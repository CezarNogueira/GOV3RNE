import type {
  Company,
  CompanyAggregate,
  CorporatePolicyLevers,
  GameState,
} from '../../types/index';
import { commodityIndex } from './commodity-service';
import {
  annualWageOf,
  chargeRateFor,
  effectiveTaxRate,
  healthOf,
  payrollFor,
  pretaxFromNet,
} from './company-service';
import { Rng } from '../../utils/rng';
import { approach, clamp, clamp100, round } from '../../utils/math';

/**
 * FINANÇAS DAS EMPRESAS
 *
 * Este é o coração do sistema: todo mês, cada empresa recalcula receita, custo,
 * lucro, imposto, dividendo, investimento e emprego a partir do cenário que o
 * presidente produziu — e devolve o resultado para a macroeconomia.
 *
 * A cadeia é sempre a mesma, e nunca é um bônus direto:
 *
 *   decisão -> alavanca (imposto, encargo, tarifa, juro, câmbio)
 *           -> receita e custo da empresa
 *           -> lucro
 *           -> emprego, investimento e dividendo
 *           -> desemprego, PIB, arrecadação e caixa do governo
 *           -> aprovação
 *
 * ESCALA
 * Tudo dentro deste arquivo é R$ MILHÕES, em base ANUAL, salvo quando o nome
 * diz "monthly". A conversão para a escala do governo (R$ bilhões) acontece
 * uma vez só, em `toBillions`, no fim do arquivo.
 */

/** Um número em R$ milhões vira R$ bilhões — a escala em que o governo pensa. */
function toBillions(millions: number): number {
  return millions / 1000;
}

export const FINANCE_PARAMS = {
  /** Quanto 1 p.p. de PIB acima do potencial move a receita de uma empresa cíclica. */
  cycleToRevenue: 3.2,
  /** Repasse do câmbio para a receita de quem exporta. */
  fxToRevenue: 0.65,
  /** Repasse do preço da commodity para a receita de quem a vende. */
  commodityToRevenue: 0.9,
  /** Efeito da tarifa de importação sobre quem ela protege. */
  tariffToRevenue: 1.4,
  /** Efeito de 1 p.p. de Selic sobre a receita de quem vive de juro. */
  interestToRevenue: 2.2,
  /** Velocidade de convergência da receita para o alvo do cenário. */
  revenueSpeed: 0.24,
  /** Velocidade com que o quadro de funcionários persegue o alvo. */
  employmentSpeed: 0.07,
  /** Velocidade do plano de investimento. */
  investmentSpeed: 0.18,
  /** Spread médio sobre a Selic no custo da dívida corporativa, em p.p. */
  debtSpread: 3.2,
  /**
   * Cada emprego direto nas grandes empresas sustenta outros na cadeia. É por
   * isso que fechar uma fábrica aparece no desemprego da cidade inteira.
   */
  supplyChainMultiplier: 3.2,
  /** Fração da população em idade ativa ocupada ou procurando trabalho. */
  laborForceShare: 0.47,
} as const;

export interface CompanyFinanceOutcome {
  aggregate: CompanyAggregate;
  /** Empregos criados (+) ou destruídos (-) no mês. */
  jobsDelta: number;
  /** Variação do desemprego causada pelas empresas, em p.p. */
  unemploymentDelta: number;
  /** Desvio de arrecadação corporativa em relação à base, R$ bilhões (12m). */
  revenueDelta: number;
  /** Dividendos que a União recebeu no mês, R$ bilhões. */
  dividendsToTreasury: number;
  /** Impulso de investimento privado para o pipeline macro. */
  investmentImpulse: number;
  /** Efeito sobre a confiança empresarial. */
  confidenceDelta: number;
  /** Empresas que entraram em crise aberta neste mês. */
  newCrises: Company[];
}

/**
 * Custo operacional de referência, fora folha e juros.
 *
 * Sai da identidade contábil do balanço-base: receita menos lucro antes do
 * imposto é tudo o que a empresa gastou. Tirando folha e juros do período, o
 * que sobra é o custo operacional — insumo, energia, frete, depreciação.
 */
function baseOperatingCost(company: Company, levers: CorporatePolicyLevers): number {
  const { revenueBase, profitBase, debt } = company.financials;
  const pretaxBase = pretaxFromNet(profitBase, effectiveTaxRate(company, levers));
  const payrollBase = (company.employeesBase * annualWageOf(company)) / 1000;
  const payrollWithCharges = payrollBase * (1 + (levers.fgtsRateBase + levers.payrollChargesBase) / 100);
  const interestBase = debt * 0.09;
  return Math.max(0, revenueBase - pretaxBase - payrollWithCharges - interestBase);
}

/** Avança as finanças de uma empresa em um mês. */
function stepCompany(
  state: GameState,
  company: Company,
  rng: Rng,
): { dividendToState: number; jobsDelta: number; taxes: number } {
  const eco = state.economy;
  const ref = state.companies.reference;
  const levers = state.companies.levers;
  const sens = company.sensitivity;
  const fin = company.financials;

  // ----------------------------------------------------- 1. Desvios do cenário
  // Nada aqui é valor absoluto: tudo é distância em relação à posse.
  const cycleGap = (eco.gdpGrowth - ref.gdpGrowth) / 100;
  const fxGap = (eco.usd - ref.usd) / ref.usd;
  const selicGap = (eco.selic - ref.selic) / 100;
  const inflationGap = (eco.inflation - ref.inflation) / 100;
  const tariffGap = (levers.importTariff - levers.importTariffBase) / 100;
  const commodityGap = (commodityIndex(state, sens.commodityId) - 100) / 100;
  const regulatoryGap = (levers.regulatoryBurden - 50) / 100;
  const shareGap = company.marketShareBase > 0 ? company.marketShare / company.marketShareBase - 1 : 0;

  // ----------------------------------------------------------- 2. Receita
  const revenueMultiplier =
    1 +
    sens.demand * cycleGap * FINANCE_PARAMS.cycleToRevenue +
    sens.fx * fxGap * FINANCE_PARAMS.fxToRevenue +
    sens.commodity * commodityGap * FINANCE_PARAMS.commodityToRevenue +
    sens.tariff * tariffGap * FINANCE_PARAMS.tariffToRevenue +
    sens.interest * selicGap * FINANCE_PARAMS.interestToRevenue +
    shareGap;

  const revenueTarget = Math.max(
    fin.revenueBase * 0.25,
    fin.revenueBase * clamp(revenueMultiplier, 0.35, 2.4) + company.publicContractRevenue * 0.15,
  );
  fin.revenue = round(
    Math.max(0, approach(fin.revenue, revenueTarget, FINANCE_PARAMS.revenueSpeed) * (1 + rng.noise(0.006))),
    1,
  );

  // ------------------------------------------------------------- 3. Custos
  // Quem tem insumo importado sofre com dólar alto; quem consegue repassar
  // inflação sofre menos com ela. Os dois estão no mesmo sinal de sensibilidade.
  const importIntensity = Math.max(0, -sens.fx) * 0.5;
  const commodityCostIntensity = Math.max(0, -sens.commodity) * 0.4;
  const costPressure =
    1 +
    inflationGap * (0.55 - sens.inflation * 0.45) +
    importIntensity * fxGap +
    commodityCostIntensity * commodityGap +
    regulatoryGap * 0.15;

  const operatingCost =
    baseOperatingCost(company, levers) *
    (fin.revenue / Math.max(1, fin.revenueBase)) ** 0.85 *
    clamp(costPressure, 0.6, 2.2);

  fin.payrollCost = payrollFor(company, levers);

  // Dívida em moeda estrangeira é reavaliada pelo câmbio: a conta cresce sem a
  // empresa ter tomado um centavo a mais.
  const fxRevaluation = fin.debt * sens.fxDebtShare * (fxGap * 0.08);
  fin.debt = round(Math.max(0, fin.debt + fxRevaluation / 12), 1);
  const interestCost = fin.debt * ((eco.selic + FINANCE_PARAMS.debtSpread) / 100) * 0.75;

  // ------------------------------------------------------------- 4. Lucro
  const pretax =
    fin.revenue - operatingCost - fin.payrollCost - interestCost + company.subsidyReceived;
  const taxRate = effectiveTaxRate(company, levers);
  const taxes = pretax > 0 ? (pretax * taxRate) / 100 : 0;

  fin.ebitda = round(fin.revenue - operatingCost - fin.payrollCost, 1);
  fin.profit = round(pretax - taxes, 1);
  fin.taxesPaid = round(taxes, 1);
  fin.netMargin = fin.revenue > 0 ? round((fin.profit / fin.revenue) * 100, 2) : 0;

  if (fin.profit < 0) {
    company.monthsInLoss += 1;
  } else {
    company.monthsInLoss = Math.max(0, company.monthsInLoss - 1);
  }

  // --------------------------------------------------------- 5. Dividendos
  // Só o lucro vira dividendo, só o payout declarado é distribuído e só a fatia
  // da União entra no caixa do governo. Nunca o lucro inteiro.
  const annualDividends = fin.profit > 0 ? fin.profit * fin.dividendPayout : 0;
  fin.dividends = round(annualDividends, 1);
  const monthlyDividends = annualDividends / 12;
  const dividendToState = round((monthlyDividends * company.ownership.stateOwnership) / 100, 3);
  company.dividendsToState = round(company.dividendsToState + dividendToState, 2);

  // ------------------------------------------------------- 6. Investimento
  // Apetite de investir: juro alto e regulação pesada travam; caixa, confiança,
  // crédito subsidiado e boa relação com o governo destravam.
  const appetite = clamp(
    1 -
      selicGap * 3.4 +
      (company.politics.governmentRelation / 100) * 0.18 +
      (company.market.investorConfidence - 50) / 220 +
      (levers.subsidizedCredit / 90) * (company.control === 'federal' ? 0.35 : 0.22) -
      regulatoryGap * 0.3 -
      ((levers.corporateTax - levers.corporateTaxBase) / 100) * sens.tax * 1.6,
    0.2,
    2.1,
  );
  const investmentTarget =
    fin.revenue * (fin.annualInvestment / Math.max(1, fin.revenueBase)) * appetite * (company.expansionCapacity / 70);
  fin.annualInvestment = round(
    Math.max(0, approach(fin.annualInvestment, investmentTarget, FINANCE_PARAMS.investmentSpeed)),
    1,
  );

  // ------------------------------------------------------------- 7. Caixa
  // Depreciação devolve parte do capex, e o resto sai do caixa. Caixa negativo
  // vira dívida: a empresa não some, ela se endivida.
  const monthlyFlow = (fin.profit - annualDividends - fin.annualInvestment * 0.45) / 12;
  fin.cash = round(fin.cash + monthlyFlow, 1);
  if (fin.cash < 0) {
    fin.debt = round(fin.debt - fin.cash, 1);
    fin.cash = 0;
  }
  fin.equity = round(fin.equity + (fin.profit - annualDividends) / 12, 1);

  // ---------------------------------------------------------- 8. Emprego
  // Custo do trabalho cai, contratação sobe — proporcional a quanto a empresa
  // depende de gente. Empresa automatizada quase não sente.
  const chargeGap =
    (chargeRateFor(company, levers) - levers.fgtsRateBase - levers.payrollChargesBase) / 100;
  const hiringPull =
    -chargeGap * sens.labor * 2.6 +
    (fin.netMargin - (fin.revenueBase > 0 ? (fin.profitBase / fin.revenueBase) * 100 : 0)) / 100 * 0.9 +
    // Margem negativa não é só "pior que a referência": empresa perdendo
    // dinheiro corta gente, mesmo quando já vinha perdendo antes. Sem este
    // termo, uma estatal deficitária contratava para sempre.
    (Math.min(0, fin.netMargin) / 100) * 0.6 +
    (company.jobCreationCapacity / 100 - 0.5) * 0.06;

  const productionRatio = fin.revenueBase > 0 ? fin.revenue / fin.revenueBase : 1;
  const employmentTarget =
    company.employeesBase * clamp(productionRatio ** 0.55 * (1 + hiringPull), 0.55, 1.6);

  const beforeEmployees = company.employees;
  company.employees = Math.round(
    approach(company.employees, employmentTarget, FINANCE_PARAMS.employmentSpeed),
  );
  const jobsDelta = company.employees - beforeEmployees;

  // -------------------------------------------------- 9. Produção e situação
  company.productionLevel = round(
    clamp(approach(company.productionLevel, productionRatio * 100, 0.3), 20, 220),
    1,
  );
  company.expansionCapacity = round(
    clamp100(
      approach(
        company.expansionCapacity,
        45 + fin.netMargin * 1.4 - (fin.debt / Math.max(1, fin.revenue)) * 12 - selicGap * 60,
        0.12,
      ),
    ),
    1,
  );
  company.crisisRisk = round(
    clamp100(
      approach(
        company.crisisRisk,
        clamp100(
          18 -
            fin.netMargin * 1.8 +
            company.monthsInLoss * 6 +
            (fin.debt / Math.max(1, fin.revenue)) * 14 -
            (fin.cash / Math.max(1, fin.revenue)) * 20,
        ),
        0.2,
      ),
    ),
    1,
  );
  company.health = healthOf(company);

  company.trail.push({ month: state.month, revenue: fin.revenue, profit: fin.profit });
  if (company.trail.length > 24) company.trail.shift();

  return { dividendToState, jobsDelta, taxes: fin.taxesPaid };
}

/**
 * Roda o mês de todas as empresas e devolve o que isso significa para o país.
 *
 * A soma dos efeitos individuais é o que faz a ponte com o motor macro: emprego
 * vira desemprego, imposto vira arrecadação, dividendo vira caixa e investimento
 * vira PIB alguns meses depois.
 */
export function processCompanyFinances(state: GameState, rng: Rng): CompanyFinanceOutcome {
  const before = state.companies.aggregate;
  const companies = state.companies.companies;

  let jobsDelta = 0;
  let dividends = 0;
  let taxes = 0;
  const newCrises: Company[] = [];

  for (const company of companies) {
    const wasInCrisis = company.inCrisis;
    const step = stepCompany(state, company, rng);
    jobsDelta += step.jobsDelta;
    dividends += step.dividendToState;
    taxes += step.taxes;

    // Crise aberta: prejuízo persistente sem caixa para aguentar. A empresa
    // passa a pedir decisão ao presidente em vez de se resolver sozinha.
    const broke = company.monthsInLoss >= 4 && company.financials.cash <= company.financials.revenue * 0.02;
    if (broke && !wasInCrisis) {
      company.inCrisis = true;
      newCrises.push(company);
    } else if (company.inCrisis && company.monthsInLoss === 0) {
      company.inCrisis = false;
    }
  }

  // ------------------------------------------------------------- Agregados
  const totalEmployees = companies.reduce((total, company) => total + company.employees, 0);
  const totalProfit = companies.reduce((total, company) => total + company.financials.profit, 0);
  const totalInvestment = companies.reduce(
    (total, company) => total + company.financials.annualInvestment,
    0,
  );
  const totalMarketCap = companies
    .filter((company) => company.ownership.listed)
    .reduce((total, company) => total + company.market.marketCap, 0);

  let relationWeighted = 0;
  let relationWeight = 0;
  let systemicExposure = 0;
  for (const company of companies) {
    const weight = company.politics.politicalInfluence / 100;
    relationWeighted += company.politics.governmentRelation * weight;
    relationWeight += weight;
    if (company.politics.systemicImportance >= 70) {
      systemicExposure += (company.crisisRisk / 100) * (company.politics.systemicImportance / 100);
    }
  }

  const aggregate: CompanyAggregate = {
    month: state.month,
    jobsDelta,
    totalEmployees,
    totalProfit: round(totalProfit, 1),
    totalInvestment: round(totalInvestment, 1),
    totalTaxes: round(taxes, 1),
    stateDividends: round(dividends, 2),
    totalMarketCap: round(totalMarketCap, 1),
    averageRelation: round(relationWeighted / Math.max(0.001, relationWeight), 1),
    systemicRisk: round(clamp100(systemicExposure * 42), 1),
    companiesInLoss: companies.filter((company) => company.financials.profit < 0).length,
  };
  state.companies.aggregate = aggregate;

  // ------------------------------------------ Ponte com a macroeconomia
  // Emprego: só o DESVIO conta, e ele é diluído na força de trabalho do país.
  const laborForce = state.nation.population * FINANCE_PARAMS.laborForceShare;
  const unemploymentDelta = round(
    clamp(
      (-jobsDelta * FINANCE_PARAMS.supplyChainMultiplier) / Math.max(1, laborForce) * 100,
      -0.35,
      0.35,
    ),
    3,
  );

  // Arrecadação: entra o DESVIO em relação ao imposto que a base pagava, nunca
  // o total. O motor macro já faz a arrecadação crescer com o PIB nominal, e
  // contar o imposto corporativo inteiro aqui seria contar duas vezes.
  const baselineTaxes = before.totalTaxes || aggregate.totalTaxes;
  const revenueDelta = round(toBillions(aggregate.totalTaxes - baselineTaxes), 3);

  // Investimento: desvio do capex agregado vira impulso no pipeline.
  const investmentGap = totalInvestment - (before.totalInvestment || totalInvestment);
  const investmentImpulse = round(clamp(toBillions(investmentGap) * 0.35, -6, 6), 3);

  const confidenceDelta = round(
    clamp(
      aggregate.averageRelation / 60 +
        (aggregate.companiesInLoss <= before.companiesInLoss ? 0.25 : -0.5) -
        aggregate.systemicRisk / 45,
      -2.5,
      2.5,
    ),
    2,
  );

  return {
    aggregate,
    jobsDelta,
    unemploymentDelta,
    revenueDelta,
    dividendsToTreasury: round(toBillions(dividends), 4),
    investmentImpulse,
    confidenceDelta,
    newCrises,
  };
}

/**
 * Aplica o resultado das empresas sobre o estado macro.
 *
 * Fica separado do cálculo de propósito: dá para simular as empresas sem mexer
 * na economia (útil em teste) e dá para ler, num lugar só, tudo o que as
 * empresas fazem com o país.
 */
export function applyCompanyOutcomeToEconomy(state: GameState, outcome: CompanyFinanceOutcome): void {
  const eco = state.economy;

  eco.unemployment = round(clamp(eco.unemployment + outcome.unemploymentDelta, 2.5, 32), 2);
  eco.revenue = round(Math.max(0, eco.revenue + outcome.revenueDelta), 1);
  eco.pipeline.investmentImpulse = round(
    eco.pipeline.investmentImpulse + outcome.investmentImpulse,
    3,
  );
  eco.businessConfidence = round(clamp100(eco.businessConfidence + outcome.confidenceDelta), 1);

  // Dividendo de estatal é receita não tributária: entra no caixa e melhora o
  // primário, na fatia que pertence à União e em nada mais.
  if (outcome.dividendsToTreasury > 0) {
    eco.treasuryCash = round(eco.treasuryCash + outcome.dividendsToTreasury, 3);
    eco.primaryBalance = round(eco.primaryBalance + outcome.dividendsToTreasury, 2);
    state.companies.ledger.dividendsReceived = round(
      state.companies.ledger.dividendsReceived + outcome.dividendsToTreasury,
      3,
    );
  }

  // Risco sistêmico alto é prêmio de risco cobrado do país inteiro.
  if (outcome.aggregate.systemicRisk > 45) {
    eco.countryRisk = Math.round(
      clamp(eco.countryRisk + (outcome.aggregate.systemicRisk - 45) * 0.8, 40, 2000),
    );
  }
}
