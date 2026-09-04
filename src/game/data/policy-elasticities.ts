/**
 * ELASTICIDADES E EXPOSIÇÕES
 *
 * Todo parâmetro que decide o tamanho de um efeito mora aqui. Nenhum número
 * mágico espalhado por engine: recalibrar o jogo é editar este arquivo.
 *
 * As elasticidades são lidas assim: "quanto o indicador se move quando a
 * variável da medida se move 1%". Uma elasticidade de consumo de 0.28 no
 * salário mínimo significa que 10% de aumento no piso empurram o consumo
 * agregado em cerca de 2,8% da massa salarial exposta — não 2,8% do PIB.
 *
 * Os valores são calibragem de jogo. São plausíveis e internamente coerentes,
 * mas não são estimativas econométricas e não devem ser lidos como tal.
 */

/** Curvatura: quanto o efeito acelera quando a medida é grande. Ver `nonLinear`. */
export const NONLINEARITY = {
  /**
   * Peso do termo quadrático. `impacto = a·d + b·d²` — com d em fração.
   * Uma alta de 50% não custa cinco vezes o que custa uma de 10%: custa mais.
   */
  inflation: 1.6,
  unemployment: 2.1,
  businessStress: 2.4,
  fiscalRisk: 1.9,
  confidence: 1.4,
  /** Onde a curva começa a acelerar de verdade (em fração de variação). */
  kneeAt: 0.08,
} as const;

export const MINIMUM_WAGE_ELASTICITY = {
  /** Fração da renda adicional que vira consumo no mesmo ano. */
  consumptionPropensity: 0.86,
  /** Quanto 1% de massa salarial adicional move o PIB, em p.p. */
  gdpPerPercentOfWageBill: 0.24,
  /** Repasse a preços: quanto 1% de aumento real do piso move o IPCA, em p.p. */
  inflationPassthrough: 0.075,
  /** Efeito sobre desemprego: p.p. por 1% de aumento REAL do piso. */
  employmentElasticity: 0.032,
  /** Quanto 1% de ganho real do piso reduz a pobreza, em p.p. */
  povertyElasticity: 0.055,
  /** Quanto 1% de ganho real do piso reduz o Gini. */
  giniElasticity: 0.0006,
  /** Fração do aumento que vaza para a informalidade em vez de virar renda. */
  informalityLeak: 0.35,
  /** Multiplicador de encargos sobre a folha privada (13º, férias, FGTS, INSS). */
  payrollCostMultiplier: 1.62,
  /** Meses pagos por ano na folha formal (12 salários mais o 13º). */
  monthsPerYear: 13,
} as const;

/**
 * EXPOSIÇÃO AO SALÁRIO MÍNIMO
 *
 * O piso não alcança todo mundo igual, e a maior parte do custo não é do
 * Tesouro. As frações abaixo são sobre a POPULAÇÃO do país, para escalarem
 * junto com ela, e cada uma tem exposição própria — quem ganha exatamente um
 * mínimo sente tudo, quem ganha cinco quase não sente.
 */
export const MINIMUM_WAGE_EXPOSURE = {
  /** Fração da população na força de trabalho. */
  laborForceShare: 0.47,
  /** Fração da força de trabalho com carteira no setor privado. */
  formalPrivateShare: 0.38,
  /** Fração da força de trabalho no setor público. */
  publicShare: 0.11,
  /** Fração da força de trabalho na informalidade. */
  informalShare: 0.39,

  /**
   * Cascata salarial: quanto de cada faixa acompanha o reajuste do piso.
   * Quem está no piso recebe o aumento inteiro; quem está logo acima recebe
   * parte, por pressão de tabela; a partir de cinco mínimos não sobra nada.
   */
  wageBands: [
    { upToMinimums: 1.0, shareOfFormal: 0.24, passthrough: 1.0, label: 'no piso' },
    { upToMinimums: 1.2, shareOfFormal: 0.16, passthrough: 0.75, label: 'até 1,2 mínimo' },
    { upToMinimums: 1.5, shareOfFormal: 0.17, passthrough: 0.45, label: 'até 1,5 mínimo' },
    { upToMinimums: 2.0, shareOfFormal: 0.18, passthrough: 0.22, label: 'até 2 mínimos' },
    { upToMinimums: 5.0, shareOfFormal: 0.19, passthrough: 0.05, label: 'até 5 mínimos' },
    { upToMinimums: 99, shareOfFormal: 0.06, passthrough: 0, label: 'acima de 5 mínimos' },
  ],

  /** Servidores e militares cuja remuneração acompanha o piso. */
  publicAtFloorShare: 0.06,

  /**
   * Benefícios indexados ao piso, como fração da população. Previdência no
   * piso, BPC e abono são o grosso do custo fiscal de um reajuste — não a folha
   * dos trabalhadores privados, que é paga pelo empregador.
   */
  pensionAtFloorShare: 0.115,
  /** Benefícios previdenciários no piso pagam 13º. */
  pensionMonthsPerYear: 13,
  assistanceAtFloorShare: 0.028,
  assistanceMonthsPerYear: 12,
  /** Abono salarial e seguro-desemprego, em meses equivalentes por ano. */
  laborBenefitShare: 0.012,
  laborBenefitMonths: 4,

  /** Alíquota efetiva de contribuição que volta ao caixa sobre a folha formal. */
  payrollTaxReturn: 0.28,
  /** Tributos indiretos médios sobre o consumo adicional. */
  consumptionTaxReturn: 0.19,
} as const;

/** Reações do mercado e do Congresso à magnitude fiscal, por R$ bilhão líquido. */
export const FISCAL_REACTION = {
  /** Pontos de credibilidade fiscal perdidos por R$ 10 bi de custo líquido anual. */
  credibilityPerTenBillion: 1.6,
  /** Pontos-base de risco-país por R$ 10 bi de custo líquido anual. */
  riskPerTenBillion: 5.5,
  /** Pontos de confiança empresarial por R$ 10 bi de custo líquido de folha. */
  businessConfidencePerTenBillion: 1.1,
} as const;

/** Modelo de tributo: como uma alíquota vira arrecadação e atividade. */
export const TAX_ELASTICITY = {
  /**
   * Curva de Laffer simplificada: a base encolhe quando a alíquota sobe.
   * `arrecadação = base × alíquota × (1 - elasticidade × variaçãoRelativa)`.
   * A elasticidade específica de cada tributo vem de `state.taxes`.
   */
  defaultBaseElasticity: 0.35,
  /** Quanto 1% de aumento de carga sobre o lucro derruba o investimento, em %. */
  investmentElasticity: 0.42,
  /** Quanto 1 p.p. de tributo sobre consumo move o IPCA, em p.p. */
  consumptionTaxToInflation: 0.32,
  /** Quanto 1% de aumento de carga move o PIB, em p.p. */
  gdpElasticity: 0.05,
} as const;

/** Modelo de orçamento: gasto público vira serviço com retorno decrescente. */
export const BUDGET_ELASTICITY = {
  /**
   * Capacidade de absorção: acima deste acréscimo relativo à dotação atual, o
   * dinheiro extra rende cada vez menos — falta obra pronta, gente para
   * contratar e capacidade de executar.
   */
  absorptiveCapacity: 0.25,
  /** Expoente do retorno decrescente acima da capacidade de absorção. */
  saturationExponent: 0.55,
  /** Pontos de índice setorial por R$ 10 bi absorvidos com eficiência plena. */
  indexPerTenBillion: 1.4,
  /** Multiplicador fiscal do gasto público sobre o PIB, por R$ bi. */
  gdpMultiplier: 0.011,
  /** Empregos criados por R$ bi de gasto absorvido. */
  jobsPerBillion: 11_000,
} as const;

/** Custo unitário de metas de efetivo, R$ mil por unidade e por ano. */
export const UNIT_COSTS = {
  policial: 92,
  medico: 210,
  professor: 78,
  enfermeiro: 64,
  casa: 95,
  escola: 4_200,
  hospital: 62_000,
  creche: 2_100,
  servidor: 110,
} as const;

/** Retorno decrescente da popularidade: dobrar a medida não dobra o aplauso. */
export const POPULARITY = {
  /** Ganho máximo de aprovação que uma única medida numérica pode render. */
  ceiling: 4.2,
  /** Variação relativa que rende metade do teto. */
  halfPoint: 0.09,
  /**
   * Peso da conta fiscal no aplauso do ANÚNCIO. Baixo de propósito: no dia do
   * anúncio quase ninguém sente o custo, e quem sente é minoria barulhenta. O
   * peso de verdade da conta chega meses depois, como efeito defasado.
   */
  fiscalDrag: 0.012,
  /** Perda de aprovação por R$ bi de custo recorrente, quando a conta vence. */
  delayedFiscalPain: 0.02,
} as const;

/**
 * Aplica a curvatura: efeito linear até o joelho, acelerando depois.
 *
 * `delta` é a variação em fração (0,05 = 5%). O sinal é preservado, então
 * cortes e aumentos aceleram na mesma proporção — a assimetria, quando existe,
 * é aplicada por quem chama, não aqui.
 */
export function nonLinear(delta: number, curvature: number): number {
  const magnitude = Math.abs(delta);
  const sign = Math.sign(delta);
  const knee = NONLINEARITY.kneeAt;
  if (magnitude <= knee) return delta;
  const excess = magnitude - knee;
  return sign * (knee + excess + curvature * excess * excess);
}
