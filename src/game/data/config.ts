/**
 * REGRAS DO JOGO — todos os números ajustáveis num só lugar.
 *
 * Nada aqui é lógica: são os valores que os engines leem. Mudar o equilíbrio do
 * jogo (chance de meta, tamanho da crise, rigor da dívida) é editar este
 * arquivo, sem tocar em nenhum engine.
 */

/** Versão do formato do save. Subiu para 2 com a reconstrução por cartas. */
export const GAME_STATE_VERSION = 2;
export const DEFAULT_START_YEAR = 2027;

/** Cartas oferecidas por mês. O jogador escolhe exatamente uma. */
export const OFFERED_CARD_COUNT = 3;

// ----------------------------------------------------------------- serviços
export const SERVICE_MIN = 0;
export const SERVICE_MAX = 100;
export const INITIAL_SERVICE = 50;

/**
 * Metas mensais. Geradas no início do mês e fixas até o fechamento.
 * `chance`: probabilidade de um serviço ter meta; `deltas`: quantos pontos
 * acima do valor atual a meta fica (0 = "mantenha o que tem").
 */
export const TARGETS = {
  chance: 0.5,
  deltas: [
    { delta: 0, weight: 35 },
    { delta: 1, weight: 40 },
    { delta: 2, weight: 25 },
  ],
} as const;

// ------------------------------------------------------------ internacional
export const GDP_START_RANK = 10;
export const GDP_BEST_RANK = 1;
/** Meses seguidos acima de todos os serviços do rival para ultrapassá-lo. */
export const GDP_MONTHS_TO_OVERTAKE = 2;

export const HDI = { initial: 500, min: 0, max: 1000, stepUp: 1, stepDown: 1 } as const;

export const COMMERCE = {
  initial: 500,
  min: 0,
  max: 1000,
  /** Agricultura e Educação na meta. */
  gain: 5,
  /** Agricultura ou Educação abaixo da meta. */
  loss: 20,
} as const;

/** Moeda em centavos de dólar: 20 = US$ 0,20. */
export const CURRENCY = {
  initialCents: 20,
  minCents: 0,
  gainChance: 0.5,
  gainCents: 5,
  lossChance: 0.01, // 1% de chance de desvalorização
  lossCents: 5, // desvalorização de US$ 0,05
  /** Perda quando o risco de dívida dispara. */
  debtLossCents: 1, // desvalorização de US$ 0,01
} as const;

export const DEBT = {
  initial: 80,
  min: 0,
  max: 1000,
  /** Até aqui não há risco adicional. */
  riskFreeUpTo: 50,
  /** Chance (%) na primeira faixa acima do limite. */
  riskBaseChance: 10,
  /** Largura de cada faixa, em pontos percentuais de dívida. */
  riskBandWidth: 50,
  /** Acréscimo de chance (pontos percentuais) a cada faixa. */
  riskBandStep: 10,
  /** Cada R$ 5 mi de saldo mensal move a dívida 1 ponto percentual. */
  balancePerPoint: 5_000_000,
  maxDropPerMonth: 3,
  maxRisePerMonth: 3,
  /** Pontos percentuais somados por mês de crise financeira. */
  crisisRisePerMonth: 5,
} as const;

/** Recompensas por posição conquistada, pagas uma única vez. */
export const RANK_REWARDS: Record<number, { hdi: number; currencyCents: number }> = {
  9: { hdi: 0, currencyCents: 5 },
  8: { hdi: 0, currencyCents: 15 },
  7: { hdi: 18, currencyCents: 0 },
  6: { hdi: 0, currencyCents: 20 },
  5: { hdi: 25, currencyCents: 0 },
  4: { hdi: 0, currencyCents: 25 },
  3: { hdi: 30, currencyCents: 0 },
  2: { hdi: 0, currencyCents: 30 },
  1: { hdi: 50, currencyCents: 50 },
};

// ----------------------------------------------------------------- recursos
export const RESOURCE_MIN = 0;
export const RESOURCE_MAX = 1000;

/**
 * Como os serviços escoam para os recursos.
 *
 * Cada mês, cada serviço gera um sinal: quanto avançou no mês, mais um bônus se
 * bateu a meta ou um desconto se ficou abaixo dela. O sinal do recurso é a média
 * ponderada dos serviços que o influenciam e entra numa "pressão" que decai
 * `pressureDecay` ao mês. O recurso muda `perPoint` × pressão.
 *
 * Resultado: um ponto de serviço move o recurso pouco e devagar, em vários
 * meses, em vez de um salto de uma vez.
 */
export const RESOURCE_GROWTH = {
  pressureDecay: 0.7,
  perPoint: 1.5,
  /** Limite do avanço mensal de um serviço contado no sinal. */
  maxProgress: 3,
  metBonus: 0.5,
  missPenalty: 0.5,
} as const;

// ----------------------------------------------------------------- economia
export const INITIAL_TREASURY = 10_000_000;
export const INITIAL_TAXES = 3_000_000;
export const INITIAL_SPENDING = 4_500_000;

/**
 * Pressão tributária. Imposto muito acima (ou abaixo) do inicial pesa (ou
 * ajuda) no Comércio e, quando alto, no Capital Humano e no Turismo. É um
 * efeito de NÍVEL, mês a mês, e por isso não está nas cartas: elas só mudam o
 * nível, e a economia reage a ele.
 */
export const TAX_PRESSURE = {
  highAbove: 1.05,
  lowBelow: 0.95,
  /** Pontos de Comércio perdidos por mês por unidade de excesso (1.0 = 100%). */
  commercePenalty: 20,
  /** Pontos de Capital Humano e Turismo perdidos por mês, idem. */
  resourcePenalty: 5,
  /** Pontos de Comércio ganhos por mês por unidade de folga. */
  commerceBonus: 10,
} as const;

export const CRISIS = {
  /** Meses de gasto zerado e penalidades. */
  months: 6,
  /** Pontos que cada serviço perde por mês de crise. */
  servicePenalty: 2,
  /** Fração de cada recurso perdida por mês de crise. */
  resourcePenaltyRate: 0.1,
  resourcePenaltyMin: 5,
  /** Pontos que cada grupo perde por mês de crise. */
  groupPenalty: 3,
} as const;

// ---------------------------------------------------------------- sociedade
export const SOCIAL_MIN = 0;
export const SOCIAL_MAX = 100;
export const INITIAL_SOCIAL = 50;
/** Variação de satisfação por reação de indicador (IDH, moeda, dívida…). */
export const SOCIAL_REACTION_STEP = 1;
