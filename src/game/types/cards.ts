import type {
  CardCategory,
  GroupId,
  InternationalId,
  ResourceId,
  ServiceId,
} from './common';

/** Efeitos que uma medida pode produzir. Todos opcionais e aditivos. */
export interface CardEffects {
  /** Pontos de serviço (0-100). */
  services?: Partial<Record<ServiceId, number>>;
  /** Pontos de recurso (0-1000). */
  resources?: Partial<Record<ResourceId, number>>;
  /** IDH (0-1000) e Comércio (0-1000). */
  international?: Partial<Record<InternationalId, number>>;
  /** Pontos de satisfação (0-100). */
  social?: Partial<Record<GroupId, number>>;
}

/**
 * Uma medida do catálogo. É um dado, não um componente: mudar um valor aqui
 * não exige tocar em nenhuma lógica de execução.
 */
export interface Card {
  /** Identificador estável, ex.: `carta-07`. */
  id: string;
  /** Número da carta no catálogo (1 a 60). */
  number: number;
  title: string;
  /** Uma ou duas frases dizendo o que será feito. */
  description: string;
  category: CardCategory;
  /** Chance de sucesso, de 0 a 100. */
  probability: number;
  /** Despesa extraordinária, em reais. Cobrada sempre, dê certo ou não. */
  implementationCost: number;
  /** Variação PERMANENTE da arrecadação mensal de impostos, em reais. */
  recurringTaxChange: number;
  /** Variação PERMANENTE dos gastos públicos mensais, em reais. */
  recurringExpenseChange: number;
  /**
   * Quando verdadeiro, a variação recorrente de impostos/gastos vale mesmo se a
   * medida fracassar. É o caso dos incentivos fiscais: o governo abre mão da
   * receita de qualquer jeito; o que pode falhar é o benefício que viria dela.
   */
  recurringAppliesOnFailure: boolean;

  /** Efeitos aplicados em caso de SUCESSO. */
  serviceEffects: NonNullable<CardEffects['services']>;
  resourceEffects: NonNullable<CardEffects['resources']>;
  internationalEffects: NonNullable<CardEffects['international']>;
  socialEffects: NonNullable<CardEffects['social']>;
  /**
   * Alternativas excludentes de serviço: uma é sorteada na execução e somada
   * aos `serviceEffects`. Usada pela carta 45 ("+1 Agricultura ou +1 Infraestrutura").
   */
  randomServiceEffects?: Partial<Record<ServiceId, number>>[];

  /** A medida constrói algo? Alimenta o aviso de obra e a reação dos indígenas. */
  createsStructure: boolean;
  /** O que é construído, para exibir na carta. */
  structureLabel?: string;

  /** Consequências adicionais APENAS em caso de fracasso. */
  failureEffects?: CardEffects;
}

/** Uma alteração concreta feita pela medida, já com o limite aplicado. */
export interface AppliedChange {
  kind: 'service' | 'resource' | 'international' | 'social' | 'taxes' | 'spending';
  /** `saude`, `comida`, `hdi`, `pobres`… */
  key: string;
  label: string;
  before: number;
  after: number;
  /** `after - before`: o que de fato mudou, não o que a carta pedia. */
  delta: number;
  /** Quanto a carta pedia (difere de `delta` quando bate no limite). */
  requested: number;
}

/** O que aconteceu quando o jogador escolheu uma carta. */
export interface CardResolution {
  cardId: string;
  /** Mês em que a carta foi escolhida. */
  month: number;
  /** Chance de sucesso usada (0-100). */
  probability: number;
  /** Número sorteado (0-100). Sucesso quando `roll < probability`. */
  roll: number;
  success: boolean;
  /**
   * Trava contra aplicação em dobro: os efeitos entram uma única vez, na
   * escolha, e a passagem do mês confere esta marca antes de qualquer coisa.
   */
  applied: boolean;
  /** Despesa extraordinária, descontada do cofre no fechamento do mês. */
  cost: number;
  /** Alternativa sorteada de `randomServiceEffects`, quando houver. */
  randomPick?: Partial<Record<ServiceId, number>>;
  changes: AppliedChange[];
}
