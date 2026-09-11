import { describe, expect, it } from 'vitest';
import { createGame, createPolicy, interpretLocally, tickMonth, type GameState } from './index';
import { abolishPrograms, readProgramAbolition } from './program-text';
import { defaultCabinet } from '../data/people';
import { MINISTRY_IDS } from '../data/ministries';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * ACABAR COM UM PROGRAMA
 *
 * Extinguir nao e cortar verba: o programa sai da lista e nao volta. Estes
 * testes cobram as duas metades disso -- que o jogo so entenda extincao quando
 * e extincao mesmo, e que, aprovada, ela apague o programa sem deixar rastro e
 * sem cobrar a conta duas vezes.
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

describe('ler a extincao no texto', () => {
  it('entende as varias formas de dizer que acabou', () => {
    const state = newGame();

    for (const frase of [
      'Acabar com o Bolsa Família',
      'Extinguir o Bolsa Família',
      'Quero abolir o Bolsa Família de vez',
      'Cancelar o Bolsa Família',
      'Revogar o Bolsa Família',
    ]) {
      expect(readProgramAbolition(frase, state), frase).toContain('renda_base');
    }
  });

  it('nao confunde corte de verba com fim do programa', () => {
    const state = newGame();

    // Estas frases mexem no programa sem acabar com ele. Apagar por engano
    // seria irreversivel, entao a leitura tem de errar para o lado seguro.
    for (const frase of [
      'Reduzir o Bolsa Família em 20%',
      'Cortar o Bolsa Família pela metade',
      'Estudar o fim do Bolsa Família',
      'Aumentar o Bolsa Família',
      'Revisar o Bolsa Família',
    ]) {
      expect(readProgramAbolition(frase, state), frase).toHaveLength(0);
    }
  });

  it('so encontra programa que existe nesta partida', () => {
    const state = newGame();

    expect(readProgramAbolition('Acabar com o Programa Que Nunca Existiu', state)).toHaveLength(0);

    // Apagado uma vez, nao e encontrado de novo.
    abolishPrograms(state, ['renda_base']);
    expect(readProgramAbolition('Acabar com o Bolsa Família', state)).toHaveLength(0);
  });
});

describe('o programa sai da lista', () => {
  it('some sem deixar rastro, em vez de ficar inativo', () => {
    const state = newGame();
    const antes = state.programs.length;

    const fim = abolishPrograms(state, ['renda_base']);

    expect(fim.removed).toHaveLength(1);
    expect(state.programs).toHaveLength(antes - 1);
    // Nem ativo, nem inativo, nem arquivado: nao esta mais la.
    expect(state.programs.some((program) => program.id === 'renda_base')).toBe(false);
  });

  it('nao devolve dinheiro no ato, porque o mes seguinte ja para de gastar', () => {
    const state = newGame();
    const caixaAntes = state.economy.treasuryCash;
    const primarioAntes = state.economy.primaryBalance;

    abolishPrograms(state, ['renda_base']);

    // Devolver o custeio aqui E parar de cobra-lo no fechamento do mes seria
    // pagar a economia duas vezes pelo mesmo corte.
    expect(state.economy.treasuryCash).toBe(caixaAntes);
    expect(state.economy.primaryBalance).toBe(primarioAntes);
  });

  it('deixa mais caixa e mais pobreza do que a mesma partida sem extinguir', () => {
    let comCorte = newGame(77);
    const programa = comCorte.programs.find((entry) => entry.id === 'renda_base')!;
    const analysis = interpretLocally('Acabar com o Bolsa Família', comCorte);
    const policy = createPolicy(analysis, 'Acabar com o Bolsa Família', comCorte, new Rng(1, 0), false);

    expect(policy.abolishProgramIds).toContain('renda_base');

    comCorte.policies = [
      { ...policy, status: 'aprovada' as const, requiresCongress: false },
      ...comCorte.policies,
    ];

    let controle = newGame(77);
    for (let index = 0; index < 7; index += 1) {
      comCorte = tickMonth(comCorte).state;
      controle = tickMonth(controle).state;
    }

    expect(comCorte.programs.some((entry) => entry.id === 'renda_base')).toBe(false);
    expect(controle.programs.some((entry) => entry.id === 'renda_base')).toBe(true);

    // O trade inteiro numa linha: sobra dinheiro, falta politica publica.
    expect(comCorte.economy.treasuryCash).toBeGreaterThan(controle.economy.treasuryCash);
    expect(comCorte.nation.povertyRate).toBeGreaterThan(controle.nation.povertyRate);
    expect(comCorte.approval.overall).toBeLessThan(controle.approval.overall);
    expect(programa.popularity).toBeGreaterThan(0);
  });

  it('nao apaga nada enquanto a medida nao entra em vigor', () => {
    const state = newGame(31);
    const analysis = interpretLocally('Acabar com o Bolsa Família', state);
    const policy = createPolicy(analysis, 'Acabar com o Bolsa Família', state, new Rng(2, 0), false);

    // Tramitando nao e aprovado: o programa continua de pe enquanto o Congresso
    // nao decidir.
    expect(policy.status).not.toBe('vigente');
    expect(state.programs.some((entry) => entry.id === 'renda_base')).toBe(true);
  });
});

/**
 * A MEDIDA PRECISA SER A MEDIDA
 *
 * Antes disto, "acabar com o Bolsa Familia" era lido pelo caminho generico e
 * virava "Reducao -- transferencia de renda": titulo errado, economia de R$ 90
 * bi contada por fora e razoes trocadas nos grupos. A extincao acontecia como
 * efeito colateral de uma medida que dizia outra coisa.
 */
describe('a leitura da extincao', () => {
  it('monta a medida a partir do programa, e nao do caminho generico', () => {
    const state = newGame();
    const analysis = interpretLocally('acabar com o bolsa familia', state);

    expect(analysis.title).toContain('Extinção');
    expect(analysis.title).toContain('Bolsa Família');
    const programa = state.programs.find((entry) => entry.id === 'renda_base')!;
    expect(analysis.summary).toContain((programa.beneficiaries / 1e6).toFixed(1));
    expect(analysis.summary).toContain(programa.monthlyCost.toFixed(1));
    expect(analysis.warnings.some((aviso) => aviso.includes('não volta'))).toBe(true);
  });

  it('nao conta a economia duas vezes', () => {
    const state = newGame();
    const analysis = interpretLocally('acabar com o bolsa familia', state);

    // O motor para de cobrar o custeio quando o programa sai da lista. Um custo
    // negativo aqui creditaria a mesma economia de novo, todo mes.
    expect(analysis.estimatedCost).toBe(0);
    expect(analysis.impacts.primaryBalance ?? 0).toBe(0);
    // Pobreza e desemprego tambem sao recalculados pelo gasto por categoria.
    expect(analysis.impacts.poverty ?? 0).toBe(0);
  });

  it('poe quem perde e quem ganha do lado certo, com o motivo certo', () => {
    const state = newGame();
    const analysis = interpretLocally('acabar com o bolsa familia', state);

    const pobres = analysis.groupImpacts.find((impacto) => impacto.groupId === 'baixa_renda')!;
    const mercado = analysis.groupImpacts.filter(
      (impacto) => impacto.groupId === 'mercado_financeiro',
    );

    // Quem recebia perde, e perde MUITO: 21 milhoes de familias nao e a gota
    // mensal do programa, e o beneficio inteiro de uma vez.
    expect(pobres.delta).toBeLessThan(-6);
    expect(pobres.reason).toContain('Perdeu');
    // Quem paga a conta comemora.
    expect(mercado.length).toBeGreaterThan(0);
    expect(mercado.every((impacto) => impacto.delta > 0)).toBe(true);
  });

  it('faz o tamanho do programa mudar o tamanho da reacao', () => {
    const state = newGame();

    const grande = interpretLocally('acabar com o bolsa familia', state);
    const pequeno = interpretLocally('extinguir o floresta viva', state);

    const perdaMaxima = (analysis: typeof grande) =>
      Math.min(...analysis.groupImpacts.map((impacto) => impacto.delta));

    // Acabar com um programa de 21 milhoes de pessoas nao pode custar o mesmo
    // que acabar com um de alcance pequeno.
    expect(perdaMaxima(grande)).toBeLessThan(perdaMaxima(pequeno));
  });

  it('exige o Congresso e chega la sem apoio nenhum', () => {
    const state = newGame();
    const analysis = interpretLocally('acabar com o bolsa familia', state);

    expect(analysis.requiresCongress).toBe(true);
    // Programa popular nao se extingue com facilidade: e para ser dificil.
    expect(analysis.estimatedOpposition).toBeGreaterThan(analysis.estimatedSupport);
  });

  it('nao rouba a leitura de quem so quis cortar verba', () => {
    const state = newGame();
    const corte = interpretLocally('reduzir o bolsa familia em 20%', state);

    expect(corte.title).not.toContain('Extinção');
  });
});
