import type { GameState, GroupImpact, PolicyImpact } from '../../types/index';
import type {
  EconomicContext,
  FiscalComponent,
  ImpactEstimate,
  NumericDebugLine,
  NumericImpactBreakdown,
  NumericMagnitude,
  NumericPolicyChange,
} from '../../types/numeric-policy';
import { numericTarget, type NumericTargetSpec } from '../../data/numeric-targets';
import { SOCIAL_GROUP_BY_ID } from '../../data/social-groups';
import {
  BUDGET_ELASTICITY,
  FISCAL_REACTION,
  MINIMUM_WAGE_EXPOSURE,
  NONLINEARITY,
  POPULARITY,
  TAX_ELASTICITY,
  nonLinear,
} from '../../data/policy-elasticities';
import { minimumWageImpact } from './minimum-wage-service';
import { buildNumericHeadline } from './reaction-generator';
import { readNumericIntent, resolveProposedValue, type NumericIntent } from './numeric-policy-reader';
import { clamp, round } from '../../utils/math';

/**
 * MOTOR DE MEDIDAS NUMÉRICAS
 *
 * Um caminho só para todo número que o presidente muda:
 *
 *   texto -> alvo -> valor atual (do GameState) -> valor proposto -> delta
 *         -> delta % -> exposição -> contexto econômico -> elasticidades
 *         -> efeitos diretos -> efeitos indiretos -> reações
 *
 * As três regras que este arquivo existe para garantir:
 *
 *   1. NENHUM impacto sai do nome da medida. Sai do delta.
 *   2. NENHUM impacto usa degrau. As fórmulas são contínuas, então +4,9% e
 *      +5,1% dão resultados parecidos mas diferentes.
 *   3. O valor atual vem do estado da partida, nunca do texto nem da IA.
 */

/** Fotografia da economia usada pelo cálculo. */
export function buildEconomicContext(state: GameState): EconomicContext {
  return {
    gdpGrowth: state.economy.gdpGrowth,
    inflation: state.economy.inflation,
    unemployment: state.economy.unemployment,
    selic: state.economy.selic,
    exchangeRate: state.economy.usd,
    publicDebtToGdp: state.economy.debtToGdp,
    fiscalBalance: state.economy.primaryBalance,
    consumerConfidence: clamp(100 - state.economy.inflation * 4 + state.approval.overall * 0.3, 5, 95),
    businessConfidence: state.economy.businessConfidence,
    averageIncome: state.nation.averageIncome,
    minimumWage: state.economy.minimumWage,
    povertyRate: state.nation.povertyRate,
    population: state.nation.population,
    gdpNominal: state.economy.gdpNominal,
    informalityRate: MINIMUM_WAGE_EXPOSURE.informalShare,
    month: state.month,
  };
}

/** Classificação por tamanho. Escolhe o TOM do texto; não substitui a conta. */
export function classifyMagnitude(percentageDelta: number): NumericMagnitude {
  const size = Math.abs(percentageDelta);
  if (size < 2) return 'small';
  if (size < 5) return 'moderate';
  if (size < 10) return 'large';
  if (size < 25) return 'veryLarge';
  return 'extreme';
}

/** Meses de vigência dentro do exercício corrente. */
function monthsLeftInYear(month: number): number {
  return 12 - ((month - 1) % 12);
}

/**
 * Monta a alteração numérica: pega o valor atual do estado, resolve o valor
 * proposto conforme a operação lida e calcula os dois deltas que importam —
 * o absoluto e o relativo.
 */
export function buildNumericChange(intent: NumericIntent, state: GameState): NumericPolicyChange {
  const target = intent.target;
  const currentValue = target.read(state);
  const proposedValue = resolveProposedValue(intent, currentValue);

  const absoluteDelta = proposedValue - currentValue;
  const percentageDelta = currentValue !== 0 ? (absoluteDelta / currentValue) * 100 : absoluteDelta;
  const isPercentUnit = target.unit === 'PERCENT' || target.unit === 'PERCENT_ANNUAL';

  const context = buildEconomicContext(state);
  const { affected, exposure } = affectedPopulationFor(target, context, absoluteDelta);

  return {
    target: target.id,
    targetLabel: target.label,
    currentValue: round(currentValue, 4),
    proposedValue: round(proposedValue, 4),
    absoluteDelta: round(absoluteDelta, 4),
    percentageDelta: round(percentageDelta, 4),
    // Em alíquota, o delta absoluto JÁ é a diferença em pontos percentuais.
    // Guardar os dois lado a lado é o que impede o texto de dizer "-2%" quando
    // a alíquota caiu 2 pontos e 25%.
    ...(isPercentUnit ? { pointDelta: round(absoluteDelta, 4) } : {}),
    direction: absoluteDelta > 0 ? 'increase' : absoluteDelta < 0 ? 'decrease' : 'flat',
    unit: target.unit,
    operation: intent.operation,
    scope: intent.scopeLabel ? `${target.scope}, restrito a ${intent.scopeLabel}` : target.scope,
    scopeFactor: intent.scopeFactor,
    ...(intent.scopeLabel ? { scopeLabel: intent.scopeLabel } : {}),
    affectedPopulation: Math.round(affected * intent.scopeFactor),
    exposureRate: round(exposure * intent.scopeFactor, 3),
    effectiveMonth: state.month,
    monthsInFirstYear: monthsLeftInYear(state.month),
    temporary: intent.temporary,
    ...(intent.durationMonths ? { durationMonths: intent.durationMonths } : {}),
    ...(intent.gradualMonths ? { gradualMonths: intent.gradualMonths } : {}),
    economicCategory: target.economicCategory,
    magnitude: classifyMagnitude(percentageDelta),
    model: target.model,
    reading: intent.reading,
  };
}

function affectedPopulationFor(
  target: NumericTargetSpec,
  context: EconomicContext,
  absoluteDelta: number,
): { affected: number; exposure: number } {
  const laborForce = context.population * MINIMUM_WAGE_EXPOSURE.laborForceShare;

  switch (target.model) {
    case 'salario_minimo': {
      const formal = laborForce * MINIMUM_WAGE_EXPOSURE.formalPrivateShare;
      const cascade = MINIMUM_WAGE_EXPOSURE.wageBands.reduce(
        (total, band) => total + band.shareOfFormal * band.passthrough,
        0,
      );
      const benefits =
        context.population *
        (MINIMUM_WAGE_EXPOSURE.pensionAtFloorShare + MINIMUM_WAGE_EXPOSURE.assistanceAtFloorShare);
      return { affected: formal * cascade + benefits, exposure: cascade };
    }
    case 'encargo_folha':
      return { affected: laborForce * MINIMUM_WAGE_EXPOSURE.formalPrivateShare, exposure: 1 };
    case 'beneficio_social':
      return {
        affected: context.population * (target.beneficiaryShare ?? 0.02),
        exposure: 1,
      };
    case 'tributo':
      return { affected: context.population * 0.55, exposure: 0.55 };
    case 'efetivo':
      return { affected: Math.abs(absoluteDelta), exposure: 1 };
    case 'orcamento':
    case 'subsidio':
    case 'juros':
    default:
      return { affected: context.population, exposure: 0.4 };
  }
}

// ---------------------------------------------------------------------------
// Cálculo por modelo
// ---------------------------------------------------------------------------

interface ModelResult {
  components: FiscalComponent[];
  grossAnnual: number;
  revenueOffsetAnnual: number;
  /** Custo de folha jogado sobre as empresas, R$ bilhões por ano. */
  businessCost: number;
  marginPressure: number;
  employmentEffect: number;
  householdIncome: number;
  realGain: number;
  consumptionChange: number;
  macro: PolicyImpact;
  debug: NumericDebugLine[];
}

function emptyMacro(): PolicyImpact {
  return {};
}

/** Salário mínimo: o modelo completo vive em minimum-wage-service. */
function runMinimumWage(change: NumericPolicyChange, context: EconomicContext): ModelResult {
  const impact = minimumWageImpact(change, context);

  return {
    components: impact.components,
    grossAnnual: impact.grossFiscalAnnual,
    revenueOffsetAnnual: impact.revenueOffsetAnnual,
    businessCost: impact.privatePayrollAnnual,
    marginPressure: round(-impact.privatePayrollAnnual / 45, 3),
    employmentEffect: impact.jobsEffect,
    householdIncome: impact.householdIncomeAnnual,
    realGain: impact.realGainPercent,
    consumptionChange: impact.consumptionPercent,
    macro: {
      inflation: impact.inflationPoints,
      gdpGrowth: impact.gdpPoints,
      unemployment: impact.unemploymentPoints,
      poverty: impact.povertyPoints,
      gini: impact.giniDelta,
      averageIncome: round((impact.householdIncomeAnnual * 1e9) / Math.max(1, impact.exposure.laborForce) / 12, 2),
    },
    debug: [
      { label: 'Trabalhadores formais expostos', value: Math.round(impact.exposure.effectiveExposedWorkers).toLocaleString('pt-BR') },
      { label: 'Fator de cascata salarial', value: impact.exposure.cascadeFactor.toFixed(3) },
      { label: 'Benefícios no piso', value: Math.round(impact.exposure.pensionAtFloor + impact.exposure.assistanceAtFloor).toLocaleString('pt-BR') },
      { label: 'Folha privada adicional (R$ bi/ano)', value: impact.privatePayrollAnnual.toFixed(2) },
      { label: 'Ganho real (%)', value: impact.realGainPercent.toFixed(3) },
    ],
  };
}

/** Encargo sobre a folha: incide sobre a massa salarial formal. */
function runPayrollCharge(change: NumericPolicyChange, context: EconomicContext): ModelResult {
  const points = change.absoluteDelta;

  // Massa salarial formal do país, R$ bilhões por ano.
  //
  // Sai da renda média e do número de trabalhadores formais, ambos do estado da
  // partida. A tentação era extrapolar a folha das 28 empresas monitoradas pelo
  // número de empregados delas — mas Petrobras e bancos pagam muito acima da
  // média, e a extrapolação inflava a massa salarial nacional em várias vezes.
  const formalWorkers =
    context.population * MINIMUM_WAGE_EXPOSURE.laborForceShare * MINIMUM_WAGE_EXPOSURE.formalPrivateShare;
  const nationalPayroll = (formalWorkers * context.averageIncome * 13) / 1e9;

  const chargeDelta = (nationalPayroll * points) / 100;
  const yearFactor = change.monthsInFirstYear / 12;

  // Encargo é receita da Previdência e do FGTS: cortar custa ao Estado o que
  // alivia na empresa. A conta é quase simétrica, com vazamento pela
  // informalidade e pelo tributo que a margem maior gera depois.
  const stateRevenue = chargeDelta * 0.92;
  const employmentEffect = -(points / 100) * formalWorkers * 0.11;

  return {
    components: [
      {
        label: points > 0 ? 'Arrecadação adicional sobre a folha' : 'Renúncia sobre a folha',
        annualBillions: round(-stateRevenue, 2),
        firstYearBillions: round(-stateRevenue * yearFactor, 2),
        note: `Massa salarial formal estimada em R$ ${nationalPayroll.toFixed(0)} bi por ano.`,
      },
      {
        label: 'Compensação parcial por lucro tributável',
        annualBillions: round(chargeDelta * 0.34 * 0.28, 2),
        firstYearBillions: round(chargeDelta * 0.34 * 0.28 * yearFactor, 2),
        note: 'Margem maior nas empresas vira base de IRPJ e CSLL.',
      },
    ],
    grossAnnual: round(Math.max(0, -stateRevenue), 2),
    revenueOffsetAnnual: round(Math.max(0, stateRevenue) - chargeDelta * 0.34 * 0.28, 2),
    businessCost: round(chargeDelta, 2),
    marginPressure: round(-chargeDelta / 55, 3),
    employmentEffect: Math.round(employmentEffect),
    householdIncome: 0,
    realGain: 0,
    consumptionChange: round((-chargeDelta * 0.2) / Math.max(1, context.gdpNominal) * 100, 3),
    macro: {
      unemployment: round(nonLinear(points / 100, NONLINEARITY.unemployment) * 8, 3),
      gdpGrowth: round(-nonLinear(points / 100, 1.2) * 3.4, 3),
      inflation: round(points * 0.012, 3),
      businessConfidence: round(-points * 0.9, 2),
    },
    debug: [
      { label: 'Massa salarial formal (R$ bi/ano)', value: nationalPayroll.toFixed(1) },
      { label: 'Variação de encargo (p.p.)', value: points.toFixed(2) },
      { label: 'Custo/alívio para as empresas (R$ bi/ano)', value: chargeDelta.toFixed(2) },
    ],
  };
}

/** Tributo: alíquota vira arrecadação com curva de Laffer e efeito na atividade. */
function runTax(
  change: NumericPolicyChange,
  context: EconomicContext,
  state: GameState,
  target: NumericTargetSpec,
): ModelResult {
  const line = state.taxes.find((entry) => entry.rate > 0 && entry.label.length > 0 && entry.id === taxLineId(target.id));
  const currentRate = change.currentValue;
  const points = change.absoluteDelta;

  // Base tributável: arrecadação por ponto de alíquota. Vem da linha real do
  // orçamento quando ela existe; senão, do parâmetro do alvo.
  const revenuePerPoint =
    line && currentRate > 0 ? line.revenue / currentRate : target.revenuePerPoint ?? 3;
  const elasticity = line?.elasticity ?? TAX_ELASTICITY.defaultBaseElasticity;

  // A base foge quando a alíquota sobe: quanto mais móvel o tributo, mais foge.
  const relativeChange = currentRate > 0 ? points / currentRate : 1;
  const erosion = 1 - elasticity * nonLinear(relativeChange, 1.1) * 0.7;
  const revenueDelta = revenuePerPoint * points * clamp(erosion, 0.1, 1.6);
  const yearFactor = change.monthsInFirstYear / 12;

  const isConsumption = target.id === 'consumoTax' || target.id === 'fuelTax' || target.id === 'importTariff';
  const inflationPoints = isConsumption
    ? round(points * TAX_ELASTICITY.consumptionTaxToInflation * 0.45, 3)
    : 0;

  return {
    components: [
      {
        label: points > 0 ? 'Arrecadação adicional' : 'Renúncia fiscal',
        annualBillions: round(-revenueDelta, 2),
        firstYearBillions: round(-revenueDelta * yearFactor, 2),
        note: `R$ ${revenuePerPoint.toFixed(1)} bi por ponto de alíquota, já com a fuga de base.`,
      },
    ],
    grossAnnual: round(Math.max(0, -revenueDelta), 2),
    revenueOffsetAnnual: round(Math.max(0, revenueDelta), 2),
    businessCost: target.id === 'irpj' || target.id === 'dividendTax' ? round(revenueDelta, 2) : 0,
    marginPressure: target.id === 'irpj' ? round(-points * 0.09, 3) : 0,
    employmentEffect: Math.round(-points * 12_000 * (isConsumption ? 0.4 : 1)),
    householdIncome: target.id === 'irpf' ? round(-revenueDelta, 2) : 0,
    realGain: 0,
    consumptionChange: round((-revenueDelta * 0.55) / Math.max(1, context.gdpNominal) * 100, 3),
    macro: {
      inflation: inflationPoints,
      gdpGrowth: round(-nonLinear(relativeChange, 1.3) * TAX_ELASTICITY.gdpElasticity * 12, 3),
      businessConfidence: round(-points * (target.id === 'irpj' ? 1.4 : 0.6), 2),
      fiscalCredibility: round(revenueDelta * 0.06, 2),
    },
    debug: [
      { label: 'Arrecadação por ponto (R$ bi)', value: revenuePerPoint.toFixed(2) },
      { label: 'Elasticidade da base', value: elasticity.toFixed(2) },
      { label: 'Variação relativa da alíquota', value: `${(relativeChange * 100).toFixed(1)}%` },
      { label: 'Arrecadação adicional (R$ bi/ano)', value: revenueDelta.toFixed(2) },
    ],
  };
}

function taxLineId(targetId: string): string {
  switch (targetId) {
    case 'irpj':
      return 'irpj';
    case 'irpf':
      return 'irpf';
    case 'consumoTax':
      return 'consumo';
    case 'iof':
      return 'financeiro';
    case 'importTariff':
      return 'importacao';
    case 'dividendTax':
      return 'dividendos';
    case 'fuelTax':
      return 'combustivel';
    default:
      return targetId;
  }
}

/** Orçamento: gasto público com capacidade de absorção e retorno decrescente. */
function runBudget(
  change: NumericPolicyChange,
  context: EconomicContext,
  target: NumericTargetSpec,
  state: GameState,
): ModelResult {
  // Alvo em % sobre uma base (reajuste de folha) ou em R$ bi direto.
  const basis = target.basis ? target.basis(state) : 0;
  const extraBillions =
    target.unit === 'PERCENT' ? (basis * change.absoluteDelta) / 100 : change.absoluteDelta;

  const current = target.unit === 'PERCENT' ? basis : Math.max(1, change.currentValue);
  const relativeIncrease = current > 0 ? extraBillions / current : 1;

  // Capacidade de absorção: acima de certo acréscimo, o dinheiro extra rende
  // cada vez menos. Cem bilhões em saúde não entregam dez vezes o que entregam
  // dez bilhões — falta obra pronta, gente para contratar e capacidade de gastar.
  const capacity = BUDGET_ELASTICITY.absorptiveCapacity;
  const absorbed =
    Math.abs(relativeIncrease) <= capacity
      ? extraBillions
      : Math.sign(extraBillions) *
        current *
        (capacity + (Math.abs(relativeIncrease) - capacity) ** BUDGET_ELASTICITY.saturationExponent * capacity);
  const efficiency = extraBillions !== 0 ? absorbed / extraBillions : 1;
  const yearFactor = change.monthsInFirstYear / 12;

  const indexPoints = (absorbed / 10) * BUDGET_ELASTICITY.indexPerTenBillion;
  const macro: PolicyImpact = {
    gdpGrowth: round(absorbed * BUDGET_ELASTICITY.gdpMultiplier, 3),
    unemployment: round(-absorbed * 0.0016, 3),
  };

  if (target.category === 'saude') macro.healthIndex = round(indexPoints, 2);
  if (target.category === 'educacao') macro.educationIndex = round(indexPoints, 2);
  if (target.category === 'seguranca') macro.securityIndex = round(indexPoints, 2);
  if (target.category === 'infraestrutura') macro.infrastructureIndex = round(indexPoints, 2);
  if (target.category === 'social') {
    macro.poverty = round(-absorbed * 0.008, 3);
    macro.gini = round(-absorbed * 0.00008, 5);
  }

  return {
    components: [
      {
        label: `Despesa adicional em ${target.label}`,
        annualBillions: round(extraBillions, 2),
        firstYearBillions: round(extraBillions * yearFactor, 2),
        note:
          efficiency < 0.9
            ? `Só cerca de ${(efficiency * 100).toFixed(0)}% do acréscimo é absorvido no primeiro ciclo: o resto vira restos a pagar e obra parada.`
            : 'Acréscimo dentro da capacidade de execução da pasta.',
      },
      {
        label: 'Retorno tributário do gasto',
        annualBillions: round(-absorbed * 0.22, 2),
        firstYearBillions: round(-absorbed * 0.22 * yearFactor, 2),
        note: 'Parte do gasto público volta como tributo sobre a atividade que ele gera.',
      },
    ],
    grossAnnual: round(extraBillions, 2),
    revenueOffsetAnnual: round(absorbed * 0.22, 2),
    businessCost: 0,
    marginPressure: 0,
    employmentEffect: Math.round(absorbed * BUDGET_ELASTICITY.jobsPerBillion),
    householdIncome: round(absorbed * 0.35, 2),
    realGain: 0,
    consumptionChange: round((absorbed * 0.35) / Math.max(1, context.gdpNominal) * 100, 3),
    macro,
    debug: [
      { label: 'Dotação atual (R$ bi/ano)', value: current.toFixed(1) },
      { label: 'Acréscimo (R$ bi/ano)', value: extraBillions.toFixed(2) },
      { label: 'Acréscimo relativo', value: `${(relativeIncrease * 100).toFixed(1)}%` },
      { label: 'Eficiência de absorção', value: `${(efficiency * 100).toFixed(0)}%` },
    ],
  };
}

/** Benefício social: beneficiários vezes o novo valor, com 13º quando cabe. */
function runBenefit(
  change: NumericPolicyChange,
  context: EconomicContext,
  target: NumericTargetSpec,
): ModelResult {
  const beneficiaries = context.population * (target.beneficiaryShare ?? 0.02);
  const months = target.id === 'pensionFloor' || target.id === 'bpc' ? 13 : 12;
  const annual = (beneficiaries * change.absoluteDelta * months) / 1e9;
  const yearFactor = change.monthsInFirstYear / 12;
  const consumptionTax = annual * 0.86 * MINIMUM_WAGE_EXPOSURE.consumptionTaxReturn;

  const inflationRate = context.inflation / 100;
  const realGain = ((1 + change.percentageDelta / 100) / (1 + inflationRate) - 1) * 100;

  return {
    components: [
      {
        label: `Despesa com ${target.label}`,
        annualBillions: round(annual, 2),
        firstYearBillions: round(annual * yearFactor, 2),
        note: `${(beneficiaries / 1e6).toFixed(1)} milhões de beneficiários, ${months} parcelas por ano.`,
      },
      {
        label: 'Tributos sobre o consumo adicional',
        annualBillions: round(-consumptionTax, 2),
        firstYearBillions: round(-consumptionTax * yearFactor, 2),
        note: 'Benefício vira consumo quase integralmente, e consumo é tributado.',
      },
    ],
    grossAnnual: round(annual, 2),
    revenueOffsetAnnual: round(consumptionTax, 2),
    businessCost: 0,
    marginPressure: 0,
    employmentEffect: Math.round(annual * 4_000),
    householdIncome: round(annual, 2),
    realGain: round(realGain, 3),
    consumptionChange: round((annual * 0.86) / Math.max(1, context.gdpNominal) * 100, 3),
    macro: {
      inflation: round(nonLinear(realGain / 100, NONLINEARITY.inflation) * 4.5, 3),
      gdpGrowth: round((annual * 0.86) / Math.max(1, context.gdpNominal) * 100 * 0.55, 3),
      poverty: round(-Math.abs(realGain) * 0.05 * Math.sign(change.absoluteDelta), 3),
      gini: round(-Math.abs(realGain) * 0.0005 * Math.sign(change.absoluteDelta), 5),
    },
    debug: [
      { label: 'Beneficiários', value: Math.round(beneficiaries).toLocaleString('pt-BR') },
      { label: 'Parcelas por ano', value: String(months) },
      { label: 'Despesa adicional (R$ bi/ano)', value: annual.toFixed(2) },
    ],
  };
}

/** Subsídio e crédito público: despesa direta com efeito sobre investimento. */
function runSubsidy(change: NumericPolicyChange, context: EconomicContext, target: NumericTargetSpec): ModelResult {
  const extra = change.absoluteDelta;
  const isCredit = target.id === 'subsidizedCredit';
  // Crédito subsidiado não é despesa integral: o custo é a equalização do juro.
  const fiscal = isCredit ? extra * 0.15 : extra;
  const yearFactor = change.monthsInFirstYear / 12;

  return {
    components: [
      {
        label: isCredit ? 'Equalização de juros do crédito público' : 'Subsídio concedido',
        annualBillions: round(fiscal, 2),
        firstYearBillions: round(fiscal * yearFactor, 2),
        note: isCredit
          ? 'O empréstimo é da empresa; o Tesouro paga a diferença de juro, em parcelas.'
          : 'Renúncia ou transferência direta, paga todo ano enquanto durar.',
      },
    ],
    grossAnnual: round(Math.max(0, fiscal), 2),
    revenueOffsetAnnual: round(Math.max(0, extra * 0.12), 2),
    businessCost: round(-extra, 2),
    marginPressure: round(extra / 90, 3),
    employmentEffect: Math.round(extra * 6_500),
    householdIncome: 0,
    realGain: 0,
    consumptionChange: 0,
    macro: {
      gdpGrowth: round(extra * 0.006, 3),
      businessConfidence: round(extra * 0.12, 2),
      fiscalCredibility: round(-fiscal * 0.09, 2),
    },
    debug: [
      { label: 'Valor contratado (R$ bi/ano)', value: extra.toFixed(2) },
      { label: 'Custo fiscal efetivo (R$ bi/ano)', value: fiscal.toFixed(2) },
      { label: 'PIB nominal de referência', value: context.gdpNominal.toFixed(0) },
    ],
  };
}

/** Efetivo: contratar gente ou construir coisas, com custo unitário. */
function runHeadcount(change: NumericPolicyChange, target: NumericTargetSpec): ModelResult {
  const units = change.absoluteDelta;
  const unitCost = target.unitCost ?? 100;
  const annual = (units * unitCost) / 1e6; // R$ mil por unidade -> R$ bilhões
  const yearFactor = change.monthsInFirstYear / 12;
  const indexPoints = Math.sign(units) * Math.min(6, Math.abs(annual) ** 0.7 * 0.5);

  const macro: PolicyImpact = {
    gdpGrowth: round(annual * 0.008, 3),
    unemployment: round(-units / 2_400_000, 3),
  };
  if (target.category === 'saude') macro.healthIndex = round(indexPoints, 2);
  if (target.category === 'educacao') macro.educationIndex = round(indexPoints, 2);
  if (target.category === 'seguranca') {
    macro.securityIndex = round(indexPoints, 2);
    macro.homicideRate = round(-indexPoints * 0.22, 3);
  }
  if (target.category === 'social') macro.poverty = round(-Math.abs(annual) * 0.004, 3);

  return {
    components: [
      {
        label: `Custo anual de ${target.label}`,
        annualBillions: round(annual, 2),
        firstYearBillions: round(annual * yearFactor, 2),
        note: `${Math.abs(units).toLocaleString('pt-BR')} unidades a R$ ${unitCost} mil por ano cada.`,
      },
    ],
    grossAnnual: round(Math.max(0, annual), 2),
    revenueOffsetAnnual: round(Math.max(0, annual * 0.24), 2),
    businessCost: 0,
    marginPressure: 0,
    employmentEffect: Math.round(units),
    householdIncome: round(annual * 0.6, 2),
    realGain: 0,
    consumptionChange: 0,
    macro,
    debug: [
      { label: 'Unidades', value: units.toLocaleString('pt-BR') },
      { label: 'Custo unitário (R$ mil/ano)', value: String(unitCost) },
      { label: 'Custo total (R$ bi/ano)', value: annual.toFixed(2) },
    ],
  };
}

/** Juros: o presidente não define a Selic. A tentativa custa credibilidade. */
function runInterestPressure(change: NumericPolicyChange): ModelResult {
  const points = change.absoluteDelta;
  const pressure = -points; // pedir juro menor é pressão negativa sobre o BC

  return {
    components: [
      {
        label: 'Serviço da dívida pública',
        annualBillions: round(points * 42, 2),
        firstYearBillions: round((points * 42 * change.monthsInFirstYear) / 12, 2),
        note: 'Cada ponto de Selic muda o custo de rolagem da dívida federal.',
      },
    ],
    grossAnnual: round(Math.max(0, points * 42), 2),
    revenueOffsetAnnual: 0,
    businessCost: round(points * 18, 2),
    marginPressure: round(-points * 0.4, 3),
    employmentEffect: Math.round(points * -90_000),
    householdIncome: 0,
    realGain: 0,
    consumptionChange: round(-points * 0.35, 3),
    macro: {
      // A medida não muda a Selic: ela pressiona. O Copom decide sozinho, e a
      // tentativa cobra prêmio de risco de quem tentou.
      selicPressure: round(pressure * 0.35, 3),
      countryRisk: round(Math.abs(points) * 14, 1),
      fiscalCredibility: round(-Math.abs(points) * 2.2, 2),
      businessConfidence: round(-Math.abs(points) * 1.4, 2),
    },
    debug: [
      { label: 'Variação pretendida (p.p.)', value: points.toFixed(2) },
      { label: 'Efeito no serviço da dívida (R$ bi/ano)', value: (points * 42).toFixed(1) },
      { label: 'Observação', value: 'O Banco Central é autônomo: a alíquota não é gravada no estado.' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Montagem do resultado
// ---------------------------------------------------------------------------

/**
 * Aplica o recorte a tudo o que é agregado.
 *
 * `realGain` fica de fora de propósito: ele é por pessoa. Quem está dentro do
 * recorte ganha o mesmo tanto — o que muda é quanta gente está dentro.
 */
function scaleByScope(result: ModelResult, factor: number): ModelResult {
  if (factor >= 0.999) return result;

  const macro: PolicyImpact = {};
  for (const [key, value] of Object.entries(result.macro)) {
    if (typeof value !== 'number') continue;
    (macro as Record<string, number>)[key] = round(value * factor, 4);
  }

  return {
    ...result,
    components: result.components.map((component) => ({
      ...component,
      annualBillions: round(component.annualBillions * factor, 2),
      firstYearBillions: round(component.firstYearBillions * factor, 2),
    })),
    grossAnnual: round(result.grossAnnual * factor, 2),
    revenueOffsetAnnual: round(result.revenueOffsetAnnual * factor, 2),
    businessCost: round(result.businessCost * factor, 2),
    marginPressure: round(result.marginPressure * factor, 3),
    employmentEffect: Math.round(result.employmentEffect * factor),
    householdIncome: round(result.householdIncome * factor, 2),
    consumptionChange: round(result.consumptionChange * factor, 3),
    macro,
  };
}

/** Faixa de apresentação: o jogo não finge precisão que não tem. */
function estimate(
  label: string,
  value: number,
  unit: ImpactEstimate['unit'],
  note: string,
  magnitude: NumericMagnitude,
): ImpactEstimate {
  // Medida maior é mais incerta: extrapolar para fora do território conhecido
  // aumenta o erro, e a faixa mostrada tem que refletir isso.
  const spread =
    magnitude === 'small' ? 0.3 : magnitude === 'moderate' ? 0.35 : magnitude === 'large' ? 0.42 : 0.55;
  const low = value - Math.abs(value) * spread;
  const high = value + Math.abs(value) * spread;
  const decimals = unit === 'jobs' || unit === 'people' ? 0 : 3;

  return {
    label,
    value: round(value, decimals),
    low: round(Math.min(low, high), decimals),
    high: round(Math.max(low, high), decimals),
    unit,
    note,
  };
}

/**
 * Reação por grupo social, proporcional ao que cada um ganha ou perde.
 *
 * A popularidade tem retorno decrescente: dobrar o aumento não dobra o
 * aplauso, e a conta fiscal desconta parte do que o aplauso rendeu.
 */
function buildGroups(
  change: NumericPolicyChange,
  result: ModelResult,
  netFiscal: number,
): GroupImpact[] {
  const groups: GroupImpact[] = [];
  // A reação IMEDIATA é ao número nominal: quem recebe vê o valor subir hoje.
  // O ganho real decide o que sobra disso meses depois, quando a inflação tiver
  // comido parte do reajuste — e isso entra como efeito defasado, não aqui.
  const gain = change.percentageDelta;
  const saturate = (value: number, ceiling: number) =>
    round(Math.sign(value) * ceiling * (1 - Math.exp(-Math.abs(value) / 6)), 2);

  if (result.householdIncome > 0 || gain > 0) {
    groups.push(
      { groupId: 'baixa_renda', delta: saturate(gain * 0.9, 6), reason: `Ganho real estimado de ${gain.toFixed(1)}% no bolso.` },
      { groupId: 'trabalhadores', delta: saturate(gain * 0.8, 5.5), reason: 'Piso e salários próximos ao piso sobem juntos.' },
    );
  } else if (result.householdIncome < 0 || gain < 0) {
    groups.push(
      { groupId: 'baixa_renda', delta: saturate(gain * 0.9, 6), reason: 'Perda de renda direta na base da pirâmide.' },
      { groupId: 'trabalhadores', delta: saturate(gain * 0.7, 5), reason: 'Corte que chega antes na folha de quem ganha menos.' },
    );
  }

  if (Math.abs(result.businessCost) > 0.5) {
    groups.push({
      groupId: 'empresariado',
      delta: saturate(-result.businessCost / 6, 6),
      reason:
        result.businessCost > 0
          ? `Folha e custos sobem cerca de R$ ${result.businessCost.toFixed(1)} bi por ano.`
          : `Alívio de cerca de R$ ${Math.abs(result.businessCost).toFixed(1)} bi por ano no custo das empresas.`,
    });
  }

  if (Math.abs(netFiscal) > 1) {
    groups.push({
      groupId: 'mercado_financeiro',
      delta: saturate(-netFiscal / 8, 6),
      reason:
        netFiscal > 0
          ? `Custo fiscal líquido de R$ ${netFiscal.toFixed(1)} bi por ano sem compensação declarada.`
          : `Melhora de R$ ${Math.abs(netFiscal).toFixed(1)} bi por ano no resultado.`,
    });
  }

  if (change.model === 'beneficio_social' || change.model === 'salario_minimo') {
    groups.push({
      groupId: 'servidores',
      delta: saturate(-netFiscal / 22, 3),
      reason: 'Despesa obrigatória nova aperta o espaço do resto do orçamento.',
    });
  }

  return groups;
}

/**
 * Aprovação agregada, com teto e retorno decrescente.
 *
 * O saldo é ponderado pelo TAMANHO de cada grupo no eleitorado: agradar quem é
 * 30% do país não vale o mesmo que desagradar quem é 3%, por mais barulho que
 * o segundo faça. Sem esse peso, um reajuste do piso saía impopular porque o
 * empresariado reclamava mais alto do que a base ganhava.
 */
function approvalFrom(groups: GroupImpact[], netFiscal: number, change: NumericPolicyChange): number {
  const weighted = groups.map((entry) => {
    const group = SOCIAL_GROUP_BY_ID[entry.groupId];
    const weight = group ? group.electorateShare / 100 + group.influence / 320 : 0.1;
    return entry.delta * weight;
  });
  const positive = weighted.filter((value) => value > 0).reduce((total, value) => total + value, 0);
  const negative = weighted.filter((value) => value < 0).reduce((total, value) => total + value, 0);
  // Quem perde reclama mais alto do que quem ganha agradece, mas não infinitamente.
  const balance = positive + negative * 1.15;

  const relative = Math.abs(change.percentageDelta) / 100;
  const saturation = 1 - Math.exp(-relative / POPULARITY.halfPoint);
  const ceilingApplied = Math.sign(balance) * POPULARITY.ceiling * saturation;

  return round(clamp(ceilingApplied - Math.max(0, netFiscal) * POPULARITY.fiscalDrag, -5, 5), 2);
}

/**
 * Calcula tudo o que a alteração numérica provoca.
 *
 * Este é o ponto único por onde toda medida numérica passa. Se dois valores
 * diferentes entrarem aqui, dois resultados diferentes saem — não porque
 * alguém escreveu um `if`, mas porque a conta é a mesma e o número é outro.
 */
export function computeNumericImpact(
  change: NumericPolicyChange,
  state: GameState,
): NumericImpactBreakdown {
  const context = buildEconomicContext(state);
  const target = numericTarget(change.target);
  if (!target) throw new Error(`Alvo numérico desconhecido: ${change.target}`);

  const rawResult: ModelResult =
    change.model === 'salario_minimo'
      ? runMinimumWage(change, context)
      : change.model === 'encargo_folha'
        ? runPayrollCharge(change, context)
        : change.model === 'tributo'
          ? runTax(change, context, state, target)
          : change.model === 'orcamento'
            ? runBudget(change, context, target, state)
            : change.model === 'beneficio_social'
              ? runBenefit(change, context, target)
              : change.model === 'subsidio'
                ? runSubsidy(change, context, target)
                : change.model === 'efetivo'
                  ? runHeadcount(change, target)
                  : change.model === 'juros'
                    ? runInterestPressure(change)
                    : {
                        components: [],
                        grossAnnual: 0,
                        revenueOffsetAnnual: 0,
                        businessCost: 0,
                        marginPressure: 0,
                        employmentEffect: 0,
                        householdIncome: 0,
                        realGain: 0,
                        consumptionChange: 0,
                        macro: emptyMacro(),
                        debug: [],
                      };

  // O recorte alcança tudo: custo, folha, emprego, inflação. Uma desoneração só
  // para microempresa não custa o mesmo que a desoneração de todo mundo, e não
  // entrega o mesmo também.
  const result = scaleByScope(rawResult, change.scopeFactor);

  const netAnnual = round(result.grossAnnual - result.revenueOffsetAnnual, 2);
  const yearFactor = change.monthsInFirstYear / 12;
  // Medida temporária não tem custo recorrente: ela acaba.
  const netRecurring = change.temporary ? 0 : netAnnual;
  const netFirstYear = round(
    netAnnual * yearFactor * (change.durationMonths ? Math.min(1, change.durationMonths / 12) : 1),
    2,
  );

  const macro: PolicyImpact = { ...result.macro };

  // O peso fiscal entra por três canais que o motor macro já conhece.
  if (Math.abs(netAnnual) > 0.1) {
    macro.fiscalCredibility = round(
      (macro.fiscalCredibility ?? 0) - (netAnnual / 10) * FISCAL_REACTION.credibilityPerTenBillion,
      2,
    );
    macro.countryRisk = round(
      (macro.countryRisk ?? 0) +
        (nonLinear(netAnnual / 100, NONLINEARITY.fiscalRisk) * 10) * FISCAL_REACTION.riskPerTenBillion,
      1,
    );
    macro.debtToGdp = round(
      (macro.debtToGdp ?? 0) + (netAnnual / Math.max(1, context.gdpNominal)) * 100,
      3,
    );
  }
  if (result.businessCost > 0.5) {
    macro.businessConfidence = round(
      (macro.businessConfidence ?? 0) -
        (result.businessCost / 10) * FISCAL_REACTION.businessConfidencePerTenBillion,
      2,
    );
  }

  const groups = buildGroups(change, result, netAnnual);
  macro.approval = approvalFrom(groups, netAnnual, change);

  const estimates: ImpactEstimate[] = [
    estimate('Saldo fiscal federal', -netAnnual, 'brl_bi', 'Despesa menos a receita que a própria medida gera.', change.magnitude),
    estimate('Custo para as empresas', result.businessCost, 'brl_bi', 'Folha e custos que o setor privado absorve, fora do orçamento.', change.magnitude),
    estimate('Renda das famílias', result.householdIncome, 'brl_bi', 'Dinheiro adicional na mão de quem recebe.', change.magnitude),
    estimate('Consumo', result.consumptionChange, 'percent', 'Efeito sobre o consumo agregado.', change.magnitude),
    estimate('Inflação', macro.inflation ?? 0, 'pp', 'Pressão sobre o IPCA em 12 meses.', change.magnitude),
    estimate('PIB', macro.gdpGrowth ?? 0, 'pp', 'Efeito líquido sobre o crescimento.', change.magnitude),
    estimate('Desemprego', macro.unemployment ?? 0, 'pp', 'Efeito sobre a taxa de desocupação.', change.magnitude),
    estimate('Empregos', result.employmentEffect, 'jobs', 'Postos formais criados ou fechados.', change.magnitude),
  ].filter((entry) => Math.abs(entry.value) > 0.0005);

  // ------------------------------------------------ A conta que chega depois
  const delayed: NumericImpactBreakdown['delayed'] = [];

  // Custo recorrente: a medida entra no primeiro exercício por uma fração do
  // ano, mas a partir do exercício seguinte ela custa cheia, todo ano. É a
  // diferença entre "cabe no orçamento deste ano" e "cabe no orçamento".
  if (Math.abs(netRecurring) > 1) {
    delayed.push({
      monthsAhead: Math.max(1, Math.min(36, change.monthsInFirstYear)),
      label: `O custo cheio de ${change.targetLabel} entra no orçamento seguinte`,
      impacts: { primaryBalance: round(-netRecurring, 2) },
    });
  }

  // A fatura política do custo. No anúncio quase ninguém sente; seis meses
  // depois, com o aperto no resto do orçamento, sente todo mundo.
  if (netRecurring > 15) {
    delayed.push({
      monthsAhead: 6,
      label: `A conta de ${change.targetLabel} aperta o resto do orçamento`,
      impacts: {
        approval: round(-Math.min(3.5, netRecurring * POPULARITY.delayedFiscalPain), 2),
        fiscalCredibility: round(-Math.min(6, netRecurring * 0.05), 2),
      },
    });
  }

  // Reajuste comido pela inflação: o aplauso do anúncio não sobrevive ao ano.
  if (result.realGain < 0 && change.percentageDelta > 0) {
    delayed.push({
      monthsAhead: 8,
      label: `O aumento de ${change.targetLabel} é anulado pela inflação`,
      impacts: { approval: round(clamp(result.realGain * 0.25, -3, 0), 2) },
    });
  }

  if (change.temporary && change.durationMonths) {
    delayed.push({
      monthsAhead: Math.min(36, change.durationMonths),
      label: `${change.targetLabel} volta ao valor anterior`,
      impacts: { approval: round(-Math.abs(macro.approval ?? 0) * 0.6, 2) },
    });
  }

  const debug: NumericDebugLine[] = [
    { label: 'Alvo', value: change.target },
    { label: 'Valor atual', value: String(change.currentValue) },
    { label: 'Valor proposto', value: String(change.proposedValue) },
    { label: 'Delta absoluto', value: String(change.absoluteDelta) },
    { label: 'Delta relativo', value: `${change.percentageDelta.toFixed(3)}%` },
    ...(change.pointDelta !== undefined
      ? [{ label: 'Delta em pontos percentuais', value: `${change.pointDelta.toFixed(2)} p.p.` }]
      : []),
    { label: 'População afetada', value: change.affectedPopulation.toLocaleString('pt-BR') },
    { label: 'Meses no primeiro exercício', value: String(change.monthsInFirstYear) },
    ...result.debug,
    { label: 'Despesa bruta (R$ bi/ano)', value: result.grossAnnual.toFixed(2) },
    { label: 'Receita compensatória (R$ bi/ano)', value: result.revenueOffsetAnnual.toFixed(2) },
    { label: 'Saldo líquido (R$ bi/ano)', value: netAnnual.toFixed(2) },
    { label: 'Saldo no primeiro exercício (R$ bi)', value: netFirstYear.toFixed(2) },
  ];

  return {
    change,
    fiscal: {
      components: result.components,
      grossAnnual: result.grossAnnual,
      revenueOffsetAnnual: result.revenueOffsetAnnual,
      netAnnual,
      netFirstYear,
      netRecurring,
    },
    business: {
      payrollCostAnnual: result.businessCost,
      marginPressure: result.marginPressure,
      employmentEffect: result.employmentEffect,
      mostExposed: mostExposedCompanies(state, change),
    },
    households: {
      extraIncomeAnnual: result.householdIncome,
      realGain: result.realGain,
      consumptionChange: result.consumptionChange,
      povertyDelta: macro.poverty ?? 0,
      giniDelta: macro.gini ?? 0,
    },
    macro,
    estimates,
    groups,
    delayed,
    debug,
  };
}

/** As empresas que mais sentem esta medida, por intensidade de mão de obra. */
function mostExposedCompanies(state: GameState, change: NumericPolicyChange): string[] {
  if (change.model !== 'salario_minimo' && change.model !== 'encargo_folha') return [];
  return [...state.companies.companies]
    .sort(
      (a, b) =>
        b.sensitivity.labor * b.employees - a.sensitivity.labor * a.employees,
    )
    .slice(0, 4)
    .map((company) => company.name);
}

/**
 * Lê o texto e devolve a medida numérica pronta, ou null quando não há número.
 *
 * É o único ponto de entrada que o resto do jogo precisa conhecer.
 */
export function analyzeNumericPolicy(
  text: string,
  state: GameState,
): NumericImpactBreakdown | null {
  const intent = readNumericIntent(text, state);
  if (!intent) return null;

  const change = buildNumericChange(intent, state);
  if (change.absoluteDelta === 0) return null;

  return computeNumericImpact(change, state);
}

/**
 * Devolve a análise da IA com a MATEMÁTICA refeita pelo motor.
 *
 * A divisão de trabalho é esta, e não é negociável:
 *
 *   IA     -> entende a intenção, escreve o texto, classifica a matéria
 *   motor  -> lê o valor atual no estado, calcula delta, custo e efeitos
 *
 * O modelo não decide quanto custa aumentar o piso: ele varia entre chamadas,
 * arredonda, chuta e às vezes inventa o valor vigente. Quando o texto tem um
 * número, o cálculo local sobrescreve custo, impactos e reações — o que
 * sobrevive da resposta remota é a redação, que é onde ela é boa.
 */
export function reconcileNumericMath<
  T extends {
    estimatedCost: number;
    impacts: PolicyImpact;
    groupImpacts: GroupImpact[];
    delayedEffects: { monthsAhead: number; label: string; impacts: PolicyImpact }[];
    headline: string;
    warnings: string[];
    numericImpact?: NumericImpactBreakdown;
  },
>(analysis: T, text: string, state: GameState): T {
  const numeric = analyzeNumericPolicy(text, state);
  if (!numeric) return analysis;

  const { change, fiscal } = numeric;
  const proposedLabel = formatTargetLabel(change.proposedValue, change.unit);
  const headline = analysis.headline.includes(proposedLabel)
    ? analysis.headline
    : buildNumericHeadline(change);

  return {
    ...analysis,
    estimatedCost: Math.round(clamp(fiscal.netFirstYear * 1e9, -1.5e12, 1.5e12)),
    // Índices setoriais que só a IA estimou (saúde, educação, segurança)
    // continuam valendo; tudo o que o motor calcula é sobrescrito por ele.
    impacts: { ...analysis.impacts, ...numeric.macro },
    groupImpacts: numeric.groups.length > 0 ? numeric.groups : analysis.groupImpacts,
    delayedEffects: [...numeric.delayed, ...analysis.delayedEffects].slice(0, 6),
    headline,
    numericImpact: numeric,
    warnings: [
      ...analysis.warnings,
      `Os números desta ficha foram recalculados pelo simulador a partir do valor vigente (${formatTargetLabel(
        change.currentValue,
        change.unit,
      )}) e do valor proposto (${proposedLabel}).`,
    ].slice(0, 6),
  };
}

function formatTargetLabel(value: number, unit: NumericPolicyChange['unit']): string {
  switch (unit) {
    case 'PERCENT':
    case 'PERCENT_ANNUAL':
      return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
    case 'BRL_ANNUAL_BILLION':
      return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
    case 'COUNT':
      return value.toLocaleString('pt-BR');
    default:
      return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  }
}

/**
 * Grava o valor novo no estado. Chamado quando a medida entra em vigor, não
 * quando é assinada — antes disso ela é só uma intenção.
 */
export function applyNumericChange(state: GameState, change: NumericPolicyChange): boolean {
  const target = numericTarget(change.target);
  if (!target?.write) return false;
  target.write(state, change.proposedValue);
  return true;
}

/** Desfaz o valor, para medida revogada, caducada ou derrubada no Supremo. */
export function revertNumericChange(state: GameState, change: NumericPolicyChange): boolean {
  const target = numericTarget(change.target);
  if (!target?.write) return false;
  target.write(state, change.currentValue);
  return true;
}
