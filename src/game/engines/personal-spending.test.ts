import { describe, expect, it } from 'vitest';
import { createGame, tickMonth, type GameState } from './index';
import {
  experienceDoneThisMonth,
  personalItemMonthlyCost,
  possessionValue,
  sellPossession,
  spendPersonal,
} from './personal-spending';
import { PERSONAL_CAR_BRANDS, PERSONAL_SHOP, PERSONAL_SHOP_BY_ID } from '../data/personal-shop';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * O DINHEIRO PESSOAL DO PRESIDENTE
 *
 * Restaurante e lazer uma vez por mês; carro e imóvel no nome dele, com
 * manutenção mensal e venda pelo valor de mercado. E o país vê: ostentação
 * custa aprovação e vira manchete, gesto popular não.
 */
function newGame(seed = 31): GameState {
  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', occupation: 'medico',
        religion: 'catolico', traits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet: defaultCabinet(MINISTRY_IDS),
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      startYear: 2027, reelection: true, seed,
    }),
  );
}

const rngOf = (state: GameState) => new Rng(state.seed, state.rngCursor);
const grupo = (state: GameState, id: string) =>
  state.socialGroups.find((candidate) => candidate.id === id)!.approval;

describe('a vitrine', () => {
  it('carros das sete marcas, com modelo, motor e preço', () => {
    expect(PERSONAL_CAR_BRANDS).toEqual(['Fiat', 'Ford', 'Chevrolet', 'Volkswagen', 'BMW', 'Mercedes-Benz', 'Ferrari']);
    for (const marca of PERSONAL_CAR_BRANDS) {
      const daMarca = PERSONAL_SHOP.filter((item) => item.category === 'carro' && item.brand === marca);
      expect(daMarca.length, marca).toBeGreaterThanOrEqual(5);
      for (const carro of daMarca) {
        expect(carro.detail).toMatch(/cv/);
        expect(carro.price).toBeGreaterThan(0);
        expect(personalItemMonthlyCost(carro)).toBeGreaterThan(0);
      }
    }
  });

  it('imóveis de todos os tipos, cada um com endereço', () => {
    for (const tipo of ['apartamento', 'casa', 'triplex', 'rural']) {
      const doTipo = PERSONAL_SHOP.filter((item) => item.category === 'imovel' && item.kind === tipo);
      expect(doTipo.length, tipo).toBeGreaterThanOrEqual(3);
      for (const imovel of doTipo) {
        if (imovel.category === 'imovel') expect(imovel.city.length).toBeGreaterThan(3);
      }
    }
  });

  it('restaurantes e lazer à vontade, e nenhum id repetido', () => {
    expect(PERSONAL_SHOP.filter((item) => item.category === 'restaurante').length).toBeGreaterThanOrEqual(5);
    expect(PERSONAL_SHOP.filter((item) => item.category === 'lazer').length).toBeGreaterThanOrEqual(5);
    const ids = PERSONAL_SHOP.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('gastar', () => {
  it('compra desconta o preço e põe o bem no nome do presidente, uma vez só', () => {
    const state = newGame();
    state.president.personalWealth = 1_000_000;

    expect(spendPersonal(state, 'fiat_argo', rngOf(state)).ok).toBe(true);
    expect(state.president.personalWealth).toBe(1_000_000 - PERSONAL_SHOP_BY_ID.fiat_argo!.price);
    expect(state.president.possessions?.map((bem) => bem.itemId)).toEqual(['fiat_argo']);
    expect(state.timeline[0]!.title).toContain('Fiat Argo');

    expect(spendPersonal(state, 'fiat_argo', rngOf(state)).ok).toBe(false);
  });

  it('sem dinheiro na conta não compra', () => {
    const state = newGame();
    state.president.personalWealth = 100_000;
    const resultado = spendPersonal(state, 'ferrari_roma', rngOf(state));
    expect(resultado.ok).toBe(false);
    expect(resultado.message).toContain('Faltam');
    expect(state.president.personalWealth).toBe(100_000);
    expect(state.president.possessions ?? []).toHaveLength(0);
  });

  it('restaurante alivia o estresse e só vale uma vez por mês', () => {
    const state = newGame();
    state.president.personalWealth = 10_000;
    state.president.stress = 60;

    expect(spendPersonal(state, 'restaurante_boteco', rngOf(state)).ok).toBe(true);
    expect(state.president.stress).toBeLessThan(60);
    expect(experienceDoneThisMonth(state, 'restaurante_boteco')).toBe(true);
    expect(spendPersonal(state, 'restaurante_boteco', rngOf(state)).ok).toBe(false);

    state.month += 1;
    expect(spendPersonal(state, 'restaurante_boteco', rngOf(state)).ok).toBe(true);
  });

  it('ostentação custa aprovação e vira manchete; gesto popular não', () => {
    const luxo = newGame();
    luxo.president.personalWealth = 50_000_000;
    const aprovacao = luxo.approval.overall;
    const pobres = grupo(luxo, 'baixa_renda');
    const noticias = luxo.news.length;

    spendPersonal(luxo, 'ferrari_sf90', rngOf(luxo));
    expect(luxo.approval.overall).toBeLessThan(aprovacao);
    expect(grupo(luxo, 'baixa_renda')).toBeLessThan(pobres);
    expect(luxo.news).toHaveLength(noticias + 1);
    expect(luxo.news[0]!.headline).toContain('Ferrari SF90');

    const popular = newGame();
    popular.president.personalWealth = 1_000_000;
    const antes = popular.approval.overall;
    const noticiasAntes = popular.news.length;
    spendPersonal(popular, 'casa_ceilandia', rngOf(popular));
    expect(popular.approval.overall).toBeGreaterThanOrEqual(antes);
    expect(popular.news).toHaveLength(noticiasAntes);
  });

  it('vender devolve o valor de mercado: carro perde valor, imóvel valoriza', () => {
    const state = newGame();
    state.president.personalWealth = 20_000_000;
    for (const itemId of ['bmw_m3', 'casa_lago_sul']) {
      const rng = rngOf(state);
      expect(spendPersonal(state, itemId, rng).ok).toBe(true);
      // O repositório avança o cursor entre uma ação e outra; o teste faz o mesmo.
      state.rngCursor = rng.cursor;
    }
    state.month += 24;

    const [carro, casa] = state.president.possessions!;
    expect(possessionValue(state, carro!)).toBeLessThan(carro!.pricePaid);
    expect(possessionValue(state, casa!)).toBeGreaterThan(casa!.pricePaid);

    const saldo = state.president.personalWealth;
    const valor = possessionValue(state, carro!);
    expect(sellPossession(state, carro!.id, rngOf(state)).ok).toBe(true);
    expect(state.president.personalWealth).toBe(saldo + valor);
    expect(state.president.possessions).toHaveLength(1);
  });
});

describe('fechamento do mês', () => {
  it('bens cobram manutenção todo mês', () => {
    const sem = newGame();
    sem.president.personalWealth = 20_000_000;
    const com = newGame();
    com.president.personalWealth = 20_000_000;
    com.president.possessions = [
      { id: 'bem_teste', itemId: 'casa_lago_sul', boughtMonth: com.month, pricePaid: 9_800_000 },
    ];

    const depoisSem = tickMonth(sem).state.president.personalWealth;
    const depoisCom = tickMonth(com).state.president.personalWealth;
    expect(depoisSem - depoisCom).toBe(personalItemMonthlyCost(PERSONAL_SHOP_BY_ID.casa_lago_sul!));
  });

  it('conta no vermelho: o bem mais caro de manter é vendido às pressas', () => {
    const state = newGame();
    state.president.personalWealth = 0;
    state.president.possessions = [
      { id: 'bem_fusca', itemId: 'vw_fusca', boughtMonth: state.month, pricePaid: 45_000 },
      { id: 'bem_ferrari', itemId: 'ferrari_purosangue', boughtMonth: state.month, pricePaid: 7_500_000 },
    ];

    const { state: depois } = tickMonth(state);
    expect(depois.president.possessions?.map((bem) => bem.itemId)).toEqual(['vw_fusca']);
    expect(depois.president.personalWealth).toBeGreaterThan(0);
    expect(depois.timeline.some((entry) => entry.title.includes('Ferrari Purosangue'))).toBe(true);
  });
});
