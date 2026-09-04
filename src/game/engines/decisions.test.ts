import { describe, expect, it } from 'vitest';
import {
  createGame,
  recordDecision,
  summarizeDecision,
  takeSnapshot,
  type GameState,
} from './index';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * A DEVOLUTIVA DE CADA DECISÃO
 *
 * O contrato deste módulo é simples e severo: o que ele mostra tem de ter
 * acontecido no estado da partida, e o que aconteceu não pode ficar escondido.
 * Nada aqui é escrito à mão — tudo é diferença entre duas fotografias.
 */
function newGame(seed = 4242): GameState {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = MINISTER_POOL[index % MINISTER_POOL.length]!.id;
  });

  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', homeCity: 'Recife', occupation: 'medico',
        education: 'medicina', religion: 'catolico', traits: [], habits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet,
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, reelection: true, seed,
    }),
  );
}

describe('medir antes e depois', () => {
  it('mostra o que mudou e ignora o que ficou parado', () => {
    const state = newGame();
    const before = takeSnapshot(state);

    state.economy.treasuryCash -= 12;
    state.approval.overall += 1.4;

    const entry = recordDecision(state, before, {
      kind: 'empresa',
      title: 'Socorro aos Correios',
      choice: 'Atendido integralmente',
      message: 'O governo bancou.',
    });

    const caixa = entry.deltas.find((delta) => delta.label === 'Caixa do Tesouro')!;
    expect(caixa.delta).toBeCloseTo(-12, 3);
    expect(caixa.tone).toBe('neg');

    const aprovacao = entry.deltas.find((delta) => delta.label === 'Aprovação do governo')!;
    expect(aprovacao.tone).toBe('pos');

    // Nada mais se moveu, então nada mais aparece.
    expect(entry.deltas).toHaveLength(2);
  });

  it('sabe que cair é bom em inflação e ruim em aprovação', () => {
    const state = newGame();
    const before = takeSnapshot(state);
    state.economy.inflation -= 0.5;
    state.approval.overall -= 2;

    const entry = recordDecision(state, before, {
      kind: 'medida',
      title: 'Ajuste',
      choice: 'Assinada',
      message: '',
    });

    expect(entry.deltas.find((d) => d.label === 'Inflação')!.tone).toBe('pos');
    expect(entry.deltas.find((d) => d.label === 'Aprovação do governo')!.tone).toBe('neg');
  });

  it('registra quem gostou e quem não gostou', () => {
    const state = newGame();
    const before = takeSnapshot(state);

    state.socialGroups.find((group) => group.id === 'empresariado')!.approval += 4;
    state.socialGroups.find((group) => group.id === 'trabalhadores')!.approval -= 3;

    const entry = recordDecision(state, before, {
      kind: 'medida',
      title: 'Desoneração da folha',
      choice: 'Assinada',
      message: '',
    });

    expect(entry.groups.find((group) => group.groupId === 'empresariado')!.delta).toBeCloseTo(4, 1);
    expect(entry.groups.find((group) => group.groupId === 'trabalhadores')!.delta).toBeCloseTo(-3, 1);
  });

  it('diz com todas as letras quando não houve efeito imediato', () => {
    const state = newGame();
    const entry = recordDecision(state, takeSnapshot(state), {
      kind: 'agenda',
      title: 'Reunião de gabinete',
      choice: 'Realizada',
      message: '',
    });

    expect(entry.deltas).toHaveLength(0);
    expect(summarizeDecision(entry)).toContain('próximos meses');
  });

  it('guarda a decisão no histórico da partida, da mais nova para a mais antiga', () => {
    const state = newGame();
    recordDecision(state, takeSnapshot(state), {
      kind: 'agenda', title: 'Primeira', choice: 'x', message: '',
    });
    recordDecision(state, takeSnapshot(state), {
      kind: 'agenda', title: 'Segunda', choice: 'x', message: '',
    });

    expect(state.decisions).toHaveLength(2);
    expect(state.decisions[0]!.title).toBe('Segunda');
  });
});
