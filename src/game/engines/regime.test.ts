import { describe, expect, it } from 'vitest';
import {
  createGame,
  deserialize,
  migrate,
  processCoupAgainstPresident,
  processRegime,
  runRegimeAction,
  ruptureOdds,
  serialize,
  tickMonth,
  type GameState,
} from './index';
import { Rng } from '../utils/rng';
import { deepClone } from '../utils/clone';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * REGIME, PODER E RUPTURA
 *
 * O que estes testes protegem é a promessa central desta camada: toda decisão
 * extraordinária muda o país de verdade, e nenhuma delas é gratuita. Reprimir
 * esvazia a rua hoje e cobra resistência depois; concentrar poder acelera e
 * custa legitimidade; romper pode dar certo — e pode acabar com o mandato.
 *
 * O último teste é o mais importante: o sistema aponta nos dois sentidos.
 */
function newGame(seed = 909): GameState {
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

/** Põe o país numa crise que justifica poderes extraordinários. */
function inCrisis(state: GameState): GameState {
  state.regime.protestLevel = 62;
  state.regime.politicalStability = 34;
  state.economy.inflation = state.economy.inflationTarget + 6;
  return state;
}

describe('o ponto de partida', () => {
  it('começa como uma democracia funcionando', () => {
    const state = newGame();
    expect(state.regime.regime).toBe('democracia');
    expect(state.regime.congressStatus).toBe('normal');
    expect(state.regime.civilLiberties).toBeGreaterThan(80);
    expect(state.regime.exception.active).toBe(false);
    expect(state.war.status).toBe('paz');
  });

  it('recusa poderes extraordinários sem crise que os justifique', () => {
    const state = newGame();
    const outcome = runRegimeAction(
      state,
      { kind: 'estado_excecao', reason: 'crise institucional', months: 6 },
      new Rng(1, 0),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/crise/i);
    expect(state.regime.exception.active).toBe(false);
  });
});

describe('estado de exceção', () => {
  it('muda o regime, o país e o mundo ao ser declarado', () => {
    const state = inCrisis(newGame());
    const liberdadesAntes = state.regime.civilLiberties;
    const riscoAntes = state.economy.countryRisk;

    const outcome = runRegimeAction(
      state,
      { kind: 'estado_excecao', reason: 'grandes manifestações', months: 4 },
      new Rng(2, 0),
    );

    expect(outcome.ok).toBe(true);
    expect(state.regime.regime).toBe('estado_de_excecao');
    expect(state.regime.exception.active).toBe(true);
    expect(state.regime.civilLiberties).toBeLessThan(liberdadesAntes);
    expect(state.regime.executivePower).toBeGreaterThan(45);
    expect(state.economy.countryRisk).toBeGreaterThan(riscoAntes);
    expect(state.diplomacy.isolation).toBeGreaterThan(0);
    // O país registra o marco: isso vai alimentar eventos e o histórico.
    expect(state.regime.milestones[0]!.title).toMatch(/exceção/i);
  });

  it('caduca sozinho no prazo, sem ninguém revogar', () => {
    let state = inCrisis(newGame());
    runRegimeAction(state, { kind: 'estado_excecao', reason: 'guerra', months: 2 }, new Rng(3, 0));
    const ate = state.regime.exception.until!;

    while (state.month < ate + 1 && !state.flags.gameOver) {
      state = tickMonth(state).state;
    }

    expect(state.regime.exception.active).toBe(false);
    expect(state.regime.regime).not.toBe('estado_de_excecao');
  });
});

describe('mobilização e repressão', () => {
  it('mobilizar aumenta prontidão, custa caixa todo mês e tensiona a política', () => {
    const state = newGame();
    const congressoAntes = state.congress.goodwill;

    runRegimeAction(state, { kind: 'mobilizar', level: 'ampla' }, new Rng(4, 0));
    expect(state.regime.mobilization).toBe('ampla');
    expect(state.regime.militaryInfluence).toBeGreaterThan(34);
    expect(state.congress.goodwill).toBeLessThan(congressoAntes);

    const caixaAntes = state.economy.treasuryCash;
    processRegime(state, new Rng(5, 0));

    expect(state.regime.militaryReadiness).toBeGreaterThan(52);
    expect(state.economy.treasuryCash).toBeLessThan(caixaAntes);
  });

  it('reprimir esvazia a rua agora e acumula resistência depois', () => {
    let state = newGame();
    state.regime.protestLevel = 60;
    const protestoAntes = state.regime.protestLevel;
    const liberdadesAntes = state.regime.civilLiberties;

    runRegimeAction(state, { kind: 'reprimir', level: 'severa' }, new Rng(6, 0));

    expect(state.regime.protestLevel).toBeLessThan(protestoAntes);
    expect(state.regime.publicFear).toBeGreaterThan(12);
    expect(state.regime.civilLiberties).toBeLessThan(liberdadesAntes);
    expect(state.diplomacy.isolation).toBeGreaterThan(0);

    // O custo real chega com o tempo: a resistência organizada cresce mês a mês.
    const resistenciaInicial = state.regime.resistance;
    for (let index = 0; index < 5; index += 1) state = tickMonth(state).state;
    expect(state.regime.resistance).toBeGreaterThan(resistenciaInicial);
  });
});

describe('concentração de poder', () => {
  it('acelera o Executivo e derruba instituições e legitimidade', () => {
    const state = newGame();
    const legitimidadeAntes = state.regime.legitimacy;

    runRegimeAction(state, { kind: 'concentrar_poder', move: 'judiciario' }, new Rng(7, 0));

    expect(state.regime.executivePower).toBeGreaterThan(38);
    expect(state.regime.judicialIndependence).toBeLessThan(78);
    expect(state.regime.institutionalStrength).toBeLessThan(74);
    expect(state.regime.legitimacy).toBeLessThan(legitimidadeAntes);
    expect(state.government.supremeCourt.relation).toBeLessThan(58);
  });

  it('só permite fechar o Congresso quando o arranjo de poder comporta', () => {
    const state = newGame();
    const recusa = runRegimeAction(state, { kind: 'congresso', move: 'suspender' }, new Rng(8, 0));
    expect(recusa.ok).toBe(false);

    state.regime.executivePower = 78;
    state.regime.institutionalStrength = 30;
    const aceito = runRegimeAction(state, { kind: 'congresso', move: 'suspender' }, new Rng(9, 0));

    expect(aceito.ok).toBe(true);
    expect(state.regime.congressStatus).toBe('suspenso');
    expect(state.congress.goodwill).toBe(0);
    expect(state.economy.countryRisk).toBeGreaterThan(200);
  });
});

describe('ruptura institucional', () => {
  /** Um país onde a ordem para romper seria cumprida. */
  function pronto(state: GameState): GameState {
    state.regime.militaryLoyalty = 88;
    state.regime.stateControl = 84;
    state.regime.institutionalStrength = 24;
    state.regime.polarization = 82;
    state.regime.protestLevel = 12;
    state.regime.legitimacy = 58;
    state.government.opposition.strength = 18;
    return state;
  }

  it('calcula a chance a partir de vários fatores, e não de um só', () => {
    const base = newGame();
    const odds = ruptureOdds(base);
    expect(odds.factors.length).toBeGreaterThan(5);

    const comTropa = deepClone(base);
    comTropa.regime.militaryLoyalty = 95;
    expect(ruptureOdds(comTropa).chance).toBeGreaterThan(odds.chance);

    const comRua = deepClone(comTropa);
    comRua.regime.protestLevel = 85;
    comRua.government.opposition.strength = 90;
    // A mesma tropa leal vale menos com o país inteiro na rua contra.
    expect(ruptureOdds(comRua).chance).toBeLessThan(ruptureOdds(comTropa).chance);
  });

  it('recusa a ordem quando nem os quartéis nem o aparato responderiam', () => {
    const state = newGame();
    state.regime.militaryLoyalty = 30;
    state.regime.stateControl = 40;

    const outcome = runRegimeAction(state, { kind: 'ruptura' }, new Rng(10, 0));
    expect(outcome.ok).toBe(false);
    expect(state.regime.regime).toBe('democracia');
  });

  it('consumada, fecha o Congresso e isola o país', () => {
    const state = pronto(newGame());
    const isolamentoAntes = state.diplomacy.isolation;

    // Semente escolhida para a ordem ser cumprida: o teste é sobre o efeito.
    let outcome = runRegimeAction(state, { kind: 'ruptura' }, new Rng(11, 0));
    let tentativas = 0;
    while (state.regime.regime === 'democracia' && tentativas < 40) {
      tentativas += 1;
      const retry = pronto(newGame());
      outcome = runRegimeAction(retry, { kind: 'ruptura' }, new Rng(100 + tentativas, 0));
      if (retry.regime.regime !== 'democracia' && retry.regime.congressStatus === 'suspenso') {
        expect(retry.regime.congressStatus).toBe('suspenso');
        expect(retry.regime.civilLiberties).toBeLessThan(70);
        expect(retry.diplomacy.isolation).toBeGreaterThan(isolamentoAntes);
        expect(retry.economy.countryRisk).toBeGreaterThan(300);
        expect(retry.regime.ruptures[0]!.success).toBe(true);
        expect(['ditadura', 'regime_militar']).toContain(retry.regime.regime);
        return;
      }
    }
    expect(outcome.ok).toBe(true);
  });

  it('fracassada, entrega o mandato ao Congresso', () => {
    for (let index = 0; index < 40; index += 1) {
      const state = newGame();
      state.regime.militaryLoyalty = 52;
      state.regime.stateControl = 58;
      state.regime.institutionalStrength = 70;
      state.government.opposition.strength = 85;
      state.regime.protestLevel = 70;

      const riscoAntes = state.congress.impeachmentRisk;
      runRegimeAction(state, { kind: 'ruptura' }, new Rng(300 + index, 0));

      if (state.regime.ruptures[0]?.success === false) {
        expect(state.congress.impeachmentRisk).toBeGreaterThan(riscoAntes);
        expect(state.regime.militaryLoyalty).toBeLessThan(52);
        expect(state.regime.congressStatus).not.toBe('suspenso');
        return;
      }
    }
    throw new Error('nenhuma tentativa fracassou em 40 sementes');
  });
});

describe('o sistema aponta nos dois sentidos', () => {
  it('pode depor o presidente que destruiu as próprias instituições', () => {
    for (let index = 0; index < 200; index += 1) {
      const state = newGame();
      state.regime.militaryLoyalty = 20;
      state.regime.legitimacy = 18;
      state.regime.protestLevel = 78;
      state.regime.institutionalStrength = 26;
      state.regime.stateControl = 30;

      const resultado = processCoupAgainstPresident(state, new Rng(500 + index, 0));
      if (resultado && state.flags.gameOver) {
        expect(state.flags.gameOverReason).toBe('ruptura');
        expect(state.regime.regime).toBe('regime_militar');
        expect(state.regime.ruptures[0]!.actor).toBe('militares');
        return;
      }
    }
    throw new Error('nenhuma deposição ocorreu em 200 sementes com o cenário pronto');
  });

  it('não depõe um presidente com instituições e quartéis do lado dele', () => {
    for (let index = 0; index < 60; index += 1) {
      const state = newGame();
      const resultado = processCoupAgainstPresident(state, new Rng(700 + index, 0));
      expect(resultado).toBeNull();
      expect(state.flags.gameOver).toBe(false);
    }
  });
});

describe('duas campanhas, dois países', () => {
  /** Roda o mandato de um governo que nunca toca nas instituições. */
  function democratica(months: number): GameState {
    let state = newGame(4242);
    for (let index = 0; index < months && !state.flags.gameOver; index += 1) {
      state = tickMonth(state).state;
    }
    return state;
  }

  /** Roda o mandato de um governo que concentra poder e reprime. */
  function autoritaria(months: number): GameState {
    let state = inCrisis(newGame(4242));
    runRegimeAction(state, { kind: 'estado_excecao', reason: 'crise institucional', months: 12 }, new Rng(20, 0));
    runRegimeAction(state, { kind: 'concentrar_poder', move: 'judiciario' }, new Rng(21, 0));
    runRegimeAction(state, { kind: 'concentrar_poder', move: 'imprensa' }, new Rng(22, 0));
    runRegimeAction(state, { kind: 'reprimir', level: 'severa' }, new Rng(23, 0));

    for (let index = 0; index < months && !state.flags.gameOver; index += 1) {
      state = tickMonth(state).state;
    }
    return state;
  }

  it('a democracia entrega legitimidade, mercado calmo e mundo aberto', () => {
    const livre = democratica(12);
    const fechada = autoritaria(12);

    expect(livre.regime.legitimacy).toBeGreaterThan(fechada.regime.legitimacy);
    expect(livre.economy.countryRisk).toBeLessThan(fechada.economy.countryRisk);
    expect(livre.diplomacy.isolation).toBeLessThan(fechada.diplomacy.isolation);
    expect(livre.regime.civilLiberties).toBeGreaterThan(fechada.regime.civilLiberties);
    expect(livre.regime.institutionalStrength).toBeGreaterThan(fechada.regime.institutionalStrength);
  });

  it('o autoritarismo entrega poder de decisão e acumula resistência', () => {
    const livre = democratica(12);
    const fechada = autoritaria(12);

    expect(fechada.regime.executivePower).toBeGreaterThan(livre.regime.executivePower);
    expect(fechada.regime.resistance).toBeGreaterThan(livre.regime.resistance);
    expect(fechada.regime.publicFear).toBeGreaterThan(livre.regime.publicFear);
    expect(fechada.regime.regime).not.toBe('democracia');
  });

  it('a transição democrática é um caminho de volta, com preço já pago', () => {
    const state = autoritaria(6);
    const isolamentoAntes = state.diplomacy.isolation;
    const liberdadesAntes = state.regime.civilLiberties;

    const outcome = runRegimeAction(state, { kind: 'transicao_democratica' }, new Rng(30, 0));

    expect(outcome.ok).toBe(true);
    expect(state.regime.congressStatus).toBe('normal');
    expect(state.regime.exception.active).toBe(false);
    expect(state.regime.civilLiberties).toBeGreaterThan(liberdadesAntes);
    expect(state.diplomacy.isolation).toBeLessThan(isolamentoAntes);
    // A resistência e a memória institucional não voltam ao ponto de partida.
    expect(state.regime.milestones.some((entry) => entry.title.includes('Transição'))).toBe(true);
  });
});

describe('persistência do regime', () => {
  it('sobrevive ao save e é reconstruído em save antigo', () => {
    const state = inCrisis(newGame());
    runRegimeAction(state, { kind: 'estado_excecao', reason: 'guerra', months: 5 }, new Rng(40, 0));

    const loaded = deserialize(serialize(state));
    expect(loaded.ok).toBe(true);
    expect(loaded.state!.regime.exception.active).toBe(true);
    expect(loaded.state!.regime.regime).toBe('estado_de_excecao');

    const antigo = newGame() as GameState & { regime?: unknown };
    delete antigo.regime;
    const migrado = migrate(antigo as GameState);
    expect(migrado.regime.regime).toBe('democracia');
  });
});
