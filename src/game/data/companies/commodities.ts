import type { CommodityId, CommodityPrice } from '../../types/companies';
import type { CompanySector } from '../../types/companies';

/**
 * PREÇOS DE COMMODITY
 *
 * O preço de commodity é o choque externo que o presidente não controla e que
 * decide o mandato mesmo assim: minério em alta salva a balança comercial,
 * petróleo em alta enche o caixa da Petrobras e esvazia o bolso do motorista.
 *
 * O índice é relativo: 100 é o preço da base de referência. `referencePrice`
 * existe só para a interface mostrar um número que o jogador reconhece.
 */
export const COMMODITY_BASELINE: readonly CommodityPrice[] = [
  {
    id: 'petroleo',
    label: 'Petróleo (Brent)',
    index: 100,
    referencePrice: 78,
    unit: 'US$/barril',
    volatility: 4.2,
    inflationPassthrough: 0.14,
    lastChange: 0,
  },
  {
    id: 'minerio_ferro',
    label: 'Minério de ferro',
    index: 100,
    referencePrice: 104,
    unit: 'US$/tonelada',
    volatility: 5.1,
    inflationPassthrough: 0.03,
    lastChange: 0,
  },
  {
    id: 'celulose',
    label: 'Celulose',
    index: 100,
    referencePrice: 620,
    unit: 'US$/tonelada',
    volatility: 3.4,
    inflationPassthrough: 0.02,
    lastChange: 0,
  },
  {
    id: 'carne',
    label: 'Carne bovina',
    index: 100,
    referencePrice: 320,
    unit: 'R$/arroba',
    volatility: 3.8,
    inflationPassthrough: 0.09,
    lastChange: 0,
  },
  {
    id: 'graos',
    label: 'Grãos (soja e milho)',
    index: 100,
    referencePrice: 132,
    unit: 'R$/saca',
    volatility: 4.0,
    inflationPassthrough: 0.11,
    lastChange: 0,
  },
  {
    id: 'aco',
    label: 'Aço',
    index: 100,
    referencePrice: 3_900,
    unit: 'R$/tonelada',
    volatility: 3.2,
    inflationPassthrough: 0.04,
    lastChange: 0,
  },
];

/**
 * Quanto o preço de cada commodity influencia o índice de commodities da
 * macroeconomia (economy.commodityIndex), que já existia no motor. A soma dos
 * pesos é 1: o índice antigo passa a ser a média ponderada dos preços novos em
 * vez de um passeio aleatório solto.
 */
export const COMMODITY_MACRO_WEIGHT: Record<CommodityId, number> = {
  petroleo: 0.26,
  minerio_ferro: 0.24,
  graos: 0.22,
  carne: 0.12,
  celulose: 0.09,
  aco: 0.07,
};

/**
 * Setores que sentem cada commodity mesmo sem tê-la como sensibilidade
 * principal. Usado nas notícias e nas demandas, não no cálculo financeiro —
 * esse usa `sensitivity.commodityId` de cada empresa, que é mais preciso.
 */
export const COMMODITY_SECTORS: Record<CommodityId, CompanySector[]> = {
  petroleo: ['petroleo_gas', 'energia', 'logistica'],
  minerio_ferro: ['mineracao', 'siderurgia'],
  celulose: ['papel_celulose'],
  carne: ['alimentos', 'agropecuaria'],
  graos: ['alimentos', 'agropecuaria', 'abastecimento', 'bebidas'],
  aco: ['siderurgia', 'bens_de_capital'],
};
