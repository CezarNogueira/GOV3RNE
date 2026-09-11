import { describe, expect, it } from 'vitest';
import {
  congressDissolved,
  createGame,
  createPolicy,
  interpretLocally,
  runAgendaAction,
  tickMonth,
  type GameState,
} from './index';
import { defaultCabinet } from '../data/people';
import { MINISTRY_IDS } from '../data/ministries';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * GOVERNAR SEM CONGRESSO
 *
 * Fechado o Congresso, a casa nao fica "enfraquecida": ela deixa de existir
 * para efeito de jogo. Nao ha tramitacao, nao ha quorum, nao ha votacao e nao
 * ha impeachment -- o que o presidente assina vale porque ele assinou.
 *
 * Estes testes cobram as duas pontas: que nada continue passando pelo Congresso
 * depois que ele fecha, e que o risco de queda nao suma junto (ele so muda de
 * endereco: vai para o quartel).
 */
function newGame(seed = 4242): GameState {
  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Cezar', lastName: 'Nogueira', politicalName: 'Cezar Nogueira', age: 40,
        gender: 'masculino', homeState: 'SP', occupation: 'empresario',
        religion: 'sem_religiao', traits: [], 
        avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida',
      cabinet: defaultCabinet(MINISTRY_IDS),
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      startYear: 2027, reelection: true, seed,
    }),
  );
}

/** Fecha a casa, como fazem a ruptura e a suspensao do Congresso. */
function dissolveCongress(state: GameState): void {
  state.regime.congressStatus = 'suspenso';
  state.regime.regime = 'ditadura';
}

describe('o Congresso deixa de existir', () => {
  it('reconhece a casa fechada num lugar so', () => {
    const state = newGame();
    expect(congressDissolved(state)).toBe(false);

    state.regime.congressStatus = 'enfraquecido';
    // Enfraquecido ainda e Congresso: continua votando, continua podendo negar.
    expect(congressDissolved(state)).toBe(false);

    dissolveCongress(state);
    expect(congressDissolved(state)).toBe(true);
  });

  it('poe medida nova em vigor pela assinatura, sem tramitar', () => {
    const state = newGame();
    dissolveCongress(state);

    const texto = 'Reforma do imposto de renda com nova tabela progressiva';
    const policy = createPolicy(
      interpretLocally(texto, state), texto, state, new Rng(2, 0), false,
    );

    // Projeto de lei e o instrumento que mais depende do Congresso. Sem casa,
    // nem ele tramita.
    expect(policy.status).not.toBe('tramitando');
    expect(policy.requiresCongress).toBe(false);
  });

  it('resolve o que ja estava na fila quando a casa fecha', () => {
    let state = newGame(31);

    const texto = 'Reforma do imposto de renda com nova tabela progressiva';
    const policy = createPolicy(
      interpretLocally(texto, state), texto, state, new Rng(3, 0), false,
    );
    state.policies = [{ ...policy, status: 'tramitando' as const, stage: 'negociacao_camara' as const }, ...state.policies];

    dissolveCongress(state);
    state = tickMonth(state).state;

    const depois = state.policies.find((entry) => entry.id === policy.id)!;
    // Nao pode ficar tramitando para sempre numa casa que nao existe.
    expect(depois.status).not.toBe('tramitando');
    expect(state.policies.some((entry) => entry.status === 'tramitando')).toBe(false);
    expect(depois.measureLog.some((entry) => entry.label === 'Aprovada sem votação')).toBe(true);
  });

  it('encerra o impeachment em andamento', () => {
    let state = newGame(77);
    state.congress.impeachmentStage = 'admitido';
    state.congress.impeachmentRisk = 70;

    dissolveCongress(state);
    state = tickMonth(state).state;

    expect(state.congress.impeachmentStage).toBe('nenhum');
    // O risco cai, mas nao zera: quem derruba presidente sem Congresso e o
    // quartel, e isso continua valendo.
    expect(state.congress.impeachmentRisk).toBeLessThan(70);
    expect(state.congress.impeachmentRisk).toBeGreaterThan(0);
  });

  it('recusa gastar agenda negociando com quem nao existe', () => {
    const state = newGame();
    dissolveCongress(state);

    const outcome = runAgendaAction(state, 'trabalhar_os_votos');
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('Congresso');

    // E a agenda nao e consumida por uma acao que nao aconteceu.
    expect(outcome.state.agenda.points).toBe(state.agenda.points);
  });

  it('volta a exigir votacao quando o Congresso e restaurado', () => {
    const state = newGame();
    dissolveCongress(state);
    expect(congressDissolved(state)).toBe(true);

    state.regime.congressStatus = 'normal';

    const texto = 'Reforma do imposto de renda com nova tabela progressiva';
    const policy = createPolicy(
      interpretLocally(texto, state), texto, state, new Rng(5, 0), false,
    );
    expect(policy.requiresCongress).toBe(true);
    expect(policy.status).toBe('tramitando');
  });
});
