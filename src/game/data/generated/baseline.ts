/**
 * ARQUIVO GERADO AUTOMATICAMENTE - nao edite a mao.
 * Origem: scripts/fetch-official-data.mjs
 * Gerado em: 2026-09-11T01:11:13.799Z
 *
 * Os valores abaixo sao DADO INICIAL, extraidos de fontes publicas oficiais.
 * Durante a partida, o motor de simulacao assume e os numeros deixam de
 * corresponder a realidade.
 */

export interface SourcedNumber {
  value: number;
  source: string;
  reference: string;
}

const s = (value: number, source: string, reference: string): SourcedNumber => ({ value, source, reference });

/** Fotografia macro usada como ponto de partida de toda nova partida. */
export const MACRO_BASELINE = {
  selic: s(14, 'BCB/SGS 432', '16/09/2026'),
  inflation12m: s(4.44, 'BCB/SGS 13522', '01/07/2026'),
  usd: s(5.1149, 'BCB/SGS 1', '10/09/2026'),
  debtToGdp: s(82.51, 'BCB/SGS 13762', '01/07/2026'),
  reservesUsdBillion: s(372.6, 'BCB/SGS 3546', '01/08/2026'),
  /** Resultado primario do setor publico consolidado. POSITIVO = SUPERAVIT (a NFSP do BCB usa o sinal oposto e ja foi invertida aqui). */
  primaryBalancePctGdp: s(-0.67, 'BCB/SGS 5793 (NFSP, sinal invertido)', '01/07/2026'),
  unemployment: s(5.3, 'IBGE/PNAD Continua', '202607'),
  /** PIB acumulado em 12 meses, valores correntes. */
  gdpNominalBillion: s(13267, 'BCB/SGS 4382', '01/07/2026'),
  minimumWage: s(1621, 'BCB/SGS 1619', '01/09/2026'),
  population: s(214211951, 'IBGE/Estimativas de Populacao', '2026'),
} as const;

/** Populacao residente estimada por UF (IBGE, 2026). */
export const STATE_POPULATION: Record<string, number> = {
  "RO": 1757338,
  "AC": 887794,
  "AM": 4360926,
  "RR": 761012,
  "PA": 8756324,
  "AP": 809953,
  "TO": 1595994,
  "MA": 7024557,
  "PI": 3392617,
  "CE": 9302211,
  "RN": 3463737,
  "PB": 4182828,
  "PE": 9583176,
  "AL": 3221128,
  "SE": 2307255,
  "BA": 14889472,
  "MG": 21460311,
  "ES": 4150692,
  "RJ": 17225410,
  "SP": 46179008,
  "PR": 11952456,
  "SC": 8312759,
  "RS": 11233317,
  "MS": 2946317,
  "MT": 3950330,
  "GO": 7495033,
  "DF": 3009996
};

/** Participacao de cada UF no PIB nacional, em % (IBGE, 2023). */
export const STATE_GDP_SHARE: Record<string, number> = {
  "RO": 0.7,
  "AC": 0.24,
  "AM": 1.48,
  "RR": 0.23,
  "PA": 2.33,
  "AP": 0.26,
  "TO": 0.59,
  "MA": 1.36,
  "PI": 0.74,
  "CE": 2.12,
  "RN": 0.93,
  "PB": 0.89,
  "PE": 2.47,
  "AL": 0.82,
  "SE": 0.56,
  "BA": 3.94,
  "MG": 8.88,
  "ES": 1.92,
  "RJ": 10.72,
  "SP": 31.48,
  "PR": 6.13,
  "SC": 4.69,
  "RS": 5.94,
  "MS": 1.69,
  "MT": 2.49,
  "GO": 3.08,
  "DF": 3.34
};

/** Cadeiras na Camara por UF (Camara dos Deputados, dados abertos). */
export const STATE_SEATS: Record<string, number> = {
  "AP": 8,
  "AM": 8,
  "SP": 70,
  "BA": 39,
  "GO": 17,
  "MG": 53,
  "RS": 31,
  "PB": 12,
  "PA": 17,
  "CE": 22,
  "DF": 8,
  "RR": 8,
  "TO": 8,
  "AL": 9,
  "PR": 30,
  "RJ": 46,
  "MA": 18,
  "ES": 10,
  "SC": 16,
  "PE": 25,
  "AC": 8,
  "PI": 10,
  "RN": 8,
  "MS": 8,
  "MT": 8,
  "RO": 8,
  "SE": 8
};

/** Taxa de desocupacao por UF, % (IBGE/PNAD Continua, 202602). */
export const STATE_UNEMPLOYMENT: Record<string, number> = {
  "RO": 2.6,
  "AC": 6.6,
  "AM": 7.5,
  "RR": 5,
  "PA": 6.2,
  "AP": 9.8,
  "TO": 4.1,
  "MA": 6,
  "PI": 8.3,
  "CE": 6.6,
  "RN": 5.6,
  "PB": 5.4,
  "PE": 8.3,
  "AL": 7.9,
  "SE": 7.9,
  "BA": 9.1,
  "MG": 3.8,
  "ES": 2.3,
  "RJ": 7.1,
  "SP": 5.4,
  "PR": 3.1,
  "SC": 2.1,
  "RS": 4.2,
  "MS": 2.7,
  "MT": 2.2,
  "GO": 4,
  "DF": 6.5
};

/** Rendimento medio mensal real do trabalho por UF, R$ (IBGE/PNAD Continua, 202602). */
export const STATE_INCOME: Record<string, number> = {
  "RO": 3800,
  "AC": 3131,
  "AM": 2775,
  "RR": 3560,
  "PA": 2576,
  "AP": 3151,
  "TO": 3497,
  "MA": 2262,
  "PI": 2522,
  "CE": 2729,
  "RN": 2873,
  "PB": 2834,
  "PE": 2792,
  "AL": 2579,
  "SE": 3039,
  "BA": 2547,
  "MG": 3487,
  "ES": 3637,
  "RJ": 4226,
  "SP": 4505,
  "PR": 4247,
  "SC": 4404,
  "RS": 4185,
  "MS": 3878,
  "MT": 4207,
  "GO": 3971,
  "DF": 6327
};

/** Composicao partidaria da Camara usada como ponto de partida. */
export const PARTY_SEATS: Record<string, number> = {
  "MDB": 38,
  "PL": 98,
  "PSDB": 18,
  "NOVO": 5,
  "PP": 46,
  "PT": 64,
  "PDT": 9,
  "REPUBLICANOS": 42,
  "CIDADANIA": 2,
  "UNIÃO": 52,
  "PCdoB": 11,
  "PV": 6,
  "REDE": 3,
  "PSB": 17,
  "PSD": 48,
  "PODE": 27,
  "SOLIDARIEDADE": 4,
  "PSOL": 13,
  "AVANTE": 5,
  "PRD": 3,
  "DC": 1,
  "MISSÃO": 1
};

export const DATA_SOURCES = [
  'IBGE - Malhas territoriais, Estimativas de Populacao, Contas Regionais e PNAD Continua',
  'Banco Central do Brasil - Sistema Gerenciador de Series Temporais (SGS)',
  'Camara dos Deputados - Portal de Dados Abertos',
] as const;
