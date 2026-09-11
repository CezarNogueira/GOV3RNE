export * from './generated/baseline';
export * from './generated/geo';
export * from './states';
export * from './parties';
export * from './ministries';
export * from './social-groups';
export * from './countries';
export * from './relations';
export * from './treaties';
export * from './promises';
export * from './people';
export * from './agenda';
export * from './campaign';
export * from './calibration';
export * from './brasil-hoje';
export * from './avatar';
export * from './programs';
export * from './program-rules';
export * from './companies/index';
export * from './events';
export * from './dynamic-events/index';
export * from './measure-types';
export * from './numeric-targets';
export * from './policy-elasticities';
export * from './public-figures';

/**
 * DOIS MODELOS DE ESPLANADA CONVIVENDO, DE PROPÓSITO
 *
 * `ministries.ts` tem as dez pastas que o gabinete jogável monta: elas têm
 * linha de orçamento, titular e efeito no resto da simulação.
 *
 * `people.ts` tem a Esplanada inteira (33 pastas, com tier, orçamento
 * discricionário, capilaridade e se a pasta é moeda de coalizão) e o banco de
 * partidos reais com bancada, disciplina e fisiologia. É o material da
 * NEGOCIAÇÃO — o que explica por que o Centrão pede Cidades e nunca pede
 * Cultura.
 *
 * Os dois exportam nomes iguais para coisas diferentes. Aqui os nomes do
 * gabinete continuam sendo os canônicos e os da negociação ganham nome próprio,
 * até que a migração de um para o outro seja decidida.
 */
export { MINISTRIES, MINISTRY_BY_ID } from './ministries';
export { PARTIES, PARTY_BY_ID } from './parties';
export type { Ministry } from '../types/index';
export {
  MINISTRIES as ESPLANADA,
  MINISTRY_BY_ID as ESPLANADA_BY_ID,
  PARTIES as CONGRESS_PARTIES,
  PARTY_BY_ID as CONGRESS_PARTY_BY_ID,
  type Ministry as EsplanadaPasta,
  type Party as CongressParty,
} from './people';
export * from './bills';
export * from './personal-shop';
