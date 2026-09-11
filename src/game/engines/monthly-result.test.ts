import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import { monthlyFiscalResult, monthlyProgramSpend } from './economy';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import type { GameState } from '../types/index';

/**
 * O LUCRO MENSAL DO PAINEL
 *
 * O card do Painel e o motor econômico leem a MESMA função. Estes testes
 * garantem que a conta é a do motor — arrecadação do mês menos despesa
 * obrigatória do mês menos programas e medidas — e que mexer num programa
 * aparece no número na hora.
 */
function newGame(): GameState {
  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', homeCity: 'Recife', occupation: 'medico',
        education: 'medicina', religion: 'catolico', traits: [], habits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet: defaultCabinet(MINISTRY_IDS),
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, reelection: true, seed: 11,
    }),
  );
}

describe('lucro mensal', () => {
  it('é a arrecadação do mês menos a despesa do mês e o custeio de programas e medidas', () => {
    const state = newGame();
    const { revenue, spending } = state.economy;

    expect(monthlyFiscalResult(state)).toBeCloseTo(
      revenue / 12 - spending / 12 - monthlyProgramSpend(state),
      6,
    );
    expect(Number.isFinite(monthlyFiscalResult(state))).toBe(true);
  });

  it('encerrar um programa devolve o custeio dele ao lucro do mês', () => {
    const state = newGame();
    const antes = monthlyFiscalResult(state);
    const programa = state.programs.find((entry) => entry.active)!;

    programa.active = false;

    expect(monthlyFiscalResult(state)).toBeCloseTo(antes + programa.monthlyCost, 6);
  });
});
