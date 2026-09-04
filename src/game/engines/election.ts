import type {
  CampaignMove,
  ElectionCandidate,
  ElectionPoll,
  ElectionRound,
  ElectionRoundResult,
  ElectionState,
  GameState,
  PartyProfile,
  Region,
} from '../types/index';
import { REGIONS } from '../types/common';
import { CAMPAIGN_MOVES, CAMPAIGN_MOVE_BY_ID } from '../data/campaign';
import { PARTY_BY_ID, TOTAL_CHAMBER_SEATS } from '../data/parties';
import { FIRST_NAMES, LAST_NAMES, OPPOSITION_LEADERS } from '../data/people';
import { MAX_PROMISES, PROMISE_CATALOG } from '../data/promises';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { nudgeGroup } from './social';
import { resetPromiseBaselines } from './promises';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { makeId, monthLabel } from '../utils/index';

/**
 * A ELEIÇÃO
 *
 * O mandato pode não acabar no mês 48. No quarto ano o presidente decide se
 * disputa a reeleição, e quem decide a disputa é o país que ele construiu:
 * aprovação de cada grupo social, preço da comida, emprego, promessa cumprida,
 * escândalo, tamanho da base e o adversário que passou quatro anos batendo
 * nele — o mesmo líder da oposição que aparece no Painel desde o primeiro mês.
 *
 * Três coisas são regra de desenho aqui:
 *
 *   1. NÃO EXISTE VITÓRIA POR SORTEIO. O resultado sai do estado da partida. O
 *      acaso entra como margem de erro da pesquisa e imprevisto de urna, na
 *      ordem de um ponto — nunca como o fator que decide.
 *   2. APROVAÇÃO NÃO É VOTO, MAS É QUASE TUDO. A conversão passa por bolso,
 *      rejeição e afinidade de cada grupo com o partido do adversário, e a
 *      eleição amplifica diferenças: quem está em 60 de aprovação ganha no
 *      primeiro turno, quem está em 30 perde feio, e o meio vai a segundo turno.
 *   3. CAMPANHA CUSTA GOVERNO. Cada movimento consome agenda e energia que
 *      deixam de ser usadas para governar, e escolhe um lado do eleitorado.
 *
 * Calendário: definição no mês 40 (abril do quarto ano), campanha até outubro,
 * primeiro turno no mês 46 e segundo turno no mês 47. Na vida real os dois
 * turnos cabem em outubro; aqui o mês é a unidade de tempo, e separá-los deixa
 * o jogador jogar o intervalo entre eles.
 */

/** Meses antes do fim do mandato em que cada etapa acontece. */
const DECISION_LEAD = 8;
const FIRST_ROUND_LEAD = 2;
const RUNOFF_LEAD = 1;

/** Eleitorado apto, em milhões. Parâmetro de simulação. */
const ELECTORATE_MILLIONS = 156;

/** Institutos de pesquisa fictícios, como o resto do elenco do jogo. */
const POLL_INSTITUTES = ['Instituto Aurora', 'Datacenso', 'Vox Brasil', 'Meridiano Pesquisas'];

export interface ElectionCalendar {
  decisionMonth: number;
  electionMonth: number;
  runoffMonth: number;
}

export function electionCalendar(state: GameState): ElectionCalendar {
  return {
    decisionMonth: state.totalMonths - DECISION_LEAD,
    electionMonth: state.totalMonths - FIRST_ROUND_LEAD,
    runoffMonth: state.totalMonths - RUNOFF_LEAD,
  };
}

/**
 * Só há eleição para quem ainda pode disputar: a Constituição permite uma
 * reeleição e uma só, então o segundo mandato termina no mês 96 sem urna.
 */
export function canRunForReelection(state: GameState): boolean {
  return state.settings.reelection && state.term === 1;
}

// ---------------------------------------------------------------------------
// Candidatos
// ---------------------------------------------------------------------------

function partyOf(id: string): PartyProfile | undefined {
  return PARTY_BY_ID[id];
}

function emptyRegions(value = 0): Record<Region, number> {
  return REGIONS.reduce(
    (acc, region) => ({ ...acc, [region]: value }),
    {} as Record<Region, number>,
  );
}

/** O presidente como candidato: ele já tem partido, ideologia e biografia. */
function buildIncumbent(state: GameState): ElectionCandidate {
  return {
    id: 'incumbente',
    name: state.president.politicalName,
    partyId: state.party.id,
    partyAcronym: state.party.acronym,
    partyColor: state.party.color,
    role: 'presidente da República, candidato à reeleição',
    incumbent: true,
    ideology: { ...state.party.ideology },
    bio: `Governa desde ${state.startYear} e disputa o segundo mandato com ${state.approval.overall.toFixed(
      0,
    )}% de aprovação.`,
    polling: 0,
    rejection: 0,
    byGroup: {},
    byRegion: emptyRegions(),
  };
}

/**
 * O adversário não é inventado na hora da eleição: é o líder da oposição que
 * vem incomodando o governo desde o primeiro mês, com o partido dele e a
 * estratégia que ele escolheu ao longo do mandato.
 */
function buildChallenger(state: GameState, rng: Rng): ElectionCandidate {
  const opposition = state.government.opposition;
  const party =
    partyOf(opposition.leaderParty) ??
    partyOf(rng.pick(OPPOSITION_LEADERS.filter((l) => l.party !== state.party.id)).party);

  const strategyLabel: Record<string, string> = {
    desgaste: 'construiu a candidatura em cima do desgaste do governo',
    obstrucao: 'travou o Congresso por quatro anos e chega como o nome do "basta"',
    institucional: 'fez oposição no Supremo e nos tribunais, e chega com verniz de moderação',
    ruptura: 'radicalizou o discurso e chega com base fiel e rejeição alta',
  };

  return {
    id: 'oposicao',
    name: opposition.leaderName,
    partyId: party?.id ?? 'PL',
    partyAcronym: party?.acronym ?? 'PL',
    partyColor: party?.color ?? '#9ca3af',
    role: 'líder da oposição',
    incumbent: false,
    ideology: party ? { ...party.ideology } : { economic: 20, social: 30, institutional: 40 },
    bio: `${opposition.leaderName} ${strategyLabel[opposition.strategy] ?? 'disputa a Presidência'}.`,
    polling: 0,
    rejection: 0,
    byGroup: {},
    byRegion: emptyRegions(),
  };
}

// ---------------------------------------------------------------------------
// O cálculo da intenção de voto
// ---------------------------------------------------------------------------

export interface IntentionSnapshot {
  /** Intenção nacional, % do eleitorado. */
  incumbent: number;
  challenger: number;
  /** Outros candidatos, brancos, nulos e indecisos. */
  others: number;
  incumbentByGroup: Record<string, number>;
  challengerByGroup: Record<string, number>;
  incumbentByRegion: Record<Region, number>;
  challengerByRegion: Record<Region, number>;
  /** Componentes nacionais, para a tela explicar de onde veio o número. */
  drivers: { label: string; value: number }[];
}

/** Média das últimas aprovações: o eleitor cobra o mandato, não só o mês. */
function approvalMemory(state: GameState): number {
  const history = state.approval.history ?? [];
  const window = history.slice(-12);
  if (window.length === 0) return state.approval.overall;
  return window.reduce((total, value) => total + value, 0) / window.length;
}

/** Soma dos efeitos de campanha já executados sobre a intenção do presidente. */
function campaignPull(election: ElectionState | null): number {
  if (!election) return 0;
  return election.moves.reduce((total, move) => total + move.intentionDelta, 0);
}

/**
 * O que a aprovação não explica sozinha: bolso, entrega, integridade e máquina.
 * Tudo em pontos percentuais somados à intenção do presidente.
 */
function nationalDrivers(state: GameState): { label: string; value: number }[] {
  const eco = state.economy;

  const pocket = clamp(
    (eco.inflationTarget + 1 - eco.inflation) * 0.9 +
      (8 - eco.unemployment) * 0.8 +
      (eco.gdpGrowth - 1.5) * 0.6,
    -9,
    9,
  );

  const kept = state.promises.filter((promise) => promise.status === 'cumprida').length;
  const broken = state.promises.filter((promise) => promise.status === 'quebrada').length;
  const promises = kept * 1.3 - broken * 1;

  const integrity = clamp((state.nation.corruptionPerception - 50) * 0.07, -4, 4);

  const machine = clamp(
    (state.congress.governmentSeatsChamber / 513 - 0.3) * 6 + (state.approval.governors - 45) * 0.04,
    -3.5,
    4,
  );

  const institutional = -clamp(state.congress.impeachmentRisk * 0.05, 0, 5);

  return [
    { label: 'Bolso do eleitor', value: round(pocket, 2) },
    { label: 'Promessas de campanha', value: round(promises, 2) },
    { label: 'Integridade', value: round(integrity, 2) },
    { label: 'Máquina e palanque', value: round(machine, 2) },
    { label: 'Crise institucional', value: round(institutional, 2) },
  ];
}

/**
 * Converte aprovação em intenção de voto, grupo por grupo.
 *
 * A conta é a mesma para os dois candidatos e não sorteia nada: a única fonte
 * de acaso é a pesquisa, que publica este número com margem de erro.
 */
export function computeIntention(state: GameState): IntentionSnapshot {
  const election = state.election;
  const challengerParty = election?.candidates.find((c) => !c.incumbent)?.partyId;
  const rivalParty = challengerParty ? partyOf(challengerParty) : undefined;
  const memory = approvalMemory(state);
  const drivers = nationalDrivers(state);
  const national =
    drivers.reduce((total, driver) => total + driver.value, 0) + campaignPull(election);

  const oppositionPull = (state.government.opposition.strength - 40) * 0.1;

  const incumbentByGroup: Record<string, number> = {};
  const challengerByGroup: Record<string, number> = {};
  let incumbentTotal = 0;
  let challengerTotal = 0;
  let weightTotal = 0;

  for (const group of state.socialGroups) {
    const base = group.approval * 0.6 + state.approval.personal * 0.25 + memory * 0.15;
    // Eleição polariza: a diferença em relação ao meio é amplificada.
    const raw = 50 + (base - 50) * 1.15 + national;

    const rivalAffinity =
      (rivalParty?.socialBase.includes(group.id) ? 9 : 0) -
      (state.party.socialBase.includes(group.id) ? 6 : 0) +
      oppositionPull;

    const incumbent = clamp(raw, 2, 92);
    const challenger = clamp((100 - incumbent) * 0.58 + rivalAffinity, 2, 92);
    const [normalizedIncumbent, normalizedChallenger] = normalize(incumbent, challenger);

    incumbentByGroup[group.id] = round(normalizedIncumbent, 1);
    challengerByGroup[group.id] = round(normalizedChallenger, 1);

    const weight = group.electorateShare;
    incumbentTotal += normalizedIncumbent * weight;
    challengerTotal += normalizedChallenger * weight;
    weightTotal += weight;
  }

  const incumbentByRegion = emptyRegions();
  const challengerByRegion = emptyRegions();
  for (const region of REGIONS) {
    const regional = state.approval.byRegion[region] ?? state.approval.overall;
    const base = regional * 0.75 + state.approval.personal * 0.25;
    const raw = 50 + (base - 50) * 1.15 + national;
    const rivalRegion = ((rivalParty?.regionalStrength?.[region] ?? 45) - 45) * 0.12;
    const incumbent = clamp(raw, 2, 92);
    const challenger = clamp((100 - incumbent) * 0.58 + rivalRegion + oppositionPull, 2, 92);
    const [ni, nc] = normalize(incumbent, challenger);
    incumbentByRegion[region] = round(ni, 1);
    challengerByRegion[region] = round(nc, 1);
  }

  const incumbent = round(incumbentTotal / Math.max(1, weightTotal), 1);
  const challenger = round(challengerTotal / Math.max(1, weightTotal), 1);

  return {
    incumbent,
    challenger,
    others: round(Math.max(0, 100 - incumbent - challenger), 1),
    incumbentByGroup,
    challengerByGroup,
    incumbentByRegion,
    challengerByRegion,
    drivers,
  };
}

/**
 * Normaliza a disputa deixando espaço para quem não está em nenhum dos dois
 * lados: candidato nanico, branco, nulo e indeciso sempre existem.
 *
 * O tamanho desse espaço é o que faz o segundo turno ser a regra e não a
 * exceção, como na eleição brasileira: com um terceiro nome relevante na
 * disputa, passar de 50% no primeiro turno exige um governo claramente bem
 * avaliado, não um governo apenas empatado.
 */
function normalize(incumbent: number, challenger: number): [number, number] {
  const floor = 14;
  const total = incumbent + challenger + floor;
  return [(incumbent / total) * 100, (challenger / total) * 100];
}

/** Rejeição de cada lado. É ela que decide o segundo turno. */
export function rejectionOf(state: GameState): { incumbent: number; challenger: number } {
  const opposition = state.government.opposition;
  const incumbent = clamp(
    100 - state.approval.overall * 0.72 - state.approval.personal * 0.18 - 6 +
      (50 - state.nation.corruptionPerception) * 0.12 +
      (state.election?.moves.reduce((total, move) => {
        const template = CAMPAIGN_MOVE_BY_ID[move.moveId];
        return total + (template?.ownRejection ?? 0);
      }, 0) ?? 0),
    14,
    82,
  );

  const strategyRejection =
    opposition.strategy === 'ruptura'
      ? 16
      : opposition.strategy === 'obstrucao'
        ? 8
        : opposition.strategy === 'desgaste'
          ? 4
          : 0;

  const challenger = clamp(
    30 + strategyRejection - (opposition.strength - 40) * 0.08 + (50 - state.approval.overall) * 0.05,
    14,
    82,
  );

  return { incumbent: round(incumbent, 1), challenger: round(challenger, 1) };
}

// ---------------------------------------------------------------------------
// Abertura da disputa e decisão de concorrer
// ---------------------------------------------------------------------------

export function openElection(state: GameState, rng: Rng): ElectionState {
  const calendar = electionCalendar(state);
  const election: ElectionState = {
    stage: 'definicao',
    termAtStake: state.term + 1,
    electionMonth: calendar.electionMonth,
    decisionMonth: calendar.decisionMonth,
    running: null,
    candidates: [buildIncumbent(state), buildChallenger(state, rng)],
    polls: [],
    rounds: [],
    moves: [],
    outcome: null,
    summary: null,
  };
  state.election = election;
  refreshCandidates(state);
  return election;
}

export interface ElectionActionOutcome {
  ok: boolean;
  message: string;
}

/**
 * O presidente diz se disputa. Não disputar é uma decisão legítima: encerra o
 * mandato no mês 48 com o governo inteiro entregue, sem o desgaste da campanha.
 */
export function decideCandidacy(state: GameState, running: boolean): ElectionActionOutcome {
  const election = state.election;
  if (!election) return { ok: false, message: 'Não há eleição em curso.' };
  if (election.running !== null) {
    return { ok: false, message: 'A decisão sobre a candidatura já foi tomada.' };
  }
  if (election.stage !== 'definicao') {
    return { ok: false, message: 'O prazo de registro da candidatura já passou.' };
  }

  election.running = running;

  if (!running) {
    election.stage = 'apurada';
    election.outcome = 'nao_concorreu';
    election.summary = `${state.president.politicalName} anunciou que não disputaria a reeleição e entregaria o cargo ao fim do mandato.`;
    // Presidente que não disputa perde o que ainda tinha de força no Congresso:
    // ninguém negocia com quem já tem data para ir embora.
    state.congress.goodwill = round(clamp100(state.congress.goodwill - 6), 1);
    state.government.opposition.strength = round(
      clamp100(state.government.opposition.strength + 8),
      1,
    );
    return {
      ok: true,
      message:
        'Você anunciou que não disputa a reeleição. O mandato segue até o último dia, mas o Congresso já começou a olhar para o sucessor.',
    };
  }

  election.stage = 'campanha';
  refreshCandidates(state);
  return {
    ok: true,
    message: `Candidatura à reeleição lançada. A disputa contra ${
      election.candidates.find((c) => !c.incumbent)?.name ?? 'a oposição'
    } começa agora.`,
  };
}

// ---------------------------------------------------------------------------
// Campanha
// ---------------------------------------------------------------------------

export function availableCampaignMoves(state: GameState): CampaignMove[] {
  const used = new Set(state.election?.moves.map((move) => move.moveId) ?? []);
  return CAMPAIGN_MOVES.filter((move) => !used.has(move.id));
}

/**
 * Executa um movimento de campanha.
 *
 * O efeito não é fixo: ele depende de quem é o presidente (carisma, energia) e
 * de quanto a campanha arrisca. Um debate pode render quatro pontos ou custar
 * dois — e é essa a razão de ele existir.
 */
export function runCampaignMove(
  state: GameState,
  moveId: string,
  rng: Rng,
): ElectionActionOutcome {
  const election = state.election;
  const move = CAMPAIGN_MOVE_BY_ID[moveId];
  if (!election || !move) return { ok: false, message: 'Movimento de campanha desconhecido.' };
  if (election.running !== true) {
    return { ok: false, message: 'Você não é candidato nesta eleição.' };
  }
  if (election.stage !== 'campanha' && election.stage !== 'entre_turnos') {
    return { ok: false, message: 'A campanha não está em curso.' };
  }
  if (election.moves.some((entry) => entry.moveId === moveId)) {
    return { ok: false, message: 'Esse movimento já foi usado nesta campanha.' };
  }
  if (state.agenda.points < move.agendaCost) {
    return {
      ok: false,
      message: `${move.label} custa ${move.agendaCost} ponto(s) de agenda e restam ${state.agenda.points}.`,
    };
  }

  state.agenda.points -= move.agendaCost;
  state.president.energy = round(clamp100(state.president.energy - move.energyCost), 1);

  // Preparo do presidente: carisma e energia decidem se o palco ajuda ou atrapalha.
  const readiness =
    (state.president.traits.includes('carismatico') ? 18 : 0) +
    (state.president.traits.includes('populista') ? 8 : 0) +
    (state.president.energy - 55) * 0.4 +
    (state.approval.personal - 45) * 0.25;

  const luck = rng.noise(1) * (move.volatility / 100) * 3.2;
  const swing = clamp(readiness / 45, -1, 1) * (move.volatility / 100) * 2.4;
  const delta = round(move.intention + swing + luck, 2);

  for (const target of move.pleases) nudgeGroup(state.socialGroups, target.groupId, target.delta);
  for (const target of move.angers) nudgeGroup(state.socialGroups, target.groupId, target.delta);

  if (moveId === 'alianca_centro') {
    // Aliança não é só voto: é bancada no mandato seguinte.
    state.congress.goodwill = round(clamp100(state.congress.goodwill + 4), 1);
  }

  const narrative =
    delta >= move.intention + 0.6
      ? `${move.label}: saiu melhor do que a campanha esperava (+${delta.toFixed(1)} p.p.).`
      : delta <= move.intention - 0.6
        ? `${move.label}: não pegou como deveria (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} p.p.).`
        : `${move.label}: efeito dentro do previsto (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} p.p.).`;

  election.moves.push({
    moveId,
    label: move.label,
    month: state.month,
    intentionDelta: delta,
    narrative,
  });

  refreshCandidates(state);

  return { ok: true, message: narrative };
}

// ---------------------------------------------------------------------------
// Pesquisas
// ---------------------------------------------------------------------------

/** Atualiza a intenção real de cada candidato dentro do estado. */
function refreshCandidates(state: GameState): IntentionSnapshot {
  const election = state.election;
  const snapshot = computeIntention(state);
  if (!election) return snapshot;

  const rejection = rejectionOf(state);
  for (const candidate of election.candidates) {
    if (candidate.incumbent) {
      candidate.polling = snapshot.incumbent;
      candidate.rejection = rejection.incumbent;
      candidate.byGroup = snapshot.incumbentByGroup;
      candidate.byRegion = snapshot.incumbentByRegion;
    } else {
      candidate.polling = snapshot.challenger;
      candidate.rejection = rejection.challenger;
      candidate.byGroup = snapshot.challengerByGroup;
      candidate.byRegion = snapshot.challengerByRegion;
    }
  }
  return snapshot;
}

/**
 * Publica a pesquisa do mês.
 *
 * O que o jogador lê NÃO é o número real: é o número real com margem de erro,
 * porque pesquisa erra. A apuração usa o número real — e é por isso que uma
 * eleição pode ser ganha por quem aparecia dois pontos atrás.
 */
export function publishPoll(state: GameState, rng: Rng): ElectionPoll | null {
  const election = state.election;
  if (!election) return null;

  const snapshot = refreshCandidates(state);
  const margin = 2.2;
  const byCandidate: Record<string, number> = {};
  for (const candidate of election.candidates) {
    const real = candidate.incumbent ? snapshot.incumbent : snapshot.challenger;
    byCandidate[candidate.id] = round(clamp(real + rng.noise(margin * 0.7), 1, 97), 1);
  }

  const poll: ElectionPoll = {
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    institute: rng.pick(POLL_INSTITUTES),
    byCandidate,
    undecided: round(
      Math.max(
        0,
        100 - Object.values(byCandidate).reduce((total, value) => total + value, 0),
      ),
      1,
    ),
    margin,
  };

  election.polls = [poll, ...election.polls].slice(0, 12);
  return poll;
}

// ---------------------------------------------------------------------------
// Apuração
// ---------------------------------------------------------------------------

function buildRound(
  state: GameState,
  round: 1 | 2,
  shares: { candidateId: string; name: string; party: string; share: number }[],
  turnout: number,
  blankAndNull: number,
): ElectionRound {
  const voters = ELECTORATE_MILLIONS * (turnout / 100);
  const valid = voters * (1 - blankAndNull / 100);

  const results: ElectionRoundResult[] = shares
    .map((entry) => ({
      candidateId: entry.candidateId,
      name: entry.name,
      party: entry.party,
      share: round2(entry.share),
      votes: round2((valid * entry.share) / 100),
    }))
    .sort((a, b) => b.share - a.share);

  const leader = results[0]!;
  const runnerUp = results[1];
  const decided = round === 2 || leader.share > 50;

  const narrative = decided
    ? `${leader.name} (${leader.party}) venceu ${round === 2 ? 'o segundo turno' : 'no primeiro turno'} com ${leader.share.toFixed(
        2,
      )}% dos votos válidos, contra ${runnerUp?.share.toFixed(2) ?? '0'}% de ${runnerUp?.name ?? '—'}.`
    : `Ninguém passou de 50%: ${leader.name} (${leader.share.toFixed(2)}%) e ${
        runnerUp?.name ?? '—'
      } (${runnerUp?.share.toFixed(2) ?? '0'}%) vão ao segundo turno.`;

  return {
    round,
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    turnout: round2(turnout),
    blankAndNull: round2(blankAndNull),
    results,
    winnerId: decided ? leader.candidateId : null,
    narrative,
  };
}

function round2(value: number): number {
  return round(value, 2);
}

/** Comparecimento e abstenção: eleição disputada leva mais gente à urna. */
function turnoutOf(state: GameState, rng: Rng): { turnout: number; blankAndNull: number } {
  const competitive = 100 - Math.abs((state.election?.candidates[0]?.polling ?? 50) - 50);
  return {
    turnout: clamp(74 + competitive * 0.04 + rng.noise(1.2), 66, 88),
    blankAndNull: clamp(6 + (60 - state.approval.overall) * 0.07 + rng.noise(0.8), 3.5, 15),
  };
}

/** Primeiro turno. Sai daqui um presidente eleito ou dois nomes para outubro. */
export function resolveFirstRound(state: GameState, rng: Rng): ElectionRound | null {
  const election = state.election;
  if (!election || election.running !== true) return null;

  const snapshot = refreshCandidates(state);
  const { turnout, blankAndNull } = turnoutOf(state, rng);

  // Imprevisto de urna: pequeno de propósito. A eleição é decidida pelo país,
  // não pelo sorteio do dia.
  const surprise = rng.noise(0.9);
  const incumbent = clamp(snapshot.incumbent + surprise, 1, 97);
  const challenger = clamp(snapshot.challenger - surprise * 0.6, 1, 97);
  // Quem não está com nenhum dos dois: candidatos nanicos disputam o mesmo voto.
  const others = Math.max(2, 100 - incumbent - challenger);
  const validTotal = incumbent + challenger + others;

  const incumbentCandidate = election.candidates.find((c) => c.incumbent)!;
  const challengerCandidate = election.candidates.find((c) => !c.incumbent)!;

  const result = buildRound(
    state,
    1,
    [
      {
        candidateId: incumbentCandidate.id,
        name: incumbentCandidate.name,
        party: incumbentCandidate.partyAcronym,
        share: (incumbent / validTotal) * 100,
      },
      {
        candidateId: challengerCandidate.id,
        name: challengerCandidate.name,
        party: challengerCandidate.partyAcronym,
        share: (challenger / validTotal) * 100,
      },
      {
        candidateId: 'outros',
        name: 'Demais candidatos',
        party: 'diversos',
        share: (others / validTotal) * 100,
      },
    ],
    turnout,
    blankAndNull,
  );

  election.rounds.push(result);

  if (result.winnerId) {
    finishElection(state, result.winnerId === 'incumbente');
  } else {
    election.stage = 'entre_turnos';
  }

  return result;
}

/**
 * Segundo turno. O voto dos eliminados não vai para o mais votado: vai para
 * quem o eleitor rejeita menos.
 */
export function resolveRunoff(state: GameState, rng: Rng): ElectionRound | null {
  const election = state.election;
  if (!election || election.stage !== 'entre_turnos') return null;

  const first = election.rounds.find((entry) => entry.round === 1);
  if (!first) return null;

  // Guardado ANTES de recalcular: é a diferença entre os dois momentos que
  // mede o que a campanha entre turnos conseguiu mover.
  const pollingBeforeRunoff = election.candidates.find((c) => c.incumbent)?.polling ?? 0;
  const snapshot = refreshCandidates(state);
  const rejection = rejectionOf(state);

  const freed = first.results.find((entry) => entry.candidateId === 'outros')?.share ?? 0;
  // Rejeição menor atrai mais voto órfão; parte dele simplesmente não escolhe.
  const engaged = freed * 0.82;
  const toIncumbent = engaged * (rejection.challenger / (rejection.incumbent + rejection.challenger));
  const toChallenger = engaged - toIncumbent;

  const base = first.results;
  const incumbentBase = base.find((entry) => entry.candidateId === 'incumbente')?.share ?? 0;
  const challengerBase = base.find((entry) => entry.candidateId === 'oposicao')?.share ?? 0;

  // A campanha entre turnos ainda mexe no placar.
  const movementSinceFirst = clamp(snapshot.incumbent - pollingBeforeRunoff, -4, 4);
  const surprise = rng.noise(1.1);

  const incumbent = clamp(incumbentBase + toIncumbent + movementSinceFirst + surprise, 1, 99);
  const challenger = clamp(challengerBase + toChallenger - surprise * 0.7, 1, 99);
  const total = incumbent + challenger;

  const { turnout, blankAndNull } = turnoutOf(state, rng);
  const incumbentCandidate = election.candidates.find((c) => c.incumbent)!;
  const challengerCandidate = election.candidates.find((c) => !c.incumbent)!;

  const result = buildRound(
    state,
    2,
    [
      {
        candidateId: incumbentCandidate.id,
        name: incumbentCandidate.name,
        party: incumbentCandidate.partyAcronym,
        share: (incumbent / total) * 100,
      },
      {
        candidateId: challengerCandidate.id,
        name: challengerCandidate.name,
        party: challengerCandidate.partyAcronym,
        share: (challenger / total) * 100,
      },
    ],
    turnout,
    // Segundo turno polarizado tem mais voto nulo de quem não quer nenhum dos dois.
    blankAndNull + 2.5,
  );

  election.rounds.push(result);
  finishElection(state, result.winnerId === 'incumbente');
  return result;
}

/** Fecha a eleição e faz o país reagir ao resultado antes mesmo da posse. */
function finishElection(state: GameState, won: boolean): void {
  const election = state.election;
  if (!election) return;

  election.stage = 'apurada';
  election.outcome = won ? 'venceu' : 'derrotado';

  const last = election.rounds[election.rounds.length - 1];
  election.summary = last?.narrative ?? null;

  if (won) {
    // Vitória renova o capital político: quem foi eleito de novo manda mais.
    state.approval.momentum = round(clamp(state.approval.momentum + 18, -100, 100), 1);
    state.congress.goodwill = round(clamp100(state.congress.goodwill + 8), 1);
    state.government.opposition.strength = round(
      clamp100(state.government.opposition.strength - 12),
      1,
    );
  } else {
    // Derrotado no fim do mandato é pato manco: ninguém mais precisa dele.
    state.approval.momentum = round(clamp(state.approval.momentum - 22, -100, 100), 1);
    state.congress.goodwill = round(clamp100(state.congress.goodwill - 14), 1);
    state.government.opposition.strength = round(
      clamp100(state.government.opposition.strength + 16),
      1,
    );
  }
}

// ---------------------------------------------------------------------------
// O passo mensal
// ---------------------------------------------------------------------------

/**
 * Chamado uma vez por mês, depois de a aprovação do mês estar fechada — a
 * eleição lê o país recém-calculado, nunca o do mês passado.
 */
export function processElection(state: GameState, rng: Rng): string[] {
  const notes: string[] = [];
  if (!canRunForReelection(state)) return notes;

  const calendar = electionCalendar(state);
  const election = state.election;

  // ------------------------------------------------------- abertura da janela
  if (!election) {
    if (state.month < calendar.decisionMonth) return notes;
    const opened = openElection(state, rng);
    const rival = opened.candidates.find((c) => !c.incumbent);
    notes.push(
      `A eleição de outubro entrou no calendário. O partido quer saber se você disputa a reeleição${
        rival ? `; do outro lado, ${rival.name} (${rival.partyAcronym}) já se lançou candidato.` : '.'
      }`,
    );
    return notes;
  }

  if (election.outcome) return notes;

  // -------------------------------------------------- silêncio vira registro
  // Não decidir também é decidir, mas não a ponto de perder a eleição por
  // esquecimento: o partido registra a candidatura sozinho, com o custo de uma
  // campanha que começou tarde.
  if (election.stage === 'definicao' && state.month >= calendar.decisionMonth + 2) {
    election.running = true;
    election.stage = 'campanha';
    election.moves.push({
      moveId: 'registro_tardio',
      label: 'Candidatura registrada pelo partido',
      month: state.month,
      intentionDelta: -1.5,
      narrative:
        'O partido registrou a candidatura sem que o presidente se pronunciasse. Campanha que começa tarde começa atrás.',
    });
    notes.push(
      'Sem resposta do Planalto, o partido registrou sua candidatura à reeleição. A campanha começa dois meses atrasada.',
    );
  }

  if (election.running !== true) return notes;

  // ----------------------------------------------------------------- apuração
  if (state.month === calendar.electionMonth) {
    const result = resolveFirstRound(state, rng);
    if (result) notes.push(result.narrative);
    return notes;
  }

  if (state.month === calendar.runoffMonth && election.stage === 'entre_turnos') {
    const result = resolveRunoff(state, rng);
    if (result) notes.push(result.narrative);
    return notes;
  }

  // ------------------------------------------------------------- campanha
  if (election.stage === 'campanha' || election.stage === 'entre_turnos') {
    const poll = publishPoll(state, rng);
    if (poll) {
      const incumbent = election.candidates.find((c) => c.incumbent)!;
      const challenger = election.candidates.find((c) => !c.incumbent)!;
      notes.push(
        `${poll.institute}: ${incumbent.name} ${poll.byCandidate[incumbent.id]?.toFixed(0)}%, ${
          challenger.name
        } ${poll.byCandidate[challenger.id]?.toFixed(0)}%. Margem de ${poll.margin} pontos.`,
      );
    }
  }

  return notes;
}

// ---------------------------------------------------------------------------
// A posse do segundo mandato
// ---------------------------------------------------------------------------

export interface SecondTermOutcome {
  ok: boolean;
  message: string;
}

/**
 * Renova o Congresso junto com a eleição presidencial.
 *
 * Deputado e senador são eleitos no mesmo dia que o presidente, e a onda do
 * primeiro contamina os outros: presidente reeleito com folga puxa bancada,
 * presidente reeleito no sufoco não puxa ninguém. O total de cadeiras não muda —
 * o que muda é de quem elas são.
 */
function renewCongress(state: GameState, winningShare: number, rng: Rng): number {
  const wave = clamp((winningShare - 50) * 0.014, -0.16, 0.16);

  const before = state.congress.governmentSeatsChamber;

  // O Congresso vai para onde está o poder. Quem foi reeleito com folga atrai o
  // meio — deputado eleito quer estar do lado de quem vai governar quatro anos.
  // Partido de convicção, nas pontas, quase não se move.
  for (const bloc of state.congress.blocs) {
    const openness = 1 - Math.min(1, Math.abs(bloc.support) / 140);
    bloc.support = round(clamp(bloc.support + clamp(wave * 55, -9, 9) * openness, -100, 100), 1);
  }

  const weights = state.congress.blocs.map((bloc) => {
    const alignment = clamp(bloc.support / 100, -1, 1);
    // Partido nanico oscila mais; partido grande é mais estável.
    const volatility = 1 + rng.noise(0.05);
    return Math.max(0.02, bloc.chamberSeats * (1 + alignment * wave) * volatility);
  });

  const totalWeight = weights.reduce((total, value) => total + value, 0);
  let distributed = 0;
  state.congress.blocs.forEach((bloc, index) => {
    const seats = Math.max(0, Math.round((TOTAL_CHAMBER_SEATS * (weights[index] ?? 0)) / totalWeight));
    bloc.chamberSeats = seats;
    distributed += seats;
  });

  // Sobra ou falta de arredondamento vai para a maior bancada, como acontece
  // com as sobras eleitorais de verdade.
  const largest = state.congress.blocs.reduce((best, bloc) =>
    bloc.chamberSeats > best.chamberSeats ? bloc : best,
  );
  largest.chamberSeats += TOTAL_CHAMBER_SEATS - distributed;

  // O Senado renova um terço: a onda chega mais fraca. O total redistribuído é
  // o que a partida já tinha, não a constante — a composição de partida vem dos
  // dados de origem e não cabe a uma eleição de meio de jogo reescrevê-la.
  const senateSize = state.congress.blocs.reduce((total, bloc) => total + bloc.senateSeats, 0);
  const senateWeights = state.congress.blocs.map((bloc, index) => {
    const alignment = clamp(bloc.support / 100, -1, 1);
    return Math.max(0.02, bloc.senateSeats * (1 + alignment * wave * 0.34) + (weights[index] ?? 0) * 0.001);
  });
  const senateTotal = senateWeights.reduce((total, value) => total + value, 0);
  let senateDistributed = 0;
  state.congress.blocs.forEach((bloc, index) => {
    const seats = Math.max(0, Math.round((senateSize * (senateWeights[index] ?? 0)) / senateTotal));
    bloc.senateSeats = seats;
    senateDistributed += seats;
  });
  const largestSenate = state.congress.blocs.reduce((best, bloc) =>
    bloc.senateSeats > best.senateSeats ? bloc : best,
  );
  largestSenate.senateSeats += senateSize - senateDistributed;

  // A base é recontada pela mesma régua que o resto do jogo usa todo mês
  // (apoio acima de 45), e não por quem tem cargo: partido com ministério que
  // virou as costas não é base, e o mês seguinte não vai fingir que é.
  const isBase = (bloc: (typeof state.congress.blocs)[number]) => bloc.support > 45;
  state.congress.governmentSeatsChamber = state.congress.blocs
    .filter(isBase)
    .reduce((total, bloc) => total + bloc.chamberSeats, 0);
  state.congress.governmentSeatsSenate = state.congress.blocs
    .filter(isBase)
    .reduce((total, bloc) => total + bloc.senateSeats, 0);

  return state.congress.governmentSeatsChamber - before;
}

/**
 * Assume o segundo mandato.
 *
 * A posse não é um recomeço: o país continua exatamente como o presidente o
 * deixou — dívida, inflação, desemprego e cicatriz política. O que recomeça é o
 * relógio, a agenda, o Congresso eleito junto e a régua das promessas, porque
 * ninguém é reeleito com o mesmo programa de quatro anos atrás.
 */
export function beginSecondTerm(
  state: GameState,
  promiseIds: string[],
  rng: Rng,
): SecondTermOutcome {
  const election = state.election;
  if (!election || election.outcome !== 'venceu') {
    return { ok: false, message: 'Não há vitória eleitoral para empossar.' };
  }
  if (state.phase !== 'transicao') {
    return { ok: false, message: 'A transição de mandato não está aberta.' };
  }

  const chosen = promiseIds
    .map((id) => PROMISE_CATALOG.find((promise) => promise.id === id))
    .filter((promise): promise is (typeof PROMISE_CATALOG)[number] => Boolean(promise))
    .slice(0, MAX_PROMISES);

  if (promiseIds.length > 0 && chosen.length !== Math.min(promiseIds.length, MAX_PROMISES)) {
    return { ok: false, message: 'Uma das promessas escolhidas não existe no catálogo.' };
  }
  if (chosen.length > 0 && chosen.length < MAX_PROMISES) {
    return {
      ok: false,
      message: `Escolha ${MAX_PROMISES} compromissos para o segundo mandato (${chosen.length} escolhidos).`,
    };
  }

  // Programa novo, régua nova. Sem promessa escolhida, o presidente reafirma as
  // mesmas — e elas passam a ser medidas de novo a partir de onde o país está.
  state.promises =
    chosen.length > 0
      ? chosen.map((promise) => ({ ...promise, status: 'pendente', progress: 0 }))
      : state.promises.map((promise) => ({ ...promise, status: 'pendente', progress: 0 }));
  resetPromiseBaselines(state);

  const lastRound = election.rounds[election.rounds.length - 1];
  const winningShare =
    lastRound?.results.find((entry) => entry.candidateId === 'incumbente')?.share ?? 50;
  const seatSwing = renewCongress(state, winningShare, rng);

  const previousTotal = state.totalMonths;
  state.term += 1;
  state.totalMonths = previousTotal + 48;
  state.month = previousTotal + 1;
  state.phase = 'mandato';
  state.flags.gameOver = false;
  state.flags.gameOverReason = undefined;

  // A campanha cansou, mas a posse renova: agenda cheia e fôlego de quem
  // acabou de ganhar.
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty];
  state.agenda.maxPoints = preset.agendaPoints;
  state.agenda.points = preset.agendaPoints;
  state.agenda.scheduled = [];
  state.agenda.travelBooked = false;
  state.president.energy = round(clamp100(Math.max(state.president.energy, 68)), 1);
  state.president.stress = round(clamp100(state.president.stress - 12), 1);

  // Reforma ministerial de início de mandato: o desgaste de quatro anos cai,
  // mas o ministro continua sendo o mesmo — trocar é decisão do jogador.
  for (const minister of state.government.ministers) {
    minister.wear = round(clamp100(minister.wear * 0.55), 1);
  }

  // O derrotado sai de cena. A oposição se reorganiza atrás de outro nome, mais
  // fraca do que estava, mas viva.
  const defeated = election.candidates.find((candidate) => !candidate.incumbent);
  const successors = OPPOSITION_LEADERS.filter(
    (leader) => leader.party !== state.party.id && leader.name !== defeated?.name,
  );
  const successor = successors.length > 0 ? rng.pick(successors) : null;
  if (successor) {
    state.government.opposition.leaderName = successor.name;
    state.government.opposition.leaderParty = successor.party;
    state.government.opposition.lastMove = successor.style;
  } else {
    state.government.opposition.leaderName = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
  }
  state.government.opposition.strength = round(clamp100(state.government.opposition.strength - 6), 1);
  state.government.opposition.objectives = [
    'Transformar o segundo mandato em fim de ciclo',
    'Chegar em 2030 com candidato competitivo',
  ];

  // Segundo mandato desgasta mais: a novidade acabou e a comparação agora é com
  // o próprio governo, não com o anterior.
  state.approval.momentum = round(clamp(state.approval.momentum + 10, -100, 100), 1);
  state.congress.impeachmentRequests = 0;
  state.congress.impeachmentRisk = round(clamp100(state.congress.impeachmentRisk * 0.6), 1);

  state.timeline = [
    {
      id: makeId('tl', rng),
      month: state.month,
      monthLabel: monthLabel(state.month, state.startYear),
      title: 'Posse do segundo mandato',
      detail: `${state.president.politicalName} foi reempossado com ${winningShare.toFixed(
        1,
      )}% dos votos válidos e uma bancada de ${state.congress.governmentSeatsChamber} deputados (${
        seatSwing >= 0 ? '+' : ''
      }${seatSwing}).`,
      kind: 'posse' as const,
      approvalAfter: state.approval.overall,
    },
    ...state.timeline,
  ].slice(0, 200);

  return {
    ok: true,
    message: `Segundo mandato iniciado. A base saiu das urnas com ${state.congress.governmentSeatsChamber} deputados (${
      seatSwing >= 0 ? '+' : ''
    }${seatSwing}) e você tem mais 48 meses.`,
  };
}
