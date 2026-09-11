import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import { tickMonth } from './index';
import { eligibleTreaties } from './diplomacy';
import { grossDebt } from './economy';
import { BRASIL_HOJE, INHERITED_TREATIES } from '../data/brasil-hoje';
import { GAME_CALIBRATION } from '../data/calibration';
import {
  MACRO_BASELINE,
  STATE_INCOME,
  STATE_POPULATION,
  STATE_UNEMPLOYMENT,
} from '../data/generated/baseline';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import type { GameState } from '../types/index';

/**
 * A PARTIDA COMEÇA NO BRASIL REAL
 *
 * Não existe mais escolha de dificuldade. Toda partida parte do país como ele
 * está (dados oficiais de 10/09/2026), e este arquivo cobra duas coisas:
 *
 * 1. O PONTO DE PARTIDA. Os números da posse são os reais, sem ajuste — e o
 *    resultado primário tem o sinal certo. A série do Banco Central é NFSP,
 *    em que positivo é déficit, e o jogo chegou a mostrar superávit onde havia
 *    déficit de R$ 89 bi.
 * 2. O EQUILÍBRIO. Não adianta começar certo se o motor puxa o país de volta
 *    para a calibragem antiga. Sem decisão nenhuma do jogador, os indicadores
 *    sociais não podem despencar nem disparar só porque a partida começou.
 */
function newGame(seed = 11): GameState {
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
      startYear: 2027, reelection: true, seed,
    }),
  );
}

function avancar(state: GameState, meses: number): GameState {
  let atual = state;
  for (let index = 0; index < meses; index += 1) atual = tickMonth(atual).state;
  return atual;
}

function media(estados: GameState[], ler: (state: GameState) => number): number {
  return estados.reduce((total, state) => total + ler(state), 0) / estados.length;
}

describe('o ponto de partida é o Brasil real', () => {
  const state = newGame();

  it('a economia da posse é a dos dados oficiais, sem ajuste nenhum', () => {
    const b = MACRO_BASELINE;
    expect(state.economy.selic).toBe(b.selic.value);
    expect(state.economy.inflation).toBe(b.inflation12m.value);
    expect(state.economy.usd).toBe(b.usd.value);
    expect(state.economy.debtToGdp).toBe(b.debtToGdp.value);
    expect(state.economy.unemployment).toBe(b.unemployment.value);
    expect(state.economy.minimumWage).toBe(b.minimumWage.value);
    expect(state.economy.gdpNominal).toBe(b.gdpNominalBillion.value);
    expect(state.economy.reserves).toBe(b.reservesUsdBillion.value);
    expect(state.economy.gdpGrowth).toBe(BRASIL_HOJE.gdpGrowth.value);
    expect(state.economy.ibovespa).toBe(BRASIL_HOJE.ibovespa.value);
  });

  it('o resultado primário tem o sinal certo: o Brasil de 2026 está em déficit', () => {
    // A série do BCB é NFSP (positivo = déficit). O baseline já grava o sinal
    // de resultado, e a partida precisa refletir isso em reais.
    expect(MACRO_BASELINE.primaryBalancePctGdp.value).toBeLessThan(0);
    expect(state.economy.primaryBalance).toBeLessThan(0);
    expect(state.economy.primaryBalance).toBeCloseTo(
      (MACRO_BASELINE.primaryBalancePctGdp.value / 100) * MACRO_BASELINE.gdpNominalBillion.value,
      0,
    );
  });

  it('a dívida bruta em reais é o percentual real aplicado ao PIB real', () => {
    const esperado = (MACRO_BASELINE.debtToGdp.value / 100) * MACRO_BASELINE.gdpNominalBillion.value;
    expect(grossDebt(state)).toBeCloseTo(esperado, 6);
    // Ordem de grandeza do Brasil de 2026: perto de R$ 11 trilhões.
    expect(grossDebt(state)).toBeGreaterThan(9_000);
    expect(grossDebt(state)).toBeLessThan(13_000);
  });

  it('os indicadores sociais da posse são os medidos', () => {
    const hoje = BRASIL_HOJE;
    expect(state.nation.population).toBe(MACRO_BASELINE.population.value);
    expect(state.nation.averageIncome).toBe(hoje.averageIncome.value);
    expect(state.nation.povertyRate).toBe(hoje.povertyRate.value);
    expect(state.nation.gini).toBe(hoje.gini.value);
    expect(state.nation.hdi).toBe(hoje.hdi.value);
    expect(state.nation.lifeExpectancy).toBe(hoje.lifeExpectancy.value);
    expect(state.nation.literacy).toBe(hoje.literacy.value);
    expect(state.nation.homicideRate).toBe(hoje.homicideRate.value);
    expect(state.nation.corruptionPerception).toBe(hoje.corruptionPerception.value);
  });

  it('não existe dificuldade: a calibragem é uma só', () => {
    expect('difficulty' in state.settings).toBe(false);
    expect(state.agenda.maxPoints).toBe(GAME_CALIBRATION.agendaPoints);
    expect(state.economy.treasuryCash).toBe(GAME_CALIBRATION.startingTreasury);
  });

  it('cada estado começa com o desemprego, a renda e a população oficiais dele', () => {
    for (const unit of state.states) {
      expect(unit.population, unit.id).toBe(STATE_POPULATION[unit.id]);
      expect(unit.unemployment, unit.id).toBe(STATE_UNEMPLOYMENT[unit.id]);
      expect(unit.income, unit.id).toBe(STATE_INCOME[unit.id]);
    }
  });

  it('pobreza, violência e IDH dos estados somam o número nacional real', () => {
    const populacao = state.states.reduce((total, unit) => total + unit.population, 0);
    const ponderada = (ler: (unit: GameState['states'][number]) => number) =>
      state.states.reduce((total, unit) => total + ler(unit) * unit.population, 0) / populacao;

    expect(ponderada((unit) => unit.poverty)).toBeCloseTo(BRASIL_HOJE.povertyRate.value, 0);
    expect(ponderada((unit) => unit.crime)).toBeCloseTo(BRASIL_HOJE.homicideRate.value, 0);
    expect(ponderada((unit) => unit.hdi)).toBeCloseTo(BRASIL_HOJE.hdi.value, 1);
  });
});

describe('as relações exteriores de hoje', () => {
  const state = newGame();
  const pais = (id: string) => state.diplomacy.countries.find((country) => country.id === id)!;

  it('os acordos em vigor já vêm assinados, marcados como herdados', () => {
    const herdados = state.diplomacy.treaties.filter((treaty) => treaty.inherited);
    expect(herdados).toHaveLength(INHERITED_TREATIES.length);
    expect(
      herdados.some((treaty) => treaty.countryId === 'uniao_europeia' && treaty.treatyId === 'livre_comercio'),
    ).toBe(true);
    // Herdado não custa caixa nem entra de novo na mesa de negociação.
    expect(herdados.every((treaty) => treaty.monthlyCost === 0)).toBe(true);
    const comUe = eligibleTreaties(state, 'uniao_europeia').map((treaty) => treaty.id);
    expect(comUe).not.toContain('livre_comercio');
  });

  it('EUA e Argentina começam em relação ruim; China e UE, boa', () => {
    // Tarifas da Seção 301 desde julho/2026 e relação rebaixada com Buenos
    // Aires em agosto/2026.
    expect(pais('usa').relation).toBeLessThan(-19);
    expect(pais('argentina').relation).toBeLessThan(-19);
    expect(pais('china').relation).toBeGreaterThan(40);
    expect(pais('uniao_europeia').relation).toBeGreaterThan(40);
  });
});

describe('o país da posse não deriva sozinho', () => {
  // Média de três sementes para o ruído do motor não decidir o teste.
  const inicio = [newGame(3), newGame(11), newGame(29)];
  const umMes = inicio.map((state) => avancar(state, 1));
  const umAno = inicio.map((state) => avancar(state, 12));

  it('no primeiro mês, sem decisão nenhuma, os indicadores sociais quase não se mexem', () => {
    const hoje = BRASIL_HOJE;
    expect(Math.abs(media(umMes, (s) => s.nation.hdi) - hoje.hdi.value)).toBeLessThan(0.01);
    expect(Math.abs(media(umMes, (s) => s.nation.averageIncome) / hoje.averageIncome.value - 1)).toBeLessThan(0.02);
    expect(Math.abs(media(umMes, (s) => s.nation.povertyRate) - hoje.povertyRate.value)).toBeLessThan(1);
    expect(Math.abs(media(umMes, (s) => s.nation.homicideRate) - hoje.homicideRate.value)).toBeLessThan(0.6);
    expect(Math.abs(media(umMes, (s) => s.nation.lifeExpectancy) - hoje.lifeExpectancy.value)).toBeLessThan(0.2);
    expect(Math.abs(media(umMes, (s) => s.economy.ibovespa) / hoje.ibovespa.value - 1)).toBeLessThan(0.06);
  });

  it('em um ano, o país muda pelo que acontece nele, e não por calibragem errada', () => {
    const hoje = BRASIL_HOJE;
    // A economia se move de verdade (juro alto esfria o emprego), então a
    // tolerância aqui é de dinâmica, não de erro: nada de renda caindo 10% ou
    // IDH perdendo meio ponto só por a partida ter começado.
    expect(Math.abs(media(umAno, (s) => s.nation.averageIncome) / hoje.averageIncome.value - 1)).toBeLessThan(0.08);
    expect(Math.abs(media(umAno, (s) => s.nation.hdi) - hoje.hdi.value)).toBeLessThan(0.02);
    expect(Math.abs(media(umAno, (s) => s.nation.povertyRate) - hoje.povertyRate.value)).toBeLessThan(4);
    expect(Math.abs(media(umAno, (s) => s.nation.homicideRate) - hoje.homicideRate.value)).toBeLessThan(3);
    expect(Math.abs(media(umAno, (s) => s.nation.lifeExpectancy) - hoje.lifeExpectancy.value)).toBeLessThan(0.8);
  });
});
