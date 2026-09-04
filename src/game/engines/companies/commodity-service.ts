import type { CommodityId, CommodityPrice, GameState } from '../../types/index';
import { COMMODITY_MACRO_WEIGHT } from '../../data/companies/commodities';
import { Rng } from '../../utils/rng';
import { clamp, round } from '../../utils/math';

/**
 * PREÇOS DE COMMODITY
 *
 * O único choque verdadeiramente externo do jogo. O presidente não controla o
 * preço do minério nem o do petróleo, mas governa em cima deles: safra boa
 * salva governo ruim, e petróleo caro enche o caixa da Petrobras enquanto
 * esvazia o bolso de quem abastece.
 *
 * Cada preço é um passeio com reversão à média — commodity sobe e desce, não
 * cresce para sempre — e o conjunto alimenta duas coisas que já existiam no
 * motor: o índice de commodities da macroeconomia e a pressão de oferta que
 * vira inflação.
 */

/** Velocidade com que o preço volta para o nível de referência. */
const MEAN_REVERSION = 0.06;

export interface CommodityOutcome {
  /** Novo valor do índice macro de commodities, 0-100. */
  macroIndex: number;
  /** Pressão inflacionária gerada no mês, em p.p. */
  inflationPressure: number;
  /** Commodity que mais se moveu, para virar notícia. */
  headline: CommodityPrice | null;
}

/** Avança os preços em um mês e devolve o que isso faz com a macroeconomia. */
export function processCommodities(state: GameState, rng: Rng): CommodityOutcome {
  const commodities = state.companies.commodities;
  let inflationPressure = 0;
  let weightedIndex = 0;
  let biggest: CommodityPrice | null = null;

  for (const commodity of commodities) {
    const before = commodity.index;

    // Passeio aleatório com reversão: o preço orbita 100 em vez de escapar.
    const drift = (100 - commodity.index) * MEAN_REVERSION;
    const shock = rng.noise(commodity.volatility);
    commodity.index = round(clamp(commodity.index + drift + shock, 25, 320), 2);
    commodity.lastChange = round(commodity.index - before, 2);

    // Preço de commodity vira inflação com peso próprio: combustível pesa muito
    // mais no IPCA do que celulose.
    inflationPressure += (commodity.lastChange / 10) * commodity.inflationPassthrough;

    const weight = COMMODITY_MACRO_WEIGHT[commodity.id] ?? 0;
    weightedIndex += commodity.index * weight;

    if (!biggest || Math.abs(commodity.lastChange) > Math.abs(biggest.lastChange)) {
      biggest = commodity;
    }
  }

  // O índice macro histórico do jogo é 0-100 com 70 de referência. Traduzimos o
  // índice das commodities (100 = referência) para essa régua antiga, para não
  // quebrar nada que já lia economy.commodityIndex.
  const macroIndex = round(clamp(70 * (weightedIndex / 100), 10, 100), 1);

  return {
    macroIndex,
    inflationPressure: round(inflationPressure, 3),
    headline: biggest && Math.abs(biggest.lastChange) >= 6 ? biggest : null,
  };
}

/** Preço corrente de uma commodity como índice (100 = referência). */
export function commodityIndex(state: GameState, id: CommodityId | undefined): number {
  if (!id) return 100;
  return state.companies.commodities.find((entry) => entry.id === id)?.index ?? 100;
}

/** Aplica um choque externo a uma commodity (guerra, quebra de safra, embargo). */
export function shockCommodity(state: GameState, id: CommodityId, points: number): void {
  const commodity = state.companies.commodities.find((entry) => entry.id === id);
  if (!commodity) return;
  const before = commodity.index;
  commodity.index = round(clamp(commodity.index + points, 25, 320), 2);
  commodity.lastChange = round(commodity.index - before, 2);
}
