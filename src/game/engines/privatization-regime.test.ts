import { describe, expect, it } from 'vitest';
import { createGame, findCompany, proposePrivatization, tickMonth, type GameState } from './index';
import { defaultCabinet } from '../data/people';
import { MINISTRY_IDS } from '../data/ministries';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * VENDER ESTATAL SEM CONGRESSO
 *
 * Numa democracia, alienar o controle de uma estatal depende de lei, o estudo
 * de modelagem leva meses e o leilao pode dar deserto -- tres freios, cada um
 * com dono. Fechado o Congresso, nenhum deles tem quem o faca valer: a venda
 * sai por decreto, sem concorrencia, para quem o governo escolher.
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
      startYear: 2027, reelection: true, seed,
    }),
  );
}

function ditadura(state: GameState): void {
  state.regime.regime = 'ditadura';
  state.regime.congressStatus = 'suspenso';
}

/** Roda o processo ate ele sair das etapas de espera. */
function ateOFim(state: GameState, companyId: string, meses = 20): GameState {
  let atual = state;
  for (let index = 0; index < meses; index += 1) {
    atual = tickMonth(atual).state;
    const processo = atual.companies.privatizations.find((entry) => entry.companyId === companyId);
    if (!processo) break;
    if (['concluida', 'fracassada', 'rejeitada'].includes(processo.stage)) break;
  }
  return atual;
}

describe('a democracia segura a venda', () => {
  it('exige lei para alienar o controle e recusa servico de Estado', () => {
    const state = newGame();

    const correios = proposePrivatization(state, 'correios', 100, new Rng(1, 0));
    expect(correios.process?.requiresLaw).toBe(true);
    expect(correios.message).toContain('Congresso');

    const caixa = proposePrivatization(state, 'caixa', 100, new Rng(2, 0));
    expect(caixa.ok).toBe(false);
    expect(caixa.message).toContain('serviço de Estado');
  });
});

describe('a ditadura vende por decreto', () => {
  it('dispensa a lei e diz por que', () => {
    const state = newGame();
    ditadura(state);

    const outcome = proposePrivatization(state, 'correios', 100, new Rng(1, 0));
    expect(outcome.ok).toBe(true);
    expect(outcome.process?.requiresLaw).toBe(false);
    expect(outcome.message).toContain('Sem Congresso');
  });

  it('vende ate o que a democracia protegia', () => {
    const state = newGame();
    ditadura(state);

    // "Presta servico de Estado e nao se vende" e uma regra que alguem precisa
    // fazer valer. Sem Congresso, nao sobra quem segure.
    expect(proposePrivatization(state, 'caixa', 100, new Rng(2, 0)).ok).toBe(true);
  });

  it('conclui a venda sem passar por plenario nenhum', () => {
    let state = newGame(31);
    ditadura(state);
    proposePrivatization(state, 'correios', 100, new Rng(3, 0));

    state = ateOFim(state, 'correios');
    const processo = state.companies.privatizations.find((entry) => entry.companyId === 'correios')!;

    expect(processo.stage).toBe('concluida');
    // Nunca houve etapa legislativa: nao ha a quem pedir autorizacao.
    expect(processo.log.some((entry) => entry.label === 'Enviada ao Congresso')).toBe(false);
    expect(processo.log.some((entry) => entry.label === 'Venda dirigida')).toBe(true);
  });

  it('nao da leilao deserto, porque nao foi a leilao', () => {
    // Os Correios dao prejuizo: em leilao publico, o lote costuma nao encontrar
    // comprador. Venda dirigida nao depende de mercado nenhum.
    for (const seed of [11, 22, 33]) {
      let state = newGame(seed);
      ditadura(state);
      proposePrivatization(state, 'correios', 100, new Rng(seed, 0));
      state = ateOFim(state, 'correios');

      const processo = state.companies.privatizations.find((e) => e.companyId === 'correios')!;
      expect(processo.stage, `semente ${seed}`).toBe('concluida');
    }
  });

  it('cobra o preco de vender sem concorrencia', () => {
    let state = newGame(31);
    ditadura(state);
    const aberto = proposePrivatization(state, 'correios', 100, new Rng(3, 0));
    const minimo = aberto.process!.reservePrice;

    state = ateOFim(state, 'correios');
    const processo = state.companies.privatizations.find((entry) => entry.companyId === 'correios')!;

    // Quem compra sabe que nao tem concorrente, e o Tesouro recebe menos do que
    // o ativo valia.
    expect(processo.proceeds).toBeLessThan(minimo);
  });
});

describe('a empresa muda de lado, e o dono tem nome', () => {
  it('sai das federais e entra nas privadas', () => {
    let state = newGame(31);
    ditadura(state);
    proposePrivatization(state, 'correios', 100, new Rng(3, 0));
    state = ateOFim(state, 'correios');

    const empresa = findCompany(state, 'correios')!;
    expect(empresa.control).toBe('privada');
    expect(state.companies.companies.filter((e) => e.control === 'federal').some((e) => e.id === 'correios')).toBe(false);
    expect(state.companies.companies.filter((e) => e.control === 'privada').some((e) => e.id === 'correios')).toBe(true);
  });

  it('entrega a empresa a uma pessoa, com oficio e rosto', () => {
    let state = newGame(31);
    ditadura(state);
    proposePrivatization(state, 'correios', 100, new Rng(3, 0));
    state = ateOFim(state, 'correios');

    const dono = findCompany(state, 'correios')!.ownership.controllingShareholder!;

    // Venda dirigida nao tem para onde esconder quem levou: e gente, com nome,
    // oficio e retrato na ficha da empresa.
    expect(dono.kind).toBe('pessoa');
    expect(dono.role).toBeTruthy();
    expect(dono.avatar).toBeTruthy();
    expect(
      state.companies.news.some((noticia) => noticia.body.includes(dono.name)),
    ).toBe(true);
  });
});
