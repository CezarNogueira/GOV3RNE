import { beforeEach, describe, expect, it } from 'vitest';
import { repository } from './repository';
import { newGameSchema } from '../game/schemas/setup';
import { MINISTRY_IDS } from '../game/data/ministries';
import { defaultCabinet } from '../game/data/people';
import { DEFAULT_AVATAR } from '../game/data/avatar';

/**
 * O IMPEACHMENT POR RISCO-PAÍS É O FIM DO SAVE
 *
 * A partida não pode ser retomada: no mês em que o risco chega a 100%, o save
 * sai do armazenamento do navegador e da lista de mandatos. A tela de fim de
 * jogo roda só com o que está em memória.
 */
function input() {
  return newGameSchema.parse({
    president: {
      firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
      gender: 'feminino', homeState: 'PE', occupation: 'medico',
      religion: 'catolico', traits: [], avatar: DEFAULT_AVATAR,
    },
    partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet: defaultCabinet(MINISTRY_IDS),
    family: { hasSpouse: false, childrenCount: 0 },
    promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
    startYear: 2027, reelection: true, seed: 44,
  });
}

function chavesDoSave(id: string): string[] {
  const chaves: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const chave = localStorage.key(index);
    if (chave && chave.includes(id)) chaves.push(chave);
  }
  return chaves;
}

describe('fim do save', () => {
  beforeEach(() => localStorage.clear());

  it('apaga o save do navegador e da lista quando o risco-país chega a 100%', () => {
    const state = repository.create(input());
    expect(repository.list().some((save) => save.id === state.id)).toBe(true);
    expect(chavesDoSave(state.id).length).toBeGreaterThan(0);

    state.economy.countryRisk = 1500;
    const outcome = repository.advance(state.id);

    expect(outcome.gameOver).toBe(true);
    expect(outcome.state.flags.endsSave).toBe(true);
    expect(repository.list().some((save) => save.id === state.id)).toBe(false);
    expect(chavesDoSave(state.id)).toHaveLength(0);
  });

  it('mês comum continua gravando o save normalmente', () => {
    const state = repository.create(input());
    const outcome = repository.advance(state.id);

    expect(outcome.gameOver).toBe(false);
    expect(repository.list().some((save) => save.id === state.id)).toBe(true);
    expect(chavesDoSave(state.id).length).toBeGreaterThan(0);
  });
});
