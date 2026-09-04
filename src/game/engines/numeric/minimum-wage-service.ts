import type {
  EconomicContext,
  FiscalComponent,
  NumericPolicyChange,
} from '../../types/numeric-policy';
import {
  MINIMUM_WAGE_ELASTICITY as E,
  MINIMUM_WAGE_EXPOSURE as X,
  nonLinear,
  NONLINEARITY,
} from '../../data/policy-elasticities';
import { round } from '../../utils/math';

/**
 * IMPACTO DO SALÁRIO MÍNIMO
 *
 * O erro conceitual mais caro deste tipo de simulação é tratar o reajuste do
 * piso como se o Tesouro pagasse a diferença de salário de todo trabalhador do
 * país. Não paga. Quem paga a folha privada é o empregador.
 *
 * O que o Tesouro paga é o que está INDEXADO ao piso:
 *
 *   previdência no piso  ->  o grosso da conta, com 13º
 *   BPC e assistência    ->  vinculação constitucional
 *   abono e seguro       ->  parcelas menores
 *   servidores no piso   ->  fatia pequena
 *
 * E parte disso volta: contribuição sobre a folha maior e tributo sobre o
 * consumo que a renda extra gera. O custo líquido é a diferença.
 *
 * Como referência de sanidade da calibragem: cada R$ 1 de aumento no piso custa
 * ao redor de R$ 0,4 bilhão por ano ao orçamento federal bruto. Um reajuste de
 * R$ 80 deve dar algo perto de R$ 30 bilhões brutos — e é isso que sai daqui.
 */

export interface WageExposure {
  laborForce: number;
  formalPrivateWorkers: number;
  /** Trabalhadores privados ponderados pela cascata salarial. */
  effectiveExposedWorkers: number;
  /** Fração média de repasse na folha privada, 0-1. */
  cascadeFactor: number;
  publicAtFloor: number;
  pensionAtFloor: number;
  assistanceAtFloor: number;
  laborBenefitPeople: number;
  informalWorkers: number;
}

/**
 * Quem é atingido e com que intensidade.
 *
 * A cascata é o que separa este modelo de uma multiplicação ingênua: quem ganha
 * exatamente um mínimo recebe o aumento inteiro, quem ganha 1,2 recebe a maior
 * parte por pressão de tabela, e a partir de cinco mínimos não sobra nada.
 */
export function wageExposure(context: EconomicContext): WageExposure {
  const laborForce = context.population * X.laborForceShare;
  const formalPrivateWorkers = laborForce * X.formalPrivateShare;
  const cascadeFactor = X.wageBands.reduce(
    (total, band) => total + band.shareOfFormal * band.passthrough,
    0,
  );

  return {
    laborForce,
    formalPrivateWorkers,
    effectiveExposedWorkers: formalPrivateWorkers * cascadeFactor,
    cascadeFactor,
    publicAtFloor: laborForce * X.publicShare * X.publicAtFloorShare,
    pensionAtFloor: context.population * X.pensionAtFloorShare,
    assistanceAtFloor: context.population * X.assistanceAtFloorShare,
    laborBenefitPeople: context.population * X.laborBenefitShare,
    informalWorkers: laborForce * X.informalShare,
  };
}

export interface MinimumWageImpact {
  exposure: WageExposure;
  components: FiscalComponent[];
  /** Despesa federal bruta anual, R$ bilhões. */
  grossFiscalAnnual: number;
  /** Receita adicional que a medida gera, R$ bilhões. */
  revenueOffsetAnnual: number;
  netFiscalAnnual: number;
  netFiscalFirstYear: number;
  /** Custo adicional da folha privada, R$ bilhões por ano. Não é do Tesouro. */
  privatePayrollAnnual: number;
  /** Renda adicional que chega às famílias, R$ bilhões por ano. */
  householdIncomeAnnual: number;
  /** Ganho real de poder de compra, em %. */
  realGainPercent: number;
  /** Variação do consumo agregado, em %. */
  consumptionPercent: number;
  /** Pressão sobre o IPCA, em p.p. */
  inflationPoints: number;
  /** Efeito sobre a taxa de desocupação, em p.p. */
  unemploymentPoints: number;
  /** Empregos formais em risco (negativo) ou criados (positivo). */
  jobsEffect: number;
  povertyPoints: number;
  giniDelta: number;
  gdpPoints: number;
}

/**
 * Calcula tudo o que um reajuste do piso provoca.
 *
 * Nenhum número aqui é escolhido por faixa: todos saem de `change.absoluteDelta`
 * e `change.percentageDelta`, da exposição de cada grupo e do estado da
 * economia. Por isso R$ 1.700 e R$ 1.800 não podem coincidir.
 */
export function minimumWageImpact(
  change: NumericPolicyChange,
  context: EconomicContext,
): MinimumWageImpact {
  const exposure = wageExposure(context);
  const delta = change.absoluteDelta;
  const nominalChange = change.percentageDelta / 100;

  // Ganho REAL: é ele que move consumo, pobreza e emprego. Um reajuste de 6%
  // com inflação de 5% é quase nada; o mesmo 6% com inflação de 1% é muito.
  const inflationRate = context.inflation / 100;
  const realGain = (1 + nominalChange) / (1 + inflationRate) - 1;

  // Aumento escalonado entrega só uma parte no primeiro ano.
  const gradualFactor = change.gradualMonths ? Math.min(1, 12 / change.gradualMonths) : 1;
  const yearFactor = change.monthsInFirstYear / 12;

  const toBillions = (people: number, months: number) => (people * delta * months) / 1e9;

  // ------------------------------------------------------- Despesa federal
  const pension = toBillions(exposure.pensionAtFloor, X.pensionMonthsPerYear);
  const assistance = toBillions(exposure.assistanceAtFloor, X.assistanceMonthsPerYear);
  const laborBenefits = toBillions(exposure.laborBenefitPeople, X.laborBenefitMonths);
  const publicPayroll = toBillions(exposure.publicAtFloor, E.monthsPerYear);

  // -------------------------------------------------- Folha privada (não é do Tesouro)
  const privatePayrollGross = toBillions(exposure.effectiveExposedWorkers, E.monthsPerYear);
  const privatePayrollWithCharges = privatePayrollGross * E.payrollCostMultiplier;

  // ------------------------------------------------------------- Retorno
  const payrollTaxes = privatePayrollGross * X.payrollTaxReturn;
  const householdIncome =
    (privatePayrollGross + pension + assistance + laborBenefits + publicPayroll) *
    (1 - E.informalityLeak * 0.25);
  const consumptionTaxes = householdIncome * E.consumptionPropensity * X.consumptionTaxReturn;

  const components: FiscalComponent[] = [
    {
      label: 'Previdência vinculada ao piso',
      annualBillions: round(pension, 2),
      firstYearBillions: round(pension * yearFactor * gradualFactor, 2),
      note: `${Math.round(exposure.pensionAtFloor / 1e6)} milhões de benefícios no piso, com 13º.`,
    },
    {
      label: 'BPC e assistência social',
      annualBillions: round(assistance, 2),
      firstYearBillions: round(assistance * yearFactor * gradualFactor, 2),
      note: `${Math.round(exposure.assistanceAtFloor / 1e6)} milhões de benefícios com vinculação constitucional.`,
    },
    {
      label: 'Abono e seguro-desemprego',
      annualBillions: round(laborBenefits, 2),
      firstYearBillions: round(laborBenefits * yearFactor * gradualFactor, 2),
      note: 'Parcelas indexadas ao piso, pagas por alguns meses do ano.',
    },
    {
      label: 'Folha pública no piso',
      annualBillions: round(publicPayroll, 2),
      firstYearBillions: round(publicPayroll * yearFactor * gradualFactor, 2),
      note: 'Só a parcela do funcionalismo cuja remuneração acompanha o mínimo.',
    },
    {
      label: 'Contribuição sobre a folha formal',
      annualBillions: round(-payrollTaxes, 2),
      firstYearBillions: round(-payrollTaxes * yearFactor * gradualFactor, 2),
      note: 'Folha maior recolhe mais: parte do custo volta ao caixa.',
    },
    {
      label: 'Tributos sobre o consumo adicional',
      annualBillions: round(-consumptionTaxes, 2),
      firstYearBillions: round(-consumptionTaxes * yearFactor * gradualFactor, 2),
      note: 'A renda extra é gasta, e o que é gasto é tributado.',
    },
  ];

  const grossFiscalAnnual = pension + assistance + laborBenefits + publicPayroll;
  const revenueOffsetAnnual = payrollTaxes + consumptionTaxes;
  const netFiscalAnnual = (grossFiscalAnnual - revenueOffsetAnnual) * gradualFactor;

  // ------------------------------------------------------------ Macro
  const realGainPercent = realGain * 100;
  const curvedReal = nonLinear(realGain, NONLINEARITY.inflation) * 100;

  const consumptionPercent =
    context.gdpNominal > 0
      ? ((householdIncome * E.consumptionPropensity) / context.gdpNominal) * 100 * gradualFactor
      : 0;

  // Inflação tem duas pernas: demanda (ganho real) e custo (folha nominal).
  const inflationPoints =
    (E.inflationPassthrough * curvedReal + 0.02 * change.percentageDelta) * gradualFactor;

  // Emprego responde ao ganho REAL: reajuste que só repõe inflação quase não
  // muda a decisão de contratar.
  const unemploymentPoints =
    E.employmentElasticity *
    nonLinear(Math.max(0, realGain), NONLINEARITY.unemployment) *
    100 *
    gradualFactor;

  const jobsEffect = -(unemploymentPoints / 100) * exposure.laborForce;

  return {
    exposure,
    components,
    grossFiscalAnnual: round(grossFiscalAnnual * gradualFactor, 2),
    revenueOffsetAnnual: round(revenueOffsetAnnual * gradualFactor, 2),
    netFiscalAnnual: round(netFiscalAnnual, 2),
    netFiscalFirstYear: round(netFiscalAnnual * yearFactor, 2),
    privatePayrollAnnual: round(privatePayrollWithCharges * gradualFactor, 2),
    householdIncomeAnnual: round(householdIncome * gradualFactor, 2),
    realGainPercent: round(realGainPercent, 3),
    consumptionPercent: round(consumptionPercent, 3),
    inflationPoints: round(inflationPoints, 3),
    unemploymentPoints: round(unemploymentPoints, 3),
    jobsEffect: Math.round(jobsEffect),
    povertyPoints: round(-E.povertyElasticity * realGainPercent * gradualFactor, 3),
    giniDelta: round(-E.giniElasticity * realGainPercent * gradualFactor, 5),
    gdpPoints: round(consumptionPercent * E.gdpPerPercentOfWageBill * 2.4, 3),
  };
}
