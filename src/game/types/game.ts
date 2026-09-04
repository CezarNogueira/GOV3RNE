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
  gameOverReason?: 'mandato_encerrado' | 'impeachment' | 'renuncia' | 'saude';
}

export type GamePhase = 'criacao' | 'posse' | 'mandato' | 'encerrado';

/** Estado completo e serializável de uma partida. */
export interface GameState {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  seed: number;
  rngCursor: number;
  phase: GamePhase;
  /** 1 a 48. */
  month: number;
  startYear: number;
  totalMonths: number;
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

  policies: Policy[];
  programs: GovernmentProgram[];

  pendingEvents: ActiveEvent[];
  consequences: Consequence[];
  news: NewsItem[];
  posts: SocialPost[];
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
