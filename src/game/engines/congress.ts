import type { GameState, PartyBloc, Policy, VoteResult } from '../types/index';
import { PARTY_BY_ID, TOTAL_CHAMBER_SEATS, TOTAL_SENATE_SEATS } from '../data/parties';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';

/**
 * MOTOR DO CONGRESSO
 *
 * Ninguém vota "no governo": cada bancada vota calculando três coisas ao mesmo
 * tempo — distância ideológica da matéria, quanto o governo já pagou, e se o
 * presidente ainda tem popularidade suficiente para valer a pena estar do lado
 * dele. Presidente popular consegue voto de graça; presidente em queda paga em
 * emenda e ainda perde.
 */

export interface VoteContext {
  /** Categoria da matéria, usada para medir afinidade com cada bancada. */
  policy: Policy;
  /** Fração de cadeiras necessária. */
  quorum: number;
}

/** Quanto uma bancada específica tende a apoiar esta matéria, 0-100. */
export function blocPropensity(state: GameState, bloc: PartyBloc, policy: Policy): number {
  const party = PARTY_BY_ID[bloc.partyId] ?? state.party;
  const government = state.party;

  // 1. Distância ideológica entre a bancada e o governo que assina a matéria.
  const ideologicalGap =
    Math.abs(party.ideology.economic - government.ideology.economic) * 0.3 +
    Math.abs(party.ideology.social - government.ideology.social) * 0.2;

  // 2. A matéria fala da prioridade da bancada?
  const priorityBonus = party.priorities.includes(policy.category) ? 12 : 0;

  // 3. PEC e lei complementar assustam mais que decreto.
  const instrumentPenalty =
    policy.instrument === 'pec' ? 22 : policy.instrument === 'projeto_lei_complementar' ? 12 : 0;

  // 4. Custo fiscal: quem é fiscalista foge de gasto, quem é distributivista corre atrás.
  const costInBillions = policy.cost / 1e9;
  const fiscalReaction = (costInBillions / 40) * (party.ideology.economic / 100) * -14;

  // 5. Popularidade do presidente: o voto mais barato é o do governo que está ganhando.
  const popularityPull = (state.approval.overall - 45) * 0.55;

  // 6. Boa vontade acumulada e emendas já pagas.
  const goodwillPull = (state.congress.goodwill - 50) * 0.35;

  return clamp100(
    bloc.support * 0.55 +
      50 -
      ideologicalGap * 0.5 +
      priorityBonus -
      instrumentPenalty +
      fiscalReaction +
      popularityPull +
      goodwillPull,
  );
}

/**
 * Roda a votação de uma matéria. Cada bancada entrega uma fração das próprias
 * cadeiras proporcional à propensão e à disciplina partidária.
 */
export function runVote(state: GameState, policy: Policy, rng: Rng): VoteResult {
  const quorum = policy.requiredQuorum;
  const isSenateToo =
    policy.instrument === 'pec' || policy.instrument === 'projeto_lei_complementar';

  // O estado físico do presidente multiplica toda votação: presidente exausto
  // perde voto que já era dele.
  const presidentMultiplier = plenaryMultiplier(state);

  let favor = 0;
  let against = 0;
  let abstentions = 0;

  for (const bloc of state.congress.blocs) {
    if (bloc.chamberSeats <= 0) continue;
    const propensity = blocPropensity(state, bloc, policy) * presidentMultiplier;

    // Bancada disciplinada converte propensão em voto quase inteiro;
    // bancada fragmentada dispersa mesmo quando quer apoiar.
    const cohesion = 0.45 + bloc.discipline / 200;
    const yesShare = clamp((propensity / 100) * cohesion + rng.noise(0.05), 0, 1);
    const abstainShare = clamp((1 - cohesion) * 0.35 + rng.range(0, 0.08), 0, 0.4);

    const yes = Math.round(bloc.chamberSeats * yesShare);
    const abstain = Math.round(bloc.chamberSeats * abstainShare);
    const no = Math.max(0, bloc.chamberSeats - yes - abstain);

    favor += yes;
    abstentions += abstain;
    against += no;
  }

  const required = Math.ceil(TOTAL_CHAMBER_SEATS * quorum);
  let passed = favor >= required;

  // PEC e LC precisam também do Senado, onde a base costuma ser menor.
  if (passed && isSenateToo) {
    const senateFavor = state.congress.blocs.reduce((total, bloc) => {
      const propensity = blocPropensity(state, bloc, policy) * presidentMultiplier;
      return total + Math.round(bloc.senateSeats * clamp(propensity / 100, 0, 1));
    }, 0);
    const senateRequired = Math.ceil(TOTAL_SENATE_SEATS * quorum);
    passed = senateFavor >= senateRequired;
  }

  return {
    chamber: isSenateToo ? 'ambas' : 'camara',
    favor,
    against,
    abstentions,
    required,
    passed,
    month: state.month,
    narrative: voteNarrative(favor, required, passed, isSenateToo),
  };
}

function voteNarrative(
  favor: number,
  required: number,
  passed: boolean,
  isSenateToo: boolean,
): string {
  const margin = favor - required;
  if (passed && margin > 60) {
    return `Aprovada com folga: ${favor} votos, ${margin} acima do necessário. O plenário não quis briga com o Planalto neste tema.`;
  }
  if (passed && margin >= 0) {
    return `Aprovada no fio: ${favor} votos contra ${required} necessários. Cada voto foi negociado individualmente${
      isSenateToo ? ' e o Senado só confirmou na madrugada' : ''
    }.`;
  }
  if (margin > -25) {
    return `Rejeitada por ${Math.abs(margin)} votos. Faltou pouco, e o governo vai passar a semana explicando por que não contou direito.`;
  }
  return `Derrotada com estrondo: ${favor} votos de ${required}. A matéria não tinha base e o Planalto foi o último a saber.`;
}

/**
 * Multiplicador do presidente em plenário. Saúde, energia e humor decidem
 * quantas reuniões ele aguenta e quanto convence em cada uma.
 */
export function plenaryMultiplier(state: GameState): number {
  const p = state.president;
  const physical = (p.health * 0.4 + p.energy * 0.4 + p.mood * 0.2) / 100;
  const negotiator = p.traits.includes('negociador') ? 0.08 : 0;
  const vindictive = p.traits.includes('vingativo') ? -0.04 : 0;
  return round(clamp(0.75 + physical * 0.35 + negotiator + vindictive, 0.6, 1.35), 2);
}

/**
 * Trabalha os votos: converte caixa em emenda e emenda em apoio. Retorna quanto
 * foi efetivamente gasto — não dá para comprar mais apoio do que o Congresso
 * está disposto a vender neste mês.
 */
export function workTheVotes(state: GameState, budget: number, rng: Rng): {
  spent: number;
  gained: number;
  narrative: string;
} {
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty];
  const available = Math.min(budget, state.economy.treasuryCash);
  if (available <= 0) {
    return {
      spent: 0,
      gained: 0,
      narrative: 'Sem caixa para liberar emenda. As lideranças ouviram, agradeceram e não prometeram nada.',
    };
  }

  // Bancadas grandes e caras primeiro: é onde o real rende mais voto.
  const targets = [...state.congress.blocs]
    .filter((bloc) => bloc.chamberSeats >= 5 && bloc.support < 90)
    .sort((a, b) => b.chamberSeats - a.chamberSeats)
    .slice(0, 6);

  let spent = 0;
  let gained = 0;

  for (const bloc of targets) {
    if (spent >= available) break;
    const slice = Math.min(available - spent, bloc.chamberSeats * 0.22 * preset.congressPrice);
    // Retorno decrescente: o segundo bilhão compra menos que o primeiro.
    const conversion = (slice / (bloc.price / 10 + 1)) * (bloc.discipline / 100) * 2.4;
    const before = bloc.support;
    bloc.support = clamp(bloc.support + conversion + rng.noise(1.2), -100, 100);
    gained += bloc.support - before;
    spent += slice;
  }

  state.economy.treasuryCash = round(state.economy.treasuryCash - spent, 2);
  state.congress.amendmentsReleased = round(state.congress.amendmentsReleased + spent, 2);
  state.congress.goodwill = round(clamp100(state.congress.goodwill + gained * 0.12), 1);

  // Emenda liberada é gasto público que aparece no primário e na percepção de corrupção.
  state.economy.pipeline.fiscalImpulse += spent * 0.6;

  return {
    spent: round(spent, 2),
    gained: round(gained, 1),
    narrative:
      spent > 0
        ? `R$ ${spent.toFixed(1)} bi em emendas liberados para ${targets.length} bancadas. O apoio subiu ${gained.toFixed(
            1,
          )} pontos e o Congresso já sabe qual é o seu preço.`
        : 'As lideranças ouviram e não se comprometeram.',
  };
}

/** Evolução mensal do humor do Congresso, sem ação do jogador. */
export function processCongress(state: GameState, rng: Rng): number {
  const before = state.congress.goodwill;
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty];

  for (const bloc of state.congress.blocs) {
    // Apoio decai naturalmente: o que foi pago no mês passado não vale hoje.
    const decay = bloc.inGovernment ? 0.6 : 1.4;
    const popularityPull = (state.approval.overall - 48) * 0.09;
    bloc.support = clamp(
      bloc.support - decay * preset.congressPrice + popularityPull + rng.noise(1.1),
      -100,
      100,
    );
  }

  // Emendas prometidas e não pagas azedam a relação.
  const pendingPenalty = state.congress.amendmentsPending * 0.35;
  const approvalPull = (state.approval.overall - 48) * 0.14;

  state.congress.goodwill = round(
    clamp100(state.congress.goodwill - 0.8 * preset.congressPrice + approvalPull - pendingPenalty + rng.noise(1)),
    1,
  );

  return round(state.congress.goodwill - before, 2);
}

/** Cadeiras que o governo consegue somar hoje, para exibir no painel. */
export function countBaseSeats(state: GameState): { chamber: number; senate: number } {
  return {
    chamber: state.congress.blocs
      .filter((bloc) => bloc.support > 45)
      .reduce((total, bloc) => total + bloc.chamberSeats, 0),
    senate: state.congress.blocs
      .filter((bloc) => bloc.support > 45)
      .reduce((total, bloc) => total + bloc.senateSeats, 0),
  };
}
