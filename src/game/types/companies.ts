import type { MinistryId } from './politics';

/**
 * SISTEMA NACIONAL DE EMPRESAS
 *
 * As empresas não são enfeite do painel econômico: são agentes que reagem à
 * caneta do presidente e devolvem o efeito para o resto da simulação.
 *
 * ESCALA — regra que vale para todo este arquivo:
 *   - dinheiro de EMPRESA é em R$ MILHÕES (receita, lucro, caixa, dívida,
 *     valor de mercado, investimento). R$ 497,5 bi = 497_500.
 *   - dinheiro de GOVERNO (economy.treasuryCash, primaryBalance, revenue) é em
 *     R$ BILHÕES, como sempre foi. A conversão acontece num lugar só,
 *     em company-finance-service.ts, e está marcada lá.
 *
 * Os números iniciais partem de balanços públicos (ver COMPANY_FINANCIAL_DATA)
 * e servem como BASE DE BALANCEAMENTO: do primeiro mês jogado em diante, tudo
 * é produzido pelo motor e não corresponde mais à realidade.
 */

export type CompanyControl = 'federal' | 'privada';

export type CompanySector =
  | 'energia'
  | 'petroleo_gas'
  | 'mineracao'
  | 'siderurgia'
  | 'financeiro'
  | 'alimentos'
  | 'bebidas'
  | 'papel_celulose'
  | 'bens_de_capital'
  | 'tecnologia'
  | 'telecomunicacoes'
  | 'logistica'
  | 'agropecuaria'
  | 'pesquisa'
  | 'turismo'
  | 'varejo'
  | 'nuclear'
  | 'abastecimento';

export const COMPANY_SECTOR_LABEL: Record<CompanySector, string> = {
  energia: 'Energia',
  petroleo_gas: 'Petróleo e gás',
  mineracao: 'Mineração',
  siderurgia: 'Siderurgia',
  financeiro: 'Financeiro',
  alimentos: 'Alimentos',
  bebidas: 'Bebidas',
  papel_celulose: 'Papel e celulose',
  bens_de_capital: 'Bens de capital',
  tecnologia: 'Tecnologia',
  telecomunicacoes: 'Telecomunicações',
  logistica: 'Logística',
  agropecuaria: 'Agropecuária',
  pesquisa: 'Pesquisa e inovação',
  turismo: 'Turismo',
  varejo: 'Varejo',
  nuclear: 'Nuclear',
  abastecimento: 'Abastecimento',
};

/** Commodities cujo preço move receita de empresa e inflação do país. */
export type CommodityId = 'petroleo' | 'minerio_ferro' | 'celulose' | 'carne' | 'graos' | 'aco';

export const COMMODITY_IDS = [
  'petroleo',
  'minerio_ferro',
  'celulose',
  'carne',
  'graos',
  'aco',
] as const;

export const COMMODITY_LABEL: Record<CommodityId, string> = {
  petroleo: 'Petróleo (Brent)',
  minerio_ferro: 'Minério de ferro',
  celulose: 'Celulose',
  carne: 'Carne',
  graos: 'Grãos',
  aco: 'Aço',
};

export interface CommodityPrice {
  id: CommodityId;
  label: string;
  /** Preço corrente como índice: 100 = preço da base de referência. */
  index: number;
  /** Preço da base, na unidade de mercado. Só para exibição. */
  referencePrice: number;
  unit: string;
  /** Volatilidade mensal típica, em pontos de índice. */
  volatility: number;
  /** Quanto 10 pontos de índice movem o IPCA em 12m, em p.p. */
  inflationPassthrough: number;
  /** Variação do último mês, em pontos de índice. */
  lastChange: number;
}

/**
 * Balanço da empresa. Tudo em R$ milhões e em base ANUAL, exceto onde dito.
 * Os campos `*Base` são a referência de calibragem e não mudam durante a
 * partida; os correntes são recalculados todo mês.
 */
export interface CompanyFinancials {
  /** Receita anual de referência (não muda). */
  revenueBase: number;
  /** Lucro líquido anual de referência (pode ser negativo). */
  profitBase: number;
  /** EBITDA anual de referência. 0 quando não divulgado ou não aplicável. */
  ebitdaBase: number;

  /** Receita anualizada corrente. */
  revenue: number;
  /** Lucro líquido anualizado corrente. */
  profit: number;
  ebitda: number;
  /** Margem líquida corrente, em % da receita. */
  netMargin: number;

  cash: number;
  debt: number;
  equity: number;
  /** Imposto corporativo pago no ano corrente (anualizado). */
  taxesPaid: number;
  /** Dividendos anuais declarados (total, antes de repartir entre acionistas). */
  dividends: number;
  /** Fração do lucro distribuída como dividendo, 0-1. */
  dividendPayout: number;
  /** Investimento anual (capex mais P&D). */
  annualInvestment: number;
  /** Folha anual, já com encargos. */
  payrollCost: number;
}

export interface CompanyOwnership {
  /** Participação da União, 0-100. */
  stateOwnership: number;
  /** Participação privada, 0-100. Sempre 100 menos stateOwnership. */
  privateOwnership: number;
  /** true quando a empresa tem ações negociadas em bolsa. */
  listed: boolean;
  /** Fração do capital em circulação, 0-100. Só faz sentido se listada. */
  freeFloat: number;
  /** A União precisa de lei para vender participação? */
  saleRequiresLaw: boolean;
  /** Empresa pode ser privatizada no jogo? Serviço de Estado não pode. */
  privatizable: boolean;
}

/**
 * Elasticidades. Cada uma responde a "quanto a receita ou a margem se move
 * quando a variável se move uma unidade natural".
 *
 * O sinal importa: `interest` positivo é banco, que ganha com juro alto, e
 * negativo é indústria, que perde. `fx` positivo é exportador. `tariff`
 * positivo é quem a tarifa protege, negativo é quem importa insumo.
 */
export interface CompanySensitivity {
  /** 0-1. Quanto a receita segue o ciclo econômico. */
  demand: number;
  /** 0-1. Quanto o lucro cai quando o imposto corporativo sobe. */
  tax: number;
  /** -1 a 1. Efeito da Selic sobre receita e margem. */
  interest: number;
  /** -1 a 1. Efeito de uma desvalorização do real. */
  fx: number;
  /** -1 a 1. Efeito da tarifa de importação. */
  tariff: number;
  /** 0-1. Intensidade em mão de obra: quanto o encargo trabalhista pesa. */
  labor: number;
  /** -1 a 1. Efeito da inflação sobre a margem. */
  inflation: number;
  /** -1 a 1. Efeito do preço da commodity de referência. */
  commodity: number;
  /** Commodity que move esta empresa. */
  commodityId?: CommodityId;
  /** 0-1. Quanto da receita vem de contrato com o setor público. */
  publicContract: number;
  /** 0-1. Fração da dívida em moeda estrangeira. */
  fxDebtShare: number;
  /** 0-1. Fração da receita vinda de exportação. */
  exportShare: number;
}

export type CompanyHealth = 'saudavel' | 'estavel' | 'pressionada' | 'critica' | 'insolvente';

export const COMPANY_HEALTH_LABEL: Record<CompanyHealth, string> = {
  saudavel: 'Saudável',
  estavel: 'Estável',
  pressionada: 'Pressionada',
  critica: 'Crítica',
  insolvente: 'Insolvente',
};

export interface CompanyMarketData {
  /** Valor de mercado corrente, R$ milhões. */
  marketCap: number;
  /** Valor de mercado de referência, R$ milhões. */
  marketCapBase: number;
  /** Cotação em R$ por ação. */
  stockPrice: number;
  stockPriceBase: number;
  /** Volatilidade anualizada em %, usada para o ruído mensal. */
  stockVolatility: number;
  /** Variação da ação no mês, %. */
  monthChange: number;
  /** Variação acumulada no mandato, %. */
  mandateChange: number;
  /** 0-100 — confiança dos investidores nesta empresa. */
  investorConfidence: number;
}

export interface CompanyPolitics {
  /** -100 hostil a +100 aliada. */
  governmentRelation: number;
  /** 0-100 — capacidade de pressionar Congresso, mídia e governo. */
  lobbyPower: number;
  /** 0-100 — peso da empresa no debate público. */
  politicalInfluence: number;
  /** 0-100 — o que quebrar aqui derruba o resto do país junto. */
  systemicImportance: number;
  /** 0-100 — confiança do consumidor na marca. */
  consumerConfidence: number;
  /** Ministério que despacha com a empresa dentro do jogo. */
  ministryId: MinistryId;
  /** Pasta setorial como a empresa a chama, mesmo que não exista como MinistryId. */
  supervisingBody: string;
  /** Grupos sociais que se mobilizam a favor e contra decisões sobre a empresa. */
  alliedGroups: string[];
  opposedGroups: string[];
}

export interface Company {
  id: string;
  /** Nome curto, o que aparece na tabela. */
  name: string;
  /** Denominação oficial. */
  officialName: string;
  control: CompanyControl;
  sector: CompanySector;
  /** Descrição de uma linha, mostrada no card. */
  note: string;
  founded: number;

  financials: CompanyFinancials;
  ownership: CompanyOwnership;
  sensitivity: CompanySensitivity;
  market: CompanyMarketData;
  politics: CompanyPolitics;

  employees: number;
  employeesBase: number;
  /** Nível de produção e atividade, 100 = normal. */
  productionLevel: number;
  /** Participação no setor, 0-100. */
  marketShare: number;
  /** Participação de referência, para medir quanto a empresa ganhou ou perdeu mercado. */
  marketShareBase: number;
  /** Subsídio anual direcionado a esta empresa, R$ milhões. */
  subsidyReceived: number;
  /**
   * Alívio tributário dado só a esta empresa, em p.p. sobre o imposto do lucro.
   * Positivo alivia, negativo aperta. É o que permite "reduzir o imposto da
   * Petrobras" sem baixar o imposto de todas as outras empresas do país.
   */
  taxRelief: number;
  /** Alívio de encargos dado só a esta empresa, em p.p. sobre a folha. */
  chargeRelief: number;
  /** Receita anual vinda de contratos com o governo, R$ milhões. */
  publicContractRevenue: number;
  /** 0-100 — fôlego para abrir fábrica, comprar concorrente, expandir. */
  expansionCapacity: number;
  /** 0-100 — capacidade de gerar emprego se o cenário ajudar. */
  jobCreationCapacity: number;
  /** 0-100 — probabilidade de entrar em crise nos próximos meses. */
  crisisRisk: number;
  health: CompanyHealth;
  /** Meses seguidos com prejuízo. Alimenta a crise empresarial. */
  monthsInLoss: number;
  /** true enquanto a empresa está em crise aberta esperando decisão. */
  inCrisis: boolean;
  /** Aporte do Tesouro recebido no mandato, R$ milhões. */
  /** Quem dirige a empresa hoje. Muda quando o governo troca a direção. */
  executive: CompanyExecutive;
  stateInjections: number;
  /** Dividendos já pagos à União no mandato, R$ milhões. */
  dividendsToState: number;
  /**
   * Últimos 24 meses de receita e lucro anualizados, R$ milhões. Existe para o
   * gráfico da ficha da empresa mostrar a trajetória, e não só a fotografia do
   * mês — é a trajetória que revela se a decisão do presidente funcionou.
   */
  trail: { month: number; revenue: number; profit: number }[];
}

// ---------------------------------------------------------------------------
// Demandas, reuniões e contratos
// ---------------------------------------------------------------------------

export type CompanyRequestKind =
  | 'reducao_imposto'
  | 'reducao_encargos'
  | 'subsidio'
  | 'financiamento'
  | 'protecao_comercial'
  | 'infraestrutura'
  | 'mudanca_regulatoria'
  | 'autorizacao_investimento'
  | 'parceria_publico_privada'
  | 'orcamento'
  | 'contrato_publico';

export const COMPANY_REQUEST_LABEL: Record<CompanyRequestKind, string> = {
  reducao_imposto: 'Redução de imposto',
  reducao_encargos: 'Redução de encargos',
  subsidio: 'Subsídio',
  financiamento: 'Financiamento',
  protecao_comercial: 'Proteção comercial',
  infraestrutura: 'Infraestrutura',
  mudanca_regulatoria: 'Mudança regulatória',
  autorizacao_investimento: 'Autorização de investimento',
  parceria_publico_privada: 'Parceria público-privada',
  orcamento: 'Orçamento',
  contrato_publico: 'Contrato público',
};

export type CompanyRequestStatus = 'aberta' | 'atendida' | 'negociada' | 'recusada' | 'expirada';

export interface CompanyRequest {
  id: string;
  companyId: string;
  companyName: string;
  kind: CompanyRequestKind;
  title: string;
  /** O que a empresa quer, na voz dela. */
  pitch: string;
  /** O que o governo ganha se atender. */
  offer: string;
  /** Custo fiscal de atender, R$ bilhões (escala de governo). */
  fiscalCost: number;
  /** Ganho de relação se atendida. */
  relationGain: number;
  /** Perda de relação se recusada. */
  relationLoss: number;
  /** Grupos que ficam irritados se o governo atender. */
  angeredGroups: string[];
  createdMonth: number;
  expiresMonth: number;
  status: CompanyRequestStatus;
  /** Preenchido quando o presidente decide. */
  resolution?: string;
  urgency: 'baixa' | 'media' | 'alta';
}

export type CompanyMeetingChoice = 'aceitar' | 'recusar' | 'negociar' | 'contraproposta';

/**
 * QUEM SENTA DO OUTRO LADO DA MESA
 *
 * A empresa não fala sozinha: quem fala é uma pessoa, com nome, tempo de casa e
 * um jeito de negociar. Trocar a direção de uma estatal troca esta pessoa — e
 * com ela muda o tom da conversa, o que a empresa pede e o quanto ela cede.
 *
 * Todos os nomes são fictícios, como o resto do elenco do jogo.
 */
export interface CompanyExecutive {
  id: string;
  name: string;
  /** Cargo como ele assina o e-mail. */
  role: string;
  /**
   * De onde a pessoa veio, e o que isso significa na mesa:
   *   tecnico   fala de operação e de prazo, pede previsibilidade
   *   politico  fala de emprego e de região, pede orçamento
   *   mercado   fala de margem e de acionista, pede tributo e regra
   *   fundador  fala da empresa como coisa dele, pede autonomia
   */
  profile: 'tecnico' | 'politico' | 'mercado' | 'fundador';
  /** Meses no cargo. Quem chegou ontem negocia diferente de quem está há anos. */
  tenureMonths: number;
  /** -100 hostil a +100 aliado. Anda junto com a relação da empresa, não igual. */
  stance: number;
  /** Uma frase que descreve o estilo de negociação. */
  trait: string;
}

export type CompanyMeetingTone = 'cordial' | 'tensa' | 'formal' | 'aflita';

/**
 * UMA REUNIÃO COM A EMPRESA
 *
 * O presidente convoca (ou aceita) uma audiência. A empresa chega com leitura
 * da própria situação e com uma pauta de pedidos — gerada a partir do balanço
 * dela e do cenário, nunca de um texto fixo. O presidente decide item a item.
 */
export interface CompanyMeeting {
  id: string;
  companyId: string;
  companyName: string;
  month: number;
  executive: CompanyExecutive;
  tone: CompanyMeetingTone;
  /** Fala de abertura do gestor, com os números da empresa dentro. */
  opening: string;
  /** Leitura da situação, em linhas curtas, para a tela mostrar ao lado. */
  situation: string[];
  /** Demandas trazidas para a mesa. São `CompanyRequest` de verdade. */
  requestIds: string[];
  /** O que o presidente ofereceu por iniciativa própria nesta reunião. */
  offers: string[];
  closed: boolean;
  /** Resumo do que ficou combinado, escrito no fechamento. */
  outcome?: string;
}

export interface CompanyContract {
  id: string;
  companyId: string;
  companyName: string;
  label: string;
  /** Valor anual do contrato, R$ milhões. */
  annualValue: number;
  monthsRemaining: number;
  startMonth: number;
  ministryId: MinistryId;
  description: string;
}

// ---------------------------------------------------------------------------
// Propriedade: privatização, compra e venda de participação
// ---------------------------------------------------------------------------

export type PrivatizationStage =
  | 'proposta'
  | 'estudos'
  | 'legislativo'
  | 'leilao'
  | 'concluida'
  | 'rejeitada'
  | 'fracassada'
  | 'cancelada';

export const PRIVATIZATION_STAGE_LABEL: Record<PrivatizationStage, string> = {
  proposta: 'Proposta anunciada',
  estudos: 'Estudos de modelagem',
  legislativo: 'Tramitação no Congresso',
  leilao: 'Leilão marcado',
  concluida: 'Venda concluída',
  rejeitada: 'Rejeitada no Congresso',
  fracassada: 'Leilão deserto',
  cancelada: 'Cancelada pelo governo',
};

export interface PrivatizationProcess {
  id: string;
  companyId: string;
  companyName: string;
  /** Participação da União colocada à venda, em pontos percentuais. */
  shareOffered: number;
  stage: PrivatizationStage;
  startMonth: number;
  /** Mês em que a fase corrente termina. */
  stageEndsMonth: number;
  /** Preço mínimo pedido, R$ milhões. */
  reservePrice: number;
  /** Valor efetivamente arrecadado, R$ milhões. Só depois do leilão. */
  proceeds: number;
  /** 0-100 — apetite do mercado por este ativo. */
  investorInterest: number;
  /** 0-100 — resistência política. */
  politicalOpposition: number;
  /** 0-100 — apoio popular à venda. */
  publicSupport: number;
  /** Medida legislativa vinculada, quando a venda exige lei. */
  policyId?: string;
  requiresLaw: boolean;
  log: CompanyProcessLog[];
}

export type AcquisitionStage =
  | 'analise'
  | 'negociacao'
  | 'oferta'
  | 'concluida'
  | 'fracassada'
  | 'cancelada';

export const ACQUISITION_STAGE_LABEL: Record<AcquisitionStage, string> = {
  analise: 'Análise do Tesouro',
  negociacao: 'Negociação com controladores',
  oferta: 'Oferta na mesa',
  concluida: 'Compra concluída',
  fracassada: 'Compra fracassada',
  cancelada: 'Cancelada pelo governo',
};

export interface AcquisitionProcess {
  id: string;
  companyId: string;
  companyName: string;
  /** Participação que a União quer comprar, em pontos percentuais. */
  targetShare: number;
  stage: AcquisitionStage;
  startMonth: number;
  stageEndsMonth: number;
  /** Prêmio exigido sobre o valor de mercado, em %. */
  premium: number;
  /** Custo estimado, R$ milhões. */
  estimatedCost: number;
  /** Quanto já foi desembolsado, R$ milhões. */
  paid: number;
  financing: 'caixa' | 'divida';
  /** 0-100 — resistência dos controladores. */
  shareholderResistance: number;
  policyId?: string;
  requiresLaw: boolean;
  log: CompanyProcessLog[];
}

export interface CompanyProcessLog {
  id: string;
  month: number;
  label: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Alavancas de política que atingem todas as empresas
// ---------------------------------------------------------------------------

/**
 * O que o presidente mexe e as empresas sentem. Todas as taxas em %, exceto
 * onde dito. Os valores iniciais são a régua: mudar qualquer um move lucro,
 * emprego e investimento de todo mundo, com intensidade proporcional à
 * sensibilidade de cada empresa.
 */
export interface CorporatePolicyLevers {
  /** Imposto sobre o lucro (IRPJ mais CSLL, efetivo), %. */
  corporateTax: number;
  corporateTaxBase: number;
  /** FGTS patronal, %. */
  fgtsRate: number;
  fgtsRateBase: number;
  /** Demais encargos patronais sobre a folha, %. */
  payrollCharges: number;
  payrollChargesBase: number;
  /** Tarifa média de importação, %. */
  importTariff: number;
  importTariffBase: number;
  /** Subsídio setorial anual concedido, R$ bilhões. */
  sectorSubsidies: number;
  /** Crédito subsidiado do BNDES contratado no mandato, R$ bilhões. */
  subsidizedCredit: number;
  /** 0-100 — peso regulatório. Sobe com regulamentação, cai com desregulamentação. */
  regulatoryBurden: number;
  /** Sobretaxa sobre lucro de bancos, p.p. */
  bankSurcharge: number;
}

/** O que uma medida assinada faz com as empresas. */
export interface CompanyPolicyImpact {
  /** Empresas nomeadas explicitamente na medida. */
  targetCompanyIds: string[];
  /** Setores atingidos, quando a medida é setorial. */
  targetSectors: CompanySector[];
  corporateTaxDelta: number;
  fgtsDelta: number;
  payrollChargesDelta: number;
  importTariffDelta: number;
  /** R$ bilhões por ano de subsídio criado (positivo) ou cortado (negativo). */
  subsidyDelta: number;
  /** R$ bilhões por ano de crédito subsidiado. */
  creditDelta: number;
  regulatoryDelta: number;
  bankSurchargeDelta: number;
  /** Empresas que a medida manda vender. */
  privatizeCompanyIds: string[];
  /** Empresas que a medida manda estatizar ou comprar. */
  nationalizeCompanyIds: string[];
  /** Ganho ou perda de relação com as empresas atingidas. */
  relationDelta: number;
  /** Explicação curta do que foi lido, mostrada ao jogador. */
  reading: string;
}

// ---------------------------------------------------------------------------
// Notícias e agregados
// ---------------------------------------------------------------------------

export type CompanyNewsKind =
  | 'investimento'
  | 'demissoes'
  | 'crise'
  | 'lucro_recorde'
  | 'prejuizo'
  | 'pedido'
  | 'ameaca'
  | 'nova_fabrica'
  | 'exportacao'
  | 'queda_acoes'
  | 'investigacao'
  | 'capital_estrangeiro'
  | 'parceria'
  | 'privatizacao'
  | 'aquisicao';

export interface CompanyNews {
  id: string;
  month: number;
  companyId: string;
  companyName: string;
  kind: CompanyNewsKind;
  headline: string;
  body: string;
  /** Positivo = boa notícia para o governo. */
  valence: number;
}

/** O que as empresas devolveram para a macroeconomia no último mês. */
export interface CompanyAggregate {
  month: number;
  /** Empregos criados (+) ou destruídos (-) no mês, em pessoas. */
  jobsDelta: number;
  /** Emprego total nas empresas monitoradas. */
  totalEmployees: number;
  /** Lucro somado, anualizado, R$ milhões. */
  totalProfit: number;
  /** Investimento anual somado, R$ milhões. */
  totalInvestment: number;
  /** Imposto corporativo pago, anualizado, R$ milhões. */
  totalTaxes: number;
  /** Dividendos que caíram no caixa da União no mês, R$ milhões. */
  stateDividends: number;
  /** Valor de mercado somado das listadas, R$ milhões. */
  totalMarketCap: number;
  /** Média ponderada da relação com o governo, -100 a 100. */
  averageRelation: number;
  /** 0-100 — risco de contágio se uma sistêmica quebrar. */
  systemicRisk: number;
  /** Empresas em prejuízo. */
  companiesInLoss: number;
}

/**
 * Fotografia macro do dia da posse. É contra ela que as empresas medem tudo:
 * "juro alto" não é um número absoluto, é juro acima do que era quando o
 * balanço de referência foi fechado.
 */
export interface CompanyMacroReference {
  selic: number;
  usd: number;
  inflation: number;
  gdpGrowth: number;
}

export interface CompaniesState {
  companies: Company[];
  commodities: CommodityPrice[];
  levers: CorporatePolicyLevers;
  reference: CompanyMacroReference;
  requests: CompanyRequest[];
  /** Audiências com empresas, abertas e encerradas. */
  meetings: CompanyMeeting[];
  contracts: CompanyContract[];
  privatizations: PrivatizationProcess[];
  acquisitions: AcquisitionProcess[];
  news: CompanyNews[];
  aggregate: CompanyAggregate;
  /** Caixa recebido e pago em operações societárias no mandato, R$ bilhões. */
  ledger: {
    dividendsReceived: number;
    privatizationProceeds: number;
    acquisitionSpending: number;
    injections: number;
    subsidiesPaid: number;
    contractSpending: number;
  };
}
