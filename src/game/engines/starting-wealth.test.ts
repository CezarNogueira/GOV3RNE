import { describe, expect, it } from 'vitest';
import { STARTING_WEALTH_BY_OCCUPATION, createGame, startingPersonalWealth } from './index';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * DINHEIRO NA CONTA PESSOAL NA POSSE
 *
 * O presidente começa com o que juntou na carreira anterior. A base vale para
 * quem tem 35 anos, a idade mínima para a Presidência; cada ano a mais soma 1%.
 */
function input(occupation: string, age: number) {
  return newGameSchema.parse({
    president: {
      firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age,
      gender: 'feminino', homeState: 'PE', occupation,
      religion: 'catolico', traits: [], avatar: DEFAULT_AVATAR,
    },
    partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet: defaultCabinet(MINISTRY_IDS),
    family: { hasSpouse: false, childrenCount: 0 },
    promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
    startYear: 2027, reelection: true, seed: 21,
  });
}

describe('dinheiro inicial por profissão', () => {
  it('cada carreira tem a sua base', () => {
    expect(STARTING_WEALTH_BY_OCCUPATION).toEqual({
      politico_carreira: 120_000,
      militar: 10_000,
      medico: 40_000,
      comunicador: 2_000,
      empresario: 95_000,
      magistrado: 90_000,
      advogado: 90_000,
      professor: 4_000,
      servidor_publico: 4_000,
      sindicalista: 4_000,
      lider_religioso: 4_000,
      produtor_rural: 4_000,
    });
  });

  it('cada ano acima de 35 soma 1% à base', () => {
    expect(startingPersonalWealth('politico_carreira', 35)).toBe(120_000);
    expect(startingPersonalWealth('politico_carreira', 36)).toBe(121_200);
    expect(startingPersonalWealth('politico_carreira', 56)).toBe(145_200);
    expect(startingPersonalWealth('professor', 60)).toBe(5_000);
    expect(startingPersonalWealth('comunicador', 85)).toBe(3_000);
  });

  it('a partida nasce com esse valor na conta pessoal', () => {
    expect(createGame(input('medico', 54)).president.personalWealth).toBe(47_600);
    expect(createGame(input('empresario', 70)).president.personalWealth).toBe(128_250);
  });
});

describe('ficha do candidato', () => {
  it('não tem mais cidade natal, formação nem hábitos', () => {
    const president = createGame(input('militar', 40)).president;
    expect(president).not.toHaveProperty('homeCity');
    expect(president).not.toHaveProperty('education');
    expect(president).not.toHaveProperty('habits');
  });
});
