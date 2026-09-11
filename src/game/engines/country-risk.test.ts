import { describe, expect, it } from 'vitest';
import { createGame, tickMonth, type GameState } from './index';
import {
  COUNTRY_RISK_COLLAPSE_POINTS,
  collapseReasons,
  countryRiskPercent,
  riskPointsToPercent,
} from './country-risk';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * RISCO-PAÍS A 100% É FIM DE JOGO
 *
 * O jogador lê o risco-país em porcentagem. Em 100% — o mercado tratando o
 * calote como certo —, o presidente sofre impeachment, a partida acaba e o
 * save é encerrado.
 */
function newGame(seed = 21): GameState {
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

describe('a escala em porcentagem', () => {
  it('converte pontos-base em porcentagem, com 1.000 pontos valendo 100%', () => {
    expect(COUNTRY_RISK_COLLAPSE_POINTS).toBe(1000);
    expect(countryRiskPercent(0)).toBe(0);
    expect(countryRiskPercent(138)).toBeCloseTo(13.8, 5);
    expect(countryRiskPercent(1000)).toBe(100);
    // O mostrador não passa de 100%.
    expect(countryRiskPercent(1600)).toBe(100);
    // Variação de medida: +22 pontos-base são +2,2 pontos percentuais.
    expect(riskPointsToPercent(22)).toBeCloseTo(2.2, 5);
  });

  it('o Brasil real da posse começa longe do colapso', () => {
    const state = newGame();
    expect(countryRiskPercent(state.economy.countryRisk)).toBeLessThan(20);
    expect(state.flags.endsSave).toBeFalsy();
  });
});

describe('o colapso', () => {
  it('risco-país a 100%: impeachment, fim de jogo e fim do save', () => {
    const state = newGame();
    state.economy.countryRisk = 1500;
    const mes = state.month;

    const { state: depois, gameOver, notes } = tickMonth(state);

    expect(gameOver).toBe(true);
    expect(depois.flags.gameOver).toBe(true);
    expect(depois.flags.gameOverReason).toBe('impeachment');
    expect(depois.flags.gameOverCause).toBe('risco_pais');
    expect(depois.flags.endsSave).toBe(true);
    expect(depois.phase).toBe('encerrado');
    // O relógio para: não existe mês seguinte depois do impeachment.
    expect(depois.month).toBe(mes);
    expect(notes.some((nota) => nota.includes('100%'))).toBe(true);
  });

  it('risco alto, mas abaixo de 100%, não derruba ninguém e avisa o presidente', () => {
    const state = newGame();
    state.economy.countryRisk = 1150;

    const { state: depois, notes } = tickMonth(state);

    expect(depois.economy.countryRisk).toBeLessThan(COUNTRY_RISK_COLLAPSE_POINTS);
    expect(depois.flags.gameOver).toBe(false);
    expect(notes.some((nota) => nota.startsWith('Risco-país em'))).toBe(true);
  });

  it('risco moderado não gera fim de jogo nem aviso', () => {
    const state = newGame();
    state.economy.countryRisk = 400;
    const { state: depois, notes } = tickMonth(state);
    expect(depois.flags.gameOver).toBe(false);
    expect(notes.some((nota) => nota.startsWith('Risco-país em'))).toBe(false);
  });

  it('a explicação aponta o que o jogador fez', () => {
    const state = newGame();
    state.economy.debtToGdp = 118;
    state.economy.fiscalCredibility = 12;
    state.economy.primaryBalance = -420;

    const motivos = collapseReasons(state);
    expect(motivos.length).toBeGreaterThan(0);
    expect(motivos.length).toBeLessThanOrEqual(4);
    expect(motivos.some((motivo) => motivo.includes('dívida'))).toBe(true);
    expect(motivos.some((motivo) => motivo.includes('credibilidade'))).toBe(true);
  });
});
