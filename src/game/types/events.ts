import type { PolicyCategory } from './common';
import type { PolicyImpact, GroupImpact } from './policy';

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
