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

  flags: GameFlags;
  defeat: DefeatInfo | null;
  lastReport: MonthReport | null;
  history: MonthSnapshot[];
  decisions: DecisionRecord[];
}

export interface NewGameInput {
  president: President;
  seed?: number;
  startYear?: number;
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
