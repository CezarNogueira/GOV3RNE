import { FEDERAL_COMPANIES } from './federal-companies';
import { PRIVATE_COMPANIES } from './private-companies';
import type { CompanyBlueprint } from './blueprint';

export * from './blueprint';
export * from './company-financial-data';
export * from './federal-companies';
export * from './private-companies';
export * from './commodities';
export * from './executives';
export * from './buyers';

/** Todas as empresas do jogo, federais primeiro. */
export const COMPANY_BLUEPRINTS: readonly CompanyBlueprint[] = [
  ...FEDERAL_COMPANIES,
  ...PRIVATE_COMPANIES,
];

const BLUEPRINT_BY_ID = new Map(COMPANY_BLUEPRINTS.map((entry) => [entry.id, entry]));

export function companyBlueprint(id: string): CompanyBlueprint | undefined {
  return BLUEPRINT_BY_ID.get(id);
}

/**
 * Termos pelos quais o jogador pode se referir a cada empresa ao escrever uma
 * medida. Usado pelo interpretador para entender "quero reduzir o imposto da
 * Petrobras" como uma medida com alvo, e não como política tributária genérica.
 *
 * Escrito sem acento de propósito: o interpretador normaliza o texto antes de
 * comparar.
 */
export const COMPANY_ALIASES: Record<string, string[]> = {
  petrobras: ['petrobras', 'petrobas', 'petroleo brasileiro'],
  banco_brasil: ['banco do brasil', 'bb'],
  caixa: ['caixa economica', 'caixa federal', 'cef'],
  bndes: ['bndes'],
  correios: ['correios', 'ect'],
  infraero: ['infraero'],
  embratur: ['embratur'],
  embrapa: ['embrapa'],
  enbpar: ['enbpar'],
  ceagesp: ['ceagesp'],
  amazul: ['amazul'],
  conab: ['conab'],
  serpro: ['serpro'],
  dataprev: ['dataprev'],
  itau: ['itau', 'itau unibanco', 'unibanco'],
  jbs: ['jbs', 'friboi'],
  vale: ['vale do rio doce', 'mineradora vale', 'a vale'],
  bradesco: ['bradesco'],
  nubank: ['nubank', 'nu holdings'],
  ambev: ['ambev'],
  weg: ['weg'],
  btg: ['btg', 'btg pactual'],
  gerdau: ['gerdau'],
  suzano: ['suzano'],
  santander_br: ['santander'],
  mercado_livre: ['mercado livre', 'mercadolivre', 'meli'],
  cosan: ['cosan', 'raizen'],
  vivo: ['vivo', 'telefonica'],
};
