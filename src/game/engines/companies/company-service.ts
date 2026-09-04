import type {
  CompaniesState,
  Company,
  CompanyAggregate,
  CompanyExecutive,
  CompanyHealth,
  CompanyMacroReference,
  CompanySector,
  CorporatePolicyLevers,
  GameState,
  IdeologyVector,
} from '../../types/index';
import {
  COMPANY_BLUEPRINTS,
  COMMODITY_BASELINE,
  EXECUTIVE_FIRST_NAMES,
  EXECUTIVE_LAST_NAMES,
  EXECUTIVE_ROLES,
  EXECUTIVE_TRAITS,
  SECTOR_PROFILE,
  financialRecord,
  type CompanyBlueprint,
  type ExecutiveProfile,
} from '../../data/companies/index';
import { clamp, clamp100, round } from '../../utils/math';

/**
 * SERVIÇO DE EMPRESAS — MONTAGEM E LEITURA
 *
 * Aqui nasce o estado das empresas e ficam as consultas que todo o resto do
 * sistema usa. Nenhuma regra de simulação mora neste arquivo: quem calcula
 * lucro é company-finance-service, quem move ação é company-market-service.
 *
 * ESCALA: dinheiro de empresa em R$ milhões. A conversão para a escala do
 * governo (R$ bilhões) acontece só em company-finance-service.
 */

/**
 * Alavancas tributárias e trabalhistas no ponto de partida.
 *
 * Os valores são a régua do jogo, não uma cópia da legislação: 34% junta IRPJ e
 * CSLL numa alíquota efetiva só, 28,8% junta INSS patronal, RAT e terceiros, e
 * a sobretaxa bancária representa a CSLL maior que os bancos pagam.
 */
export const DEFAULT_LEVERS: CorporatePolicyLevers = {
  corporateTax: 34,
  corporateTaxBase: 34,
  fgtsRate: 8,
  fgtsRateBase: 8,
  payrollCharges: 28.8,
  payrollChargesBase: 28.8,
  importTariff: 11.6,
  importTariffBase: 11.6,
  sectorSubsidies: 0,
  subsidizedCredit: 0,
  regulatoryBurden: 50,
  bankSurcharge: 11,
};

/**
 * Custo anual por empregado, em R$ MIL, já com salário e benefícios mas ANTES
 * dos encargos patronais — são os encargos que o presidente mexe, e por isso
 * eles entram por fora.
 */
export const SECTOR_ANNUAL_WAGE: Record<CompanySector, number> = {
  petroleo_gas: 320,
  financeiro: 210,
  mineracao: 200,
  nuclear: 190,
  tecnologia: 180,
  energia: 180,
  pesquisa: 160,
  telecomunicacoes: 140,
  bens_de_capital: 120,
  siderurgia: 120,
  turismo: 120,
  papel_celulose: 110,
  bebidas: 110,
  logistica: 85,
  abastecimento: 80,
  alimentos: 75,
  agropecuaria: 70,
  varejo: 70,
};

/** Custo anual por empregado do setor, em R$ mil, antes dos encargos. */
export function annualWageOf(company: Company): number {
  return SECTOR_ANNUAL_WAGE[company.sector];
}

/** Encargos sobre a folha que esta empresa paga, em %, já com o alívio próprio. */
export function chargeRateFor(company: Company, levers: CorporatePolicyLevers): number {
  return clamp(levers.fgtsRate + levers.payrollCharges - company.chargeRelief, 0, 90);
}

/** Folha anual da empresa em R$ milhões, com os encargos vigentes. */
export function payrollFor(company: Company, levers: CorporatePolicyLevers): number {
  const wage = annualWageOf(company);
  // employees × R$ mil/ano ÷ 1000 = R$ milhões.
  const base = (company.employees * wage) / 1000;
  return round(base * (1 + chargeRateFor(company, levers) / 100), 1);
}

/**
 * Alíquota efetiva sobre o lucro desta empresa.
 *
 * Junta três coisas: a alíquota geral, a sobretaxa que só banco paga e o alívio
 * (ou aperto) concedido a esta empresa em particular. É por essa última parcela
 * que "reduzir o imposto da Petrobras" não vira desoneração para o país todo.
 */
export function effectiveTaxRate(company: Company, levers: CorporatePolicyLevers): number {
  const surcharge = company.sector === 'financeiro' ? levers.bankSurcharge : 0;
  return clamp(levers.corporateTax + surcharge - company.taxRelief, 0, 90);
}

/**
 * Lucro antes do imposto implícito no dado de referência.
 *
 * O balanço público traz o lucro LÍQUIDO. Para o imposto virar um canal de
 * verdade — mexer na alíquota tem de mexer no lucro — o motor precisa do lucro
 * ANTES do imposto, e ele sai de volta da alíquota de referência.
 */
export function pretaxFromNet(net: number, taxRate: number): number {
  if (net <= 0) return net;
  return round(net / (1 - taxRate / 100), 1);
}

/**
 * Monta quem dirige a empresa.
 *
 * O nome é sorteado de forma DETERMINÍSTICA a partir do id da empresa: a mesma
 * partida sempre encontra o mesmo executivo, sem precisar carregar o Rng da
 * partida até aqui. Trocar a direção depois substitui esta pessoa por outra.
 */
export function buildExecutive(
  blueprint: CompanyBlueprint,
  profile: ExecutiveProfile,
  salt = 0,
): CompanyExecutive {
  // Hash simples e estável sobre o id: nomes iguais para partidas iguais.
  let hash = salt * 2_654_435_761;
  for (let index = 0; index < blueprint.id.length; index += 1) {
    hash = (hash * 31 + blueprint.id.charCodeAt(index)) >>> 0;
  }

  const first = EXECUTIVE_FIRST_NAMES[hash % EXECUTIVE_FIRST_NAMES.length] ?? 'Alberto';
  const last = EXECUTIVE_LAST_NAMES[(hash >>> 5) % EXECUTIVE_LAST_NAMES.length] ?? 'Tavares';
  const traits = EXECUTIVE_TRAITS[profile];
  const trait = traits[(hash >>> 9) % traits.length] ?? traits[0]!;

  const roleKind =
    blueprint.sector === 'financeiro' ? 'banco' : blueprint.sector === 'pesquisa' ? 'pesquisa' : 'padrao';

  return {
    id: `exec_${blueprint.id}_${salt}`,
    name: `${first} ${last}`,
    role: EXECUTIVE_ROLES[blueprint.control][roleKind],
    profile,
    // Quem foi nomeado agora tem tempo de casa zero; a direção herdada já estava lá.
    tenureMonths: salt === 0 ? 6 + ((hash >>> 13) % 60) : 0,
    stance: round(clamp(blueprint.governmentRelation * 0.8 + ((hash >>> 17) % 21) - 10, -100, 100), 1),
    trait,
  };
}

function initialHealth(profit: number, revenue: number): CompanyHealth {
  if (revenue <= 0) return 'estavel';
  const margin = (profit / revenue) * 100;
  if (margin >= 12) return 'saudavel';
  if (margin >= 3) return 'estavel';
  if (margin >= 0) return 'pressionada';
  if (margin >= -8) return 'critica';
  return 'insolvente';
}

/**
 * Monta uma empresa a partir do molde e do balanço de referência.
 *
 * `ideology` desloca a relação inicial com o governo: um presidente estatizante
 * chega com as federais do lado dele e o mercado desconfiado; um liberal chega
 * com o inverso. Nenhum dos dois chega com todo mundo neutro.
 */
function buildCompany(blueprint: CompanyBlueprint, ideology: IdeologyVector): Company {
  const record = financialRecord(blueprint.id);
  const levers = DEFAULT_LEVERS;

  const revenue = record.revenue;
  const profit = record.netProfit;
  const employees = record.employees;

  const company: Company = {
    id: blueprint.id,
    name: blueprint.name,
    officialName: blueprint.officialName,
    control: blueprint.control,
    sector: blueprint.sector,
    note: blueprint.note,
    founded: blueprint.founded,

    financials: {
      revenueBase: revenue,
      profitBase: profit,
      ebitdaBase: record.ebitda,
      revenue,
      profit,
      ebitda: record.ebitda,
      netMargin: revenue > 0 ? round((profit / revenue) * 100, 2) : 0,
      cash: record.cash,
      debt: record.debt,
      equity: record.equity,
      taxesPaid: 0,
      dividends: Math.max(0, profit) * blueprint.dividendPayout,
      dividendPayout: blueprint.dividendPayout,
      annualInvestment: round(revenue * blueprint.investmentRate, 1),
      payrollCost: 0,
    },

    ownership: {
      stateOwnership: blueprint.stateOwnership,
      privateOwnership: round(100 - blueprint.stateOwnership, 2),
      listed: blueprint.listed,
      freeFloat: blueprint.freeFloat,
      saleRequiresLaw: blueprint.saleRequiresLaw,
      privatizable: blueprint.privatizable,
    },

    sensitivity: { ...blueprint.sensitivity },

    market: {
      marketCap: record.marketCap,
      marketCapBase: record.marketCap,
      stockPrice: blueprint.stockPrice,
      stockPriceBase: blueprint.stockPrice,
      stockVolatility: blueprint.stockVolatility,
      monthChange: 0,
      mandateChange: 0,
      investorConfidence: clamp100(52 + (profit > 0 ? 8 : -16)),
    },

    politics: {
      // Estatizante aproxima as federais e afasta o mercado; liberal faz o oposto.
      governmentRelation: round(
        clamp(
          blueprint.governmentRelation +
            (blueprint.control === 'federal' ? -ideology.economic * 0.12 : ideology.economic * 0.14),
          -100,
          100,
        ),
        1,
      ),
      lobbyPower: blueprint.lobbyPower,
      politicalInfluence: blueprint.politicalInfluence,
      systemicImportance: blueprint.systemicImportance,
      consumerConfidence: blueprint.consumerConfidence,
      ministryId: blueprint.ministryId,
      supervisingBody: blueprint.supervisingBody,
      alliedGroups: [...blueprint.alliedGroups],
      opposedGroups: [...blueprint.opposedGroups],
    },

    employees,
    employeesBase: employees,
    productionLevel: 100,
    marketShare: blueprint.marketShare,
    marketShareBase: blueprint.marketShare,
    subsidyReceived: 0,
    taxRelief: 0,
    chargeRelief: 0,
    publicContractRevenue: round(revenue * blueprint.sensitivity.publicContract, 1),
    expansionCapacity: blueprint.expansionCapacity,
    jobCreationCapacity: blueprint.jobCreationCapacity,
    crisisRisk: profit < 0 ? 46 : 12,
    health: initialHealth(profit, revenue),
    monthsInLoss: profit < 0 ? 3 : 0,
    inCrisis: false,
    executive: buildExecutive(blueprint, SECTOR_PROFILE[blueprint.sector]),
    stateInjections: 0,
    dividendsToState: 0,
    trail: [],
  };

  company.financials.payrollCost = payrollFor(company, levers);
  company.financials.taxesPaid = round(
    Math.max(0, pretaxFromNet(profit, effectiveTaxRate(company, levers)) - profit),
    1,
  );

  return company;
}

/**
 * Estado inicial completo do sistema de empresas.
 *
 * `reference` congela a macro da posse: é contra ela que toda empresa mede o
 * cenário depois. Sem essa âncora, "juro alto" viraria um número absoluto e a
 * mesma Selic significaria coisas diferentes em dificuldades diferentes.
 */
export function buildCompaniesState(
  ideology: IdeologyVector,
  reference: CompanyMacroReference,
): CompaniesState {
  const companies = COMPANY_BLUEPRINTS.map((blueprint) => buildCompany(blueprint, ideology));

  return {
    companies,
    commodities: COMMODITY_BASELINE.map((entry) => ({ ...entry })),
    levers: { ...DEFAULT_LEVERS },
    reference: { ...reference },
    requests: [],
    meetings: [],
    contracts: [],
    privatizations: [],
    acquisitions: [],
    news: [],
    aggregate: emptyAggregate(companies),
    ledger: {
      dividendsReceived: 0,
      privatizationProceeds: 0,
      acquisitionSpending: 0,
      injections: 0,
      subsidiesPaid: 0,
      contractSpending: 0,
    },
  };
}

function emptyAggregate(companies: Company[]): CompanyAggregate {
  return {
    month: 0,
    jobsDelta: 0,
    totalEmployees: companies.reduce((total, company) => total + company.employees, 0),
    totalProfit: round(
      companies.reduce((total, company) => total + company.financials.profit, 0),
      1,
    ),
    totalInvestment: round(
      companies.reduce((total, company) => total + company.financials.annualInvestment, 0),
      1,
    ),
    totalTaxes: round(
      companies.reduce((total, company) => total + company.financials.taxesPaid, 0),
      1,
    ),
    stateDividends: 0,
    totalMarketCap: round(
      companies
        .filter((company) => company.ownership.listed)
        .reduce((total, company) => total + company.market.marketCap, 0),
      1,
    ),
    averageRelation: round(
      companies.reduce((total, company) => total + company.politics.governmentRelation, 0) /
        Math.max(1, companies.length),
      1,
    ),
    systemicRisk: 0,
    companiesInLoss: companies.filter((company) => company.financials.profit < 0).length,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function findCompany(state: GameState, companyId: string): Company | undefined {
  return state.companies.companies.find((company) => company.id === companyId);
}

export function federalCompanies(state: GameState): Company[] {
  return state.companies.companies.filter((company) => company.control === 'federal');
}

export function privateCompanies(state: GameState): Company[] {
  return state.companies.companies.filter((company) => company.control === 'privada');
}

export function companiesInSector(state: GameState, sector: CompanySector): Company[] {
  return state.companies.companies.filter((company) => company.sector === sector);
}

/** Situação da empresa em uma palavra, com o sinal que a interface usa. */
export function healthOf(company: Company): CompanyHealth {
  const { profit, revenue, cash, debt } = company.financials;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const leverage = revenue > 0 ? debt / revenue : 0;

  if (company.monthsInLoss >= 10 && cash <= 0) return 'insolvente';
  if (company.monthsInLoss >= 6 || (margin < -6 && leverage > 1.2)) return 'critica';
  if (margin < 0 || company.monthsInLoss >= 2) return 'pressionada';
  if (margin >= 12 && leverage < 1.5) return 'saudavel';
  return 'estavel';
}

/**
 * Valor da empresa para efeito de compra e venda de participação.
 *
 * Empresa listada vale o que a bolsa diz. Empresa fechada não tem preço de
 * mercado: vale patrimônio mais um múltiplo do lucro, e desconta a dívida.
 */
export function valuationOf(company: Company): number {
  if (company.ownership.listed) return round(company.market.marketCap, 1);
  const { equity, profit, debt } = company.financials;
  const earningsValue = profit > 0 ? profit * 7 : profit * 3;
  return round(Math.max(equity * 0.35, equity + earningsValue - debt * 0.25), 1);
}

/** Valor da fatia da União nesta empresa, R$ milhões. */
export function stateStakeValue(company: Company): number {
  return round((valuationOf(company) * company.ownership.stateOwnership) / 100, 1);
}

/** Soma do valor das participações da União em todas as empresas, R$ milhões. */
export function totalStatePortfolio(state: GameState): number {
  return round(
    state.companies.companies.reduce((total, company) => total + stateStakeValue(company), 0),
    1,
  );
}

/** Empresas que o país não consegue deixar quebrar sem levar dano junto. */
export function systemicCompanies(state: GameState): Company[] {
  return state.companies.companies.filter((company) => company.politics.systemicImportance >= 70);
}

/** Empresas com relação hostil ao governo, ordenadas pelo tamanho do problema. */
export function hostileCompanies(state: GameState): Company[] {
  return state.companies.companies
    .filter((company) => company.politics.governmentRelation < 0)
    .sort(
      (a, b) =>
        a.politics.governmentRelation * (a.politics.lobbyPower / 100) -
        b.politics.governmentRelation * (b.politics.lobbyPower / 100),
    );
}

/**
 * Pressão do empresariado sobre o Congresso, 0-100.
 *
 * É a média do lobby ponderada pela relação: empresa grande e satisfeita
 * empurra a favor do governo, empresa grande e irritada empurra contra. O
 * resultado entra em `congress.ts` como modificador de probabilidade — nunca
 * como decisão.
 */
export function businessLobbyPressure(state: GameState): number {
  const companies = state.companies.companies;
  if (companies.length === 0) return 0;

  let weighted = 0;
  let weight = 0;
  for (const company of companies) {
    const power = company.politics.lobbyPower / 100;
    weighted += (company.politics.governmentRelation / 100) * power;
    weight += power;
  }
  return round(clamp((weighted / Math.max(0.001, weight)) * 100, -100, 100), 1);
}
