/**
 * CAMADA DE DADOS FINANCEIROS DAS EMPRESAS
 *
 * Esta é a única fonte de números de referência do sistema de empresas. Tudo o
 * que o motor faz depois parte daqui, e nada mais no código repete estes
 * valores — atualizar um balanço significa editar UMA linha deste arquivo.
 *
 * REGRAS DESTE ARQUIVO
 *
 * 1. Escala: todos os valores monetários em R$ MILHÕES. R$ 497,5 bi = 497_500.
 *
 * 2. Moeda: empresas que reportam em dólar (Vale, JBS) trazem `currency: 'USD'`
 *    e os valores JÁ convertidos pela taxa de referência abaixo. O valor
 *    original em dólar fica registrado em `note`, para a conversão poder ser
 *    refeita quando o câmbio de referência mudar.
 *
 * 3. `estimated: false` significa que o número veio do balanço público citado
 *    em `source`. `estimated: true` significa que é um PARÂMETRO DE
 *    BALANCEAMENTO do jogo, escolhido para a empresa se comportar de forma
 *    plausível no simulador — não é um dado reportado e não deve ser lido como
 *    tal. A interface mostra essa diferença ao jogador.
 *
 * 4. Nenhum destes números é dinheiro infinito nem valor estático: eles são o
 *    ponto de partida do motor. Do primeiro mês jogado em diante, receita,
 *    lucro e valor de mercado são produzidos pela simulação.
 */

/**
 * Câmbio usado para converter os balanços reportados em dólar. Não é o câmbio
 * da partida (esse flutua no motor); é só a régua de conversão da base.
 */
export const USD_REFERENCE_RATE = 5.4;

/** Ano-base dos dados de referência. */
export const FINANCIAL_DATA_BASE_YEAR = 2025;

export interface CompanyFinancialRecord {
  companyId: string;
  year: number;
  /** Receita ou produto bancário anual, R$ milhões. */
  revenue: number;
  /** Lucro líquido anual, R$ milhões. Negativo é prejuízo. */
  netProfit: number;
  /** EBITDA anual, R$ milhões. 0 quando não divulgado ou não aplicável. */
  ebitda: number;
  /** Ativos totais, R$ milhões. */
  assets: number;
  /** Patrimônio líquido, R$ milhões. */
  equity: number;
  cash: number;
  debt: number;
  employees: number;
  /** Valor de mercado ou valor patrimonial de referência, R$ milhões. */
  marketCap: number;
  /** Moeda do relatório de origem. */
  currency: 'BRL' | 'USD';
  source: string;
  /**
   * false = número reportado pela empresa na fonte citada.
   * true  = parâmetro de balanceamento do jogo, não um dado reportado.
   */
  estimated: boolean;
  note?: string;
}

/**
 * Base de referência. A ordem é irrelevante; o acesso é sempre por id.
 *
 * Os registros com `estimated: false` usam os números divulgados pelas próprias
 * companhias para 2025. Os demais estão marcados como estimados de propósito:
 * é melhor o jogo dizer que calibrou um número do que fingir que o mediu.
 */
export const COMPANY_FINANCIAL_DATA: readonly CompanyFinancialRecord[] = [
  // ------------------------------------------------------------- Federais
  {
    companyId: 'petrobras',
    year: 2025,
    revenue: 497_500,
    netProfit: 110_100,
    ebitda: 237_200,
    assets: 1_180_000,
    equity: 390_000,
    cash: 55_000,
    debt: 320_000,
    employees: 46_500,
    marketCap: 520_000,
    currency: 'BRL',
    source: 'Petrobras — divulgação de resultados de 2025',
    estimated: false,
    note: 'Receita, lucro líquido e EBITDA ajustado divulgados pela companhia. Ativos, caixa, dívida e valor de mercado são calibragem do jogo.',
  },
  {
    companyId: 'banco_brasil',
    year: 2025,
    revenue: 168_000,
    netProfit: 32_000,
    ebitda: 0,
    assets: 2_400_000,
    equity: 190_000,
    cash: 120_000,
    debt: 0,
    employees: 86_000,
    marketCap: 160_000,
    currency: 'BRL',
    source: 'Calibragem do jogo a partir da ordem de grandeza pública do banco',
    estimated: true,
    note: 'Banco não tem EBITDA nem dívida no sentido industrial: o passivo é depósito de cliente, e por isso entra como 0 aqui.',
  },
  {
    companyId: 'caixa',
    year: 2025,
    revenue: 142_000,
    netProfit: 16_100,
    ebitda: 0,
    assets: 1_900_000,
    equity: 118_000,
    cash: 96_000,
    debt: 0,
    employees: 87_000,
    marketCap: 118_000,
    currency: 'BRL',
    source: 'Caixa Econômica Federal — resultado de 2025',
    estimated: false,
    note: 'Lucro líquido contábil de 2025 (~R$ 16,1 bi); o recorrente divulgado foi de ~R$ 15,5 bi. Receita e balanço são calibragem. Sem ações em bolsa, o "valor de mercado" é o patrimônio.',
  },
  {
    companyId: 'bndes',
    year: 2025,
    revenue: 78_000,
    netProfit: 15_200,
    ebitda: 0,
    assets: 962_000,
    equity: 140_000,
    cash: 60_000,
    debt: 0,
    employees: 2_900,
    marketCap: 140_000,
    currency: 'BRL',
    source: 'BNDES — resultado de 2025',
    estimated: false,
    note: 'Lucro recorrente (~R$ 15,2 bi) e ativos (~R$ 962 bi) divulgados; carteira de crédito de ~R$ 664 bi. Receita e caixa são calibragem.',
  },
  {
    companyId: 'correios',
    year: 2025,
    revenue: 22_000,
    netProfit: -3_200,
    ebitda: -1_400,
    assets: 18_000,
    equity: 2_600,
    cash: 900,
    debt: 9_500,
    employees: 88_000,
    marketCap: 12_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'Estatal intensiva em mão de obra e deficitária no ponto de partida. É de propósito: nem toda empresa federal dá lucro, e esta é a que o jogador vai ter de decidir o que fazer.',
  },
  {
    companyId: 'infraero',
    year: 2025,
    revenue: 1_900,
    netProfit: -180,
    ebitda: 90,
    assets: 7_800,
    equity: 3_100,
    cash: 480,
    debt: 1_200,
    employees: 4_600,
    marketCap: 4_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
  },
  {
    companyId: 'embratur',
    year: 2025,
    revenue: 620,
    netProfit: -40,
    ebitda: 10,
    assets: 900,
    equity: 520,
    cash: 210,
    debt: 90,
    employees: 320,
    marketCap: 700,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'Agência de promoção do turismo brasileiro no exterior. Entidade distinta da Embrapa — os dois registros são separados de propósito.',
  },
  {
    companyId: 'embrapa',
    year: 2025,
    revenue: 4_800,
    netProfit: 120,
    ebitda: 380,
    assets: 9_400,
    equity: 6_200,
    cash: 700,
    debt: 320,
    employees: 8_500,
    marketCap: 9_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'Empresa de pesquisa agropecuária. Entidade distinta da Embratur — os dois registros são separados de propósito.',
  },
  {
    companyId: 'enbpar',
    year: 2025,
    revenue: 3_400,
    netProfit: 260,
    ebitda: 900,
    assets: 24_000,
    equity: 11_000,
    cash: 1_600,
    debt: 6_800,
    employees: 1_400,
    marketCap: 14_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'Holding federal de participações em energia (Itaipu e Eletronuclear).',
  },
  {
    companyId: 'ceagesp',
    year: 2025,
    revenue: 380,
    netProfit: -25,
    ebitda: 18,
    assets: 1_500,
    equity: 820,
    cash: 60,
    debt: 240,
    employees: 900,
    marketCap: 1_100,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
  },
  {
    companyId: 'amazul',
    year: 2025,
    revenue: 900,
    netProfit: 30,
    ebitda: 80,
    assets: 1_800,
    equity: 700,
    cash: 210,
    debt: 120,
    employees: 1_500,
    marketCap: 1_400,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'Empresa de tecnologia do programa nuclear da Marinha. Receita quase toda vinda de contrato com a União.',
  },
  {
    companyId: 'conab',
    year: 2025,
    revenue: 2_600,
    netProfit: -120,
    ebitda: 60,
    assets: 6_000,
    equity: 2_100,
    cash: 380,
    debt: 1_500,
    employees: 3_400,
    marketCap: 3_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'Executa a política de abastecimento e os estoques reguladores: o resultado dela depende do preço dos grãos.',
  },
  {
    companyId: 'serpro',
    year: 2025,
    revenue: 4_100,
    netProfit: 210,
    ebitda: 620,
    assets: 5_200,
    equity: 2_400,
    cash: 900,
    debt: 300,
    employees: 8_200,
    marketCap: 6_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
  },
  {
    companyId: 'dataprev',
    year: 2025,
    revenue: 3_200,
    netProfit: 180,
    ebitda: 480,
    assets: 4_100,
    equity: 1_900,
    cash: 760,
    debt: 220,
    employees: 4_300,
    marketCap: 5_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
  },

  // ------------------------------------------------------------- Privadas
  {
    companyId: 'itau',
    year: 2025,
    revenue: 175_100,
    netProfit: 45_800,
    ebitda: 0,
    assets: 3_100_000,
    equity: 220_000,
    cash: 180_000,
    debt: 0,
    employees: 102_000,
    marketCap: 380_000,
    currency: 'BRL',
    source: 'Itaú Unibanco — resultado de 2025',
    estimated: false,
    note: 'Produto bancário de ~R$ 175,1 bi e lucro líquido contábil de ~R$ 45,8 bi (recorrente ~R$ 45,4 bi). Balanço e valor de mercado são calibragem.',
  },
  {
    companyId: 'jbs',
    year: 2025,
    revenue: 465_480,
    netProfit: 10_800,
    ebitda: 36_720,
    assets: 320_000,
    equity: 80_000,
    cash: 30_000,
    debt: 110_000,
    employees: 280_000,
    marketCap: 120_000,
    currency: 'USD',
    source: 'JBS — resultado de 2025',
    estimated: false,
    note: 'Original: receita líquida ~US$ 86,2 bi, lucro ~US$ 2 bi, EBITDA ajustado ~US$ 6,8 bi. Convertido a R$ 5,40/US$.',
  },
  {
    companyId: 'vale',
    year: 2025,
    revenue: 207_360,
    netProfit: 12_690,
    ebitda: 83_700,
    assets: 480_000,
    equity: 200_000,
    cash: 30_000,
    debt: 90_000,
    employees: 68_000,
    marketCap: 280_000,
    currency: 'USD',
    source: 'Vale — resultado de 2025',
    estimated: false,
    note: 'Original: receita operacional líquida ~US$ 38,4 bi, EBITDA ajustado ~US$ 15,5 bi, lucro atribuível aos acionistas ~US$ 2,35 bi. Convertido a R$ 5,40/US$.',
  },
  {
    companyId: 'bradesco',
    year: 2025,
    revenue: 128_000,
    netProfit: 21_000,
    ebitda: 0,
    assets: 2_100_000,
    equity: 165_000,
    cash: 140_000,
    debt: 0,
    employees: 82_000,
    marketCap: 160_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
  },
  {
    companyId: 'nubank',
    year: 2025,
    revenue: 62_000,
    netProfit: 13_000,
    ebitda: 0,
    assets: 190_000,
    equity: 35_000,
    cash: 28_000,
    debt: 0,
    employees: 8_600,
    marketCap: 320_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'Banco digital: folha pequena, base de clientes grande e valor de mercado desproporcional ao balanço.',
  },
  {
    companyId: 'ambev',
    year: 2025,
    revenue: 88_200,
    netProfit: 16_000,
    ebitda: 29_500,
    assets: 190_000,
    equity: 92_000,
    cash: 18_000,
    debt: 12_000,
    employees: 32_000,
    marketCap: 200_000,
    currency: 'BRL',
    source: 'Ambev — resultado de 2025',
    estimated: false,
    note: 'Receita líquida ~R$ 88,2 bi, lucro ~R$ 16 bi, EBITDA normalizado ~R$ 29,5 bi. Balanço é calibragem.',
  },
  {
    companyId: 'weg',
    year: 2025,
    revenue: 40_800,
    netProfit: 6_100,
    ebitda: 8_900,
    assets: 52_000,
    equity: 30_000,
    cash: 9_000,
    debt: 5_000,
    employees: 42_000,
    marketCap: 210_000,
    currency: 'BRL',
    source: 'WEG — resultado de 2025',
    estimated: false,
    note: 'Receita operacional líquida ~R$ 40,8 bi e ROIC de ~32,5% divulgados. Lucro, EBITDA e balanço são calibragem coerente com esse ROIC.',
  },
  {
    companyId: 'btg',
    year: 2025,
    revenue: 34_000,
    netProfit: 13_500,
    ebitda: 0,
    assets: 700_000,
    equity: 55_000,
    cash: 60_000,
    debt: 0,
    employees: 7_500,
    marketCap: 170_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
  },
  {
    companyId: 'gerdau',
    year: 2025,
    revenue: 68_000,
    netProfit: 4_200,
    ebitda: 11_500,
    assets: 90_000,
    equity: 48_000,
    cash: 6_000,
    debt: 18_000,
    employees: 30_000,
    marketCap: 38_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'O projeto não tem os dados públicos recentes da Gerdau carregados. Estes números são calibragem coerente com a escala do setor siderúrgico brasileiro e devem ser substituídos quando o balanço entrar nesta camada.',
  },
  {
    companyId: 'suzano',
    year: 2025,
    revenue: 50_000,
    netProfit: 13_400,
    ebitda: 21_700,
    assets: 160_000,
    equity: 50_000,
    cash: 20_000,
    debt: 80_000,
    employees: 40_000,
    marketCap: 70_000,
    currency: 'BRL',
    source: 'Suzano — resultado de 2025',
    estimated: false,
    note: 'Receita líquida ~R$ 50 bi, EBITDA ajustado ~R$ 21,7 bi, lucro ~R$ 13,4 bi, geração de caixa operacional ~R$ 13,9 bi. Balanço é calibragem — a dívida alta em dólar é característica do setor e importa para o modelo cambial.',
  },
  {
    companyId: 'santander_br',
    year: 2025,
    revenue: 82_000,
    netProfit: 13_000,
    ebitda: 0,
    assets: 1_300_000,
    equity: 90_000,
    cash: 85_000,
    debt: 0,
    employees: 52_000,
    marketCap: 105_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
  },
  {
    companyId: 'mercado_livre',
    year: 2025,
    revenue: 120_000,
    netProfit: 9_000,
    ebitda: 16_000,
    assets: 130_000,
    equity: 30_000,
    cash: 22_000,
    debt: 14_000,
    employees: 60_000,
    marketCap: 400_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'Operação brasileira da companhia, que reporta em dólar e consolida a América Latina inteira. Aqui entra só a escala equivalente ao Brasil.',
  },
  {
    companyId: 'cosan',
    year: 2025,
    revenue: 45_000,
    netProfit: 1_800,
    ebitda: 9_000,
    assets: 180_000,
    equity: 35_000,
    cash: 12_000,
    debt: 90_000,
    employees: 45_000,
    marketCap: 30_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
    note: 'Holding de energia, açúcar, álcool e logística. Dívida alta: o resultado dela é muito sensível à Selic.',
  },
  {
    companyId: 'vivo',
    year: 2025,
    revenue: 58_000,
    netProfit: 5_400,
    ebitda: 22_000,
    assets: 110_000,
    equity: 68_000,
    cash: 5_000,
    debt: 12_000,
    employees: 33_000,
    marketCap: 90_000,
    currency: 'BRL',
    source: 'Calibragem do jogo',
    estimated: true,
  },
];

const BY_ID = new Map(COMPANY_FINANCIAL_DATA.map((record) => [record.companyId, record]));

/** Busca o registro financeiro de uma empresa. Lança se o id não existir. */
export function financialRecord(companyId: string): CompanyFinancialRecord {
  const record = BY_ID.get(companyId);
  if (!record) throw new Error(`Empresa sem dado financeiro cadastrado: ${companyId}`);
  return record;
}

/** true quando os números da empresa são calibragem do jogo, não balanço reportado. */
export function isEstimatedData(companyId: string): boolean {
  return BY_ID.get(companyId)?.estimated ?? true;
}
