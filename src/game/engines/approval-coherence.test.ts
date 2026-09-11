import { describe, expect, it } from 'vitest';
import { createGame, migrate, nudgeApproval, tickMonth, type GameState } from './index';
import { MINISTER_POOL, defaultCabinet } from '../data/people';
import { MINISTRY_IDS } from '../data/ministries';
import { REGIONS } from '../types/common';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * O MAPA E A MANCHETE PRECISAM SER O MESMO NUMERO
 *
 * A aprovacao nacional saia da media dos grupos sociais; a estadual perseguia a
 * regional, que perseguia a media dos estados. Dois lacos fechados com
 * equilibrio proprio: dava para ter os 27 estados acima de 50 e uma media
 * nacional de 39, o que nao e leitura dificil, e leitura errada.
 *
 * Agora ha uma hierarquia so -- pais, regiao, estado -- com os desvios
 * recentrados por populacao. Estes testes cobram a coerencia entre os tres
 * niveis, que e o que o jogador le na tela.
 */
function newGame(seed = 4242): GameState {
  const cabinet = defaultCabinet(MINISTRY_IDS);

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
      startYear: 2027, reelection: true, seed,
    }),
  );
}

/** A media que o mapa mostra: ponderada por populacao, como uma pesquisa. */
function mapAverage(state: GameState): number {
  const population = state.states.reduce((total, unit) => total + unit.population, 0);
  return (
    state.states.reduce((total, unit) => total + unit.approval * unit.population, 0) / population
  );
}

describe('aprovacao nacional e o mapa', () => {
  it('e exatamente a media dos 27 estados, todo mes', () => {
    let state = newGame();
    let pior = 0;

    for (let index = 0; index < 44; index += 1) {
      state = tickMonth(state).state;
      pior = Math.max(pior, Math.abs(mapAverage(state) - state.approval.overall));
    }

    // Nao e "perto": e o mesmo numero. O que o jogador ve na manchete e a
    // media dos estados que ele ve no mapa, contando quanta gente mora em
    // cada um.
    expect(pior).toBeLessThan(0.6);
  });

  it('mostra em cada regiao a media real dos estados dela', () => {
    let state = newGame(21);
    for (let index = 0; index < 26; index += 1) state = tickMonth(state).state;

    for (const region of REGIONS) {
      const units = state.states.filter((unit) => unit.region === region);
      const populacao = units.reduce((total, unit) => total + unit.population, 0);
      const real =
        units.reduce((total, unit) => total + unit.approval * unit.population, 0) / populacao;

      // O numero da regiao nao e estimado nem suavizado: e a conta que o
      // jogador faria olhando os estados dela.
      expect(state.approval.byRegion[region]).toBeCloseTo(real, 1);
    }
  });

  it('nao mostra uma regiao abaixo de todos os estados que ela contem', () => {
    let state = newGame(33);
    for (let index = 0; index < 26; index += 1) state = tickMonth(state).state;

    for (const region of REGIONS) {
      const units = state.states.filter((unit) => unit.region === region);
      const menor = Math.min(...units.map((unit) => unit.approval));
      const maior = Math.max(...units.map((unit) => unit.approval));

      // O sintoma que o jogador relatou: o Sul inteiro acima de 50 e o rotulo
      // do Sul marcando 34,8. Uma media que cai fora do intervalo dos proprios
      // dados nao e media de coisa nenhuma.
      expect(state.approval.byRegion[region]).toBeGreaterThanOrEqual(menor - 0.2);
      expect(state.approval.byRegion[region]).toBeLessThanOrEqual(maior + 0.2);
    }
  });

  it('nao acumula vies sistematico entre o mapa e a manchete', () => {
    let state = newGame(99);
    const gaps: number[] = [];

    for (let index = 0; index < 44; index += 1) {
      state = tickMonth(state).state;
      gaps.push(mapAverage(state) - state.approval.overall);
    }

    // Num mes isolado o mapa pode estar todo acima ou todo abaixo: pesquisa
    // estadual atrasa em relacao a nacional, e isso e honesto. O que nao pode
    // e o atraso virar um degrau permanente -- que era o sintoma antigo, o
    // mapa inteiro num patamar e a manchete em outro, mandato afora.
    const media = gaps.reduce((total, gap) => total + gap, 0) / gaps.length;
    expect(Math.abs(media)).toBeLessThan(1.5);
  });

  it('faz as regioes acompanharem a queda do pais no mesmo mes', () => {
    let state = newGame(7);
    for (let index = 0; index < 12; index += 1) state = tickMonth(state).state;

    const antes = { ...state.approval.byRegion };
    const nacionalAntes = state.approval.overall;

    // Um tombo nacional grande, sem endereco regional.
    nudgeApproval(state, -12);
    state = tickMonth(state).state;

    const queda = nacionalAntes - state.approval.overall;
    expect(queda).toBeGreaterThan(4);

    for (const region of REGIONS) {
      // Nenhuma regiao pode ficar parada enquanto o pais desaba.
      expect(state.approval.byRegion[region]).toBeLessThan(antes[region]);
    }
  });

  it('trata o vies regional como redistribuicao, e nao como vazamento', () => {
    const state = newGame(5);
    const antes = REGIONS.map((region) => state.approval.byRegion[region]);
    const nacionalAntes = state.approval.overall;

    nudgeApproval(state, 10, 'nordeste');

    const depois = REGIONS.map((region) => state.approval.byRegion[region]);
    const mediaAntes = antes.reduce((total, valor) => total + valor, 0) / antes.length;
    const mediaDepois = depois.reduce((total, valor) => total + valor, 0) / depois.length;

    // O pais subiu 10; a media das regioes tem de subir 10 tambem. O Nordeste
    // sobe mais que as outras, mas ninguem perde o que o pais ganhou.
    expect(state.approval.overall - nacionalAntes).toBeCloseTo(10, 0);
    expect(mediaDepois - mediaAntes).toBeCloseTo(10, 0);
  });
});

describe('saves feitos quando as duas contas divergiam', () => {
  it('reconcilia o mapa com a manchete ao carregar, sem esperar um mes', () => {
    const state = newGame(12);

    // O save da captura do jogador: aprovacao do governo em 39, estados todos
    // em torno de 53. Duas contas diferentes para a mesma coisa.
    state.approval.overall = 39;
    for (const unit of state.states) unit.approval = 53;

    const migrado = migrate(state);

    expect(mapAverage(migrado)).toBeCloseTo(39, 0);
    for (const region of REGIONS) {
      const units = migrado.states.filter((unit) => unit.region === region);
      const menor = Math.min(...units.map((unit) => unit.approval));
      const maior = Math.max(...units.map((unit) => unit.approval));
      expect(migrado.approval.byRegion[region]).toBeGreaterThanOrEqual(menor - 0.2);
      expect(migrado.approval.byRegion[region]).toBeLessThanOrEqual(maior + 0.2);
    }
  });

  it('nao mexe em save que ja estava coerente', () => {
    let state = newGame(12);
    state = tickMonth(state).state;
    const antes = state.states.map((unit) => unit.approval);

    const migrado = migrate(state);

    expect(migrado.states.map((unit) => unit.approval)).toEqual(antes);
  });
});
