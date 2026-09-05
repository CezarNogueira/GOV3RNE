import type { PolicyCategory } from './common';
import type { MinistryId } from './politics';

/**
 * RECONHECIMENTO DE INTENÇÃO
 *
 * O jogador escreve em português corrido e o jogo precisa entender o que ele
 * quis. Não há modelo de linguagem: há dicionário, banco de entidades do
 * próprio jogo, distância de edição e regras de contexto — tudo local e
 * determinístico, a mesma frase produzindo sempre a mesma leitura.
 *
 * O reconhecedor NÃO altera o estado da partida e não decide se a medida é boa.
 * Ele responde três perguntas e para:
 *
 *   1. o que a pessoa quer fazer   -> intent
 *   2. sobre o quê                 -> entities
 *   3. com que números             -> numbers
 *
 * O que fazer com isso é decisão do construtor de medida e, depois dele, do
 * sistema legislativo que já existe.
 */

/** Tipos de coisa que o jogo sabe reconhecer num texto. */
export type EntityKind =
  | 'COMPANY'
  | 'MINISTRY'
  | 'BUDGET_AREA'
  | 'TAX'
  | 'SECTOR'
  | 'SOCIAL_GROUP'
  | 'NUMERIC_TARGET'
  | 'PROGRAM'
  | 'COUNTRY';

export interface EntityRecord {
  kind: EntityKind;
  id: string;
  name: string;
  /** Todas as formas de escrever isso, já normalizadas. */
  aliases: string[];
  /** Dado auxiliar que o construtor precisa (ministryId de uma pasta, por exemplo). */
  meta?: Record<string, string | number | boolean>;
}

export interface RecognizedEntity {
  kind: EntityKind;
  id: string;
  name: string;
  /** 0-1. Casamento exato vale 1; aproximado vale menos. */
  confidence: number;
  /** O trecho do texto que casou. */
  matchedText: string;
  meta?: Record<string, string | number | boolean>;
}

/** Como o número foi escrito, para não confundir "para" com "em". */
export type NumberMode = 'SET' | 'INCREASE' | 'DECREASE' | 'PERCENT_INCREASE' | 'PERCENT_DECREASE';

export interface RecognizedNumber {
  value: number;
  unit: 'BRL' | 'BRL_BILLION' | 'PERCENT' | 'PERCENT_POINT' | 'COUNT';
  mode: NumberMode;
  /** Trecho de origem, para a tela mostrar o que foi lido. */
  matchedText: string;
}

/**
 * O que o sistema pode fazer com a leitura.
 *
 *   DIRETO       a frase já diz tudo — segue para a ficha técnica de sempre;
 *   CONFIGURAR   a intenção é clara mas falta o "como" — abre um construtor;
 *   ESCOLHER     há mais de uma leitura plausível — pergunta antes de seguir;
 *   NADA         não deu para entender o suficiente.
 */
export type RecognitionAction = 'DIRETO' | 'CONFIGURAR' | 'ESCOLHER' | 'NADA';

export interface RecognitionChoice {
  /** Id da intenção ou da entidade que esta opção representa. */
  id: string;
  label: string;
  detail: string;
  /** Texto que substitui o do jogador se ele escolher esta opção. */
  rewrite?: string;
}

export interface RecognizedMeasure {
  rawText: string;
  normalizedText: string;
  /** Id da intenção reconhecida, ou 'desconhecida'. */
  intent: string;
  intentLabel: string;
  /** 0-1, combinando a força da intenção e das entidades. */
  confidence: number;
  entities: RecognizedEntity[];
  numbers: RecognizedNumber[];
  category?: PolicyCategory;
  ministries: MinistryId[];
  /** Construtor a abrir quando a medida precisa ser configurada. */
  builder?: string;
  action: RecognitionAction;
  /** Frase curta em português dizendo o que o sistema entendeu. */
  reading: string;
  /** Opções quando há ambiguidade. */
  choices: RecognitionChoice[];
  /** Ressalvas da leitura: negação detectada, alvo faltando, grafia corrigida. */
  notes: string[];
  /** true quando a frase nega a ação ("não quero privatizar"). */
  negated: boolean;
  /** true quando a frase pede estudo, não execução ("estudar a privatização"). */
  hypothetical: boolean;
}

// ---------------------------------------------------------------------------
// Construtores de medida
// ---------------------------------------------------------------------------

/** Uma escolha dentro de um construtor: "reduzir impostos", "criar crédito". */
export interface BuilderOption {
  id: string;
  label: string;
  /** O que essa opção faz, em uma linha. */
  detail: string;
  /**
   * Trecho que entra no texto final da medida quando a opção é escolhida. É
   * assim que o construtor conversa com o interpretador temático que já existe:
   * ele escreve a medida em português, e o resto do jogo lê como sempre leu.
   */
  clause: string;
  /** Custo indicativo por opção, R$ bilhões/ano. Serve para a tela somar. */
  cost: number;
  /** Alvo numérico que esta opção move, quando existe. */
  numericTarget?: string;
  /** Quanto move, na unidade do alvo. Positivo aumenta, negativo reduz. */
  numericDelta?: number;
}

export interface BuilderAmountSpec {
  label: string;
  /** Unidade do campo de valor. */
  unit: 'BRL_BILLION' | 'PERCENT';
  min: number;
  max: number;
  step: number;
  default: number;
  hint: string;
}

/** Tipo de tela que o construtor pede. */
export type BuilderShape = 'OPCOES' | 'ORCAMENTO' | 'REFORMA_TRIBUTARIA' | 'EMPRESA' | 'PODER';

export interface BuilderSpec {
  id: string;
  title: string;
  /** Frase de abertura do painel, na voz do sistema. */
  intro: string;
  shape: BuilderShape;
  category: PolicyCategory;
  ministries: MinistryId[];
  options: BuilderOption[];
  amount?: BuilderAmountSpec;
  /**
   * Alvo numérico onde o dinheiro do painel efetivamente entra ou sai. É ele
   * que faz o painel mexer no orçamento de verdade em vez de gerar texto: o
   * construtor escreve a medida já apontando para esta conta, e o motor
   * numérico que já existe faz o resto.
   */
  budgetTarget?: string;
  /** Instrumento sugerido para a medida montada. */
  instrument?: 'decreto' | 'medida_provisoria' | 'projeto_lei' | 'pec';
  /** Quantas opções o jogador precisa escolher, no mínimo. */
  minOptions: number;
}

/** O que o painel devolve depois de configurado. */
export interface MeasurePlan {
  builderId: string;
  title: string;
  /** Opções marcadas. */
  optionIds: string[];
  /** Valor do campo de quantia, quando o construtor tem um. */
  amount?: number;
  /** Alterações numéricas estruturadas (orçamento, alíquotas). */
  changes: PlannedChange[];
  /** Entidade central da medida, quando existe (empresa, pasta). */
  entityId?: string;
  entityName?: string;
}

/** Uma alteração numérica montada pelo painel, já no alvo do jogo. */
export interface PlannedChange {
  /** Id em NUMERIC_TARGETS. */
  target: string;
  /** Valor final desejado, na unidade do alvo. */
  value: number;
  /** Como o painel expressou a mudança, para o texto da medida. */
  label: string;
}
