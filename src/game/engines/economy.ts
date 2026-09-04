import type { GameState } from '../types/index';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { Rng } from '../utils/rng';
import { approach, clamp, clamp100, round } from '../utils/math';

/**
 * MOTOR ECONÔMICO
 *
 * Não é um modelo de previsão. É um laço de realimentação plausível, calibrado
 * para que o jogador sinta a cadeia causal que existe de verdade:
 *
 *   gasto sem lastro -> credibilidade fiscal cai
 *   credibilidade cai -> risco-país sobe
 *   risco sobe        -> real desvaloriza
 *   real fraco        -> importado encarece -> inflação sobe
 *   inflação sobe     -> Copom sobe a Selic (e você não manda no Copom)
 *   juro real alto    -> atividade cai -> desemprego sobe
 *
 * O laço leva de seis a doze meses para fechar, então o estrago costuma
 * aparecer bem depois da decisão que o causou. Isso é intencional: é a
 * mecânica central do jogo, não um efeito colateral.
 *
 * Todos os parâmetros vivem em PARAMS para poderem ser recalibrados sem tocar
 * na lógica.
 */
export const PARAMS = {
  /** Crescimento potencial anual do país, em %. */
  potentialGrowth: 2.1,
  /** Quanto R$ 1 bi de impulso fiscal mensal move o PIB, em p.p. ao ano. */
  fiscalMultiplier: 0.011,
  /** Velocidade de convergência do PIB observado para o potencial ajustado. */
  gdpConvergence: 0.22,
  /** Peso da inércia inflacionária (quanto do IPCA de ontem sobrevive). */
  inflationInertia: 0.86,
  /** Repasse cambial: quanto 10% de alta do dólar adiciona ao IPCA em 12m. */
  fxPassthrough: 0.18,
  /** Sensibilidade da inflação ao hiato do produto. */
  outputGapToInflation: 0.34,
  /** Regra de Taylor: reação do Copom ao desvio da meta. */
  taylorInflation: 0.55,
  /** Reação do Copom ao hiato do produto. */
  taylorOutput: 0.18,
  /** Velocidade com que a Selic caminha para a taxa indicada pela regra. */
  selicSpeed: 0.28,
  /** Juro real neutro estimado, %. */
  neutralRealRate: 4.5,
  /** Okun: quanto 1 p.p. de crescimento acima do potencial reduz o desemprego. */
  okun: 0.34,
  /** Desemprego estrutural de longo prazo, %. */
  structuralUnemployment: 6.4,
  /** Elasticidade da arrecadação ao PIB nominal. */
  revenueElasticity: 1.06,
  /** Quanto 1 ponto de credibilidade fiscal reduz o risco-país, em pb. */
  credibilityToRisk: 4.2,
  /** Quanto 1 p.p. de dívida/PIB acima de 75% adiciona ao risco-país. */
  debtToRisk: 3.6,
  /** Quanto 100 pb de risco-país desvalorizam o real, em %. */
  riskToFx: 0.062,
  /** Defasagem do juro real sobre a atividade (meses de meia-vida). */
  monetaryLagHalfLife: 7,
  /**
   * Crescimento real anual da despesa obrigatória, em %. Previdência, pisos
   * constitucionais e demografia empurram o gasto acima da inflação todo ano.
   * É a razão de o resultado primário piorar sozinho quando ninguém age.
   */
  mandatoryRealGrowth: 2.4,
} as const;

export interface EconomyDelta {
  gdpGrowth: number;
  inflation: number;
  unemployment: number;
  selic: number;
  usd: number;
  debtToGdp: number;
  primaryBalance: number;
  countryRisk: number;
  treasuryCash: number;
}

/**
 * Avança a economia em um mês. Recebe o impulso já contratado no pipeline
 * (medidas assinadas, programas ativos, escolhas de evento) e devolve o delta
 * de cada indicador para a tela de resultado do mês.
 */
export function processEconomy(state: GameState, rng: Rng): EconomyDelta {
  const eco = state.economy;
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty];
  const sensitivity = preset.economySensitivity;

  const before = {
    gdpGrowth: eco.gdpGrowth,
    inflation: eco.inflation,
    unemployment: eco.unemployment,
    selic: eco.selic,
    usd: eco.usd,
    debtToGdp: eco.debtToGdp,
    primaryBalance: eco.primaryBalance,
    countryRisk: eco.countryRisk,
    treasuryCash: eco.treasuryCash,
  };

  // -------------------------------------------------------------- 1. Custeio
  // Programas ativos e medidas em execução consomem caixa todo mês.
  const programCost = state.programs
    .filter((program) => program.active)
    .reduce((total, program) => total + program.monthlyCost, 0);
  const policyCost = state.policies
    .filter((policy) => policy.status === 'vigente' && policy.monthsRemaining > 0)
    .reduce((total, policy) => total + policy.monthlyCost, 0);
  const monthlySpend = programCost + policyCost;

  // -------------------------------------------------------- 2. Choque externo
  // Commodity é a única variável realmente fora do controle do presidente.
  eco.commodityIndex = clamp100(eco.commodityIndex + rng.noise(3.2));
  const commodityBoost = (eco.commodityIndex - 70) * 0.014;

  // ------------------------------------------------------- 3. Juro real e drag
  const realRate = eco.selic - eco.inflation;
  const monetaryGap = realRate - PARAMS.neutralRealRate;
  // O aperto monetário chega à atividade devagar: meia-vida de ~7 meses.
  const lagFactor = 1 / PARAMS.monetaryLagHalfLife;
  eco.pipeline.monetaryDrag = approach(eco.pipeline.monetaryDrag, monetaryGap * 0.22, lagFactor);

  // ------------------------------------------------------- 4. Crescimento
  const fiscalPush = eco.pipeline.fiscalImpulse * PARAMS.fiscalMultiplier;
  const confidencePush = (eco.businessConfidence - 50) * 0.012;
  const investmentPush = eco.pipeline.investmentImpulse * 0.01;

  const targetGrowth =
    PARAMS.potentialGrowth +
    fiscalPush +
    confidencePush +
    investmentPush +
    commodityBoost -
    eco.pipeline.monetaryDrag;

  eco.gdpGrowth = round(
    approach(eco.gdpGrowth, targetGrowth, PARAMS.gdpConvergence) + rng.noise(0.06),
    2,
  );

  // Hiato do produto: quanto a economia roda acima ou abaixo do potencial.
  const outputGap = eco.gdpGrowth - PARAMS.potentialGrowth;

  // ------------------------------------------------------- 5. Câmbio
  //
  // O câmbio é um NÍVEL orbitando uma âncora, não uma taxa de variação. A
  // âncora caminha pela diferença entre a inflação daqui e a de fora (paridade
  // de poder de compra); risco-país e juro real deslocam o nível em torno dela.
  const externalInflation = 2.2;
  eco.fxAnchor = round(
    clamp(eco.fxAnchor * (1 + (eco.inflation - externalInflation) / 100 / 12), 2, 40),
    4,
  );

  const riskPremium = (eco.countryRisk - 200) * PARAMS.riskToFx * 0.02;
  const carryPull = -(realRate - PARAMS.neutralRealRate) * 0.014;
  const commodityPull = -commodityBoost * 0.35;
  const fxTarget = eco.fxAnchor * (1 + clamp(riskPremium + carryPull + commodityPull, -0.35, 1.2));
  eco.usd = round(clamp(approach(eco.usd, fxTarget, 0.18) + rng.noise(0.045), 2.2, 22), 4);
  const fxChange = (eco.usd - before.usd) / before.usd;

  // ------------------------------------------------------- 6. Inflação
  const demandPressure = outputGap * PARAMS.outputGapToInflation;
  const fxPressure = fxChange * 100 * PARAMS.fxPassthrough;
  const shock = eco.pipeline.supplyShock;

  const inflationTarget =
    eco.inflation * PARAMS.inflationInertia +
    (1 - PARAMS.inflationInertia) * eco.inflationTarget +
    (demandPressure + fxPressure + shock + eco.pipeline.inflationPressure) * sensitivity;

  eco.inflation = round(clamp(inflationTarget + rng.noise(0.09), -3, 90), 2);

  // ------------------------------------------------------- 7. Selic (autônoma)
  // O Copom não obedece ao presidente. Reage à meta e cobra prêmio de quem
  // perdeu credibilidade fiscal.
  const credibilityPenalty = (60 - eco.fiscalCredibility) * 0.028;
  const taylorRate =
    eco.inflation +
    PARAMS.neutralRealRate +
    PARAMS.taylorInflation * (eco.inflation - eco.inflationTarget) +
    PARAMS.taylorOutput * outputGap +
    credibilityPenalty;
  eco.selic = round(clamp(approach(eco.selic, taylorRate, PARAMS.selicSpeed), 1.9, 60), 2);

  // ------------------------------------------------------- 8. Desemprego
  const unemploymentTarget =
    PARAMS.structuralUnemployment - outputGap * PARAMS.okun * 2.4 + (eco.selic - 10) * 0.06;
  eco.unemployment = round(
    clamp(approach(eco.unemployment, unemploymentTarget, 0.16 * sensitivity) + rng.noise(0.05), 2.5, 32),
    2,
  );

  // ------------------------------------------------------- 9. Contas públicas
  const nominalGrowth = (eco.gdpGrowth + eco.inflation) / 100;
  eco.gdpNominal = round(eco.gdpNominal * (1 + nominalGrowth / 12), 0);

  const revenueGrowth = (nominalGrowth / 12) * PARAMS.revenueElasticity;
  eco.revenue = round(eco.revenue * (1 + revenueGrowth), 1);

  // eco.spending guarda só a despesa OBRIGATÓRIA (folha, previdência, mínimos
  // constitucionais), que é indexada e cresce com a inflação. Programas e
  // medidas entram por monthlySpend — contá-los aqui também criaria um déficit
  // fantasma que ninguém decidiu.
  eco.spending = round(
    eco.spending * (1 + (eco.inflation + PARAMS.mandatoryRealGrowth) / 100 / 12),
    1,
  );

  // O primário é acumulado em 12 meses: entra o mês novo, sai o mês velho.
  const monthlyPrimary = eco.revenue / 12 - eco.spending / 12 - monthlySpend;
  eco.primaryBalance = round(eco.primaryBalance * (11 / 12) + monthlyPrimary, 1);

  // Dinâmica da dívida: juro nominal menos crescimento nominal, mais o primário.
  //
  // O primário usado aqui é o ACUMULADO (eco.primaryBalance), não o fluxo do mês
  // calculado acima: é nele que caem os custos das medidas assinadas, das
  // emendas liberadas e das escolhas de evento. Ler o fluxo bruto deixaria o
  // gasto discricionário empurrar o PIB sem nunca aparecer na dívida.
  const interestBurden = ((eco.selic / 100) * eco.debtToGdp) / 12;
  const growthErosion = (nominalGrowth / 12) * eco.debtToGdp;
  const primaryEffect = (-(eco.primaryBalance / 12) / eco.gdpNominal) * 100;
  eco.debtToGdp = round(
    clamp(eco.debtToGdp + interestBurden - growthErosion + primaryEffect, 20, 220),
    2,
  );

  // ------------------------------------------------------- 10. Credibilidade
  // Furar o resultado primário derruba credibilidade; entregá-lo reconstrói,
  // sempre mais devagar do que destrói.
  const primaryPctGdp = (eco.primaryBalance / eco.gdpNominal) * 100;
  const credibilityTarget = clamp100(
    50 + primaryPctGdp * 12 - Math.max(0, eco.debtToGdp - 78) * 0.9 + (eco.gdpGrowth - 2) * 2.5,
  );
  const credibilitySpeed = credibilityTarget < eco.fiscalCredibility ? 0.16 : 0.07;
  eco.fiscalCredibility = round(
    clamp100(approach(eco.fiscalCredibility, credibilityTarget, credibilitySpeed * sensitivity)),
    1,
  );

  // ------------------------------------------------------- 11. Risco-país
  const riskTarget = clamp(
    150 +
      (60 - eco.fiscalCredibility) * PARAMS.credibilityToRisk +
      Math.max(0, eco.debtToGdp - 75) * PARAMS.debtToRisk -
      (eco.commodityIndex - 70) * 1.4,
    60,
    1600,
  );
  eco.countryRisk = Math.round(
    clamp(approach(eco.countryRisk, riskTarget, 0.24 * sensitivity) + rng.noise(6), 60, 2000),
  );

  // ------------------------------------------------------- 12. Confiança e bolsa
  const confidenceTarget = clamp100(
    48 + (eco.fiscalCredibility - 50) * 0.6 - (eco.selic - 10) * 1.1 + (eco.gdpGrowth - 2) * 3.5,
  );
  eco.businessConfidence = round(
    clamp100(approach(eco.businessConfidence, confidenceTarget, 0.14)),
    1,
  );
  // Confiança de hoje é investimento de daqui a dois ou três meses.
  eco.pipeline.investmentImpulse = approach(
    eco.pipeline.investmentImpulse,
    (eco.businessConfidence - 50) * 0.09,
    0.2,
  );

  const iboTarget =
    130_000 + (eco.businessConfidence - 50) * 1_600 - (eco.countryRisk - 200) * 42 + eco.gdpGrowth * 4_200;
  eco.ibovespa = Math.round(clamp(approach(eco.ibovespa, iboTarget, 0.3) + rng.noise(2_400), 30_000, 600_000));

  // ------------------------------------------------------- 13. Reservas e caixa
  eco.reserves = round(
    clamp(eco.reserves + (eco.commodityIndex - 70) * 0.16 - Math.max(0, fxChange) * 240, 60, 900),
    1,
  );

  // Caixa discricionário: sobra da arrecadação depois do custeio obrigatório.
  const discretionaryInflow = Math.max(0, monthlyPrimary) * 0.55 + eco.revenue / 12 * 0.012;
  eco.treasuryCash = round(eco.treasuryCash + discretionaryInflow - monthlySpend * 0.12, 2);

  // Salário mínimo é reajustado em janeiro pela inflação do ano anterior.
  if (state.month % 12 === 1 && state.month > 1) {
    eco.minimumWage = Math.round(eco.minimumWage * (1 + eco.inflation / 100));
  }

  // ------------------------------------------------------- 14. Dissipação
  // Pressões represadas se dissipam sozinhas se ninguém as renovar.
  eco.pipeline.fiscalImpulse = round(eco.pipeline.fiscalImpulse * 0.82, 3);
  eco.pipeline.inflationPressure = round(eco.pipeline.inflationPressure * 0.74, 3);
  eco.pipeline.supplyShock = round(eco.pipeline.supplyShock * 0.68, 3);

  return {
    gdpGrowth: round(eco.gdpGrowth - before.gdpGrowth, 2),
    inflation: round(eco.inflation - before.inflation, 2),
    unemployment: round(eco.unemployment - before.unemployment, 2),
    selic: round(eco.selic - before.selic, 2),
    usd: round(eco.usd - before.usd, 3),
    debtToGdp: round(eco.debtToGdp - before.debtToGdp, 2),
    primaryBalance: round(eco.primaryBalance - before.primaryBalance, 1),
    countryRisk: Math.round(eco.countryRisk - before.countryRisk),
    treasuryCash: round(eco.treasuryCash - before.treasuryCash, 2),
  };
}

/** Carga tributária efetiva, usada pela promessa de baixar imposto. */
export function taxBurden(state: GameState): number {
  return round((state.economy.revenue / state.economy.gdpNominal) * 100, 2);
}

/** Juro real corrente, exibido no painel de economia. */
export function realInterestRate(state: GameState): number {
  return round(state.economy.selic - state.economy.inflation, 2);
}
