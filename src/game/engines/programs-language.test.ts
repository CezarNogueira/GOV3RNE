import { describe, expect, it } from 'vitest';
import { createGame, recognizeMeasure, type GameState } from './index';
import { verbForms } from './recognizer/text';
import { composeMeasureText } from './builders/plan';
import { readProgramAbolition } from './program-text';
import { defaultCabinet } from '../data/people';
import { MINISTRY_IDS } from '../data/ministries';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * PROGRAMA COMO ENTIDADE DE PRIMEIRA CLASSE
 *
 * O jogador cita o programa pelo nome, em qualquer conjugacao, e escolhe o que
 * fazer com ele -- do mesmo jeito que faz com uma empresa. Nada aqui e uma
 * cadeia de `if`: a entidade sai de `state.programs`, a intencao sai do banco
 * de intencoes e a conjugacao e gerada do radical.
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

describe('o verbo do jogador nao vem no infinitivo', () => {
  it('gera as conjugacoes que as pessoas escrevem', () => {
    expect(verbForms('acabar')).toContain('acaba');
    expect(verbForms('colocar')).toContain('coloca');
    expect(verbForms('reduzir')).toContain('reduz');
    expect(verbForms('suspender')).toContain('suspende');
  });

  it('nao casa palavra que so comeca parecido', () => {
    // "matar" com casamento por prefixo transformaria "materia tributaria" em
    // ordem de matar. As formas sao palavras inteiras, e "materia" nao e uma.
    expect(verbForms('matar')).not.toContain('materia');
    expect(verbForms('cortar')).not.toContain('cortina');
  });
});

describe('as frases de programa viram acao', () => {
  const casos: [string, string][] = [
    ['acaba com o Bolsa Família', 'encerrar_programa'],
    ['corta o Bolsa Família', 'reduzir_programa'],
    ['coloca mais dinheiro no Bolsa Família', 'ampliar_programa'],
    ['reduz o Bolsa Família', 'reduzir_programa'],
    ['muda quem pode receber o Bolsa Família', 'alterar_programa'],
    ['muda as regras do Bolsa Família', 'alterar_programa'],
    ['expande o Bolsa Família', 'ampliar_programa'],
    ['limita o Bolsa Família', 'reduzir_programa'],
    ['suspende o Bolsa Família', 'suspender_programa'],
    ['reabre o Bolsa Família', 'retomar_programa'],
    ['quero mexer no Bolsa Família', 'alterar_programa'],
    ['acaba bolsa', 'encerrar_programa'],
  ];

  for (const [frase, esperado] of casos) {
    it(`entende "${frase}"`, () => {
      const leitura = recognizeMeasure(frase, newGame());
      expect(leitura.intent).toBe(esperado);
      expect(leitura.entities.some((entity) => entity.kind === 'PROGRAM')).toBe(true);
    });
  }

  it('encontra o programa da partida, e nao um catalogo fixo', () => {
    const state = newGame();
    // Programa apagado deixa de ser citavel no mesmo instante.
    state.programs = state.programs.filter((program) => program.id !== 'renda_base');

    const leitura = recognizeMeasure('acaba com o Bolsa Família', state);
    expect(leitura.entities.some((entity) => entity.id === 'renda_base')).toBe(false);
  });
});

describe('pergunta em vez de chutar', () => {
  it('lista os programas quando a frase nao nomeia nenhum', () => {
    const leitura = recognizeMeasure('mata esse programa', newGame());

    expect(leitura.intent).toBe('encerrar_programa');
    expect(leitura.action).toBe('ESCOLHER');
    // Escolher um por conta propria apagaria o programa errado.
    expect(leitura.choices.length).toBeGreaterThan(3);
    expect(leitura.choices[0]!.detail).toContain('bi por mês');
  });
});

describe('escrever o nome de um sistema abre o sistema', () => {
  const navegacoes: [string, string][] = [
    ['programas', 'programas'],
    ['quero mexer nos programas', 'programas'],
    ['gerenciar programas', 'programas'],
    ['empresas', 'empresas'],
    ['ver as estatais', 'empresas'],
    ['quero mexer nos impostos', 'impostos'],
    ['orcamento', 'orcamento'],
  ];

  for (const [frase, destino] of navegacoes) {
    it(`"${frase}" abre ${destino}`, () => {
      const leitura = recognizeMeasure(frase, newGame());
      expect(leitura.action).toBe('NAVEGAR');
      expect(leitura.destination).toBe(destino);
    });
  }

  it('nao confunde acao com navegacao', () => {
    // "apoiar pequenas empresas" cita um sistema e continua sendo medida.
    const acao = recognizeMeasure('apoiar pequenas empresas', newGame());
    expect(acao.action).not.toBe('NAVEGAR');

    // Alvo especifico tambem tira a frase da navegacao.
    const especifico = recognizeMeasure('quero mexer no Bolsa Família', newGame());
    expect(especifico.action).not.toBe('NAVEGAR');
  });
});

describe('clicar e escrever produzem a mesma medida', () => {
  it('o painel do programa escreve a frase que o jogador teria digitado', () => {
    const state = newGame();
    const programa = state.programs.find((entry) => entry.id === 'renda_base')!;

    // O que o painel monta quando o jogador marca "Encerrar o programa".
    const plano = {
      builderId: 'programa',
      title: 'Programa de governo',
      optionIds: ['encerrar'],
      changes: [],
      entityId: programa.id,
      entityName: programa.name,
    };
    const frase = composeMeasureText(plano, state);

    // A frase nomeia o programa e e reconhecida como extincao -- a mesma
    // leitura que sai de "acabar com o Bolsa Familia" digitado a mao.
    expect(frase).toContain(programa.name);
    expect(readProgramAbolition(frase, state)).toContain('renda_base');

    const digitado = readProgramAbolition('acabar com o Bolsa Família', state);
    expect(readProgramAbolition(frase, state)).toEqual(digitado);
  });

  it('a opcao de ampliar nao vira extincao por engano', () => {
    const state = newGame();
    const frase = composeMeasureText(
      {
        builderId: 'programa',
        title: 'Programa de governo',
        optionIds: ['ampliar_orcamento'],
        amount: 12,
        changes: [],
        entityId: 'renda_base',
        entityName: 'Bolsa Família',
      },
      state,
    );

    expect(frase).toContain('Bolsa Família');
    expect(readProgramAbolition(frase, state)).toHaveLength(0);
  });
});
