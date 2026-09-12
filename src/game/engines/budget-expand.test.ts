import { describe, expect, it } from 'vitest';
import { builderForChoice, createGame, recognizeMeasure, verbForms, type GameState } from './index';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * AMPLIAR ORÇAMENTO NÃO É CORTAR GASTO
 *
 * "Ampliar orçamento" caía em "Cortar gastos", e clicar na opção certa ainda
 * abria o painel de corte. Estes testes cobrem as duas pontas: a leitura da
 * frase e o painel que cada opção abre.
 */
function newGame(): GameState {
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
      startYear: 2027, reelection: true, seed: 21,
    }),
  );
}

const state = newGame();
const read = (texto: string) => recognizeMeasure(texto, state);

describe('ampliar orçamento', () => {
  it('lê como reforço de orçamento, em várias formas de escrever', () => {
    for (const frase of [
      'ampliar orçamento',
      'Ampliar orçamento',
      'ampliar o orçamento',
      'ampliar orçamento da educação',
      'aumentar orçamento da saúde',
      'aumentar o orçamento dos ministérios',
      'mais verba para a saúde',
      'reforçar o orçamento da segurança',
    ]) {
      const leitura = read(frase);
      expect(leitura.intent, frase).toBe('ampliar_orcamento');
      expect(leitura.builder, frase).toBe('reforco_orcamento');
    }
  });

  it('já traz a pasta citada', () => {
    const leitura = read('ampliar orçamento da educação');
    expect(leitura.entities.some((entity) => entity.id === 'educacao')).toBe(true);
  });

  it('cortar continua sendo cortar', () => {
    expect(read('Cortar gastos').builder).toBe('corte_orcamento');
    expect(read('cortar gastos da saúde').builder).toBe('corte_orcamento');
    expect(read('reduzir orçamento da educação').builder).toBe('corte_orcamento');
  });

  it('a preposição "para" não é o verbo parar', () => {
    const formas = verbForms('parar');
    expect(formas).not.toContain('para');
    expect(formas).toContain('parou');
    expect(read('mais verba para a saúde').intent).not.toBe('suspender_programa');
  });
});

describe('opção de "Você quis dizer"', () => {
  it('cada opção abre o painel dela, e não o da leitura principal', () => {
    const leitura = {
      ...read('Cortar gastos'),
      builder: 'corte_orcamento',
      choices: [
        { id: 'cortar_orcamento', label: 'Cortar gastos', detail: '' },
        { id: 'ampliar_orcamento', label: 'Ampliar orçamento', detail: '' },
      ],
    };
    expect(builderForChoice(leitura, 'ampliar_orcamento')).toBe('reforco_orcamento');
    expect(builderForChoice(leitura, 'cortar_orcamento')).toBe('corte_orcamento');
  });

  it('opção de entidade continua no painel da leitura principal', () => {
    const leitura = { ...read('Cortar gastos'), builder: 'privatizacao' };
    expect(builderForChoice(leitura, 'outra')).toBe('privatizacao');
  });
});
