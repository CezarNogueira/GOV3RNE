import type { Difficulty, PolicyCategory, Region } from './common';
import type { CampaignPromise, FamilyMember, PartyProfile, President } from './president';
import type { EconomyState, EconomySnapshot, BudgetLine, TaxLine } from './economy';
import type { CompaniesState } from './companies';
import type {
  NationState,
  FederalUnit,
  SocialGroup,
  CountryRelation,
  DiplomaticBloc,
  StateVisit,
  ActiveTreaty,
  TreatyOffer,
} from './world';
import type { CongressState, Committee, Minister, OppositionState, SupremeCourtState } from './politics';
import type { Policy, GovernmentProgram, ScheduledAction } from './policy';
import type { ActiveEvent, Consequence, NewsItem, SocialPost, TimelineEntry } from './events';
import type { ElectionState } from './election';
import type { DecisionEntry } from './decisions';

export interface ApprovalState {
  /** Aprovação do governo, 0-100. */
  overall: number;
  /** Aprovação pessoal do presidente (costuma ser maior que a do governo). */
  personal: number;
  byRegion: Record<Region, number>;
  byGroup: Record<string, number>;
  /** Aprovação entre parlamentares, 0-100. */
  congress: number;
  /** Aprovação entre governadores. */
  governors: number;
  /** Momentum do governo, -100 a +100. */
  momentum: number;
  history: number[];
}

export interface AgendaState {
  /** Pontos de agenda disponíveis no mês. */
  points: number;
  maxPoints: number;
  scheduled: ScheduledAction[];
  /** Se houver viagem marcada, o mês doméstico é substituído. */
  travelBooked: boolean;
}

export interface GovernmentState {
  ministers: Minister[];
  vicePresidentId: string;
  vicePresidentName: string;
  vicePresidentParty: string;
  vicePresidentLoyalty: number;
  vicePresidentArticulation: number;
  vicePresidentStatus: 'na_linha' | 'incomodado' | 'solto' | 'rompido';
  /** Serviço de inteligência: antecipa a crise do mês seguinte. */
  intelligenceActive: boolean;
  intelligenceExposure: number;
  cabinetReshuffles: number;
  committees: Committee[];
  supremeCourt: SupremeCourtState;
  opposition: OppositionState;
}

export interface DiplomacyState {
  /** -100 (China) a +100 (EUA). */
  alignment: number;
  isolation: number;
  countries: CountryRelation[];
  blocs: DiplomaticBloc[];
  visits: StateVisit[];
  /** Acordos bilaterais assinados e em vigor. */
  treaties: ActiveTreaty[];
  /** Acordos colocados na mesa numa visita, aguardando aceite ou recusa. */
  pendingOffers: TreatyOffer[];
}

export interface MonthResult {
  month: number;
  monthLabel: string;
  approvalDelta: number;
  gdpDelta: number;
  inflationDelta: number;
  unemploymentDelta: number;
  congressDelta: number;
  treasuryDelta: number;
  headlines: string[];
  highlights: ResultHighlight[];
}

export interface ResultHighlight {
  label: string;
  value: string;
  delta: number;
  tone: 'positivo' | 'negativo' | 'neutro';
}

export interface GameSettings {
  difficulty: Difficulty;
  animations: boolean;
  volume: number;
  eventFrequency: number;
  dataMode: 'inicial_real' | 'ficcional';
  language: 'pt-BR';
  tutorialDone: boolean;
  reelection: boolean;
}

export interface GameFlags {
  tutorialStep: number;
  seenIntro: boolean;
  /** Eventos "once" já disparados. */
  firedEvents: string[];
  gameOver: boolean;
  /**
   * Mês em que cada evento dinâmico aconteceu pela última vez. É o que impede
   * a agenda de repetir o mesmo assunto duas vezes seguidas.
   */
  eventCooldowns?: Record<string, number>;
  /**
   * Desdobramentos agendados: evento que passa a ser prioritário a partir do
   * mês marcado. É o que transforma uma provocação em rompimento e um
   * escândalo em CPI, em vez de deixar cada crise isolada.
   */
  pendingFollowUps?: { definitionId: string; dueMonth: number }[];
  gameOverReason?: 'mandato_encerrado' | 'impeachment' | 'renuncia' | 'saude' | 'derrota_eleitoral';
}

/**
 * `transicao` é o intervalo entre ganhar a eleição e assumir o segundo
 * mandato: o relógio do primeiro parou, o do segundo ainda não começou, e o
 * presidente precisa dizer com que programa volta.
 */
export type GamePhase = 'criacao' | 'posse' | 'mandato' | 'transicao' | 'encerrado';

/** Estado completo e serializável de uma partida. */
export interface GameState {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  seed: number;
  rngCursor: number;
  phase: GamePhase;
  /** 1 a 48 no primeiro mandato; até 96 quando há reeleição. */
  month: number;
  startYear: number;
  totalMonths: number;
  /**
   * Mandato em curso: 1 no primeiro, 2 depois de uma reeleição. A Constituição
   * permite uma reeleição e só uma, então este número nunca passa de 2.
   */
  term: number;
  settings: GameSettings;
  flags: GameFlags;

  president: President;
  party: PartyProfile;
  family: FamilyMember[];
  promises: CampaignPromise[];

  economy: EconomyState;
  nation: NationState;
  approval: ApprovalState;
  agenda: AgendaState;
  government: GovernmentState;
  congress: CongressState;
  diplomacy: DiplomacyState;

  states: FederalUnit[];
  socialGroups: SocialGroup[];
  budget: BudgetLine[];
  taxes: TaxLine[];
  /**
   * Sistema nacional de empresas: estatais, privadas, commodities, alavancas
   * tributárias e processos societários em curso. Substituiu a lista decorativa
   * de "corporations" que existia antes — aquela não reagia a nada.
   */
  companies: CompaniesState;

  /**
   * A disputa pela reeleição. Nasce nula e é montada no quarto ano, quando a
   * janela eleitoral abre — ou fica nula para sempre se a partida foi criada
   * com a reeleição desabilitada.
   */
  election: ElectionState | null;

  policies: Policy[];
  programs: GovernmentProgram[];

  pendingEvents: ActiveEvent[];
  consequences: Consequence[];
  news: NewsItem[];
  posts: SocialPost[];
  /**
   * O que cada decisão do presidente fez com o país, medido antes e depois.
   * É o extrato que a interface mostra na hora e o histórico guarda.
   */
  decisions: DecisionEntry[];
  timeline: TimelineEntry[];
  history: EconomySnapshot[];
  lastResult: MonthResult | null;
}

export interface FinalEvaluationAxis {
  id: string;
  label: string;
  score: number;
  note: string;
}

export interface FinalEvaluation {
  axes: FinalEvaluationAxis[];
  finalApproval: number;
  historicalPopularity: number;
  overall: number;
  legacyTitle: string;
  legacyBody: string;
  promisesKept: number;
  promisesTotal: number;
  grade: string;
  highlights: string[];
  categoryScores: Partial<Record<PolicyCategory, number>>;
}

export interface SaveSlotMeta {
  id: string;
  name: string;
  month: number;
  monthLabel: string;
  approval: number;
  difficulty: Difficulty;
  updatedAt: string;
  presidentName: string;
  party: string;
  autosave: boolean;
}
