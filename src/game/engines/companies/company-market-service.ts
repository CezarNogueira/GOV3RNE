import type { Company, CompanySector, GameState } from '../../types/index';
import { Rng } from '../../utils/rng';
import { approach, clamp, clamp100, round } from '../../utils/math';

/**
 * MERCADO DE AÇÕES
 *
 * A bolsa não é um indicador decorativo: é o preço que o mercado paga para ser
 * sócio de cada empresa, e ele muda quando o lucro muda, quando o juro muda e
 * quando o presidente abre a boca.
 *
 * Regra de desenho: a mesma notícia move empresas diferentes com intensidade
 * diferente. Imposto extraordinário sobre bancos derruba Itaú e Bradesco muito
 * mais do que derruba Vale — e derruba Nubank de um jeito próprio, porque a
 * ação dele é mais volátil que a dos dois.
 */

/** Risco-país de referência: acima disso, o mercado cobra prêmio de todo mundo. */
const RISK_ANCHOR = 220;

export interface MarketOutcome {
  /** Índice agregado das listadas: 100 = valor de mercado da posse. */
  marketIndex: number;
  /** Variação do índice no mês, %. */
  indexChange: number;
  /** Maior alta do mês, quando relevante. */
  topGainer: Company | null;
  /** Maior queda do mês, quando relevante. */
  topLoser: Company | null;
}

/** Avança o preço das ações de todas as listadas em um mês. */
export function processCompanyMarket(state: GameState, rng: Rng): MarketOutcome {
  const eco = state.economy;
  const ref = state.companies.reference;
  const selicGap = (eco.selic - ref.selic) / 100;

  let capNow = 0;
  let capBase = 0;
  let topGainer: Company | null = null;
  let topLoser: Company | null = null;

  for (const company of state.companies.companies) {
    if (!company.ownership.listed) {
      // Empresa fechada não tem cotação; o "valor" dela é patrimonial e quem
      // cuida disso é valuationOf(), em company-service.
      company.market.monthChange = 0;
      continue;
    }

    const fin = company.financials;
    const before = company.market.marketCap;

    // Fundamento: o quanto o lucro corrente se afastou do lucro de referência.
    // Empresa que já nascia no prejuízo é avaliada pela direção, não pela razão.
    const earningsRatio =
      fin.profitBase > 0
        ? clamp(fin.profit / fin.profitBase, -0.6, 3)
        : fin.profit > 0
          ? 1.3
          : 0.85;

    // Humor: confiança do investidor, relação com o governo, risco-país e juro.
    // Juro alto é a alternativa sem risco — quanto maior, menos a ação vale.
    const sentiment =
      1 +
      (company.market.investorConfidence - 50) / 220 +
      (company.politics.governmentRelation / 100) * 0.06 -
      ((eco.countryRisk - RISK_ANCHOR) / 2000) * (1 + company.market.stockVolatility / 100) -
      selicGap * (1.5 + company.sensitivity.interest * -0.8) -
      (company.crisisRisk / 100) * 0.35;

    const target = company.market.marketCapBase * (0.35 + 0.65 * earningsRatio) * clamp(sentiment, 0.25, 2.2);

    // O ruído é proporcional à volatilidade da própria ação: papel de banco
    // grande balança menos que papel de banco digital.
    const noise = rng.noise(company.market.stockVolatility / 100 / 3.4);
    company.market.marketCap = round(
      Math.max(company.market.marketCapBase * 0.08, approach(company.market.marketCap, target, 0.22) * (1 + noise)),
      1,
    );

    const ratio = company.market.marketCap / Math.max(1, company.market.marketCapBase);
    company.market.stockPrice = round(company.market.stockPriceBase * ratio, 2);
    company.market.monthChange = round(((company.market.marketCap - before) / Math.max(1, before)) * 100, 2);
    company.market.mandateChange = round((ratio - 1) * 100, 1);

    company.market.investorConfidence = round(
      clamp100(
        approach(
          company.market.investorConfidence,
          clamp100(
            50 +
              fin.netMargin * 1.6 +
              company.politics.governmentRelation * 0.12 -
              company.crisisRisk * 0.4 -
              company.monthsInLoss * 3,
          ),
          0.18,
        ),
      ),
      1,
    );

    capNow += company.market.marketCap;
    capBase += company.market.marketCapBase;

    if (!topGainer || company.market.monthChange > topGainer.market.monthChange) topGainer = company;
    if (!topLoser || company.market.monthChange < topLoser.market.monthChange) topLoser = company;
  }

  const marketIndex = capBase > 0 ? round((capNow / capBase) * 100, 2) : 100;
  const previous = state.companies.aggregate.totalMarketCap;
  const indexChange = previous > 0 ? round(((capNow - previous) / previous) * 100, 2) : 0;

  return {
    marketIndex,
    indexChange,
    topGainer: topGainer && topGainer.market.monthChange >= 6 ? topGainer : null,
    topLoser: topLoser && topLoser.market.monthChange <= -6 ? topLoser : null,
  };
}

/**
 * Puxa o Ibovespa na direção do que as empresas do jogo valem.
 *
 * O motor macro já calcula um alvo para o índice a partir de confiança e risco.
 * Aqui ele é corrigido pelo valor real das companhias listadas: se a bolsa do
 * jogo sobe enquanto todas as empresas perdem lucro, alguma coisa está errada.
 */
export function reconcileIbovespa(state: GameState, marketIndex: number): void {
  const implied = 142_000 * (marketIndex / 100);
  state.economy.ibovespa = Math.round(
    clamp(approach(state.economy.ibovespa, implied, 0.35), 30_000, 600_000),
  );
}

/**
 * Choque de mercado dirigido a um setor ou a uma lista de empresas.
 *
 * É o que um anúncio produz no mesmo dia, antes de qualquer balanço: o preço se
 * move na expectativa. A intensidade varia com a volatilidade de cada papel,
 * então o mesmo anúncio nunca bate igual em duas empresas.
 */
export function shockMarket(
  state: GameState,
  options: { companyIds?: string[]; sectors?: CompanySector[]; magnitude: number },
): Company[] {
  const touched: Company[] = [];
  const { companyIds = [], sectors = [], magnitude } = options;

  for (const company of state.companies.companies) {
    const named = companyIds.includes(company.id);
    const inSector = sectors.includes(company.sector);
    if (!named && !inSector) continue;
    if (!company.ownership.listed) {
      touched.push(company);
      continue;
    }

    // Empresa nomeada leva o choque cheio; empresa atingida só pelo setor leva
    // dois terços. Papel volátil amplifica o movimento.
    const exposure = (named ? 1 : 0.65) * (0.7 + company.market.stockVolatility / 100);
    const move = clamp(magnitude * exposure, -45, 45);

    const before = company.market.marketCap;
    company.market.marketCap = round(Math.max(company.market.marketCapBase * 0.08, before * (1 + move / 100)), 1);
    company.market.stockPrice = round(
      company.market.stockPriceBase * (company.market.marketCap / Math.max(1, company.market.marketCapBase)),
      2,
    );
    company.market.monthChange = round(
      company.market.monthChange + ((company.market.marketCap - before) / Math.max(1, before)) * 100,
      2,
    );
    company.market.investorConfidence = round(
      clamp100(company.market.investorConfidence + move * 0.35),
      1,
    );
    touched.push(company);
  }

  return touched;
}
