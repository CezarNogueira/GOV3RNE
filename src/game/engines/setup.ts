import {
  DEBT,
  CURRENCY,
  COMMERCE,
  DEFAULT_START_YEAR,
  GAME_STATE_VERSION,
  GDP_START_RANK,
  HDI,
  INITIAL_SPENDING,
  INITIAL_TAXES,
  INITIAL_TREASURY,
} from '../data/config';
import { INITIAL_RESOURCES, INITIAL_SERVICES, INITIAL_SOCIETY } from '../data/meta';
import { RESOURCE_IDS } from '../types/common';
import type { GameState, NewGameInput } from '../types/state';
import { makeId } from '../utils/id';
import { createSeed, Rng } from '../utils/rng';
import { installPolitics } from './politics';
import { buildTurn } from './turn';

/**
 * Cria uma partida nova nos valores iniciais do enunciado: serviços e grupos em
 * 50, IDH e Comércio em 500, moeda a US$ 0,20, dívida em 80%, 10º no ranking.
 */
export function createGame(input: NewGameInput): GameState {
  const seed = input.seed ?? createSeed();
  const rng = new Rng(seed);
  const now = new Date().toISOString();

  const zeroPressure = {} as GameState['resourcePressure'];
  for (const id of RESOURCE_IDS) zeroPressure[id] = 0;

  const state: GameState = {
    id: makeId('jogo', rng),
    version: GAME_STATE_VERSION,
    createdAt: now,
    updatedAt: now,
    seed,
    rngCursor: 0,
    phase: 'jogando',
    month: 1,
    startYear: input.startYear ?? DEFAULT_START_YEAR,
    president: input.president,

    services: { ...INITIAL_SERVICES },
    resources: { ...INITIAL_RESOURCES },
    resourcePressure: zeroPressure,
    international: {
      gdpRank: GDP_START_RANK,
      hdi: HDI.initial,
      commerce: COMMERCE.initial,
      currencyCents: CURRENCY.initialCents,
      debt: DEBT.initial,
      monthsAboveRival: 0,
      claimedRewards: [],
    },
    economy: {
      treasury: INITIAL_TREASURY,
      taxes: INITIAL_TAXES,
      spending: INITIAL_SPENDING,
      crisisMonthsLeft: 0,
      crisisCount: 0,
      lastBalance: 0,
    },
    society: { ...INITIAL_SOCIETY },

    // Substituído logo abaixo: o turno precisa do estado já montado para sortear.
    turn: undefined as never,
    // Montada logo abaixo, com a eleição de abertura.
    politics: undefined as never,

    flags: { reachedFirst: false, tutorialDone: false },
    defeat: null,
    lastReport: null,
    history: [],
    decisions: [],
  };

  state.turn = buildTurn(state, rng);
  state.rngCursor = rng.cursor;
  installPolitics(state, input.candidacy);
  return state;
}
