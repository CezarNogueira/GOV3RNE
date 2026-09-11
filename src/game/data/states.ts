import type { Region, StateInfo } from '../types/index';
import {
  STATE_GDP_SHARE,
  STATE_INCOME,
  STATE_POPULATION,
  STATE_SEATS,
  STATE_UNEMPLOYMENT,
} from './generated/baseline';
import { BRASIL_HOJE } from './brasil-hoje';

interface StateSeed {
  id: string;
  name: string;
  region: Region;
  capital: string;
}

/** As 27 unidades da federação. População, PIB e cadeiras vêm do pacote de dados oficiais. */
const SEEDS: readonly StateSeed[] = [
  { id: 'AC', name: 'Acre', region: 'norte', capital: 'Rio Branco' },
  { id: 'AL', name: 'Alagoas', region: 'nordeste', capital: 'Maceió' },
  { id: 'AP', name: 'Amapá', region: 'norte', capital: 'Macapá' },
  { id: 'AM', name: 'Amazonas', region: 'norte', capital: 'Manaus' },
  { id: 'BA', name: 'Bahia', region: 'nordeste', capital: 'Salvador' },
  { id: 'CE', name: 'Ceará', region: 'nordeste', capital: 'Fortaleza' },
  { id: 'DF', name: 'Distrito Federal', region: 'centro-oeste', capital: 'Brasília' },
  { id: 'ES', name: 'Espírito Santo', region: 'sudeste', capital: 'Vitória' },
  { id: 'GO', name: 'Goiás', region: 'centro-oeste', capital: 'Goiânia' },
  { id: 'MA', name: 'Maranhão', region: 'nordeste', capital: 'São Luís' },
  { id: 'MT', name: 'Mato Grosso', region: 'centro-oeste', capital: 'Cuiabá' },
  { id: 'MS', name: 'Mato Grosso do Sul', region: 'centro-oeste', capital: 'Campo Grande' },
  { id: 'MG', name: 'Minas Gerais', region: 'sudeste', capital: 'Belo Horizonte' },
  { id: 'PA', name: 'Pará', region: 'norte', capital: 'Belém' },
  { id: 'PB', name: 'Paraíba', region: 'nordeste', capital: 'João Pessoa' },
  { id: 'PR', name: 'Paraná', region: 'sul', capital: 'Curitiba' },
  { id: 'PE', name: 'Pernambuco', region: 'nordeste', capital: 'Recife' },
  { id: 'PI', name: 'Piauí', region: 'nordeste', capital: 'Teresina' },
  { id: 'RJ', name: 'Rio de Janeiro', region: 'sudeste', capital: 'Rio de Janeiro' },
  { id: 'RN', name: 'Rio Grande do Norte', region: 'nordeste', capital: 'Natal' },
  { id: 'RS', name: 'Rio Grande do Sul', region: 'sul', capital: 'Porto Alegre' },
  { id: 'RO', name: 'Rondônia', region: 'norte', capital: 'Porto Velho' },
  { id: 'RR', name: 'Roraima', region: 'norte', capital: 'Boa Vista' },
  { id: 'SC', name: 'Santa Catarina', region: 'sul', capital: 'Florianópolis' },
  { id: 'SP', name: 'São Paulo', region: 'sudeste', capital: 'São Paulo' },
  { id: 'SE', name: 'Sergipe', region: 'nordeste', capital: 'Aracaju' },
  { id: 'TO', name: 'Tocantins', region: 'norte', capital: 'Palmas' },
];

export const STATES: readonly StateInfo[] = SEEDS.map((seed) => ({
  ...seed,
  population: STATE_POPULATION[seed.id] ?? 0,
  gdpShare: STATE_GDP_SHARE[seed.id] ?? 0,
  chamberSeats: STATE_SEATS[seed.id] ?? 8,
}));

export const STATE_BY_ID: Record<string, StateInfo> = Object.fromEntries(
  STATES.map((state) => [state.id, state]),
);

export const STATES_BY_REGION: Record<Region, StateInfo[]> = STATES.reduce(
  (acc, state) => {
    acc[state.region].push(state);
    return acc;
  },
  {
    norte: [] as StateInfo[],
    nordeste: [] as StateInfo[],
    'centro-oeste': [] as StateInfo[],
    sudeste: [] as StateInfo[],
    sul: [] as StateInfo[],
  },
);

/**
 * Perfil socioeconômico de cada UF.
 *
 * Desemprego e renda são os oficiais do estado (PNAD Contínua, baixados pelo
 * script de dados). Pobreza, violência e IDH não têm série estadual com API
 * estável: partem de um perfil relativo — quem é mais pobre, mais violento ou
 * mais desenvolvido que quem — ajustado para que a média dos estados, ponderada
 * pela população, bata com o número nacional real de BRASIL_HOJE.
 */
export interface StateProfileSeed {
  poverty: number;
  unemployment: number;
  income: number;
  hdi: number;
  crime: number;
  infrastructure: number;
}

const PERFIL_RELATIVO: Record<string, StateProfileSeed> = {
  AC: { poverty: 42, unemployment: 9.2, income: 1180, hdi: 0.71, crime: 38, infrastructure: 34 },
  AL: { poverty: 45, unemployment: 10.4, income: 1090, hdi: 0.68, crime: 42, infrastructure: 38 },
  AP: { poverty: 40, unemployment: 11.8, income: 1210, hdi: 0.72, crime: 44, infrastructure: 33 },
  AM: { poverty: 41, unemployment: 10.1, income: 1240, hdi: 0.73, crime: 36, infrastructure: 36 },
  BA: { poverty: 38, unemployment: 11.6, income: 1230, hdi: 0.71, crime: 46, infrastructure: 44 },
  CE: { poverty: 39, unemployment: 9.8, income: 1200, hdi: 0.73, crime: 41, infrastructure: 46 },
  DF: { poverty: 12, unemployment: 8.4, income: 3450, hdi: 0.85, crime: 22, infrastructure: 78 },
  ES: { poverty: 20, unemployment: 7.1, income: 1980, hdi: 0.77, crime: 27, infrastructure: 65 },
  GO: { poverty: 18, unemployment: 6.9, income: 2050, hdi: 0.77, crime: 25, infrastructure: 63 },
  MA: { poverty: 48, unemployment: 9.5, income: 980, hdi: 0.69, crime: 34, infrastructure: 32 },
  MT: { poverty: 16, unemployment: 5.4, income: 2280, hdi: 0.78, crime: 28, infrastructure: 60 },
  MS: { poverty: 17, unemployment: 6.1, income: 2190, hdi: 0.78, crime: 24, infrastructure: 62 },
  MG: { poverty: 21, unemployment: 7.2, income: 1960, hdi: 0.79, crime: 20, infrastructure: 68 },
  PA: { poverty: 44, unemployment: 9.9, income: 1120, hdi: 0.7, crime: 39, infrastructure: 35 },
  PB: { poverty: 41, unemployment: 9.6, income: 1180, hdi: 0.72, crime: 33, infrastructure: 43 },
  PR: { poverty: 15, unemployment: 5.6, income: 2340, hdi: 0.81, crime: 18, infrastructure: 76 },
  PE: { poverty: 40, unemployment: 12.3, income: 1290, hdi: 0.73, crime: 44, infrastructure: 48 },
  PI: { poverty: 47, unemployment: 8.7, income: 1050, hdi: 0.7, crime: 30, infrastructure: 34 },
  RJ: { poverty: 22, unemployment: 10.2, income: 2280, hdi: 0.8, crime: 35, infrastructure: 72 },
  RN: { poverty: 39, unemployment: 11.1, income: 1260, hdi: 0.73, crime: 47, infrastructure: 45 },
  RS: { poverty: 14, unemployment: 5.9, income: 2410, hdi: 0.81, crime: 21, infrastructure: 74 },
  RO: { poverty: 30, unemployment: 6.8, income: 1590, hdi: 0.74, crime: 31, infrastructure: 44 },
  RR: { poverty: 38, unemployment: 10.6, income: 1380, hdi: 0.74, crime: 40, infrastructure: 36 },
  SC: { poverty: 10, unemployment: 4.2, income: 2560, hdi: 0.83, crime: 14, infrastructure: 82 },
  SP: { poverty: 17, unemployment: 7.8, income: 2620, hdi: 0.82, crime: 12, infrastructure: 84 },
  SE: { poverty: 42, unemployment: 12.6, income: 1220, hdi: 0.72, crime: 43, infrastructure: 42 },
  TO: { poverty: 33, unemployment: 8.2, income: 1420, hdi: 0.75, crime: 29, infrastructure: 41 },
};

/** Média de um campo do perfil relativo, ponderada pela população de cada UF. */
function mediaPonderada(campo: 'poverty' | 'crime' | 'hdi'): number {
  let soma = 0;
  let peso = 0;
  for (const [uf, perfil] of Object.entries(PERFIL_RELATIVO)) {
    const populacao = STATE_POPULATION[uf] ?? 0;
    soma += perfil[campo] * populacao;
    peso += populacao;
  }
  return peso > 0 ? soma / peso : 1;
}

const ESCALA = {
  poverty: BRASIL_HOJE.povertyRate.value / mediaPonderada('poverty'),
  crime: BRASIL_HOJE.homicideRate.value / mediaPonderada('crime'),
  hdi: BRASIL_HOJE.hdi.value / mediaPonderada('hdi'),
};

export const STATE_PROFILE: Record<string, StateProfileSeed> = Object.fromEntries(
  Object.entries(PERFIL_RELATIVO).map(([uf, perfil]) => [
    uf,
    {
      ...perfil,
      unemployment: STATE_UNEMPLOYMENT[uf] ?? perfil.unemployment,
      income: STATE_INCOME[uf] ?? perfil.income,
      poverty: Math.round(perfil.poverty * ESCALA.poverty * 10) / 10,
      crime: Math.round(perfil.crime * ESCALA.crime * 10) / 10,
      hdi: Math.min(0.95, Math.round(perfil.hdi * ESCALA.hdi * 1000) / 1000),
    },
  ]),
);
