/**
 * ARQUIVO GERADO AUTOMATICAMENTE - nao edite a mao.
 * Origem: scripts/fetch-official-data.mjs
 * Gerado em: 2026-09-02T22:22:47.485Z
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
  usd: s(5.1273, 'BCB/SGS 1', '02/09/2026'),
  debtToGdp: s(82.51, 'BCB/SGS 13762', '01/07/2026'),
  reservesUsdBillion: s(369.7, 'BCB/SGS 3546', '01/07/2026'),
  primaryBalancePctGdp: s(0.67, 'BCB/SGS 5793', '01/07/2026'),
  unemployment: s(5.3, 'IBGE/PNAD Continua', '202607'),
  gdpNominalBillion: s(10943, 'IBGE/Contas Regionais', '2023'),
  population: s(203080756, 'IBGE/Censo', '2022'),
} as const;

/** Populacao residente por UF (IBGE, Censo 2022). */
export const STATE_POPULATION: Record<string, number> = {
  "RO": 1581196,
  "AC": 830018,
  "AM": 3941613,
  "RR": 636707,
  "PA": 8120131,
  "AP": 733759,
  "TO": 1511460,
  "MA": 6776699,
  "PI": 3271199,
  "CE": 8794957,
  "RN": 3302729,
  "PB": 3974687,
  "PE": 9058931,
  "AL": 3127683,
  "SE": 2210004,
  "BA": 14141626,
  "MG": 20539989,
  "ES": 3833712,
  "RJ": 16055174,
  "SP": 44411238,
  "PR": 11444380,
  "SC": 7610361,
  "RS": 10882965,
  "MS": 2757013,
  "MT": 3658649,
  "GO": 7056495,
  "DF": 2817381
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
  'IBGE - Malhas territoriais, Censo 2022, Contas Regionais e PNAD Continua',
  'Banco Central do Brasil - Sistema Gerenciador de Series Temporais (SGS)',
  'Camara dos Deputados - Portal de Dados Abertos',
] as const;
