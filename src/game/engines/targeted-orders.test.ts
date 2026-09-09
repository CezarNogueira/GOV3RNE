import { describe, expect, it } from 'vitest';
import {
  createGame,
  regimeActionAvailable,
  runRegimeAction,
  tickMonth,
  type GameState,
} from './index';
import { defaultCabinet } from '../data/people';
import { MINISTRY_IDS } from '../data/ministries';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * ORDENS DIRIGIDAS
 *
 * Depois da ruptura o Estado passa a poder escolher o alvo com nome: perseguir
 * um grupo social inteiro, cassar um ministro, depor um governador. Sao ordens
 * irreversiveis, e o jogo cobra por elas na moeda certa -- legitimidade,
 * liberdades, resistencia e isolamento.
 */
function newGame(seed = 4242): GameState {
  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Cezar', lastName: 'Nogueira', politicalName: 'Cezar Nogueira', age: 40,
        gender: 'masculino', homeState: 'SP', homeCity: 'Sao Paulo', occupation: 'empresario',
        education: 'administracao', religion: 'sem_religiao', traits: [], habits: [],
        avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida',
      cabinet: defaultCabinet(MINISTRY_IDS),
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, reelection: true, seed,
    }),
  );
}

function ditadura(state: GameState): void {
  state.regime.regime = 'ditadura';
  state.regime.congressStatus = 'suspenso';
}

describe('a democracia nao assina essas ordens', () => {
  it('recusa enquanto o pais e democracia, e nao cobra meio preco', () => {
    const state = newGame();

    for (const kind of ['perseguir_grupo', 'neutralizar_figura'] as const) {
      const permitido = regimeActionAvailable(state, kind);
      expect(permitido.ok, kind).toBe(false);
      expect(permitido.reason).toBeTruthy();
    }

    const tentativa = runRegimeAction(
      state, { kind: 'perseguir_grupo', groupId: 'universitarios' }, new Rng(1, 0),
    );
    expect(tentativa.ok).toBe(false);
    expect(
      state.socialGroups.find((grupo) => grupo.id === 'universitarios')!.mobilization,
    ).toBeGreaterThan(0);
  });
});

describe('perseguir um grupo', () => {
  it('cala o grupo e cobra caro no resto', () => {
    const state = newGame();
    ditadura(state);

    const antes = {
      liberdades: state.regime.civilLiberties,
      legitimidade: state.regime.legitimacy,
      resistencia: state.regime.resistance,
      isolamento: state.diplomacy.isolation,
    };

    const outcome = runRegimeAction(
      state, { kind: 'perseguir_grupo', groupId: 'universitarios' }, new Rng(1, 0),
    );
    expect(outcome.ok).toBe(true);

    const alvo = state.socialGroups.find((grupo) => grupo.id === 'universitarios')!;
    expect(alvo.mobilization).toBeLessThan(5);
    expect(alvo.approval).toBeLessThan(30);

    // O preco nao e da conta do grupo: e da conta do regime.
    expect(state.regime.civilLiberties).toBeLessThan(antes.liberdades);
    expect(state.regime.legitimacy).toBeLessThan(antes.legitimidade);
    expect(state.diplomacy.isolation).toBeGreaterThan(antes.isolamento);
    // Resistencia sobe em todo mundo, nao so em quem foi perseguido: quem
    // assistiu entendeu que pode ser o proximo.
    expect(state.regime.resistance).toBeGreaterThan(antes.resistencia + 8);
  });

  it('registra a perseguicao no historico institucional', () => {
    const state = newGame();
    ditadura(state);
    runRegimeAction(state, { kind: 'perseguir_grupo', groupId: 'indigenas' }, new Rng(2, 0));

    expect(state.regime.milestones[0]!.title).toContain('Persegui');
  });
});

describe('afastar uma figura', () => {
  it('tira o ministro do gabinete e deixa a pasta vaga', () => {
    const state = newGame();
    ditadura(state);

    const ministro = state.government.ministers[3]!;
    const antes = state.government.ministers.length;

    const outcome = runRegimeAction(
      state, { kind: 'neutralizar_figura', targetKind: 'ministro', targetId: ministro.id }, new Rng(3, 0),
    );
    expect(outcome.ok).toBe(true);

    // Sai do tabuleiro e nao e substituido sozinho: quem mandou prender herdou
    // o trabalho ate nomear outro.
    expect(state.government.ministers).toHaveLength(antes - 1);
    expect(state.government.ministers.some((entry) => entry.id === ministro.id)).toBe(false);
    expect(
      state.government.ministers.some((entry) => entry.ministryId === ministro.ministryId),
    ).toBe(false);
  });

  it('poe o estado sob intervencao e assusta os outros governadores', () => {
    const state = newGame();
    ditadura(state);

    const unidade = state.states[5]!;
    const anterior = unidade.governorName;

    const outcome = runRegimeAction(
      state, { kind: 'neutralizar_figura', targetKind: 'governador', targetId: unidade.id }, new Rng(4, 0),
    );
    expect(outcome.ok).toBe(true);

    const depois = state.states.find((entry) => entry.id === unidade.id)!;
    expect(depois.governorName).not.toBe(anterior);
    expect(depois.governorParty).toBe('intervenção');

    const outros = state.states.filter((entry) => entry.id !== unidade.id);
    expect(outros.every((entry) => entry.governorRelation < 92)).toBe(true);
  });

  it('concorda o texto com quem foi afastado', () => {
    const state = newGame();
    ditadura(state);

    const feminina = state.government.ministers.find((entry) =>
      /^(Delegada|Professora|Embaixadora)/.test(entry.name),
    );
    if (!feminina) return;

    const outcome = runRegimeAction(
      state, { kind: 'neutralizar_figura', targetKind: 'ministro', targetId: feminina.id }, new Rng(5, 0),
    );
    expect(outcome.message).toContain('cassada');
  });
});

describe('a conta chega depois', () => {
  it('deixa o regime mais fragil, e nao mais seguro', () => {
    let comOrdens = newGame(77);
    let semOrdens = newGame(77);
    ditadura(comOrdens);
    ditadura(semOrdens);

    runRegimeAction(comOrdens, { kind: 'perseguir_grupo', groupId: 'trabalhadores' }, new Rng(6, 0));
    runRegimeAction(
      comOrdens,
      { kind: 'neutralizar_figura', targetKind: 'governador', targetId: comOrdens.states[2]!.id },
      new Rng(7, 0),
    );

    for (let index = 0; index < 8; index += 1) {
      comOrdens = tickMonth(comOrdens).state;
      semOrdens = tickMonth(semOrdens).state;
    }

    // Silenciar quem reclama nao compra estabilidade: compra resistencia.
    expect(comOrdens.regime.resistance).toBeGreaterThan(semOrdens.regime.resistance);
    expect(comOrdens.regime.legitimacy).toBeLessThan(semOrdens.regime.legitimacy);
    expect(comOrdens.diplomacy.isolation).toBeGreaterThan(semOrdens.diplomacy.isolation);
  });
});
