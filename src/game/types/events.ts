import type { PolicyCategory } from './common';
import type { PolicyImpact, GroupImpact } from './policy';
import type { SpouseStance } from './president';

export type EventCategory =
  | 'economico'
  | 'politico'
  | 'social'
  | 'natural'
  | 'internacional'
  | 'judicial'
  | 'pessoal'
  | 'governamental'
  | 'congresso'
  | 'midia';

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'economico',
  'politico',
  'social',
  'natural',
  'internacional',
  'judicial',
  'pessoal',
  'governamental',
  'congresso',
  'midia',
] as const;

export type EventSeverity = 'rotina' | 'atencao' | 'grave' | 'critico';

export interface EventOption {
  id: string;
  label: string;
  description: string;
  /** Consequência anunciada ao jogador antes de escolher. */
  warning: string;
  cost: number;
  impacts: PolicyImpact;
  groupImpacts: GroupImpact[];
  approvalDelta: number;
  congressDelta: number;
  stressDelta: number;
  requires?: EventRequirement;
  /**
   * Efeito sobre um país específico e sobre a posição do Brasil no mundo.
   *
   * Existe porque relação diplomática não cabe nos indicadores nacionais: um
   * acordo com um país muda a relação COM AQUELE PAÍS, e é isso que a próxima
   * visita e o próximo acordo vão encontrar.
   */
  diplomacy?: EventDiplomaticEffect;
  /**
   * Efeito sobre a família do presidente.
   *
   * Existe pela mesma razão que o efeito diplomático existe: quem mora com o
   * presidente não cabe nos indicadores nacionais. É por aqui que uma escolha
   * alivia (ou piora) o estresse de quem está em casa, que uma relação começa
   * durante o mandato e que ela termina.
   */
  family?: EventFamilyEffect;
}

export interface EventFamilyEffect {
  /** Muda o estresse do cônjuge, em pontos. Negativo alivia. */
  spouseStressDelta?: number;
  /** Muda a exposição pública do cônjuge, em pontos. */
  exposureDelta?: number;
  /** Redefine a postura pública do cônjuge. */
  stance?: SpouseStance;
  /** Começa uma relação: entra um cônjuge na família do presidente. */
  startRelationship?: { name: string; age: number; occupation: string };
  /** Encerra a relação em curso. O cônjuge sai da família. */
  endRelationship?: boolean;
}

export interface EventDiplomaticEffect {
  /** Id do país em `state.diplomacy.countries`. */
  countryId: string;
  relationDelta?: number;
  tradeDelta?: number;
  trustDelta?: number;
  tensionDelta?: number;
  /** Isolamento do Brasil no tabuleiro, 0-100. Negativo aproxima o país do mundo. */
  isolationDelta?: number;
}

export interface EventRequirement {
  minTreasury?: number;
  minApproval?: number;
  minCongressGoodwill?: number;
  abinActive?: boolean;
}

export interface GameEventDefinition {
  id: string;
  title: string;
  category: EventCategory;
  severity: EventSeverity;
  /** Texto de abertura, escrito como manchete de telejornal. */
  brief: string;
  /** Peso base do sorteio. */
  weight: number;
  /** Condições mínimas para o evento entrar no sorteio. */
  conditions?: EventConditions;
  options: EventOption[];
  tags: PolicyCategory[];
  /** Evento que só pode acontecer uma vez por partida. */
  once: boolean;
}

export interface EventConditions {
  minMonth?: number;
  maxMonth?: number;
  minInflation?: number;
  maxApproval?: number;
  minApproval?: number;
  minUnemployment?: number;
  minDebt?: number;
  maxFiscalCredibility?: number;
  minUnrest?: number;
  minImpeachmentRisk?: number;
  requiresPolicyCategory?: PolicyCategory;
}

export interface ActiveEvent {
  id: string;
  definitionId: string;
  month: number;
  title: string;
  brief: string;
  category: EventCategory;
  severity: EventSeverity;
  options: EventOption[];
  resolvedOptionId?: string;
  resolution?: string;
}

/** Desdobramento tardio de uma decisão já tomada. */
export interface Consequence {
  id: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  body: string;
  month: number;
  kind: 'efeito_direto' | 'efeito_colateral' | 'cobranca' | 'colheita';
  impacts: PolicyImpact;
  approvalDelta: number;
}

export type NewsTone = 'positiva' | 'negativa' | 'neutra' | 'critica';

export interface NewsItem {
  id: string;
  month: number;
  outlet: string;
  headline: string;
  body: string;
  tone: NewsTone;
  category: EventCategory;
  reach: number;
}

export interface SocialPost {
  id: string;
  month: number;
  author: string;
  handle: string;
  kind: 'jornalista' | 'influenciador' | 'cidadao' | 'politico' | 'economista';
  text: string;
  tone: NewsTone;
  likes: number;
}

export interface TimelineEntry {
  id: string;
  month: number;
  monthLabel: string;
  title: string;
  detail: string;
  kind: 'posse' | 'medida' | 'evento' | 'crise' | 'votacao' | 'nomeacao' | 'viagem' | 'pessoal' | 'marco';
  approvalAfter: number;
}

// ---------------------------------------------------------------------------
// Eventos dinâmicos
// ---------------------------------------------------------------------------

/**
 * EVENTOS QUE SE MONTAM A PARTIR DO PAÍS
 *
 * O catálogo estático (`EVENT_CATALOG`) traz situações escritas por inteiro. Um
 * evento dinâmico é diferente: ele traz um MOLDE, e as pessoas, empresas e
 * países saem do estado da partida na hora em que ele acontece.
 *
 * Isso muda a natureza da agenda. "Ministro provoca governador em entrevista"
 * deixa de ser uma frase e passa a ser o SEU ministro provocando o governador
 * do estado onde você tem base — com as consequências caindo exatamente sobre
 * essa relação, e não sobre um número genérico.
 *
 * Os dois catálogos são sorteados juntos, pelo mesmo motor, e produzem o mesmo
 * `ActiveEvent`. Nada na interface, na resolução ou no fechamento do mês sabe
 * a diferença — e é assim que a expansão não vira um sistema paralelo.
 */
export interface BuiltEvent {
  title: string;
  brief: string;
  options: EventOption[];
  /**
   * Desdobramento agendado: o id de outro evento dinâmico que passa a ser
   * prioritário daqui a alguns meses. É o que transforma uma provocação em
   * rompimento e um escândalo em CPI.
   */
  followUp?: { definitionId: string; afterMonths: number };
}

export interface DynamicEventDefinition {
  id: string;
  category: EventCategory;
  severity: EventSeverity;
  /** Peso base do sorteio, na mesma escala do catálogo estático. */
  weight: number;
  tags: PolicyCategory[];
  once?: boolean;
  /** Meses de silêncio depois de acontecer. Evita a agenda repetir o assunto. */
  cooldownMonths?: number;
  /** Condições numéricas, iguais às do catálogo estático. */
  conditions?: EventConditions;
  /**
   * Porta de entrada: o evento só entra no sorteio se isto for verdade. É aqui
   * que "eventos do cônjuge" ficam impossíveis para quem não tem cônjuge.
   */
  canGenerate?: (state: GameStateLike) => boolean;
  /**
   * Quanto o país está pedindo este evento agora. Multiplica o peso — um
   * escândalo pesa mais em governo desmoralizado, um elogio internacional pesa
   * mais em governo estável.
   */
  pressure?: (state: GameStateLike) => number;
  /**
   * Monta o evento com as entidades sorteadas. Devolver `null` significa "não
   * havia com quem montar isto agora" — sem ministro, sem estatal, sem país
   * parceiro — e o motor simplesmente segue para o próximo candidato.
   */
  build: (state: GameStateLike, rng: RngLike) => BuiltEvent | null;
}

/**
 * O motor de eventos recebe o estado inteiro, mas o catálogo não precisa
 * conhecer o módulo do estado para ser tipado — o que evitaria um ciclo de
 * imports entre tipos. Estes dois apelidos existem só para isso.
 */
export type GameStateLike = import('./game').GameState;
export type RngLike = import('../utils/rng').Rng;
