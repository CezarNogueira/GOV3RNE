import type { ByGroup, ByResource, ByService, GroupId, ResourceId, ServiceId, Timestamp } from './common';
import type { CardResolution } from './cards';
import type { President } from './president';

// ------------------------------------------------------------ internacional

export interface InternationalState {
  /** Posição no ranking de PIB: começa em 10 e nunca passa de 1. */
  gdpRank: number;
  /** IDH, de 0 a 1000. */
  hdi: number;
  /** Comércio, de 0 a 1000. */
  commerce: number;
  /**
   * Valor da moeda em CENTAVOS de dólar (20 = US$ 0,20). Inteiro de propósito:
   * somar 0,05 e subtrair 0,10 em ponto flutuante acumula erro.
   */
  currencyCents: number;
  /** Dívida pública em % do PIB, de 0 a 1000. */
  debt: number;
  /**
   * Meses consecutivos em que os cinco serviços superaram os do país que ocupa
   * a posição imediatamente acima. Zera ao falhar e ao conquistar a posição.
   */
  monthsAboveRival: number;
  /** Posições cuja recompensa já foi paga. Garante que cada uma vale uma vez. */
  claimedRewards: number[];
}

// ----------------------------------------------------------------- economia

export interface EconomyState {
  /** Cofre público, em reais. Pode ficar negativo — e aí começa a crise. */
  treasury: number;
  /** Arrecadação mensal de impostos, em reais. Recorrente. */
  taxes: number;
  /** Gastos públicos mensais, em reais. Recorrente. */
  spending: number;
  /**
   * Meses de crise que ainda faltam. Enquanto for maior que zero os gastos
   * públicos contam como zero e o país é penalizado.
   */
  crisisMonthsLeft: number;
  /** Quantas crises já aconteceram na partida. */
  crisisCount: number;
  /**
   * Saldo do último fechamento (receitas menos despesas). Alimenta a dívida do
   * mês seguinte — a dívida reage ao resultado já fechado, não a uma projeção.
   */
  lastBalance: number;
}

// -------------------------------------------------------------------- turno

/** Fotografia do início do mês, antes da carta. Base do "antes e depois". */
export interface MonthStartSnapshot {
  services: ByService<number>;
  resources: ByResource<number>;
  society: ByGroup<number>;
  hdi: number;
  commerce: number;
  currencyCents: number;
  debt: number;
  treasury: number;
  taxes: number;
  spending: number;
}

export interface TurnState {
  /** As três cartas do mês, sem repetição. Guardadas para recarregar não sortear de novo. */
  offeredCardIds: string[];
  /** Metas do mês. `null` = o serviço não tem meta neste mês. Fixas até o fechamento. */
  targets: ByService<number | null>;
  /** A carta escolhida e o que ela fez. Nula até o jogador decidir. */
  choice: CardResolution | null;
  start: MonthStartSnapshot;
}

// ---------------------------------------------------------------- relatórios

export type DefeatCause = 'servico' | 'recurso' | 'moeda' | 'grupo';

export interface DefeatInfo {
  cause: DefeatCause;
  /** Id do que zerou: `saude`, `comida`, `moeda`, `pobres`… */
  subject: string;
  label: string;
  month: number;
}

export interface RankReward {
  rank: number;
  /** Pontos de IDH recebidos (0 quando a posição paga em moeda). */
  hdi: number;
  /** Centavos de dólar recebidos (0 quando a posição paga em IDH). */
  currencyCents: number;
}

export interface ServiceReport {
  id: ServiceId;
  before: number;
  after: number;
  target: number | null;
  /** `null` quando o serviço não tinha meta. */
  met: boolean | null;
}

export interface ResourceReport {
  id: ResourceId;
  before: number;
  after: number;
  delta: number;
  /** Receita do mês gerada por este recurso, em reais. */
  revenue: number;
}

export type CrisisPhase = 'nenhuma' | 'iniciada' | 'em_curso' | 'encerrada';

/** Tudo o que a passagem de um mês fez, para o modal de fechamento e o histórico. */
export interface MonthReport {
  month: number;
  monthLabel: string;
  cardId: string | null;
  cardTitle: string | null;
  cardSuccess: boolean | null;

  services: ServiceReport[];
  /** Todos os serviços que tinham meta terminaram nela ou acima. */
  allTargetsMet: boolean;

  hdi: { before: number; after: number };
  commerce: { before: number; after: number };
  currency: { beforeCents: number; afterCents: number };
  debt: { before: number; after: number; riskPercent: number };
  gdp: {
    rankBefore: number;
    rankAfter: number;
    monthsAboveRival: number;
    /** Posição que o país persegue ao fim do mês (`null` no 1º lugar). */
    chasingRank: number | null;
    reward: RankReward | null;
  };

  resources: ResourceReport[];
  economy: {
    treasuryBefore: number;
    taxes: number;
    resourceRevenue: number;
    /** Gasto efetivo: zero durante a crise. */
    spending: number;
    extraordinaryCosts: number;
    balance: number;
    treasuryAfter: number;
    crisis: CrisisPhase;
    crisisMonthsLeft: number;
  };
  society: { id: GroupId; before: number; after: number }[];

  /** Frases curtas sobre o que aconteceu: moeda, dívida, promoção, crise… */
  notes: string[];
  defeat: DefeatInfo | null;
}

/** Um ponto da série histórica, gravado a cada fechamento. */
export interface MonthSnapshot {
  month: number;
  services: ByService<number>;
  resources: ByResource<number>;
  society: ByGroup<number>;
  hdi: number;
  commerce: number;
  currencyCents: number;
  debt: number;
  gdpRank: number;
  treasury: number;
  taxes: number;
  spending: number;
}

/** Linha do extrato de decisões. */
export interface DecisionRecord {
  month: number;
  monthLabel: string;
  cardId: string;
  title: string;
  success: boolean;
  cost: number;
  probability: number;
}

// ------------------------------------------------------------------- política

export type ElectiveOffice = 'presidente' | 'senador' | 'deputado';
/** Quem ocupa um cargo: o id de um NPC (`npc-01`…) ou `PLAYER_ID`. */
export type PersonId = string;

/** Um dos 40 políticos do jogo. Copiado da tabela fixa na criação e salvo no save. */
export interface PoliticalNpc {
  id: string;
  name: string;
  /** 0-100: aumenta o resultado das obras e o ganho das atividades. */
  efficiency: number;
  /** 0-100: puxa votos e muda com o desempenho no cargo. */
  popularity: number;
  /** 0-100: chance de decidir a favor do país. */
  honesty: number;
  /** 0-100: desempenho no cargo. Abaixo do piso, entra no painel de improdutivos. */
  productivity: number;
  /** Verbas desviadas como ministro. É o que uma investigação encontra. */
  diversions: number;
  /** Cassado: inelegível e fora de nomeações até este mês. */
  bannedUntil: number;
}

export interface PlayerPolitics {
  popularity: number;
  productivity: number;
  /** Cargo que o jogador disputa na próxima eleição. `null` = não concorre. */
  candidacy: ElectiveOffice | null;
  bannedUntil: number;
}

export interface Offices {
  president: PersonId | null;
  deputies: PersonId[];
  senators: PersonId[];
  ministers: ByService<PersonId | null>;
  /** `since`: mês da posse. O mandato no STF dura 16 anos. */
  stf: { id: PersonId; since: number }[];
}

export interface ElectionRace {
  office: ElectiveOffice;
  seats: number;
  results: { id: PersonId; votes: number; elected: boolean }[];
  /** Voto de cada eleitor, na ordem dos NPCs: `ballots[i]` é o voto de `npcs[i]`. Alimenta a apuração. */
  ballots?: PersonId[];
  /** Voto do jogador, quando ele votou nesta disputa. */
  playerVote?: PersonId;
}

/** Eleição com candidatos registrados, esperando o voto do jogador para ser apurada. */
export interface PendingElection {
  month: number;
  races: { office: ElectiveOffice; candidates: PersonId[] }[];
}

/** Duelo de leis no Congresso: as duas disputam o voto dos parlamentares; a mais votada segue ao STF. */
export interface LawDuel {
  id: string;
  month: number;
  /** Ids das duas proposições. */
  a: string;
  b: string;
  /** Voto de cada parlamentar (deputados, depois senadores). `null` = não votou. */
  ballots?: { voterId: PersonId; pick: 'a' | 'b' | null }[];
  winner?: 'a' | 'b';
}

export interface ElectionRecord {
  /** Mês em que os eleitos tomam posse. */
  month: number;
  races: ElectionRace[];
}

export type ProposalKind = 'lei' | 'orcamento' | 'investigacao' | 'stf';
/** `congresso`: leis, votadas em duelo pelas duas casas juntas no fechamento do mês. */
export type ProposalStage = 'congresso' | 'camara' | 'senado' | 'stf' | 'presidente';
export type ProposalStatus = 'em_tramitacao' | 'aprovada' | 'rejeitada' | 'vetada';

/** Projeto de lei, Lei Orçamentária, pedido de investigação ou indicação ao STF. */
export interface Proposal {
  id: string;
  kind: ProposalKind;
  title: string;
  authorId: PersonId;
  month: number;
  stage: ProposalStage;
  status: ProposalStatus;
  /** Lei: a carta do catálogo cujo efeito ela aplica. */
  cardId?: string;
  /** Orçamento: repasse mensal proposto para cada ministério. */
  budget?: ByService<number>;
  /** Investigação: o ministro investigado. Indicação: o indicado ao STF. */
  targetId?: PersonId;
  service?: ServiceId;
  /** Voto do jogador na etapa em curso (ausente = não votou). */
  playerVote?: boolean;
  tallies: { stage: ProposalStage; yes: number; no: number; month: number }[];
  closedMonth?: number;
}

export interface ServiceAdmin {
  /** Verba do ministério, em reais. Só o ministro da área gasta. */
  fund: number;
  structures: number;
  /** Estruturas que precisam de manutenção. */
  worn: number;
}

export interface Invitation {
  id: string;
  kind: 'ministro' | 'stf';
  service?: ServiceId;
  fromId: PersonId;
  month: number;
}

export interface PoliticsState {
  /** Cursor do sorteador próprio da política: não mexe nos sorteios das cartas. */
  rngCursor: number;
  nextId: number;
  npcs: PoliticalNpc[];
  player: PlayerPolitics;
  offices: Offices;
  /** Lei Orçamentária em vigor: repasse mensal a cada ministério, parte dos gastos públicos. */
  budget: ByService<number>;
  admin: ByService<ServiceAdmin>;
  proposals: Proposal[];
  elections: ElectionRecord[];
  pendingElection?: PendingElection;
  /** Duelos de leis dos últimos meses. */
  duels: LawDuel[];
  invitations: Invitation[];
  /** Uma reunião diplomática por mês. */
  lastMeetingMonth: number;
  /** Uma iniciativa (projeto ou pedido de investigação) por mês. */
  lastInitiativeMonth: number;
  log: { month: number; text: string }[];
}

// -------------------------------------------------------------------- partida

export type GamePhase = 'jogando' | 'derrota';

export interface GameFlags {
  /** O país já chegou ao 1º lugar do ranking de PIB. A partida segue depois disso. */
  reachedFirst: boolean;
  /** O jogador já viu o tutorial inicial. */
  tutorialDone: boolean;
}

export interface GameState {
  id: string;
  /** Versão do formato do save. Saves de outra versão não são lidos. */
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  seed: number;
  rngCursor: number;
  phase: GamePhase;
  /** Mês em curso: 1 é janeiro do ano inicial. Não há limite — a partida só acaba na derrota. */
  month: number;
  startYear: number;
  president: President;

  services: ByService<number>;
  resources: ByResource<number>;
  /**
   * Pressão acumulada dos serviços sobre cada recurso. É o que torna a
   * influência gradual: um ponto de serviço entra aqui e vai escoando para o
   * recurso ao longo de vários meses.
   */
  resourcePressure: ByResource<number>;
  international: InternationalState;
  economy: EconomyState;
  society: ByGroup<number>;

  turn: TurnState;
  /** Cargos, eleições, Congresso, ministérios e STF. */
  politics: PoliticsState;

  flags: GameFlags;
  defeat: DefeatInfo | null;
  lastReport: MonthReport | null;
  history: MonthSnapshot[];
  decisions: DecisionRecord[];
}

export interface NewGameInput {
  /** Identidade do jogador (nome e retrato). */
  president: President;
  seed?: number;
  startYear?: number;
  /**
   * Cargo disputado na eleição de abertura. Ausente = o jogador já começa
   * presidente, como no jogo antes das eleições (testes, simulador, saves antigos).
   */
  candidacy?: ElectiveOffice | null;
}

export interface SaveSlotMeta {
  id: string;
  name: string;
  month: number;
  monthLabel: string;
  gdpRank: number;
  treasury: number;
  updatedAt: string;
  presidentName: string;
  defeated: boolean;
}
