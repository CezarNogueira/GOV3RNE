import { describe, expect, it } from 'vitest';
import {
  buildMeasureFromPlan,
  createGame,
  createPolicy,
  migrate,
  recognizeMeasure,
  tickMonth,
  type GameState,
} from './index';
import { defaultCabinet } from '../data/people';
import { MINISTRY_IDS } from '../data/ministries';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * RENDA MEDIA COMO CONSEQUENCIA
 *
 * A renda nao sobe porque o jogador apertou um botao: ela sobe no fim de uma
 * cadeia -- investimento e qualificacao levantam a PRODUTIVIDADE, a
 * produtividade levanta o salario, o salario levanta a renda.
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

function assinar(
  state: GameState,
  optionIds: string[],
  amount: number,
  seed: number,
  alvo?: string,
): void {
  const { analysis, text } = buildMeasureFromPlan(
    { builderId: 'renda', title: 'Elevar a renda', optionIds, amount, changes: [] },
    state,
  );
  const comAlvo = alvo
    ? { ...analysis, impacts: { ...analysis.impacts, targetStates: [alvo] } }
    : analysis;
  const policy = createPolicy(comAlvo, text, state, new Rng(seed, 0), false);
  state.policies = [
    { ...policy, status: 'aprovada' as const, requiresCongress: false },
    ...state.policies,
  ];
}

const renda = (state: GameState, uf: string) => state.states.find((u) => u.id === uf)!.income;
const prod = (state: GameState, uf: string) => state.states.find((u) => u.id === uf)!.productivity;

describe('o jogo entende o pedido', () => {
  const casos: [string, string | null][] = [
    ['Aumentar a renda do Brasil', null],
    ['Aumentar a renda da Bahia', 'BA'],
    ['Melhorar os salários', null],
    ['Aumentar a renda dos trabalhadores', null],
    ['Criar empregos melhores', null],
    ['Desenvolver a economia da Bahia', 'BA'],
  ];

  for (const [frase, alvo] of casos) {
    it(`entende "${frase}"`, () => {
      const leitura = recognizeMeasure(frase, newGame());
      expect(leitura.intent).toBe('elevar_renda');
      expect(leitura.builder).toBe('renda');

      const estados = leitura.entities.filter((entity) => entity.kind === 'STATE');
      if (alvo) expect(estados.map((entity) => entity.id)).toContain(alvo);
      else expect(estados).toHaveLength(0);
    });
  }

  it('nao confunde o Brasil com Brasilia', () => {
    const leitura = recognizeMeasure('Aumentar a renda do Brasil', newGame());
    expect(leitura.entities.some((entity) => entity.id === 'DF')).toBe(false);
  });

  it('entende a regiao inteira', () => {
    const leitura = recognizeMeasure('Aumentar a renda do Nordeste', newGame());
    expect(leitura.entities.some((entity) => entity.kind === 'REGION')).toBe(true);
  });
});

describe('a renda e consequencia, e nao botao', () => {
  it('sobe acima do controle quando o governo investe por tres anos', () => {
    let comPolitica = newGame(77);
    let controle = newGame(77);

    for (let mes = 0; mes < 36; mes += 1) {
      if (mes % 6 === 0) {
        assinar(comPolitica, ['qualificacao', 'industria'], 20, mes + 1);
        assinar(comPolitica, ['infraestrutura'], 25, mes + 50, 'BA');
      }
      comPolitica = tickMonth(comPolitica).state;
      controle = tickMonth(controle).state;
    }

    expect(comPolitica.nation.averageIncome).toBeGreaterThan(controle.nation.averageIncome * 1.05);
    expect(renda(comPolitica, 'BA')).toBeGreaterThan(renda(controle, 'BA') * 1.08);
  });

  it('faz a produtividade subir junto com a renda, e nao no lugar dela', () => {
    let state = newGame(31);
    const prodInicial = prod(state, 'BA');
    const rendaInicial = renda(state, 'BA');

    assinar(state, ['infraestrutura', 'industria'], 60, 5, 'BA');
    for (let mes = 0; mes < 24; mes += 1) state = tickMonth(state).state;

    expect(prod(state, 'BA')).toBeGreaterThan(prodInicial);
    expect(renda(state, 'BA')).toBeGreaterThan(rendaInicial);
  });

  it('mantem a medida enderecada dentro do estado que ela nomeou', () => {
    let comAlvo = newGame(11);
    let semNada = newGame(11);

    assinar(comAlvo, ['infraestrutura'], 60, 9, 'BA');
    for (let mes = 0; mes < 18; mes += 1) {
      comAlvo = tickMonth(comAlvo).state;
      semNada = tickMonth(semNada).state;
    }

    const ganhoBA = renda(comAlvo, 'BA') - renda(semNada, 'BA');
    const ganhoSP = renda(comAlvo, 'SP') - renda(semNada, 'SP');

    expect(ganhoBA).toBeGreaterThan(0);
    expect(ganhoBA).toBeGreaterThan(ganhoSP);
  });
});

describe('cada politica tem um efeito diferente', () => {
  it('cobra inflacao de quem levanta o piso e nao de quem qualifica', () => {
    const inflacaoDe = (opcao: string) => {
      const state = newGame(55);
      const { analysis } = buildMeasureFromPlan(
        { builderId: 'renda', title: 'Elevar a renda', optionIds: [opcao], amount: 40, changes: [] },
        state,
      );
      return analysis.impacts.inflation ?? 0;
    };

    expect(inflacaoDe('salario_minimo')).toBeGreaterThan(inflacaoDe('qualificacao'));
  });

  it('poe o efeito do ensino tecnico no futuro, e nao no mes seguinte', () => {
    const state = newGame(55);
    const { analysis } = buildMeasureFromPlan(
      { builderId: 'renda', title: 'Elevar a renda', optionIds: ['qualificacao'], amount: 40, changes: [] },
      state,
    );

    // Quase nada agora; o grosso vem la na frente.
    expect(analysis.impacts.productivity ?? 0).toBeLessThan(1);
    expect(analysis.delayedEffects.some((efeito) => efeito.monthsAhead > 12)).toBe(true);
  });

  it('faz o tamanho do dinheiro importar', () => {
    const produtividadeDe = (amount: number) => {
      const state = newGame(55);
      const { analysis } = buildMeasureFromPlan(
        { builderId: 'renda', title: 'Elevar a renda', optionIds: ['industria'], amount, changes: [] },
        state,
      );
      return analysis.impacts.productivity ?? 0;
    };

    expect(produtividadeDe(80)).toBeGreaterThan(produtividadeDe(20) * 3);
  });
});

describe('saves antigos', () => {
  it('reconstroi a produtividade de quem ja estava jogando', () => {
    const state = newGame();
    const legado = state as unknown as { states: Record<string, unknown>[] };
    for (const unit of legado.states) delete unit.productivity;

    const migrado = migrate(state);

    for (const unit of migrado.states) {
      expect(typeof unit.productivity).toBe('number');
      expect(unit.productivity).toBeGreaterThan(0);
    }
  });
});
