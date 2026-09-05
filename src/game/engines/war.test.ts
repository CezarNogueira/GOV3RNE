import { describe, expect, it } from 'vitest';
import {
  createGame,
  declareWar,
  deserialize,
  finishWar,
  migrate,
  negotiatePeace,
  processWar,
  runRegimeAction,
  serialize,
  tickMonth,
  warForecast,
  type GameState,
} from './index';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * GUERRA
 *
 * A guerra tem de doer no mesmo lugar em que o resto do jogo dói: no caixa, no
 * preço, na diplomacia e na paciência da população. Estes testes verificam que
 * ela não é um rótulo — e que ela acaba, de um jeito ou de outro.
 */
function newGame(seed = 555): GameState {
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

const firstCountry = (state: GameState) => state.diplomacy.countries[0]!;

describe('declaração de guerra', () => {
  it('avisa a conta antes, com os números daquele país', () => {
    const state = newGame();
    const country = firstCountry(state);
    const forecast = warForecast(state, country.id)!;

    expect(forecast.country.id).toBe(country.id);
    expect(forecast.monthlyCost).toBeGreaterThan(0);
    expect(forecast.riskDelta).toBeGreaterThan(0);
    expect(warForecast(state, 'pais_que_nao_existe')).toBeNull();
  });

  it('muda economia, diplomacia e militares no mesmo dia', () => {
    const state = newGame();
    const country = firstCountry(state);
    const riscoAntes = state.economy.countryRisk;
    const comercioAntes = country.trade;

    const outcome = declareWar(state, country.id, new Rng(1, 0));

    expect(outcome.ok).toBe(true);
    expect(state.war.status).toBe('guerra');
    expect(state.war.countryId).toBe(country.id);
    expect(state.war.warSupport).toBeGreaterThan(40);
    expect(state.economy.countryRisk).toBeGreaterThan(riscoAntes);
    expect(state.diplomacy.countries[0]!.trade).toBeLessThan(comercioAntes);
    expect(state.regime.mobilization).not.toBe('normal');
    expect(state.regime.militaryInfluence).toBeGreaterThan(34);
    expect(state.regime.milestones.some((entry) => entry.title.includes('Guerra'))).toBe(true);
  });

  it('cobra do Planalto a conta política de declarar sem conflito prévio', () => {
    const calmo = newGame();
    const alvoCalmo = firstCountry(calmo);
    alvoCalmo.tension = 10;
    const boaVontadeAntes = calmo.congress.goodwill;
    const impeachmentAntes = calmo.congress.impeachmentRisk;

    declareWar(calmo, alvoCalmo.id, new Rng(3, 0));

    // A narrativa sempre disse que o Congresso foi avisado depois do anúncio.
    // Agora ele responde a isso: guerra sem crise prévia é guerra de agressão,
    // e a Casa cobra por ela.
    expect(calmo.congress.goodwill).toBeLessThan(boaVontadeAntes);
    expect(calmo.congress.impeachmentRisk).toBeGreaterThan(impeachmentAntes);

    // Já um conflito que vinha fervendo custa bem menos na Casa.
    const fervendo = newGame();
    const alvoQuente = firstCountry(fervendo);
    alvoQuente.tension = 90;
    const boaVontadeQuente = fervendo.congress.goodwill;
    declareWar(fervendo, alvoQuente.id, new Rng(3, 0));

    expect(boaVontadeQuente - fervendo.congress.goodwill).toBeLessThan(
      boaVontadeAntes - calmo.congress.goodwill,
    );
  });

  it('recusa uma segunda frente', () => {
    const state = newGame();
    declareWar(state, firstCountry(state).id, new Rng(2, 0));
    const segunda = declareWar(state, state.diplomacy.countries[1]!.id, new Rng(3, 0));
    expect(segunda.ok).toBe(false);
  });
});

describe('a guerra ao longo dos meses', () => {
  it('gasta caixa, cansa a população e pressiona a dívida', () => {
    const state = newGame();
    declareWar(state, firstCountry(state).id, new Rng(4, 0));

    const caixaAntes = state.economy.treasuryCash;
    const apoioInicial = state.war.warSupport;
    const dividaAntes = state.economy.debtToGdp;

    for (let index = 0; index < 6; index += 1) {
      state.month += 1;
      processWar(state, new Rng(10 + index, index));
    }

    expect(state.economy.treasuryCash).toBeLessThan(caixaAntes);
    expect(state.war.totalCost).toBeGreaterThan(0);
    expect(state.war.warExhaustion).toBeGreaterThan(10);
    expect(state.war.warSupport).toBeLessThan(apoioInicial);
    expect(state.war.casualties).toBeGreaterThan(0);
    expect(state.economy.debtToGdp).toBeGreaterThan(dividaAntes);
  });

  it('encarece com o tempo, em vez de cobrar sempre a mesma parcela', () => {
    const state = newGame();
    declareWar(state, firstCountry(state).id, new Rng(4, 0));
    const parcelaInicial = state.war.monthlyCost;

    for (let index = 0; index < 8; index += 1) {
      state.month += 1;
      processWar(state, new Rng(10 + index, index));
    }

    // Reposição de equipamento e linha mais longa: o oitavo mês custa mais que
    // o primeiro. Se a conta fosse fixa, continuar a guerra nunca ficaria mais
    // difícil do que começá-la.
    expect(state.war.monthlyCost).toBeGreaterThan(parcelaInicial * 1.15);
  });

  it('perde apoio do mundo quando o regime fecha durante o conflito', () => {
    const aberto = newGame();
    declareWar(aberto, firstCountry(aberto).id, new Rng(4, 0));

    const fechado = deserialize(serialize(aberto)).state!;
    fechado.regime.regime = 'ditadura';
    fechado.regime.repression = 'severa';

    for (let index = 0; index < 5; index += 1) {
      aberto.month += 1;
      fechado.month += 1;
      processWar(aberto, new Rng(10 + index, index));
      processWar(fechado, new Rng(10 + index, index));
    }

    // Mesma guerra, mesmo adversário, mesma sorte: o que separa os dois é quem
    // está dando o tiro. Apoio internacional deixou de ser um número congelado
    // no dia da declaração e só mexido por missão diplomática.
    expect(fechado.war.internationalSupport).toBeLessThan(aberto.war.internationalSupport);
  });

  it('termina, de um jeito ou de outro', () => {
    let state = newGame();
    declareWar(state, firstCountry(state).id, new Rng(5, 0));

    for (let index = 0; index < 40 && state.war.status === 'guerra' && !state.flags.gameOver; index += 1) {
      state = tickMonth(state).state;
    }

    if (state.war.status !== 'guerra') {
      expect(state.war.endedMonth).toBeDefined();
      expect(state.regime.mobilization).toBe('normal');
    }
    expect(['vitoria', 'derrota', 'armisticio', 'guerra']).toContain(state.war.status);
  });

  it('aceitar a paz encerra o conflito e devolve comércio', () => {
    const state = newGame();
    declareWar(state, firstCountry(state).id, new Rng(6, 0));
    state.war.peaceOffer = { month: state.month, terms: 'equilibrada' };
    const comercioNaGuerra = state.diplomacy.countries[0]!.trade;

    const outcome = negotiatePeace(state, true, new Rng(7, 0));

    expect(outcome.ok).toBe(true);
    expect(state.war.status).toBe('armisticio');
    expect(state.diplomacy.countries[0]!.trade).toBeGreaterThan(comercioNaGuerra);
  });

  it('derrota derruba a lealdade militar e alimenta o impeachment', () => {
    const state = newGame();
    declareWar(state, firstCountry(state).id, new Rng(8, 0));
    const lealdadeAntes = state.regime.militaryLoyalty;
    const riscoAntes = state.congress.impeachmentRisk;

    finishWar(state, 'derrota', 'A frente cedeu.');

    expect(state.regime.militaryLoyalty).toBeLessThan(lealdadeAntes);
    expect(state.congress.impeachmentRisk).toBeGreaterThan(riscoAntes);
  });
});

describe('integração', () => {
  it('declara e negocia pelo mesmo ponto de entrada das outras ações', () => {
    const state = newGame();
    const country = firstCountry(state);

    const declarada = runRegimeAction(state, { kind: 'declarar_guerra', countryId: country.id }, new Rng(9, 0));
    expect(declarada.ok).toBe(true);
    expect(state.war.status).toBe('guerra');

    const aliados = runRegimeAction(state, { kind: 'buscar_aliados' }, new Rng(11, 0));
    expect(aliados.ok).toBe(true);
  });

  it('mantém regime e guerra no save, e reconstrói save antigo', () => {
    const state = newGame();
    declareWar(state, firstCountry(state).id, new Rng(12, 0));
    state.regime.repression = 'rigorosa';

    const loaded = deserialize(serialize(state));
    expect(loaded.ok).toBe(true);
    expect(loaded.state!.war.status).toBe('guerra');
    expect(loaded.state!.regime.repression).toBe('rigorosa');

    const antigo = newGame() as GameState & { regime?: unknown; war?: unknown };
    delete antigo.regime;
    delete antigo.war;
    const migrado = migrate(antigo as GameState);

    expect(migrado.regime.regime).toBe('democracia');
    expect(migrado.war.status).toBe('paz');
    expect(() => tickMonth(migrado)).not.toThrow();
  });
});
