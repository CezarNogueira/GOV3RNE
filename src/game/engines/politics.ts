import { getCard } from '../data/cards';
import { SERVICE_LABEL } from '../data/meta';
import {
  BAN_MONTHS,
  BUDGET_MAX_LINE,
  DIPLOMACY,
  INITIAL_STRUCTURES,
  LAW_CARD_IDS,
  MAINTENANCE_COST,
  MAX_LAW_DUELS,
  NPC_CANDIDATES,
  NPC_TABLE,
  PLAYER_ATTRIBUTES,
  PLAYER_ID,
  PLAYER_START,
  PRODUCTIVITY_FLOOR,
  SEATS,
  STF_SEATS,
  STRUCTURES,
  TERM_MONTHS,
  WEAR_PENALTY_AT,
} from '../data/politics';
import { RIVALS } from '../data/rivals';
import type { Card, CardResolution } from '../types/cards';
import { GROUP_IDS, SERVICE_IDS, type ByService, type ServiceId } from '../types/common';
import type {
  ElectionRecord,
  ElectiveOffice,
  GameState,
  LawDuel,
  PendingElection,
  PersonId,
  PoliticalNpc,
  PoliticsState,
  Proposal,
  ProposalKind,
  ProposalStage,
} from '../types/state';
import { deepClone } from '../utils/clone';
import { formatReais, formatSignedReais } from '../utils/format';
import { average, clamp } from '../utils/math';
import { Rng } from '../utils/rng';
import { checkDefeat } from './defeat';
import { totalRevenue } from './resources';
import { clampService } from './services';
import { applyResolution } from './turn';

/**
 * POLÍTICA
 *
 * Eleições, Congresso, STF, ministérios e as ações de cada cargo. Tudo o que é
 * sorteado aqui passa por um `Rng` próprio (semente da partida + cursor em
 * `politics.rngCursor`), então a política não muda as cartas nem as rolagens do
 * resto do jogo, e recarregar a página não refaz nenhum sorteio.
 *
 * O mês político tem dois momentos, chamados por `advanceMonth`:
 *   - `politicalSession`, antes do fechamento: ministros NPC administram as
 *     pastas, a pauta é votada (uma etapa por mês) e os NPCs tomam iniciativas;
 *   - `politicsAfterClose`, depois: repasses do orçamento, produtividade,
 *     popularidade, fim de mandatos no STF e eleições.
 */

export class PoliticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoliticsError';
  }
}

type Say = (text: string) => void;

const pct = (value: number) => clamp(Math.round(value), 0, 100);
const byService = <T>(make: () => T): ByService<T> =>
  Object.fromEntries(SERVICE_IDS.map((id) => [id, make()])) as ByService<T>;
const sumOf = (values: Partial<Record<string, number>>) =>
  Object.values(values).reduce<number>((total, value) => total + (value ?? 0), 0);

export function politicsRng(state: GameState): Rng {
  return new Rng((state.seed ^ 0x51ed270b) >>> 0, state.politics.rngCursor);
}

// ------------------------------------------------------------------ consultas

export function npcOf(p: PoliticsState, id: PersonId | null): PoliticalNpc | undefined {
  return p.npcs.find((npc) => npc.id === id);
}

export function personName(state: GameState, id: PersonId | null): string {
  if (!id) return 'Vago';
  if (id === PLAYER_ID) return `${state.president.politicalName} (você)`;
  return npcOf(state.politics, id)?.name ?? '—';
}

export type Post =
  | { kind: 'presidente' | 'senador' | 'deputado' | 'stf' }
  | { kind: 'ministro'; service: ServiceId };

export function postOf(p: PoliticsState, id: PersonId): Post | null {
  const o = p.offices;
  if (o.president === id) return { kind: 'presidente' };
  if (o.senators.includes(id)) return { kind: 'senador' };
  if (o.deputies.includes(id)) return { kind: 'deputado' };
  if (o.stf.some((seat) => seat.id === id)) return { kind: 'stf' };
  const service = SERVICE_IDS.find((s) => o.ministers[s] === id);
  return service ? { kind: 'ministro', service } : null;
}

export function postLabel(post: Post | null): string {
  if (!post) return 'Sem cargo';
  if (post.kind === 'ministro') return `Ministro da ${SERVICE_LABEL[post.service]}`;
  return { presidente: 'Presidente', senador: 'Senador', deputado: 'Deputado', stf: 'Ministro do STF' }[post.kind];
}

/** Eficiência, popularidade, honestidade e produtividade de qualquer político, jogador incluído. */
export function attributesOf(p: PoliticsState, id: PersonId) {
  if (id === PLAYER_ID) return { ...PLAYER_ATTRIBUTES, popularity: p.player.popularity, productivity: p.player.productivity };
  const npc = npcOf(p, id);
  if (!npc) throw new PoliticsError('Político desconhecido.');
  return npc;
}

function adjust(p: PoliticsState, id: PersonId, field: 'popularity' | 'productivity', delta: number): void {
  const target = id === PLAYER_ID ? p.player : npcOf(p, id);
  if (target) target[field] = pct(target[field] + delta);
}

/** Cargo novo, ficha de produtividade nova. */
function startTerm(p: PoliticsState, id: PersonId): void {
  adjust(p, id, 'productivity', PLAYER_START.productivity - attributesOf(p, id).productivity);
}

/** Sem cargo e sem cassação em vigor: pode ser nomeado ou disputar eleição. */
export function isAvailable(p: PoliticsState, id: PersonId, month: number): boolean {
  const banned = id === PLAYER_ID ? p.player.bannedUntil : npcOf(p, id)?.bannedUntil ?? 0;
  return postOf(p, id) === null && banned <= month;
}

export function availableNpcs(p: PoliticsState, month: number): PoliticalNpc[] {
  return p.npcs.filter((npc) => isAvailable(p, npc.id, month));
}

export const isPlayerPresident = (state: GameState) => state.politics.offices.president === PLAYER_ID;
export const isPlayerLegislator = (state: GameState) =>
  state.politics.offices.deputies.includes(PLAYER_ID) || state.politics.offices.senators.includes(PLAYER_ID);
export const isPlayerStf = (state: GameState) => state.politics.offices.stf.some((seat) => seat.id === PLAYER_ID);

/** Fechamento do mês em que acontece a próxima eleição. */
export function nextElection(month: number): { closingMonth: number; senate: boolean } {
  const closingMonth = Math.ceil(month / TERM_MONTHS.presidente) * TERM_MONTHS.presidente;
  return { closingMonth, senate: closingMonth % TERM_MONTHS.senador === 0 };
}

/** Presidente, deputados, senadores e ministros abaixo do piso de produtividade, do pior para o melhor. */
export function unproductivePoliticians(state: GameState): { id: PersonId; productivity: number }[] {
  const o = state.politics.offices;
  const ministers = SERVICE_IDS.map((s) => o.ministers[s]).filter((id): id is PersonId => !!id);
  const ids = [...(o.president ? [o.president] : []), ...o.deputies, ...o.senators, ...ministers];
  return ids
    .map((id) => ({ id, productivity: attributesOf(state.politics, id).productivity }))
    .filter((entry) => entry.productivity < PRODUCTIVITY_FLOOR)
    .sort((a, b) => a.productivity - b.productivity);
}

/** Ministros no painel de improdutivos: os únicos que o Congresso pode investigar. */
export function investigableMinisters(state: GameState): { id: PersonId; service: ServiceId; productivity: number }[] {
  return unproductivePoliticians(state).flatMap((entry) => {
    const post = postOf(state.politics, entry.id);
    return post?.kind === 'ministro' && entry.id !== PLAYER_ID ? [{ ...entry, service: post.service }] : [];
  });
}

/** Eleitos no painel: os únicos que o STF pode cassar (ministro não tem mandato, é investigado). */
export const cassablePoliticians = (state: GameState) =>
  unproductivePoliticians(state).filter((entry) => postOf(state.politics, entry.id)?.kind !== 'ministro');

/**
 * Os três projetos que o parlamentar pode pautar no mês. Fixos durante o mês e
 * sem gastar sorteio da partida; o que outro autor já pôs em tramitação fica de fora.
 */
export function lawOptions(state: GameState): string[] {
  const busy = new Set(
    state.politics.proposals
      .filter((x) => x.status === 'em_tramitacao' && x.cardId && (x.authorId !== PLAYER_ID || x.month < state.month))
      .map((x) => x.cardId),
  );
  const shuffled = new Rng((state.seed ^ 0x2c1b3c6d) >>> 0, state.month * 97).shuffle(LAW_CARD_IDS);
  return shuffled.filter((id) => !busy.has(id)).slice(0, 3);
}

/** Saldo de uma lei para o país: serviços pesam mais; custo e gasto recorrente pesam contra. */
export function lawBenefit(card: Card): number {
  return (
    sumOf(card.serviceEffects) * 3 +
    sumOf(card.resourceEffects) / 5 +
    (card.internationalEffects.hdi ?? 0) +
    (card.internationalEffects.commerce ?? 0) / 5 +
    sumOf(card.socialEffects) / 2 +
    (card.recurringTaxChange - card.recurringExpenseChange) / 300_000 -
    card.implementationCost / 1_000_000
  );
}

/** O Senado já rejeitou este nome para o STF: o presidente precisa indicar outro. */
export const rejectedForStf = (p: PoliticsState, id: PersonId) =>
  p.proposals.some((x) => x.kind === 'stf' && x.status === 'rejeitada' && x.targetId === id);

export const budgetTotal = (budget: ByService<number>) => SERVICE_IDS.reduce((sum, id) => sum + budget[id], 0);

/** O orçamento cabe na arrecadação (impostos + receita dos recursos)? */
export function budgetAffordable(state: GameState, budget: ByService<number>): boolean {
  const spending = state.economy.spending + budgetTotal(budget) - budgetTotal(state.politics.budget);
  return state.economy.taxes + totalRevenue(state.resources).total - spending >= 0;
}

/** O que seria bom para o país: é contra isso que a honestidade dos NPCs é medida. */
export function isBeneficial(state: GameState, proposal: Proposal): boolean {
  const p = state.politics;
  switch (proposal.kind) {
    case 'lei':
      return lawBenefit(getCard(proposal.cardId!)) > 0;
    case 'orcamento':
      return budgetAffordable(state, proposal.budget!);
    case 'investigacao':
      return (npcOf(p, proposal.targetId!)?.diversions ?? 0) > 0;
    case 'stf': {
      const nominee = attributesOf(p, proposal.targetId!);
      return (nominee.efficiency + nominee.honesty) / 2 >= 55;
    }
  }
}

/** Voto de um NPC: quanto mais honesto, mais vota a favor do país. */
function npcVotesYes(npc: { honesty: number }, beneficial: boolean, rng: Rng): boolean {
  const aligned = rng.next() < 0.45 + (0.5 * npc.honesty) / 100;
  return aligned === beneficial;
}

/**
 * Medida do mês quando o presidente é NPC. Honesto: pesa o saldo da medida para o
 * país. Desonesto: prefere a mais garantida. Os dois correm atrás das metas do mês,
 * socorrem o grupo social em perigo e não empurram nenhum para perto de zero.
 */
export function npcPickCard(state: GameState): string {
  const honesty = npcOf(state.politics, state.politics.offices.president)?.honesty ?? 50;
  const score = (card: Card) => {
    let value = honesty >= 50 ? lawBenefit(card) : card.probability / 10;
    for (const id of SERVICE_IDS) {
      const target = state.turn.targets[id];
      const delta = card.serviceEffects[id] ?? 0;
      if (delta > 0 && target !== null && state.services[id] < target && state.services[id] + delta >= target) value += 6;
    }
    for (const g of GROUP_IDS) {
      const delta = card.socialEffects[g] ?? 0;
      if (state.society[g] < 35) value += delta * 3;
      if (state.society[g] + delta < 20) value -= 1000;
    }
    return (card.probability / 100) * value;
  };
  const cards = state.turn.offeredCardIds.map(getCard);
  return cards.reduce((best, card) => (score(card) > score(best) ? card : best)).id;
}

export const STAGES: Record<ProposalKind, ProposalStage[]> = {
  lei: ['congresso', 'stf', 'presidente'],
  orcamento: ['camara', 'senado'],
  investigacao: ['camara', 'senado'],
  stf: ['senado'],
};

export const STAGE_LABEL: Record<ProposalStage, string> = {
  congresso: 'Congresso',
  camara: 'Câmara',
  senado: 'Senado',
  stf: 'STF',
  presidente: 'Presidência',
};

export function stageMembers(p: PoliticsState, stage: ProposalStage): PersonId[] {
  if (stage === 'congresso') return [...p.offices.deputies, ...p.offices.senators];
  if (stage === 'camara') return p.offices.deputies;
  if (stage === 'senado') return p.offices.senators;
  if (stage === 'stf') return p.offices.stf.map((seat) => seat.id);
  return p.offices.president ? [p.offices.president] : [];
}

// --------------------------------------------------------------------- criação

function logger(state: GameState, notes?: string[]): Say {
  return (text) => {
    state.politics.log = [{ month: state.month, text }, ...state.politics.log].slice(0, 80);
    notes?.push(text);
  };
}

function addProposal(state: GameState, data: Omit<Proposal, 'id' | 'month' | 'stage' | 'status' | 'tallies'>): Proposal {
  const p = state.politics;
  const proposal: Proposal = { ...data, id: `pl-${p.nextId++}`, month: state.month, stage: STAGES[data.kind][0]!, status: 'em_tramitacao', tallies: [] };
  p.proposals.push(proposal);
  // Guarda só as 40 mais recentes já encerradas.
  const closed = p.proposals.filter((x) => x.status !== 'em_tramitacao');
  if (closed.length > 40) {
    const drop = new Set(closed.slice(0, closed.length - 40));
    p.proposals = p.proposals.filter((x) => !drop.has(x));
  }
  return proposal;
}

/**
 * Monta a política de uma partida (nova ou de um save anterior às eleições):
 * os 40 NPCs, o STF herdado com mandatos escalonados, a Lei Orçamentária que
 * reparte os gastos públicos atuais entre as cinco pastas e a eleição de abertura.
 *
 * `candidacy` ausente: o jogador já é o presidente (jogo clássico); a eleição
 * preenche só o Congresso e os ministros são nomeados pela equipe de transição.
 */
export function installPolitics(state: GameState, candidacy?: ElectiveOffice | null): void {
  const line = clamp(Math.round(state.economy.spending / SERVICE_IDS.length / 10_000) * 10_000, 0, BUDGET_MAX_LINE);
  state.politics = {
    rngCursor: 0,
    nextId: 1,
    npcs: NPC_TABLE.map(([name, efficiency, popularity, honesty], i) => ({
      id: `npc-${String(i + 1).padStart(2, '0')}`,
      name,
      efficiency,
      popularity,
      honesty,
      productivity: 40 + Math.round(efficiency * 0.4),
      diversions: 0,
      bannedUntil: 0,
    })),
    player: { ...PLAYER_START, candidacy: candidacy === undefined ? 'presidente' : candidacy, bannedUntil: 0 },
    offices: { president: null, deputies: [], senators: [], ministers: byService(() => null), stf: [] },
    budget: byService(() => line),
    admin: byService(() => ({ fund: line, structures: INITIAL_STRUCTURES, worn: 0 })),
    proposals: [],
    elections: [],
    duels: [],
    invitations: [],
    lastMeetingMonth: 0,
    lastInitiativeMonth: 0,
    log: [],
  };
  const p = state.politics;
  const rng = politicsRng(state);
  const say = logger(state);

  // STF herdado: vagas abrem com 4, 10 e 15 anos de partida.
  let pool = [...p.npcs];
  for (const elapsed of [144, 72, 12]) {
    const judge = rng.weighted(pool, (npc) => npc.honesty + npc.efficiency);
    pool = pool.filter((npc) => npc !== judge);
    p.offices.stf.push({ id: judge.id, since: state.month - elapsed });
  }

  if (candidacy === undefined) {
    p.offices.president = PLAYER_ID;
    elect(state, rng, ['senador', 'deputado'], state.month, say);
    fillMinistries(state, rng, say);
  } else {
    // Só registra as candidaturas: a apuração vem depois do voto do jogador (`castElectionVotes`).
    openElection(state, rng, ['presidente', 'senador', 'deputado'], state.month, say);
  }
  p.rngCursor = rng.cursor;
}

// -------------------------------------------------------------------- eleições

/**
 * Eleição, em duas etapas:
 *   1. `openElection`: os cargos em disputa ficam vagos e cada NPC elegível
 *      registra candidatura a no máximo um cargo (sorteado com peso na popularidade);
 *   2. `closeElection`: cada um dos 40 NPCs vota uma vez por cargo, com chance
 *      proporcional ao quadrado da popularidade do candidato, e o voto do jogador
 *      entra quando ele votou. Os mais votados ficam com as vagas.
 * Entre as duas, na eleição de abertura, o jogador preenche a cédula.
 */
function elect(state: GameState, rng: Rng, races: ElectiveOffice[], month: number, say: Say): void {
  openElection(state, rng, races, month, say);
  closeElection(state, rng, say);
}

function openElection(state: GameState, rng: Rng, races: ElectiveOffice[], month: number, say: Say): void {
  const p = state.politics;
  const o = p.offices;
  if (races.includes('presidente')) {
    o.president = null;
    // Os ministros caem junto com o presidente que os nomeou.
    for (const id of SERVICE_IDS) o.ministers[id] = null;
    p.invitations = [];
  }
  if (races.includes('deputado')) o.deputies = [];
  if (races.includes('senador')) o.senators = [];

  // Juízes do STF e senadores no meio do mandato não disputam (o jogador senador pode tentar a Presidência).
  let pool = availableNpcs(p, month);
  const candidacy = p.player.candidacy;
  const playerRuns =
    candidacy !== null &&
    races.includes(candidacy) &&
    p.player.bannedUntil <= month &&
    !isPlayerStf(state) &&
    (!o.senators.includes(PLAYER_ID) || candidacy === 'presidente');

  if (races.includes('presidente') && candidacy !== null && !playerRuns && !isPlayerStf(state)) {
    say(`Sua candidatura a ${candidacy} não foi registrada neste pleito.`);
  }

  const pending: PendingElection = { month, races: [] };
  for (const office of ['presidente', 'senador', 'deputado'] as const) {
    if (!races.includes(office)) continue;
    const candidates: PersonId[] = [];
    for (let i = 0; i < NPC_CANDIDATES[office] && pool.length > 0; i += 1) {
      const pick = rng.weighted(pool, (npc) => npc.popularity + 5);
      candidates.push(pick.id);
      pool = pool.filter((npc) => npc !== pick);
    }
    if (playerRuns && candidacy === office) candidates.push(PLAYER_ID);
    pending.races.push({ office, candidates });
  }
  p.pendingElection = pending;
}

/** Apura a eleição registrada. `picks`: o voto do jogador em cada cargo (ausente = em branco). */
function closeElection(state: GameState, rng: Rng, say: Say, picks: Partial<Record<ElectiveOffice, PersonId>> = {}): void {
  const p = state.politics;
  const o = p.offices;
  const pending = p.pendingElection;
  if (!pending) return;
  delete p.pendingElection;

  const record: ElectionRecord = { month: pending.month, races: [] };
  for (const { office, candidates } of pending.races) {
    const popularity = (id: PersonId) => attributesOf(p, id).popularity;
    const votes = new Map<PersonId, number>(candidates.map((id) => [id, 0]));
    const ballots: PersonId[] = [];
    for (let voter = 0; voter < p.npcs.length && candidates.length > 0; voter += 1) {
      const choice = rng.weighted(candidates, (id) => popularity(id) ** 2 + 1);
      ballots.push(choice);
      votes.set(choice, (votes.get(choice) ?? 0) + 1);
    }
    const playerVote = picks[office];
    const counted = playerVote !== undefined && candidates.includes(playerVote);
    if (counted) votes.set(playerVote, (votes.get(playerVote) ?? 0) + 1);

    const ranked = [...candidates].sort((a, b) => (votes.get(b) ?? 0) - (votes.get(a) ?? 0) || popularity(b) - popularity(a));
    const elected = ranked.slice(0, SEATS[office]);
    record.races.push({
      office,
      seats: SEATS[office],
      results: ranked.map((id) => ({ id, votes: votes.get(id) ?? 0, elected: elected.includes(id) })),
      ballots,
      ...(counted ? { playerVote } : {}),
    });

    if (office === 'presidente') o.president = elected[0] ?? null;
    if (office === 'senador') o.senators = elected;
    if (office === 'deputado') o.deputies = elected;
    for (const id of elected) startTerm(p, id);

    const voters = p.npcs.length + (counted ? 1 : 0);
    if (office === 'presidente') say(`Eleição presidencial: ${personName(state, o.president)} venceu com ${votes.get(o.president ?? '') ?? 0} dos ${voters} votos.`);
    if (candidates.includes(PLAYER_ID)) {
      const place = ranked.indexOf(PLAYER_ID) + 1;
      say(elected.includes(PLAYER_ID)
        ? `Você foi eleito ${office} com ${votes.get(PLAYER_ID)} votos (${place}º lugar).`
        : `Você não se elegeu ${office}: ${votes.get(PLAYER_ID)} votos, ${place}º lugar.`);
    }
  }
  p.elections = [...p.elections, record].slice(-6);

  // Senador eleito presidente deixa a cadeira para o suplente.
  if (o.president === PLAYER_ID && o.senators.includes(PLAYER_ID)) {
    o.senators = o.senators.filter((id) => id !== PLAYER_ID);
    fillSeat(state, 'senador', pending.month, say);
  }
}

/** Depois da eleição: convite ao jogador derrotado e nomeação dos ministros pelo presidente NPC. */
function afterElection(state: GameState, rng: Rng, say: Say): void {
  const p = state.politics;
  const president = p.offices.president;
  if (!president) return;
  if (president === PLAYER_ID) {
    say('Você é o presidente: nomeie os cinco ministros e envie a Lei Orçamentária em Política.');
    return;
  }
  if (isAvailable(p, PLAYER_ID, state.month) && rng.next() < 0.4 + p.player.popularity / 200) {
    const service = rng.pick(SERVICE_IDS);
    p.invitations.push({ id: `cv-${p.nextId++}`, kind: 'ministro', service, fromId: president, month: state.month });
    say(`${personName(state, president)} convidou você para o Ministério da ${SERVICE_LABEL[service]}.`);
  }
  fillMinistries(state, rng, say);
}

/** Vaga aberta no meio do mandato: assume o mais votado disponível da última eleição para o cargo. */
function fillSeat(state: GameState, office: ElectiveOffice, month: number, say: Say): void {
  const p = state.politics;
  const race = [...p.elections].reverse().flatMap((e) => e.races).find((r) => r.office === office);
  let next = race?.results.find((r) => isAvailable(p, r.id, month))?.id;
  if (!next && office === 'presidente') {
    next = [...availableNpcs(p, month)].sort((a, b) => b.popularity - a.popularity)[0]?.id;
  }
  if (!next) {
    say(`A vaga de ${office} ficou aberta: não há suplente disponível.`);
    return;
  }
  if (office === 'presidente') p.offices.president = next;
  if (office === 'senador') p.offices.senators.push(next);
  if (office === 'deputado') p.offices.deputies.push(next);
  say(`${personName(state, next)} assumiu como ${office}${office === 'presidente' ? '' : ' (suplente)'}.`);
}

/** Presidente NPC (ou equipe de transição) preenche as pastas vagas que não estão em convite. */
function fillMinistries(state: GameState, rng: Rng, say: Say): void {
  const p = state.politics;
  for (const service of SERVICE_IDS) {
    if (p.offices.ministers[service]) continue;
    if (p.invitations.some((i) => i.kind === 'ministro' && i.service === service)) continue;
    const free = availableNpcs(p, state.month);
    if (free.length === 0) return;
    const pick = rng.weighted(free, (npc) => npc.efficiency + npc.honesty / 2);
    p.offices.ministers[service] = pick.id;
    startTerm(p, pick.id);
    say(`${pick.name} assumiu o Ministério da ${SERVICE_LABEL[service]}.`);
  }
}

/** Tira alguém do cargo (cassação, condenação) e chama o substituto quando o cargo é eletivo. */
function removeFromOffice(state: GameState, id: PersonId, say: Say): void {
  const p = state.politics;
  const o = p.offices;
  const post = postOf(p, id);
  if (!post) return;
  if (post.kind === 'ministro') o.ministers[post.service] = null;
  if (post.kind === 'stf') o.stf = o.stf.filter((seat) => seat.id !== id);
  if (post.kind === 'deputado') {
    o.deputies = o.deputies.filter((x) => x !== id);
    fillSeat(state, 'deputado', state.month, say);
  }
  if (post.kind === 'senador') {
    o.senators = o.senators.filter((x) => x !== id);
    fillSeat(state, 'senador', state.month, say);
  }
  if (post.kind === 'presidente') {
    o.president = null;
    for (const service of SERVICE_IDS) o.ministers[service] = null;
    p.invitations = [];
    fillSeat(state, 'presidente', state.month, say);
    say('Os ministros deixam os cargos com a queda do presidente.');
  }
}

// ----------------------------------------------------------------- ministérios

export type MinistryAction = 'pequena' | 'grande' | 'manutencao';

/** Obra ou manutenção paga com a verba da pasta. Ministro desonesto pode desviar a verba. */
function runMinistry(state: GameState, service: ServiceId, actorId: PersonId, action: MinistryAction, rng: Rng, say: Say): void {
  const p = state.politics;
  const admin = p.admin[service];
  const actor = attributesOf(p, actorId);
  const cost = action === 'manutencao' ? admin.worn * MAINTENANCE_COST : STRUCTURES[service][action].cost;
  if (cost <= 0) throw new PoliticsError('Nenhuma estrutura precisa de manutenção.');
  if (admin.fund < cost) throw new PoliticsError(`Verba insuficiente: a pasta tem ${formatReais(admin.fund)} e a ação custa ${formatReais(cost)}.`);
  admin.fund -= cost;
  const name = personName(state, actorId);
  const area = SERVICE_LABEL[service];

  // A produtividade do ministro é o que ele entrega: obra sobe, desvio derruba.
  const npc = npcOf(p, actorId);
  if (npc && rng.next() < (100 - npc.honesty) / 250) {
    npc.diversions += 1;
    adjust(p, actorId, 'productivity', -15);
    say(`Ministério da ${area}: ${formatReais(cost)} pagos e nada entregue.`);
    return;
  }
  if (action === 'manutencao') {
    say(`${name} fez a manutenção de ${admin.worn} estrutura(s) de ${area}.`);
    admin.worn = 0;
    adjust(p, actorId, 'productivity', 2);
    return;
  }
  const structure = STRUCTURES[service][action];
  const gain = structure.gain + (rng.next() < actor.efficiency / 200 ? 1 : 0);
  admin.structures += 1;
  state.services[service] = clampService(state.services[service] + gain);
  adjust(p, actorId, 'productivity', 5);
  if (actorId === PLAYER_ID) adjust(p, PLAYER_ID, 'popularity', 1);
  say(`${name} entregou: ${structure.label} (+${gain} de ${area}).`);
}

function npcMinisterAct(state: GameState, service: ServiceId, rng: Rng, say: Say): void {
  const id = state.politics.offices.ministers[service];
  if (!id || id === PLAYER_ID) return;
  const admin = state.politics.admin[service];
  const action: MinistryAction | null =
    admin.worn > 0 && admin.fund >= admin.worn * MAINTENANCE_COST
      ? 'manutencao'
      : admin.fund >= STRUCTURES[service].grande.cost
        ? 'grande'
        : admin.fund >= STRUCTURES[service].pequena.cost
          ? 'pequena'
          : null;
  if (action) runMinistry(state, service, id, action, rng, say);
}

// -------------------------------------------------------------------- tramitação

function enact(state: GameState, proposal: Proposal, rng: Rng, say: Say): void {
  const p = state.politics;
  proposal.status = 'aprovada';
  proposal.closedMonth = state.month;
  if (proposal.kind === 'lei') {
    const card = getCard(proposal.cardId!);
    const resolution: CardResolution = {
      cardId: card.id, month: state.month, probability: 100, roll: 0, success: true, applied: false, cost: card.implementationCost, changes: [],
      ...(card.randomServiceEffects?.length ? { randomPick: rng.pick(card.randomServiceEffects) } : {}),
    };
    applyResolution(state, card, resolution);
    state.economy.treasury -= card.implementationCost;
    adjust(p, proposal.authorId, 'productivity', 8);
    adjust(p, proposal.authorId, 'popularity', 2);
    const effects = resolution.changes
      .map((c) => `${c.label} ${c.kind === 'taxes' || c.kind === 'spending' ? formatSignedReais(c.delta) : c.delta > 0 ? `+${c.delta}` : c.delta}`)
      .join(', ');
    say(`Lei sancionada: ${card.title} (custo ${formatReais(card.implementationCost)}${effects ? `; ${effects}` : ''}).`);
  }
  if (proposal.kind === 'orcamento') {
    const budget = proposal.budget!;
    state.economy.spending = Math.max(0, state.economy.spending + budgetTotal(budget) - budgetTotal(p.budget));
    p.budget = { ...budget };
    say(`Lei Orçamentária aprovada: ${formatReais(budgetTotal(budget))} por mês para os ministérios.`);
  }
  if (proposal.kind === 'investigacao') {
    const target = proposal.targetId!;
    const npc = npcOf(p, target);
    if (postOf(p, target)?.kind !== 'ministro') {
      say(`Investigação arquivada: ${personName(state, target)} já não é ministro.`);
    } else if (npc && npc.diversions > 0) {
      npc.diversions = 0;
      adjust(p, target, 'popularity', -15);
      say(`Investigação concluída: ${npc.name} desviou verbas e deixou o ministério.`);
      removeFromOffice(state, target, say);
    } else {
      say(`Investigação concluída: nada contra ${personName(state, target)}.`);
    }
  }
  if (proposal.kind === 'stf') {
    const target = proposal.targetId!;
    if (p.offices.stf.length < STF_SEATS && isAvailable(p, target, state.month)) {
      p.offices.stf.push({ id: target, since: state.month });
      say(`${personName(state, target)} tomou posse no STF.`);
    }
  }
}

function presidentialDecision(state: GameState, proposal: Proposal, sanction: boolean, rng: Rng, say: Say): void {
  if (sanction) {
    enact(state, proposal, rng, say);
    return;
  }
  proposal.status = 'vetada';
  proposal.closedMonth = state.month;
  say(`O presidente vetou: ${proposal.title}.`);
}

/** Cada proposição em tramitação passa por uma etapa por sessão. Maioria dos votos válidos; empate rejeita. */
function voteAgenda(state: GameState, rng: Rng, say: Say): void {
  const p = state.politics;
  let voted = 0;
  let missed = 0;
  for (const proposal of p.proposals) {
    if (proposal.status !== 'em_tramitacao') continue;
    // Leis no Congresso vão a duelo; e cada proposição avança só uma etapa por mês.
    if (proposal.stage === 'congresso' || proposal.tallies.at(-1)?.month === state.month) continue;
    if (proposal.stage === 'presidente') {
      const president = npcOf(p, p.offices.president);
      // Jogador presidente: a lei espera a decisão dele em Política.
      if (president) presidentialDecision(state, proposal, npcVotesYes(president, isBeneficial(state, proposal), rng), rng, say);
      continue;
    }
    const beneficial = isBeneficial(state, proposal);
    let yes = 0;
    let no = 0;
    for (const id of stageMembers(p, proposal.stage)) {
      let ballot: boolean | undefined;
      if (id === PLAYER_ID) {
        ballot = proposal.playerVote;
        if (ballot === undefined) missed += 1;
        else voted += 1;
      } else {
        ballot = npcVotesYes(npcOf(p, id)!, beneficial, rng);
      }
      if (ballot === true) yes += 1;
      if (ballot === false) no += 1;
    }
    const stage = proposal.stage;
    proposal.tallies.push({ stage, yes, no, month: state.month });
    delete proposal.playerVote;
    if (yes <= no) {
      proposal.status = 'rejeitada';
      proposal.closedMonth = state.month;
      say(`${STAGE_LABEL[stage]} rejeitou: ${proposal.title} (${yes} a ${no}).`);
      continue;
    }
    const stages = STAGES[proposal.kind];
    const next = stages[stages.indexOf(stage) + 1];
    if (next) {
      proposal.stage = next;
      say(`${STAGE_LABEL[stage]} aprovou: ${proposal.title} (${yes} a ${no}). Segue para ${STAGE_LABEL[next]}.`);
    } else {
      enact(state, proposal, rng, say);
    }
  }
  if (voted + missed > 0) adjust(p, PLAYER_ID, 'productivity', voted * 2 - missed * 5);
}

/** Julgamento de cassação pelos três ministros do STF. O voto do jogador entra quando ele é ministro. */
function judgeCassation(state: GameState, targetId: PersonId, rng: Rng, say: Say, playerBallot?: boolean): boolean {
  const p = state.politics;
  let yes = 0;
  let no = 0;
  for (const seat of p.offices.stf) {
    const ballot = seat.id === PLAYER_ID ? playerBallot : npcVotesYes(npcOf(p, seat.id)!, true, rng);
    if (ballot === true) yes += 1;
    if (ballot === false) no += 1;
  }
  const name = personName(state, targetId);
  if (yes <= no) {
    say(`O STF manteve o mandato de ${name} (${yes} a ${no}).`);
    return false;
  }
  const label = postLabel(postOf(p, targetId));
  adjust(p, targetId, 'popularity', -20);
  if (targetId === PLAYER_ID) p.player.bannedUntil = state.month + BAN_MONTHS;
  else npcOf(p, targetId)!.bannedUntil = state.month + BAN_MONTHS;
  say(`O STF cassou o mandato de ${name} (${label}) por improdutividade (${yes} a ${no}).`);
  removeFromOffice(state, targetId, say);
  return true;
}

function npcBudget(state: GameState): ByService<number> {
  const total = budgetTotal(state.politics.budget) * (state.economy.treasury < 0 ? 0.85 : 1);
  const weights = byService(() => 0);
  for (const id of SERVICE_IDS) weights[id] = 110 - state.services[id];
  const weightSum = budgetTotal(weights);
  const budget = byService(() => 0);
  for (const id of SERVICE_IDS) {
    budget[id] = clamp(Math.round((total * weights[id]) / weightSum / 10_000) * 10_000, 0, BUDGET_MAX_LINE);
  }
  return budget;
}

// ------------------------------------------------------- duelos de leis

/** Um parlamentar NPC apresenta um projeto: o honesto tende aos que fazem bem ao país. */
function npcProposeLaw(state: GameState, rng: Rng, say: Say, legislators: PersonId[]): boolean {
  const p = state.politics;
  const author = npcOf(p, rng.pick(legislators))!;
  const pool = LAW_CARD_IDS.filter((id) => !p.proposals.some((x) => x.status === 'em_tramitacao' && x.cardId === id));
  const good = pool.filter((id) => lawBenefit(getCard(id)) > 0);
  const options = rng.next() < author.honesty / 100 && good.length > 0 ? good : pool;
  if (options.length === 0) return false;
  const card = getCard(rng.pick(options));
  addProposal(state, { kind: 'lei', title: card.title, authorId: author.id, cardId: card.id });
  adjust(p, author.id, 'productivity', 3);
  say(`${author.name} apresentou o projeto de lei "${card.title}".`);
  return true;
}

export const pendingDuels = (state: GameState) => (state.politics.duels ?? []).filter((d) => d.month === state.month && !d.winner);

/**
 * Monta os duelos do fechamento (uma vez por mês). Os NPCs completam a pauta até
 * um número par de leis, no mínimo duas, e as mais antigas se enfrentam aos pares,
 * até `MAX_LAW_DUELS` duelos. A que sobrar espera o mês seguinte.
 */
function prepareCongress(state: GameState, rng: Rng, say: Say): void {
  const p = state.politics;
  p.duels ??= [];
  if (p.duels.some((d) => d.month === state.month)) return;
  const pending = () => p.proposals.filter((x) => x.kind === 'lei' && x.status === 'em_tramitacao' && x.stage === 'congresso');
  // Leis de saves anteriores, ainda nas etapas antigas, passam a disputar no Congresso.
  for (const x of p.proposals) {
    if (x.kind === 'lei' && x.status === 'em_tramitacao' && (x.stage === 'camara' || x.stage === 'senado')) x.stage = 'congresso';
  }
  const legislators = [...p.offices.deputies, ...p.offices.senators].filter((id) => id !== PLAYER_ID);
  while (legislators.length > 0 && (pending().length < 2 || pending().length % 2 === 1)) {
    if (!npcProposeLaw(state, rng, say, legislators)) break;
  }
  const laws = pending().slice(0, MAX_LAW_DUELS * 2);
  for (let i = 0; i + 1 < laws.length; i += 2) {
    p.duels.push({ id: `dl-${p.nextId++}`, month: state.month, a: laws[i]!.id, b: laws[i + 1]!.id });
  }
  p.duels = p.duels.slice(-12);
}

/** Votação do duelo: cada parlamentar escolhe uma das duas; a mais votada segue para o STF. */
function resolveDuel(state: GameState, duel: LawDuel, rng: Rng, say: Say, playerPick?: 'a' | 'b'): void {
  const p = state.politics;
  const a = p.proposals.find((x) => x.id === duel.a && x.status === 'em_tramitacao');
  const b = p.proposals.find((x) => x.id === duel.b && x.status === 'em_tramitacao');
  if (!a || !b) {
    duel.ballots = [];
    duel.winner = a ? 'a' : 'b';
    return;
  }
  const better: 'a' | 'b' = lawBenefit(getCard(a.cardId!)) >= lawBenefit(getCard(b.cardId!)) ? 'a' : 'b';
  const worse: 'a' | 'b' = better === 'a' ? 'b' : 'a';
  duel.ballots = [...p.offices.deputies, ...p.offices.senators].map((voterId) => {
    if (voterId === PLAYER_ID) return { voterId, pick: playerPick ?? null };
    const aligned = rng.next() < 0.45 + (0.5 * npcOf(p, voterId)!.honesty) / 100;
    return { voterId, pick: aligned ? better : worse };
  });
  const votesA = duel.ballots.filter((x) => x.pick === 'a').length;
  const votesB = duel.ballots.filter((x) => x.pick === 'b').length;
  const popular = (x: Proposal) => attributesOf(p, x.authorId).popularity;
  duel.winner = votesA !== votesB ? (votesA > votesB ? 'a' : 'b') : popular(a) >= popular(b) ? 'a' : 'b';

  const [won, lost, wv, lv] = duel.winner === 'a' ? [a, b, votesA, votesB] : [b, a, votesB, votesA];
  won.tallies.push({ stage: 'congresso', yes: wv, no: lv, month: state.month });
  won.stage = 'stf';
  lost.tallies.push({ stage: 'congresso', yes: lv, no: wv, month: state.month });
  lost.status = 'rejeitada';
  lost.closedMonth = state.month;
  if (isPlayerLegislator(state)) adjust(p, PLAYER_ID, 'productivity', playerPick ? 2 : -5);
  say(`Congresso: "${won.title}" venceu "${lost.title}" por ${wv} a ${lv} e segue para o STF.`);
}

/** Projetos e investigações dos parlamentares NPC; nomeações, orçamento e STF do presidente NPC; cassações do STF. */
function npcInitiatives(state: GameState, rng: Rng, say: Say): void {
  const p = state.politics;
  const o = p.offices;
  const open = () => p.proposals.filter((x) => x.status === 'em_tramitacao');
  const legislators = [...o.deputies, ...o.senators].filter((id) => id !== PLAYER_ID);

  // Convite vale até o fim do mês em que o jogador o recebeu.
  if (p.invitations.some((i) => i.month < state.month)) {
    p.invitations = p.invitations.filter((i) => i.month >= state.month);
    say('Um convite ficou sem resposta e expirou.');
  }

  // Só ministro no painel de improdutivos pode ser investigado; o pior vai primeiro.
  const suspect = investigableMinisters(state).find((m) => !open().some((x) => x.kind === 'investigacao' && x.targetId === m.id));
  if (legislators.length > 0 && suspect && rng.next() < 0.35) {
    const author = npcOf(p, rng.pick(legislators))!;
    addProposal(state, { kind: 'investigacao', title: `Investigar ${personName(state, suspect.id)} (${SERVICE_LABEL[suspect.service]})`, authorId: author.id, targetId: suspect.id, service: suspect.service });
    say(`${author.name} pediu a abertura de investigação contra o ministro da ${SERVICE_LABEL[suspect.service]}.`);
  }

  const president = npcOf(p, o.president);
  if (president) {
    fillMinistries(state, rng, say);
    if (state.month % 12 === 1 && state.month > 1 && !open().some((x) => x.kind === 'orcamento')) {
      const budget = npcBudget(state);
      addProposal(state, { kind: 'orcamento', title: `Lei Orçamentária (${formatReais(budgetTotal(budget))}/mês)`, authorId: president.id, budget });
      say(`${president.name} enviou a Lei Orçamentária ao Congresso.`);
    }
    const stfPending = open().some((x) => x.kind === 'stf') || p.invitations.some((i) => i.kind === 'stf');
    if (o.stf.length < STF_SEATS && !stfPending) {
      if (isAvailable(p, PLAYER_ID, state.month) && rng.next() < 0.3) {
        p.invitations.push({ id: `cv-${p.nextId++}`, kind: 'stf', fromId: president.id, month: state.month });
        say(`${president.name} convidou você para uma vaga no STF.`);
      } else {
        const free = availableNpcs(p, state.month).filter((npc) => !rejectedForStf(p, npc.id));
        if (free.length > 0) {
          const nominee = rng.weighted(free, (npc) => (president.honesty >= 50 ? npc.honesty + npc.efficiency : npc.popularity));
          addProposal(state, { kind: 'stf', title: `Indicação de ${nominee.name} ao STF`, authorId: president.id, targetId: nominee.id });
          say(`${president.name} indicou ${nominee.name} ao STF. O Senado vota a indicação.`);
        }
      }
    }
  }

  if (!isPlayerStf(state) && o.stf.length > 0 && rng.next() < 0.3) {
    const worst = cassablePoliticians(state)[0];
    if (worst) judgeCassation(state, worst.id, rng, say);
  }
}

// ----------------------------------------------------------- passagem do mês

/** Sessão política do mês, antes do fechamento: as obras contam para as metas. */
export function politicalSession(state: GameState, rng: Rng, notes: string[]): void {
  const say = logger(state, notes);
  // Eleição de abertura sem o voto do jogador: apura em branco.
  if (state.politics.pendingElection) {
    closeElection(state, rng, say);
    afterElection(state, rng, say);
  }
  // Duelos de leis que a interface não apurou (jogador sem voto, testes, simulador).
  prepareCongress(state, rng, say);
  for (const duel of pendingDuels(state)) resolveDuel(state, duel, rng, say);
  for (const service of SERVICE_IDS) npcMinisterAct(state, service, rng, say);
  for (const service of SERVICE_IDS) {
    const admin = state.politics.admin[service];
    if (admin.worn < admin.structures) admin.worn += 1;
    if (admin.worn >= WEAR_PENALTY_AT) {
      state.services[service] = clampService(state.services[service] - 1);
      const minister = state.politics.offices.ministers[service];
      if (minister) adjust(state.politics, minister, 'productivity', -8);
      say(`${SERVICE_LABEL[service]}: ${admin.worn} estruturas sem manutenção custaram 1 ponto.`);
    }
  }
  voteAgenda(state, rng, say);
  npcInitiatives(state, rng, say);
}

/**
 * Depois do fechamento: repasses do orçamento (o gasto do mês, zerado na crise),
 * produtividade, popularidade (a do presidente segue a satisfação média dos
 * grupos), fim de mandatos no STF e eleições a cada 4 anos.
 */
export function politicsAfterClose(
  state: GameState,
  rng: Rng,
  ctx: { spending: number; hasTargets: boolean; allTargetsMet: boolean },
  notes: string[],
): void {
  const say = logger(state, notes);
  const p = state.politics;
  const o = p.offices;

  const total = budgetTotal(p.budget);
  const ratio = total > 0 ? Math.min(1, ctx.spending / total) : 0;
  for (const id of SERVICE_IDS) p.admin[id].fund += Math.round(p.budget[id] * ratio);

  if (o.president && ctx.hasTargets) adjust(p, o.president, 'productivity', ctx.allTargetsMet ? 4 : -4);
  // Ministro NPC tende à própria eficiência; as obras e os desvios o afastam dela.
  for (const service of SERVICE_IDS) {
    const npc = npcOf(p, o.ministers[service]);
    if (npc) npc.productivity = pct(npc.productivity + (npc.efficiency - npc.productivity) * 0.15);
  }
  for (const id of [...o.deputies, ...o.senators]) {
    const npc = npcOf(p, id);
    if (npc) npc.productivity = pct(npc.productivity + (npc.efficiency - npc.productivity) * 0.25 + rng.int(-5, 5));
    const productivity = attributesOf(p, id).productivity;
    if (productivity >= 65) adjust(p, id, 'popularity', 1);
    if (productivity < PRODUCTIVITY_FLOOR) adjust(p, id, 'popularity', -1);
  }
  if (o.president) {
    const approval = average(GROUP_IDS.map((g) => state.society[g]));
    const current = attributesOf(p, o.president).popularity;
    adjust(p, o.president, 'popularity', Math.round((approval - current) * 0.25));
  }

  const nextMonth = state.month + 1;
  for (const seat of [...o.stf]) {
    if (seat.since + TERM_MONTHS.stf <= nextMonth) {
      o.stf = o.stf.filter((x) => x !== seat);
      say(`${personName(state, seat.id)} encerrou 16 anos no STF. A vaga está aberta.`);
    }
  }

  if (state.month % TERM_MONTHS.presidente === 0) {
    const races: ElectiveOffice[] = ['presidente', 'deputado'];
    if (state.month % TERM_MONTHS.senador === 0) races.push('senador');
    // O resultado vai só para o registro: quem revela é a apuração, não o relatório do mês.
    const quiet = logger(state);
    say('Eleições gerais encerradas: acompanhe a apuração.');
    elect(state, rng, races, nextMonth, quiet);
    afterElection(state, rng, quiet);
  }
}

// ----------------------------------------------------------- ações do jogador

/** Envelope das ações: clona, sorteia com o Rng da política, confere derrota e grava o cursor. */
function act(state: GameState, run: (s: GameState, rng: Rng, say: Say) => void): GameState {
  if (state.phase !== 'jogando') throw new PoliticsError('A partida já terminou.');
  const s = deepClone(state);
  const rng = politicsRng(s);
  run(s, rng, logger(s));
  s.politics.rngCursor = rng.cursor;
  const defeat = checkDefeat(s);
  if (defeat) {
    s.defeat = defeat;
    s.phase = 'derrota';
  }
  s.updatedAt = new Date().toISOString();
  return s;
}

const need = (ok: boolean, message: string) => {
  if (!ok) throw new PoliticsError(message);
};

const openProposal = (s: GameState, id: string) => {
  const proposal = s.politics.proposals.find((x) => x.id === id && x.status === 'em_tramitacao');
  if (!proposal) throw new PoliticsError('Esta proposição não está mais em tramitação.');
  return proposal;
};

export function setCandidacy(state: GameState, office: ElectiveOffice | null): GameState {
  return act(state, (s) => {
    need(office !== 'senador' || nextElection(s.month).senate, 'O próximo pleito não elege senadores.');
    s.politics.player.candidacy = office;
  });
}

function useInitiative(s: GameState): void {
  need(isPlayerLegislator(s), 'Só deputados e senadores apresentam projetos e pedem investigações.');
  need(s.politics.lastInitiativeMonth !== s.month, 'Você já usou a iniciativa deste mês.');
  s.politics.lastInitiativeMonth = s.month;
}

export function proposeLaw(state: GameState, cardId: string): GameState {
  return act(state, (s, _rng, say) => {
    need(lawOptions(s).includes(cardId), 'Este projeto não está entre os disponíveis do mês.');
    need(!s.politics.proposals.some((x) => x.status === 'em_tramitacao' && x.cardId === cardId), 'Este projeto já está em tramitação.');
    useInitiative(s);
    const card = getCard(cardId);
    addProposal(s, { kind: 'lei', title: card.title, authorId: PLAYER_ID, cardId });
    adjust(s.politics, PLAYER_ID, 'productivity', 5);
    say(`Você apresentou o projeto de lei "${card.title}".`);
  });
}

export function requestInvestigation(state: GameState, service: ServiceId): GameState {
  return act(state, (s, _rng, say) => {
    const target = s.politics.offices.ministers[service];
    need(!!target && target !== PLAYER_ID, 'Não há ministro a investigar nesta pasta.');
    need(investigableMinisters(s).some((m) => m.id === target), 'Só ministros no painel de improdutivos podem ser investigados.');
    need(!s.politics.proposals.some((x) => x.status === 'em_tramitacao' && x.kind === 'investigacao' && x.targetId === target), 'Já há investigação em votação contra este ministro.');
    useInitiative(s);
    addProposal(s, { kind: 'investigacao', title: `Investigar ${personName(s, target!)} (${SERVICE_LABEL[service]})`, authorId: PLAYER_ID, targetId: target!, service });
    say(`Você pediu investigação contra o ministro da ${SERVICE_LABEL[service]}.`);
  });
}

/** Fechamento do mês, parte 1: monta os duelos de leis (idempotente no mês). */
export function openCongress(state: GameState): GameState {
  return act(state, (s, rng, say) => prepareCongress(s, rng, say));
}

/** Apura um duelo. Parlamentar escolhe `a` ou `b`; sem cadeira, a votação corre só com os NPCs. */
export function voteDuel(state: GameState, duelId: string, pick?: 'a' | 'b'): GameState {
  return act(state, (s, rng, say) => {
    const duel = pendingDuels(s).find((d) => d.id === duelId);
    if (!duel) throw new PoliticsError('Esta votação já foi apurada.');
    need(!pick || isPlayerLegislator(s), 'Só deputados e senadores votam no Congresso.');
    resolveDuel(s, duel, rng, say, pick);
  });
}

/** O voto do jogador na eleição de abertura; em seguida, a apuração. */
export function castElectionVotes(state: GameState, picks: Partial<Record<ElectiveOffice, PersonId>>): GameState {
  return act(state, (s, rng, say) => {
    need(!!s.politics.pendingElection, 'Não há eleição esperando o seu voto.');
    closeElection(s, rng, say, picks);
    afterElection(s, rng, say);
  });
}

export function castVote(state: GameState, proposalId: string, yes: boolean): GameState {
  return act(state, (s) => {
    const proposal = openProposal(s, proposalId);
    need(proposal.stage !== 'congresso', 'Leis são votadas em duelo no fechamento do mês.');
    need(proposal.stage !== 'presidente' && stageMembers(s.politics, proposal.stage).includes(PLAYER_ID), 'Você não vota nesta etapa.');
    proposal.playerVote = yes;
  });
}

export function sendBudget(state: GameState, budget: ByService<number>): GameState {
  return act(state, (s, _rng, say) => {
    need(isPlayerPresident(s), 'Só o presidente envia a Lei Orçamentária.');
    need(!s.politics.proposals.some((x) => x.status === 'em_tramitacao' && x.kind === 'orcamento'), 'Já há uma Lei Orçamentária em votação.');
    const clean = byService(() => 0);
    for (const id of SERVICE_IDS) {
      const value = budget[id];
      need(Number.isFinite(value) && value >= 0 && value <= BUDGET_MAX_LINE, `Cada pasta recebe de R$ 0 a ${formatReais(BUDGET_MAX_LINE)} por mês.`);
      clean[id] = Math.round(value);
    }
    addProposal(s, { kind: 'orcamento', title: `Lei Orçamentária (${formatReais(budgetTotal(clean))}/mês)`, authorId: PLAYER_ID, budget: clean });
    say('Você enviou a Lei Orçamentária ao Congresso.');
  });
}

export function appointMinister(state: GameState, service: ServiceId, npcId: string): GameState {
  return act(state, (s, _rng, say) => {
    const p = s.politics;
    need(isPlayerPresident(s), 'Só o presidente nomeia ministros.');
    need(!!npcOf(p, npcId) && isAvailable(p, npcId, s.month), 'Este político já tem cargo ou está cassado.');
    const previous = p.offices.ministers[service];
    p.offices.ministers[service] = npcId;
    startTerm(p, npcId);
    p.invitations = p.invitations.filter((i) => i.service !== service);
    say(`Você nomeou ${personName(s, npcId)} para o Ministério da ${SERVICE_LABEL[service]}${previous ? ` no lugar de ${personName(s, previous)}` : ''}.`);
  });
}

export function nominateStf(state: GameState, npcId: string): GameState {
  return act(state, (s, _rng, say) => {
    const p = s.politics;
    need(isPlayerPresident(s), 'Só o presidente indica ministros do STF.');
    need(p.offices.stf.length < STF_SEATS, 'Não há vaga aberta no STF.');
    need(!p.proposals.some((x) => x.status === 'em_tramitacao' && x.kind === 'stf'), 'Já há uma indicação em votação no Senado.');
    need(!!npcOf(p, npcId) && isAvailable(p, npcId, s.month), 'Este político já tem cargo ou está cassado.');
    need(!rejectedForStf(p, npcId), 'O Senado já rejeitou este nome: indique outro.');
    addProposal(s, { kind: 'stf', title: `Indicação de ${personName(s, npcId)} ao STF`, authorId: PLAYER_ID, targetId: npcId });
    say(`Você indicou ${personName(s, npcId)} ao STF. O Senado vota no fechamento do mês.`);
  });
}

export function decideLaw(state: GameState, proposalId: string, sanction: boolean): GameState {
  return act(state, (s, rng, say) => {
    const proposal = openProposal(s, proposalId);
    need(isPlayerPresident(s) && proposal.stage === 'presidente', 'Só o presidente sanciona ou veta, e só depois do STF.');
    presidentialDecision(s, proposal, sanction, rng, say);
  });
}

export type MeetingObjective = 'intercambio' | 'venda' | 'compra';

/** Valor de uma negociação com o país: quanto mais alto no ranking, maior o negócio. */
export function meetingValue(rivalId: string, base: number): number {
  const rival = RIVALS.find((r) => r.id === rivalId);
  return rival ? Math.round(base * (1 + (9 - rival.rank) * 0.1)) : base;
}

export function holdMeeting(state: GameState, rivalId: string, objective: MeetingObjective, service: ServiceId = 'educacao'): GameState {
  return act(state, (s, _rng, say) => {
    const rival = RIVALS.find((r) => r.id === rivalId);
    need(isPlayerPresident(s), 'Só o presidente faz reuniões diplomáticas.');
    need(!!rival, 'País fora do ranking dos 10 maiores PIBs.');
    need(s.politics.lastMeetingMonth !== s.month, 'Já houve reunião diplomática neste mês.');
    s.politics.lastMeetingMonth = s.month;
    if (objective === 'intercambio') {
      const gain = DIPLOMACY.exchangeGain + (rival!.services.educacao >= DIPLOMACY.exchangeBonusFrom ? 1 : 0);
      s.economy.treasury -= DIPLOMACY.exchangeCost;
      s.services.educacao = clampService(s.services.educacao + gain);
      say(`Intercâmbio com ${rival!.name}: +${gain} de Educação por ${formatReais(DIPLOMACY.exchangeCost)}.`);
    } else if (objective === 'venda') {
      const value = meetingValue(rivalId, DIPLOMACY.saleValue);
      s.economy.treasury += value;
      s.services[service] = clampService(s.services[service] - DIPLOMACY.serviceDelta);
      say(`Venda de estatal da ${SERVICE_LABEL[service]} para ${rival!.name}: +${formatReais(value)}, −${DIPLOMACY.serviceDelta} de ${SERVICE_LABEL[service]}.`);
    } else {
      const cost = meetingValue(rivalId, DIPLOMACY.purchaseCost);
      need(s.economy.treasury >= cost, `O cofre não cobre a compra de ${formatReais(cost)}.`);
      s.economy.treasury -= cost;
      s.services[service] = clampService(s.services[service] + DIPLOMACY.serviceDelta);
      say(`Compra de empresa de ${rival!.name} para a ${SERVICE_LABEL[service]}: −${formatReais(cost)}, +${DIPLOMACY.serviceDelta} de ${SERVICE_LABEL[service]}.`);
    }
  });
}

export function ministerAction(state: GameState, action: MinistryAction): GameState {
  return act(state, (s, rng, say) => {
    const post = postOf(s.politics, PLAYER_ID);
    if (post?.kind !== 'ministro') throw new PoliticsError('Só o ministro da pasta administra a verba dela.');
    runMinistry(s, post.service, PLAYER_ID, action, rng, say);
  });
}

export function cassate(state: GameState, targetId: PersonId): GameState {
  return act(state, (s, rng, say) => {
    need(isPlayerStf(s), 'Só ministros do STF cassam mandatos.');
    need(cassablePoliticians(s).some((x) => x.id === targetId), 'Só eleitos no painel de improdutivos podem ser cassados.');
    judgeCassation(s, targetId, rng, say, true);
  });
}

export function answerInvitation(state: GameState, invitationId: string, accept: boolean): GameState {
  return act(state, (s, _rng, say) => {
    const p = s.politics;
    const invitation = p.invitations.find((i) => i.id === invitationId);
    need(!!invitation, 'Este convite não vale mais.');
    p.invitations = p.invitations.filter((i) => i !== invitation);
    if (!accept) {
      say('Você recusou o convite.');
      return;
    }
    need(isAvailable(p, PLAYER_ID, s.month), 'Você já ocupa um cargo.');
    if (invitation!.kind === 'ministro') {
      const service = invitation!.service!;
      need(!p.offices.ministers[service], 'A pasta já foi ocupada.');
      p.offices.ministers[service] = PLAYER_ID;
      startTerm(p, PLAYER_ID);
      say(`Você assumiu o Ministério da ${SERVICE_LABEL[service]}.`);
    } else {
      need(p.offices.stf.length < STF_SEATS, 'A vaga no STF já foi ocupada.');
      addProposal(s, { kind: 'stf', title: `Indicação de ${s.president.politicalName} ao STF`, authorId: invitation!.fromId, targetId: PLAYER_ID });
      say('Você aceitou a indicação ao STF. O Senado vota no fechamento do mês.');
    }
  });
}
