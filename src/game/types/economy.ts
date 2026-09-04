import type { DataOrigin } from './common';

/** Fotografia macroeconômica do mês corrente. Valores em % ou R$ bilhões. */
export interface EconomyState {
  /** PIB nominal em R$ bilhões (anualizado). */
  gdpNominal: number;
  /** Crescimento real do PIB, % em 12 meses. */
  gdpGrowth: number;
  /** IPCA acumulado em 12 meses, %. */
  inflation: number;
  /** Taxa de desocupação, %. */
  unemployment: number;
  /** Meta Selic, % a.a. */
  selic: number;
  /** Meta de inflação perseguida pelo BC, %. */
  inflationTarget: number;
  /** Câmbio R$/US$. */
  usd: number;
  /**
   * Câmbio de equilíbrio de longo prazo (paridade de poder de compra).
   * O câmbio observado orbita este valor com prêmio de risco e diferencial
   * de juros. Sem essa âncora o câmbio vira uma exponencial: a taxa passa a
   * ser aplicada sobre o valor já depreciado, mês após mês.
   */
  fxAnchor: number;
  /** Dívida bruta como % do PIB. */
  debtToGdp: number;
  /** Resultado primário em R$ bilhões, 12 meses. */
  primaryBalance: number;
  /** Arrecadação federal, R$ bilhões, 12 meses. */
  revenue: number;
  /** Despesa primária, R$ bilhões, 12 meses. */
  spending: number;
  /** Reservas internacionais, US$ bilhões. */
  reserves: number;
  /** Índice da bolsa, pontos. */
  ibovespa: number;
  /** Risco-país em pontos-base. */
  countryRisk: number;
  /** 0-100 — quanto o mercado acredita na âncora fiscal. */
  fiscalCredibility: number;
  /** 0-100 — decide investimento privado com defasagem. */
  businessConfidence: number;
  /** 0-100 — choque externo fora do controle do presidente. */
  commodityIndex: number;
  /** Salário mínimo mensal, R$. */
  minimumWage: number;
  /** Caixa discricionário disponível no mês, R$ bilhões. */
  treasuryCash: number;
  /** Pressões represadas que ainda vão aparecer nos indicadores. */
  pipeline: EconomyPipeline;
}

/**
 * O laço macro não fecha no mesmo mês. Aqui ficam os efeitos contratados
 * que ainda vão vazar para inflação, crescimento e desemprego.
 */
export interface EconomyPipeline {
  /** Impulso fiscal ainda não absorvido (R$ bi/mês). */
  fiscalImpulse: number;
  /** Pressão inflacionária acumulada, em p.p. */
  inflationPressure: number;
  /** Choque de oferta ativo, em p.p. */
  supplyShock: number;
  /** Impulso de investimento privado contratado. */
  investmentImpulse: number;
  /** Efeito defasado do juro real sobre a atividade. */
  monetaryDrag: number;
}

export interface EconomySnapshot {
  month: number;
  label: string;
  gdpGrowth: number;
  inflation: number;
  unemployment: number;
  selic: number;
  usd: number;
  debtToGdp: number;
  primaryBalance: number;
  countryRisk: number;
  approval: number;
}

export interface BudgetLine {
  id: string;
  ministryId: string;
  label: string;
  /** R$ bilhões por ano. */
  allocated: number;
  /** Fração obrigatória (não cortável por decreto). */
  mandatoryShare: number;
  execution: number;
  origin: DataOrigin;
}

export interface TaxLine {
  id: string;
  label: string;
  /** Alíquota efetiva de referência, %. */
  rate: number;
  /** Arrecadação anual, R$ bilhões. */
  revenue: number;
  /** Quem paga, para efeito de reação social. */
  incidence: string[];
  /** Sensibilidade da arrecadação a variações de alíquota (curva de Laffer simplificada). */
  elasticity: number;
}
