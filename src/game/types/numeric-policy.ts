import type { GroupImpact, PolicyImpact } from './policy';

/**
 * MEDIDAS NUMÉRICAS
 *
 * Quando o presidente escreve um número, esse número é a medida. "Salário
 * mínimo para R$ 1.700" e "para R$ 1.800" não são a mesma política com um
 * rótulo diferente: são +4,9% e +11,1%, e tudo o que vem depois — custo,
 * inflação, emprego, reação — tem de sair daí.
 *
 * REGRAS DESTE MÓDULO
 *
 * 1. O valor ATUAL nunca é adivinhado: sai do GameState.
 * 2. O valor PROPOSTO sai do texto do presidente, lido por parser determinístico.
 * 3. O impacto sai de `delta`, `percentageDelta`, exposição e contexto econômico —
 *    nunca do nome da medida.
 * 4. Nada de degraus: as fórmulas são contínuas, então +4,9% e +5,1% produzem
 *    resultados parecidos mas diferentes.
 * 5. A escala interna é precisa; a apresentada ao jogador é uma faixa.
 */

/** O que a unidade significa, para o parser e para a formatação. */
export type NumericUnit =
  /** Reais por mês (salário mínimo, benefício, piso). */
  | 'BRL_MONTHLY'
  /** R$ bilhões por ano (orçamento, subsídio, investimento). */
  | 'BRL_ANNUAL_BILLION'
  /** Alíquota ou taxa em % (FGTS, IRPJ, tarifa). */
  | 'PERCENT'
  /** Taxa anual em % (Selic). */
  | 'PERCENT_ANNUAL'
  /** Contagem de pessoas ou coisas (policiais, médicos, casas). */
  | 'COUNT';

export const NUMERIC_UNIT_LABEL: Record<NumericUnit, string> = {
  BRL_MONTHLY: 'R$ por mês',
  BRL_ANNUAL_BILLION: 'R$ bilhões por ano',
  PERCENT: '%',
  PERCENT_ANNUAL: '% ao ano',
  COUNT: 'unidades',
};

/** O que a frase pede que se faça com o número. */
export type NumericOperation =
  /** "para R$ 1.700" — o número é o valor final. */
  | 'SET_VALUE'
  /** "em R$ 100" — o número é o acréscimo. */
  | 'INCREASE_ABSOLUTE'
  | 'DECREASE_ABSOLUTE'
  /** "em 10%" — o número é a variação relativa. */
  | 'INCREASE_PERCENT'
  | 'DECREASE_PERCENT';

/**
 * Classificação por tamanho. Existe só para escolher o TOM do texto e o grau da
 * reação — nunca para substituir a conta. Duas medidas na mesma faixa continuam
 * tendo impactos diferentes, porque o impacto vem do número, não da faixa.
 */
export type NumericMagnitude = 'small' | 'moderate' | 'large' | 'veryLarge' | 'extreme';

export const MAGNITUDE_LABEL: Record<NumericMagnitude, string> = {
  small: 'pequena',
  moderate: 'moderada',
  large: 'grande',
  veryLarge: 'muito grande',
  extreme: 'extrema',
};

/** Modelo econômico que o motor usa para transformar o delta em consequência. */
export type NumericModel =
  | 'salario_minimo'
  | 'encargo_folha'
  | 'tributo'
  | 'orcamento'
  | 'beneficio_social'
  | 'juros'
  | 'subsidio'
  | 'efetivo';

/** A alteração numérica em si, antes de qualquer consequência. */
export interface NumericPolicyChange {
  target: string;
  targetLabel: string;
  /** Lido do GameState, nunca do texto. */
  currentValue: number;
  proposedValue: number;
  /** proposedValue menos currentValue, na unidade do alvo. */
  absoluteDelta: number;
  /** Variação relativa em %, sempre sobre o valor atual. */
  percentageDelta: number;
  /**
   * Só para alíquotas: a diferença em PONTOS percentuais.
   * 8% -> 6% são -2 pontos percentuais e -25% de variação relativa. Confundir
   * os dois é o erro mais comum em texto sobre tributo, e o jogo mostra os dois.
   */
  pointDelta?: number;
  direction: 'increase' | 'decrease' | 'flat';
  unit: NumericUnit;
  operation: NumericOperation;
  /** Quem a medida alcança, em palavras. */
  scope: string;
  /**
   * Fração de alcance, 0-1. Uma medida geral vale 1; uma restrita a
   * microempresas vale a fração correspondente, e TODOS os efeitos calculados
   * são multiplicados por ela — custo, folha, emprego, inflação.
   */
  scopeFactor: number;
  /** Recorte declarado no texto, quando existe. */
  scopeLabel?: string;
  /** Quantas pessoas são atingidas de forma relevante. */
  affectedPopulation: number;
  /** 0-1: fração média de exposição de quem é atingido. */
  exposureRate: number;
  /** Mês do mandato em que passa a valer. */
  effectiveMonth: number;
  /** Meses de efeito dentro do primeiro exercício. */
  monthsInFirstYear: number;
  temporary: boolean;
  durationMonths?: number;
  /** Quando a medida é escalonada ("ao longo de dois anos"). */
  gradualMonths?: number;
  economicCategory: string;
  magnitude: NumericMagnitude;
  model: NumericModel;
  /** Frase curta explicando como o texto foi lido. */
  reading: string;
}

/** Uma linha da conta fiscal, para o custo nunca ser um número solto. */
export interface FiscalComponent {
  label: string;
  /** R$ bilhões por ano, positivo = despesa, negativo = receita. */
  annualBillions: number;
  /** R$ bilhões no primeiro exercício, já considerando o mês de vigência. */
  firstYearBillions: number;
  note: string;
}

/**
 * Estimativa apresentável: valor central preciso por dentro, faixa por fora.
 * O jogo não finge saber que o PIB vai subir 0,27381%.
 */
export interface ImpactEstimate {
  label: string;
  /** Valor central. Usado nos cálculos. */
  value: number;
  low: number;
  high: number;
  unit: 'pp' | 'percent' | 'brl_bi' | 'jobs' | 'people' | 'index';
  /** Explicação curta de onde saiu. */
  note: string;
}

export interface FiscalBreakdown {
  components: FiscalComponent[];
  /** Despesa bruta anual, R$ bilhões. */
  grossAnnual: number;
  /** Receita adicional que a própria medida gera, R$ bilhões. */
  revenueOffsetAnnual: number;
  /** Saldo líquido anual: despesa menos receita. Positivo = custa. */
  netAnnual: number;
  /** Saldo líquido no primeiro exercício. */
  netFirstYear: number;
  /** Saldo recorrente a partir do exercício seguinte. */
  netRecurring: number;
}

export interface BusinessBreakdown {
  /** Custo adicional de folha do setor privado, R$ bilhões por ano. */
  payrollCostAnnual: number;
  /** Pressão sobre a margem média, em pontos percentuais. */
  marginPressure: number;
  /** Empregos formais em risco (negativo) ou criados (positivo). */
  employmentEffect: number;
  /** Empresas mais expostas, por id. */
  mostExposed: string[];
}

export interface HouseholdBreakdown {
  /** Renda adicional das famílias, R$ bilhões por ano. */
  extraIncomeAnnual: number;
  /** Ganho real de poder de compra, em %. Já descontada a inflação esperada. */
  realGain: number;
  /** Variação do consumo, em %. */
  consumptionChange: number;
  povertyDelta: number;
  giniDelta: number;
}

/** Uma linha do memorial de cálculo, para o modo de depuração. */
export interface NumericDebugLine {
  label: string;
  value: string;
}

/**
 * O resultado completo de uma medida numérica: a alteração, a conta fiscal
 * aberta, o efeito sobre empresas e famílias, o efeito macro e as reações.
 */
export interface NumericImpactBreakdown {
  change: NumericPolicyChange;
  fiscal: FiscalBreakdown;
  business: BusinessBreakdown;
  households: HouseholdBreakdown;
  /** Efeitos que entram no motor macro, no formato que o resto do jogo já lê. */
  macro: PolicyImpact;
  /** Estimativas apresentáveis, em faixa. */
  estimates: ImpactEstimate[];
  /** Reação por grupo social, calculada a partir da magnitude. */
  groups: GroupImpact[];
  /** Efeitos que só aparecem meses depois. */
  delayed: { monthsAhead: number; label: string; impacts: PolicyImpact }[];
  /** Memorial de cálculo. Não aparece em produção. */
  debug: NumericDebugLine[];
}

/**
 * Fotografia da economia usada pelo cálculo. O mesmo aumento não pode produzir
 * o mesmo efeito com inflação de 3% e com inflação de 15%.
 */
export interface EconomicContext {
  gdpGrowth: number;
  inflation: number;
  unemployment: number;
  selic: number;
  exchangeRate: number;
  publicDebtToGdp: number;
  fiscalBalance: number;
  consumerConfidence: number;
  businessConfidence: number;
  averageIncome: number;
  minimumWage: number;
  povertyRate: number;
  population: number;
  gdpNominal: number;
  /** Fração da força de trabalho fora da formalidade. */
  informalityRate: number;
  month: number;
}
