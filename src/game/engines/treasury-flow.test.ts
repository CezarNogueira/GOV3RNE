import { describe, expect, it } from 'vitest';
import {
  applyImpacts,
  createGame,
  createPolicy,
  interpretLocally,
  monthlyFiscalResult,
  monthlyTreasuryInflow,
  tickMonth,
  type GameState,
} from './index';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * O DINHEIRO QUE A MEDIDA ARRECADA VAI PARA O CAIXA
 *
 * Imposto novo e corte de gasto são dinheiro que entra todo mês. Ele aparece
 * no lucro mensal e entra no caixa no fechamento — em vez de pular direto para
 * o primário acumulado e nunca chegar ao caixa. O déficit herdado na posse
 * continua coberto com dívida.
 */
function newGame(seed = 17): GameState {
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

describe('caixa e primário', () => {
  it('na posse, o déficit herdado não vira entrada de caixa', () => {
    expect(monthlyTreasuryInflow(newGame())).toBeLessThan(0.5);
  });

  it('dinheiro recorrente de medida entra no lucro do mês e no caixa, não de uma vez no primário', () => {
    const state = newGame();
    const primario = state.economy.primaryBalance;
    const lucro = monthlyFiscalResult(state);
    const entrada = monthlyTreasuryInflow(state);

    applyImpacts(state, { primaryBalance: 60 }, 1, 'recorrente');

    expect(state.economy.primaryBalance).toBe(primario);
    expect(monthlyFiscalResult(state)).toBeCloseTo(lucro + 5, 6);
    expect(monthlyTreasuryInflow(state)).toBeGreaterThan(entrada + 4.5);
  });

  it('no fechamento do mês, o caixa recebe esse dinheiro', () => {
    const sem = newGame();
    const com = newGame();
    applyImpacts(com, { primaryBalance: 60 }, 1, 'recorrente');

    const caixaSem = tickMonth(sem).state.economy.treasuryCash;
    const caixaCom = tickMonth(com).state.economy.treasuryCash;
    expect(caixaCom - caixaSem).toBeGreaterThan(4);
  });

  it('efeito pontual de evento continua caindo no primário', () => {
    const state = newGame();
    const primario = state.economy.primaryBalance;
    const lucro = monthlyFiscalResult(state);

    applyImpacts(state, { primaryBalance: 10 }, 1);

    expect(state.economy.primaryBalance).toBeCloseTo(primario + 10, 6);
    expect(monthlyFiscalResult(state)).toBeCloseTo(lucro, 6);
  });

  it('reverter a medida tira o ganho sem criar rombo fantasma', () => {
    const state = newGame();
    applyImpacts(state, { primaryBalance: 60 }, 1, 'recorrente');
    applyImpacts(state, { primaryBalance: 60 }, -1.5, 'recorrente');
    expect(state.economy.recurringFiscalGain).toBe(0);
  });

  it('aumento de imposto aprovado passa a render todo mês para o caixa', () => {
    const state = newGame();
    const texto = 'Aumentar o imposto de renda de quem ganha acima de 50 mil por mês';
    const analysis = interpretLocally(texto, state);
    expect(analysis.impacts.primaryBalance ?? 0).toBeGreaterThan(0);

    const rng = new Rng(state.seed, state.rngCursor);
    const policy = createPolicy(analysis, texto, state, rng, false);
    state.rngCursor = rng.cursor;
    policy.status = 'aprovada';
    policy.stage = 'sancao';
    state.policies.push(policy);

    const depois = tickMonth(state).state;
    expect(depois.economy.recurringFiscalGain ?? 0).toBeGreaterThan(0);
    expect(monthlyTreasuryInflow(depois)).toBeGreaterThan(1);
  });
});
