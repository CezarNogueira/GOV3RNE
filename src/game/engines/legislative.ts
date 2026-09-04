import type {
  ChamberId,
  GameState,
  LegalOpinion,
  LegislativeStage,
  MinisterBriefing,
  NegotiationOption,
  NegotiationOptionId,
  Policy,
  PolicyImpact,
  ProposalAnalysis,
  PublicCharacter,
  PublicReactionEntry,
  VotePrediction,
  VoteResult,
} from '../types/index';
import { PARTY_BY_ID, TOTAL_CHAMBER_SEATS, TOTAL_SENATE_SEATS } from '../data/parties';
import { MINISTRY_BY_ID } from '../data/ministries';
import { SOCIAL_GROUP_BY_ID } from '../data/social-groups';
import { CELEBRITIES, CITIZENS } from '../data/public-figures';
import { MEASURE_TYPE_CONFIG } from '../data/measure-types';
import { INSTRUMENT_RULES } from './policy';
import { blocPropensity, plenaryMultiplier } from './congress';
import { nudgeApproval } from './approval';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { makeId } from '../utils/id';

/**
 * MOTOR LEGISLATIVO
 *
 * Cobre tudo que acontece entre assinar uma medida e ela virar norma: o
 * parecer jurídico e a fala do ministro na Leitura do Gabinete, a previsão
 * de votação com faixa de incerteza, a negociação bancada a bancada, a
 * votação real (que diverge da previsão de propósito) e a reação do país
 * depois que a medida entra em vigor.
 *
 * `status` (em `types/policy.ts`) continua a fonte de verdade grossa que o
 * resto do jogo já lê. `stage` é só a fase fina dentro de "tramitando" que
 * esta interface usa para saber qual tela mostrar.
 */

// ---------------------------------------------------------------------------
// FASE 1 — Leitura do Gabinete
// ---------------------------------------------------------------------------

/** Parecer jurídico lido antes de assinar. Puramente derivado do risco já calculado pelo intérprete. */
export function buildLegalOpinion(analysis: ProposalAnalysis): LegalOpinion {
  const rules = INSTRUMENT_RULES[analysis.instrument];
  const risk = analysis.legalRisk;

  if (risk < 25) {
    return {
      clear: true,
      severity: 'baixa',
      explanation: 'Sem obstáculo jurídico identificado. O instrumento escolhido comporta a matéria.',
      blocksImmediateIssue: false,
    };
  }

  if (risk < 55) {
    return {
      clear: true,
      severity: 'media',
      explanation:
        'Não há impedimento formal, mas o texto se aproxima do limite do que este instrumento alcança. Judicialização é possível depois de vigente.',
      blocksImmediateIssue: false,
    };
  }

  const overreach = !rules.needsVote;
  return {
    clear: false,
    severity: 'alta',
    explanation: overreach
      ? `Risco de excesso de poder regulamentar: ${rules.label.toLowerCase()} não deveria tratar de matéria com este alcance sem passar pelo Congresso. Alta chance de suspensão liminar.`
      : 'Risco jurídico alto. A Casa Civil recomenda revisão do texto antes de seguir — mas a decisão final é sua.',
    blocksImmediateIssue: overreach,
  };
}

const STANCE_OPENER: Record<'favoravel' | 'cauteloso' | 'contrario', readonly string[]> = {
  favoravel: [
    'A pasta já vinha pedindo isso. Pode contar com a gente para tocar.',
    'Sem ressalva por aqui — vamos operacionalizar assim que sair do papel.',
  ],
  cauteloso: [
    'Dá para tocar, mas o senhor precisa saber que a equipe vai sentir o tamanho da conta.',
    'Topamos, com uma ressalva: o cronograma que estamos entregando hoje aperta se isso entrar.',
  ],
  contrario: [
    'Vou falar com franqueza: não recomendo assinar assim, o risco é maior do que parece no papel.',
    'A pasta cumpre o que for assinado, mas registro que o parecer técnico aqui é contrário.',
  ],
};

const MINISTRY_TOPIC: Partial<Record<Policy['category'], string>> = {
  economia: 'o impacto no caixa e no mercado',
  saude: 'a fila e o orçamento da rede',
  educacao: 'o calendário letivo e os professores',
  seguranca: 'o efetivo e o equipamento nas ruas',
  infraestrutura: 'o cronograma de obras já em andamento',
  social: 'quem já está cadastrado nos programas',
  meio_ambiente: 'a fiscalização e o licenciamento',
  institucional: 'a estrutura administrativa da pasta',
  diplomacia: 'a repercussão com os parceiros comerciais',
  agricultura: 'a safra e o crédito rural',
  trabalho: 'a folha de pagamento e os sindicatos',
  cultura: 'os editais e os equipamentos culturais',
};

/** Fala do ministro da pasta responsável, ouvida sob pedido antes de assinar. Não usa RNG do jogo: é ilustrativo, não afeta a simulação. */
export function ministerBriefing(state: GameState, analysis: ProposalAnalysis): MinisterBriefing | null {
  const ministryId =
    analysis.affectedMinistries[0] ??
    Object.values(MINISTRY_BY_ID).find((ministry) => ministry.categories.includes(analysis.category))?.id;
  if (!ministryId) return null;

  const minister = state.government.ministers.find((entry) => entry.ministryId === ministryId);
  if (!minister) return null;

  const costInBillions = analysis.estimatedCost / 1e9;
  const stance: 'favoravel' | 'cauteloso' | 'contrario' =
    analysis.legalRisk > 55 || analysis.estimatedOpposition > 55
      ? 'contrario'
      : costInBillions > 20 || analysis.legalRisk > 30
        ? 'cauteloso'
        : 'favoravel';

  const seedText = `${minister.id}_${analysis.title}`;
  const opener = STANCE_OPENER[stance][hashPick(seedText, STANCE_OPENER[stance].length)];
  const topic = MINISTRY_TOPIC[analysis.category] ?? 'os desdobramentos práticos disso';

  return {
    ministryId,
    ministerName: minister.name,
    quote: `${opener} O que mais me preocupa agora é ${topic}.`,
    stance,
  };
}

/** Hash determinístico simples, só para variar texto ilustrativo sem consumir o RNG da partida. */
function hashPick(text: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % Math.max(1, modulo);
}

// ---------------------------------------------------------------------------
// FASE 2/3 — Previsão de votação
// ---------------------------------------------------------------------------

function dealBonusByParty(policy: Policy): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const deal of policy.deals) {
    totals[deal.partyId] = (totals[deal.partyId] ?? 0) + deal.votesDelta;
  }
  return totals;
}

function seatsFor(house: ChamberId, chamberSeats: number, senateSeats: number): number {
  return house === 'camara' ? chamberSeats : senateSeats;
}

function requiredSeats(house: ChamberId, quorum: number): number {
  return Math.ceil((house === 'camara' ? TOTAL_CHAMBER_SEATS : TOTAL_SENATE_SEATS) * quorum);
}

/**
 * Previsão determinística (sem RNG) da votação numa Casa. Nunca é o número
 * final: a interface deve sempre exibir a faixa `favorLow`-`favorHigh`.
 */
export function predictHouseVote(state: GameState, policy: Policy, house: ChamberId): VotePrediction {
  const bonusByParty = dealBonusByParty(policy);
  const multiplier = plenaryMultiplier(state);

  let favor = 0;
  let against = 0;
  let totalSeats = 0;
  const parties = state.congress.blocs
    .map((bloc) => {
      const seats = seatsFor(house, bloc.chamberSeats, bloc.senateSeats);
      if (seats <= 0) return null;
      totalSeats += seats;

      const base = blocPropensity(state, bloc, policy);
      const bonus = bonusByParty[bloc.partyId] ?? 0;
      const propensity = clamp100(base + bonus) * multiplier;
      const cohesion = 0.45 + bloc.discipline / 200;
      const yesShare = clamp((propensity / 100) * cohesion, 0, 1);
      const abstainShare = clamp((1 - cohesion) * 0.35 + 0.04, 0, 0.4);

      const favorSeats = Math.round(seats * yesShare);
      const undecidedSeats = Math.round(seats * abstainShare);
      const againstSeats = Math.max(0, seats - favorSeats - undecidedSeats);

      favor += favorSeats;
      against += againstSeats;

      return {
        partyId: bloc.partyId,
        seats,
        favorSeats,
        againstSeats,
        undecidedSeats,
        dealCount: policy.deals.filter((deal) => deal.partyId === bloc.partyId).length,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const undecided = Math.max(0, totalSeats - favor - against);
  const required = requiredSeats(house, policy.requiredQuorum);

  return {
    house,
    totalSeats,
    required,
    favor,
    against,
    undecided,
    favorLow: Math.max(0, Math.round(favor * 0.8)),
    favorHigh: Math.min(totalSeats, Math.round(favor * 1.2)),
    parties,
  };
}

// ---------------------------------------------------------------------------
// Negociação bancada a bancada
// ---------------------------------------------------------------------------

interface OptionBlueprint {
  id: NegotiationOptionId;
  label: string;
  description: string;
  costPerSeat: number;
  approvalCost: number;
  corruptionCost: number;
  baseVotes: number;
}

const OPTION_BLUEPRINTS: readonly OptionBlueprint[] = [
  {
    id: 'liberar_emenda',
    label: 'Liberar emenda parlamentar',
    description: 'Repasse direto para os redutos da bancada.',
    costPerSeat: 0.35,
    approvalCost: 0,
    corruptionCost: 0,
    baseVotes: 8,
  },
  {
    id: 'destinar_recursos_regionais',
    label: 'Destinar recursos regionais',
    description: 'Verba carimbada para o estado onde a bancada é mais forte.',
    costPerSeat: 0.5,
    approvalCost: 0,
    corruptionCost: 0,
    baseVotes: 10,
  },
  {
    id: 'alterar_trecho',
    label: 'Alterar trecho da medida',
    description: 'Reescreve parte do texto para acomodar a objeção da bancada.',
    costPerSeat: 0,
    approvalCost: 0,
    corruptionCost: 0,
    baseVotes: 14,
  },
  {
    id: 'nomear_aliado',
    label: 'Nomear aliado indicado pela bancada',
    description: 'Um cargo de confiança em troca do apoio declarado.',
    costPerSeat: 0,
    approvalCost: 1.5,
    corruptionCost: 0,
    baseVotes: 9,
  },
  {
    id: 'criar_programa_regional',
    label: 'Criar programa regional',
    description: 'Programa novo, com placa, no reduto eleitoral da bancada.',
    costPerSeat: 0.6,
    approvalCost: 0,
    corruptionCost: 0,
    baseVotes: 11,
  },
  {
    id: 'concessao_politica',
    label: 'Concessão política',
    description: 'Um acordo de bastidor que ninguém vai anunciar em nota oficial.',
    costPerSeat: 0.3,
    approvalCost: 0,
    corruptionCost: 1,
    baseVotes: 13,
  },
  {
    id: 'prioridade_outro_projeto',
    label: 'Prioridade a outro projeto',
    description: 'Compromisso de pautar, no próximo mês, um projeto de interesse da bancada.',
    costPerSeat: 0,
    approvalCost: 0,
    corruptionCost: 0,
    baseVotes: 6,
  },
];

function houseFromStage(stage: LegislativeStage | undefined): ChamberId | null {
  if (stage === 'negociacao_camara') return 'camara';
  if (stage === 'negociacao_senado') return 'senado';
  return null;
}

/**
 * Efetividade da negociação com uma bancada específica: quanto mais distante
 * ideologicamente do governo, mais disciplinada, e quanto mais acordos já
 * fechados nesta mesma medida, menos vale a próxima oferta. É isto que
 * impede comprar o plenário inteiro com dinheiro.
 */
function negotiationEffectiveness(state: GameState, policy: Policy, partyId: string): number {
  const party = PARTY_BY_ID[partyId];
  const government = state.party;
  if (!party) return 0;

  const ideologicalGap =
    Math.abs(party.ideology.economic - government.ideology.economic) +
    Math.abs(party.ideology.social - government.ideology.social);
  const resistance = clamp(1 - ideologicalGap / 500, 0.25, 1);

  const bloc = state.congress.blocs.find((entry) => entry.partyId === partyId);
  const disciplineDamping = clamp(1 - ((bloc?.discipline ?? 50) - 40) / 160, 0.5, 1.15);

  const priorDeals = policy.deals.filter((deal) => deal.partyId === partyId).length;
  const fatigue = clamp(1 - priorDeals * 0.3, 0.25, 1);

  return resistance * disciplineDamping * fatigue;
}

/** Menu de negociação disponível com uma bancada, para a medida corrente. */
export function listNegotiationOptions(state: GameState, policy: Policy, partyId: string): NegotiationOption[] {
  const house = houseFromStage(policy.stage);
  if (!house) return [];

  const bloc = state.congress.blocs.find((entry) => entry.partyId === partyId);
  if (!bloc) return [];

  const seats = seatsFor(house, bloc.chamberSeats, bloc.senateSeats);
  const priorDeals = policy.deals.filter((deal) => deal.partyId === partyId).length;
  const config = MEASURE_TYPE_CONFIG[policy.instrument];
  const effectiveness = negotiationEffectiveness(state, policy, partyId);

  return OPTION_BLUEPRINTS.map((blueprint) => {
    const cost = round(blueprint.costPerSeat * Math.max(seats, 4), 2);
    const votesDelta = Math.max(0.5, round(blueprint.baseVotes * effectiveness, 1));

    let disabled = false;
    let disabledReason: string | undefined;

    if (priorDeals >= 3) {
      disabled = true;
      disabledReason = 'Esta bancada já disse tudo que tinha a dizer sobre esta matéria.';
    } else if (blueprint.id === 'alterar_trecho' && (!config.canBeModifiedByAmendment || policy.amended)) {
      disabled = true;
      disabledReason = !config.canBeModifiedByAmendment
        ? 'Este instrumento não admite emenda de texto.'
        : 'A medida já foi reformulada uma vez; não dá para alterar de novo.';
    }

    return {
      id: blueprint.id,
      label: blueprint.label,
      description: blueprint.description,
      cost,
      approvalCost: blueprint.approvalCost,
      corruptionCost: blueprint.corruptionCost,
      votesDelta,
      affordable: cost <= state.economy.treasuryCash,
      disabled,
      disabledReason,
    };
  });
}

function scaleImpacts(impacts: PolicyImpact, factor: number): PolicyImpact {
  const scaled: PolicyImpact = {};
  for (const [key, value] of Object.entries(impacts)) {
    if (typeof value === 'number') (scaled as Record<string, number>)[key] = round(value * factor, 4);
  }
  return scaled;
}

function logEvent(policy: Policy, month: number, label: string, detail: string): void {
  policy.measureLog = [...policy.measureLog, { id: makeId('log'), month, label, detail }];
}

/** Fecha um acordo de negociação com uma bancada para a medida corrente. Muta `state` diretamente. */
export function negotiateWithParty(
  state: GameState,
  policyId: string,
  partyId: string,
  optionId: NegotiationOptionId,
  rng: Rng,
): { ok: boolean; message: string } {
  const policy = state.policies.find((entry) => entry.id === policyId);
  if (!policy) return { ok: false, message: 'Medida não encontrada.' };
  if (!houseFromStage(policy.stage)) {
    return { ok: false, message: 'Esta medida não está em negociação agora.' };
  }

  const option = listNegotiationOptions(state, policy, partyId).find((entry) => entry.id === optionId);
  if (!option) return { ok: false, message: 'Opção de negociação inválida.' };
  if (option.disabled) return { ok: false, message: option.disabledReason ?? 'Opção indisponível.' };
  if (!option.affordable) return { ok: false, message: 'Não há caixa suficiente para esta negociação.' };

  state.economy.treasuryCash = round(state.economy.treasuryCash - option.cost, 2);
  if (option.cost > 0) {
    state.congress.amendmentsReleased = round(state.congress.amendmentsReleased + option.cost, 2);
    state.economy.pipeline.fiscalImpulse += option.cost * 0.6;
  }
  if (option.approvalCost > 0) {
    state.approval.overall = round(clamp100(state.approval.overall - option.approvalCost), 2);
  }
  if (option.corruptionCost > 0) {
    state.nation.corruptionPerception = round(clamp100(state.nation.corruptionPerception - option.corruptionCost), 2);
  }

  policy.deals = [
    ...policy.deals,
    {
      id: makeId('deal', rng),
      partyId,
      optionId,
      label: option.label,
      month: state.month,
      cost: option.cost,
      votesDelta: option.votesDelta,
      effectDescription: option.description,
    },
  ];

  if (optionId === 'alterar_trecho') {
    policy.impacts = scaleImpacts(policy.impacts, 0.85);
    policy.cost = round(policy.cost * 0.85, 0);
    policy.monthlyCost = round(policy.monthlyCost * 0.85, 3);
    policy.legalRisk = Math.max(0, Math.round(policy.legalRisk * 0.9));
    policy.amended = true;
  }

  const party = PARTY_BY_ID[partyId];
  logEvent(
    policy,
    state.month,
    `Acordo com ${party?.acronym ?? partyId}`,
    `${option.label}: ${option.description}`,
  );

  return {
    ok: true,
    message: `${party?.acronym ?? partyId} topou o acordo: ${option.label.toLowerCase()}.`,
  };
}

// ---------------------------------------------------------------------------
// Votação real
// ---------------------------------------------------------------------------

function tallyHouse(
  state: GameState,
  policy: Policy,
  house: ChamberId,
  rng: Rng,
): { favor: number; against: number; abstentions: number } {
  const bonusByParty = dealBonusByParty(policy);
  const multiplier = plenaryMultiplier(state);

  let favor = 0;
  let against = 0;
  let abstentions = 0;

  for (const bloc of state.congress.blocs) {
    const seats = seatsFor(house, bloc.chamberSeats, bloc.senateSeats);
    if (seats <= 0) continue;

    const base = blocPropensity(state, bloc, policy);
    const bonus = bonusByParty[bloc.partyId] ?? 0;
    const propensity = clamp100(base + bonus) * multiplier;
    const cohesion = 0.45 + bloc.discipline / 200;
    const yesShare = clamp((propensity / 100) * cohesion + rng.noise(0.05), 0, 1);
    const abstainShare = clamp((1 - cohesion) * 0.35 + rng.range(0, 0.08), 0, 0.4);

    const yes = Math.round(seats * yesShare);
    const abstain = Math.round(seats * abstainShare);
    const no = Math.max(0, seats - yes - abstain);

    favor += yes;
    abstentions += abstain;
    against += no;
  }

  return { favor, against, abstentions };
}

function buildNarrative(house: ChamberId, favor: number, required: number, passed: boolean): string {
  const houseLabel = house === 'camara' ? 'Câmara' : 'Senado';
  const margin = favor - required;
  if (passed && margin > 40) {
    return `Aprovada na ${houseLabel} com folga: ${favor} votos, ${margin} acima do necessário.`;
  }
  if (passed) {
    return `Aprovada na ${houseLabel} no fio: ${favor} votos contra ${required} necessários.`;
  }
  if (margin > -20) {
    return `Rejeitada na ${houseLabel} por ${Math.abs(margin)} votos. Faltou pouco.`;
  }
  return `Derrotada na ${houseLabel} com estrondo: ${favor} votos de ${required} necessários.`;
}

function buildRejectionFactors(state: GameState, policy: Policy, result: VoteResult): string[] {
  const factors: string[] = [];
  const totalVoting = result.favor + result.against;
  if (totalVoting > 0 && result.against / totalVoting > 0.5) {
    factors.push('Resistência da oposição foi maior do que a base conseguiu compensar.');
  }
  if (policy.cost / 1e9 > 15) {
    factors.push('Impacto fiscal elevado pesou contra, mesmo com articulação.');
  }
  if (state.approval.overall < 40) {
    factors.push('Popularidade baixa do governo esfriou votos que poderiam ter sido fáceis.');
  }
  if (policy.deals.length === 0) {
    factors.push('Nenhum acordo foi fechado com as lideranças antes da votação.');
  }
  if (state.congress.goodwill < 40) {
    factors.push('Relação desgastada com o Congresso deixou lideranças menos dispostas a entregar votos.');
  }
  if (factors.length === 0) {
    factors.push('A base simplesmente não apareceu em número suficiente no dia da votação.');
  }
  return factors;
}

/**
 * Roda a votação real numa Casa. Usa o mesmo RNG determinístico da partida,
 * então diverge da previsão (que não tem ruído) sempre que a bancada se
 * dispersa mais ou menos do que o esperado — de propósito.
 */
export function castHouseVote(
  state: GameState,
  policyId: string,
  rng: Rng,
): { ok: boolean; message: string; result?: VoteResult } {
  const policy = state.policies.find((entry) => entry.id === policyId);
  if (!policy) return { ok: false, message: 'Medida não encontrada.' };

  const house = houseFromStage(policy.stage);
  if (!house) return { ok: false, message: 'Esta medida não está pronta para votação.' };

  const config = MEASURE_TYPE_CONFIG[policy.instrument];
  const tally = tallyHouse(state, policy, house, rng);
  const required = requiredSeats(house, policy.requiredQuorum);
  const passed = tally.favor >= required;

  const result: VoteResult = {
    chamber: house,
    favor: tally.favor,
    against: tally.against,
    abstentions: tally.abstentions,
    required,
    passed,
    month: state.month,
    narrative: buildNarrative(house, tally.favor, required, passed),
  };

  if (house === 'camara') policy.chamberVote = result;
  else policy.senateVote = result;
  policy.vote = result;

  if (!passed) {
    policy.status = 'rejeitada';
    policy.stage = 'concluido';
    policy.rejectionFactors = buildRejectionFactors(state, policy, result);
    state.congress.goodwill = round(clamp100(state.congress.goodwill - 3), 1);
    logEvent(policy, state.month, `Rejeitada ${house === 'camara' ? 'na Câmara' : 'no Senado'}`, result.narrative);
  } else if (house === 'camara' && config.requiresSenate) {
    policy.stage = 'transicao_senado';
    logEvent(policy, state.month, 'Aprovada na Câmara', result.narrative);
  } else {
    policy.status = 'aprovada';
    policy.stage = 'sancao';
    logEvent(policy, state.month, `Aprovada ${house === 'camara' ? 'na Câmara' : 'no Senado'}`, result.narrative);
  }

  return { ok: true, message: result.narrative, result };
}

/** Confirma a transição para o Senado depois de aprovada na Câmara. */
export function acknowledgeSenateTransition(state: GameState, policyId: string): { ok: boolean; message: string } {
  const policy = state.policies.find((entry) => entry.id === policyId);
  if (!policy) return { ok: false, message: 'Medida não encontrada.' };
  if (policy.stage !== 'transicao_senado') return { ok: false, message: 'Não há transição pendente.' };

  policy.stage = 'negociacao_senado';
  logEvent(
    policy,
    state.month,
    'Seguiu para o Senado',
    'A matéria chega ao Senado com o resultado da Câmara já conhecido pelas lideranças.',
  );
  return { ok: true, message: 'A matéria segue para o Senado Federal.' };
}

// ---------------------------------------------------------------------------
// FASE FINAL — Reação do país
// ---------------------------------------------------------------------------

type Stance = 'positivo' | 'neutro' | 'negativo';

const REACTION_OPENER: Record<Stance, readonly string[]> = {
  positivo: [
    'Isso aí é o que eu queria ver.',
    'Vou ser sincero, gostei de "{title}".',
    'Finalmente alguém fez alguma coisa direito.',
  ],
  neutro: [
    'Vou esperar pra ver no bolso.',
    'Nem contra, nem a favor — quero ver "{title}" na prática.',
    'Bonito no discurso, vamos ver na entrega.',
  ],
  negativo: [
    'Isso não vai pegar bem comigo.',
    '"{title}" é golpe no meu bolso, sinto muito.',
    'Só vim aqui pra dizer que não gostei.',
  ],
};

function reactionFor(policy: Policy, person: PublicCharacter, rng: Rng): PublicReactionEntry {
  const group = SOCIAL_GROUP_BY_ID[person.groupId];
  const groupImpact = policy.groupImpacts.find((entry) => entry.groupId === person.groupId);
  const costInBillions = policy.cost / 1e9;

  let score = 0;
  if (groupImpact) score += groupImpact.delta * 1.4;
  if (group?.demands.includes(policy.category)) score += 6;
  score += (policy.impacts.approval ?? 0) * 2;
  if (costInBillions > 10) score -= (person.economicLean / 100) * 6;
  if (costInBillions < 0) score += (person.economicLean / 100) * 4;
  score += rng.noise(3);

  const stance: Stance = score > 3 ? 'positivo' : score < -3 ? 'negativo' : 'neutro';
  const opener = rng.pick(REACTION_OPENER[stance]).replace('{title}', policy.title);
  const closer = groupImpact
    ? groupImpact.reason
    : `Não é bem a minha pauta como ${person.role.toLowerCase()}, mas segui de olho.`;

  const approvalWeight = round(
    clamp(score / (person.celebrity ? 6 : 10), -1.5, 1.5),
    2,
  );

  return {
    personId: person.id,
    name: person.name,
    role: person.role,
    celebrity: person.celebrity,
    stance,
    quote: `${opener} ${closer}`,
    approvalWeight,
  };
}

/** Sorteia 5 cidadãos e 2 famosos (fictícios) e gera a reação de cada um à medida recém-vigente. */
export function generatePublicReaction(policy: Policy, rng: Rng): PublicReactionEntry[] {
  const citizens = rng.shuffle(CITIZENS).slice(0, 5);
  const celebrities = rng.shuffle(CELEBRITIES).slice(0, 2);
  return [...citizens, ...celebrities].map((person) => reactionFor(policy, person, rng));
}

/**
 * REAÇÃO DO PAÍS, SOB DEMANDA
 *
 * A reação já existia, mas só aparecia no fechamento do mês. Como a tramitação
 * agora acontece na hora em que o presidente assina, a reação precisa poder ser
 * revelada na hora também — é a última fase do fluxo, depois da votação.
 *
 * A função é idempotente de propósito: se a reação já foi gerada (aqui ou no
 * fechamento do mês), ela é devolvida como está e NADA é aplicado de novo. Sem
 * isso, abrir a tela duas vezes cobraria duas vezes a mesma aprovação.
 */
export interface PublicReactionOutcome {
  ok: boolean;
  message: string;
  entries: PublicReactionEntry[];
  /** Variação de aprovação aplicada agora. Zero quando já tinha sido aplicada. */
  approvalDelta: number;
  /** true quando esta chamada foi a que gerou a reação. */
  fresh: boolean;
}

/** Status em que a medida realmente produz efeito — e portanto move aprovação. */
const REACTIVE_STATUSES = new Set(['assinada', 'aprovada', 'vigente']);

export function revealPublicReaction(
  state: GameState,
  policyId: string,
  rng: Rng,
): PublicReactionOutcome {
  const policy = state.policies.find((entry) => entry.id === policyId);
  if (!policy) {
    return { ok: false, message: 'Medida não encontrada.', entries: [], approvalDelta: 0, fresh: false };
  }

  if (policy.publicReaction && policy.publicReaction.length > 0) {
    return {
      ok: true,
      message: 'A reação a esta medida já foi apurada.',
      entries: policy.publicReaction,
      approvalDelta: 0,
      fresh: false,
    };
  }

  const entries = generatePublicReaction(policy, rng);
  policy.publicReaction = entries;

  // Medida derrotada também repercute, mas não move aprovação: o país reage ao
  // que o governo ENTREGA, e uma medida rejeitada não entregou nada. O desgaste
  // da derrota já foi cobrado na votação.
  const takesEffect = REACTIVE_STATUSES.has(policy.status);
  const approvalDelta = takesEffect
    ? round(entries.reduce((total, entry) => total + entry.approvalWeight, 0) * 0.6, 2)
    : 0;

  if (approvalDelta !== 0) nudgeApproval(state, approvalDelta);

  const positive = entries.filter((entry) => entry.stance === 'positivo').length;
  const negative = entries.filter((entry) => entry.stance === 'negativo').length;
  logEvent(
    policy,
    state.month,
    'Reação do país',
    `${positive} reações positivas e ${negative} negativas entre quem opinou.`,
  );

  return {
    ok: true,
    message: `${positive} a favor, ${negative} contra entre quem opinou.`,
    entries,
    approvalDelta,
    fresh: true,
  };
}
