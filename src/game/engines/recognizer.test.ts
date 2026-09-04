import { describe, expect, it } from 'vitest';
import { createGame, recognizeMeasure, type GameState } from './index';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * O INTERPRETADOR LOCAL
 *
 * O jogo não tem IA. O que ele tem é banco de intenções, banco de entidades
 * montado a partir dos próprios dados da partida, comparação aproximada e
 * regras de contexto. Estes testes são a régua disso: se o jogador escrever
 * como uma pessoa escreve — errando acento, abreviando, invertendo a ordem —,
 * o sistema tem de chegar na mesma leitura.
 */
function newGame(seed = 4242): GameState {
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

const state = newGame();
const read = (text: string) => recognizeMeasure(text, state);

describe('privatização', () => {
  const frases = [
    'Privatizar os Correios',
    'privatizar correios',
    'vender os correios',
    'quero vender a estatal dos correios',
    'privatiza os correios pfv',
    'quero privatizar os correio',
  ];

  for (const frase of frases) {
    it(`entende "${frase}"`, () => {
      const leitura = read(frase);
      expect(leitura.intent).toBe('privatizar_empresa');
      expect(leitura.entities[0]?.id).toBe('correios');
    });
  }

  it('reconhece a Petrobras por apelido', () => {
    expect(read('quero privatizar a petro').entities[0]?.id).toBe('petrobras');
    expect(read('vender a Petrobras').entities[0]?.id).toBe('petrobras');
    expect(read('colocar a Petrobras à venda').intent).toBe('privatizar_empresa');
  });

  it('tolera erro de digitação no nome e no verbo', () => {
    const comErro = read('Privatizar os Correius');
    expect(comErro.intent).toBe('privatizar_empresa');
    expect(comErro.entities[0]?.id).toBe('correios');
    expect(comErro.entities[0]?.confidence).toBeLessThan(1);

    expect(read('privatisar correios').intent).toBe('privatizar_empresa');
    expect(read('Privatizar a Petrobraz').entities[0]?.id).toBe('petrobras');
  });
});

describe('pequenas empresas', () => {
  const frases = [
    'Apoiar pequenas empresas',
    'ajudar os pequenos negócios',
    'quero fortalecer as empresas pequenas',
    'dar apoio aos pequenos empresários',
    'Quero dar uma força pras empresas pequenas',
    'ajuda empresas pequenas',
  ];

  for (const frase of frases) {
    it(`entende "${frase}"`, () => {
      const leitura = read(frase);
      expect(leitura.intent).toBe('apoiar_pequenas_empresas');
      expect(leitura.action).toBe('CONFIGURAR');
      expect(leitura.builder).toBe('pequenas_empresas');
    });
  }
});

describe('orçamento', () => {
  it('entende corte de gastos sem alvo e pede configuração', () => {
    for (const frase of [
      'Cortar gastos',
      'preciso diminuir os gastos do governo',
      'reduzir despesas',
      'economizar dinheiro do governo',
      'quero cortar o orçamento',
      'gastar menos',
    ]) {
      const leitura = read(frase);
      expect(leitura.intent, frase).toBe('cortar_orcamento');
      expect(leitura.builder, frase).toBe('corte_orcamento');
    }
  });

  it('leva o corte direto para a pasta citada', () => {
    const saude = read('cortar gastos da saúde');
    expect(saude.intent).toBe('cortar_orcamento');
    expect(saude.entities.some((entity) => entity.id === 'saude')).toBe(true);

    const educacao = read('reduzir orçamento da educação');
    expect(educacao.entities.some((entity) => entity.id === 'educacao')).toBe(true);
  });

  it('separa cortar de investir na mesma área', () => {
    expect(read('cortar gastos da saúde').intent).toBe('cortar_orcamento');
    expect(read('investir na saúde').intent).toBe('investir_saude');
  });
});

describe('reforma tributária', () => {
  const frases = [
    'Fazer reforma tributária',
    'quero reformar os impostos',
    'precisamos mudar o sistema tributário',
    'reforma dos impostos',
    'faz reforma dos imposto',
    'reforma tributaria',
  ];

  for (const frase of frases) {
    it(`entende "${frase}"`, () => {
      const leitura = read(frase);
      expect(leitura.intent).toBe('reforma_tributaria');
      expect(leitura.action).toBe('CONFIGURAR');
    });
  }
});

describe('outras áreas de governo', () => {
  const casos: [string, string][] = [
    ['investir na saúde', 'investir_saude'],
    ['melhorar hospitais', 'investir_saude'],
    ['melhorar a educação', 'investir_educacao'],
    ['ajudar agricultores', 'ajudar_agricultores'],
    ['melhorar infraestrutura', 'investir_infraestrutura'],
    ['Quero melhorar a vida dos pobres', 'programa_social'],
    ['Quero ajudar os jovens a conseguir emprego', 'emprego_jovem'],
    ['combater a criminalidade', 'seguranca_publica'],
    ['diminuir o imposto de renda', 'reduzir_imposto'],
    ['criar imposto sobre grandes fortunas', 'aumentar_imposto'],
  ];

  for (const [frase, esperado] of casos) {
    it(`lê "${frase}" como ${esperado}`, () => {
      expect(read(frase).intent).toBe(esperado);
    });
  }
});

describe('números', () => {
  it('separa "para" de "em"', () => {
    const paraValor = read('Aumentar o salário mínimo para 1800').numbers[0]!;
    expect(paraValor.mode).toBe('SET');
    expect(paraValor.value).toBe(1800);

    const emPercentual = read('Aumentar o salário mínimo em 10%').numbers[0]!;
    expect(emPercentual.mode).toBe('PERCENT_INCREASE');
    expect(emPercentual.unit).toBe('PERCENT');
  });

  it('lê bilhões como bilhões e sabe a direção', () => {
    const corte = read('Cortar 20 bilhões da saúde').numbers[0]!;
    expect(corte.value).toBe(20);
    expect(corte.unit).toBe('BRL_BILLION');
    expect(corte.mode).toBe('DECREASE');

    const investimento = read('Investir 50 bilhões em infraestrutura').numbers[0]!;
    expect(investimento.value).toBe(50);
    expect(investimento.mode).toBe('INCREASE');
  });

  it('distingue ponto percentual de variação relativa', () => {
    expect(read('Aumentar imposto em 2 pontos percentuais').numbers[0]!.unit).toBe('PERCENT_POINT');
    expect(read('Reduzir imposto em 5%').numbers[0]!.unit).toBe('PERCENT');
  });
});

describe('contexto', () => {
  it('não trata negação como ordem', () => {
    const leitura = read('Não quero privatizar os Correios');
    expect(leitura.negated).toBe(true);
    expect(leitura.action).toBe('NADA');
  });

  it('trata pedido de estudo como estudo', () => {
    const leitura = read('Estude uma possível privatização dos Correios');
    expect(leitura.hypothetical).toBe(true);
    expect(leitura.notes.some((note) => note.includes('estudo'))).toBe(true);
  });

  it('devolve leitura livre quando não reconhece nada', () => {
    const leitura = read('Vou conversar com os governadores sobre o clima da semana');
    expect(leitura.action).toBe('NADA');
    expect(leitura.intent).toBe('desconhecida');
  });
});

describe('tolerância a erro', () => {
  const casos: [string, string][] = [
    ['corta verba saude', 'cortar_orcamento'],
    ['reforma tributaria', 'reforma_tributaria'],
    ['privatisar correios', 'privatizar_empresa'],
    ['ajuda empresas pequenas', 'apoiar_pequenas_empresas'],
    ['faz reforma dos imposto', 'reforma_tributaria'],
    ['quero mudar os impostos', 'reforma_tributaria'],
  ];

  for (const [frase, esperado] of casos) {
    it(`lê "${frase}"`, () => {
      expect(read(frase).intent).toBe(esperado);
    });
  }

  it('encontra a pasta mesmo com a frase abreviada', () => {
    const leitura = read('corta verba saude');
    expect(leitura.entities.some((entity) => entity.id === 'saude')).toBe(true);
  });
});

describe('confiança', () => {
  it('dá confiança alta para frase explícita e menor para frase torta', () => {
    const clara = read('Privatizar os Correios');
    const torta = read('quero vender os correius');

    expect(clara.confidence).toBeGreaterThan(0.9);
    expect(torta.confidence).toBeLessThan(clara.confidence);
    expect(torta.intent).toBe('privatizar_empresa');
  });

  it('abre painel quando falta o "como" e segue direto quando o texto já diz tudo', () => {
    expect(read('Apoiar pequenas empresas').action).toBe('CONFIGURAR');
    expect(read('Cortar gastos').action).toBe('CONFIGURAR');
    // Com alvo e número, não há o que perguntar: vai para a ficha técnica.
    expect(read('Cortar 20 bilhões da saúde').action).toBe('DIRETO');
  });

  it('sempre configura a reforma tributária, mesmo com número na frase', () => {
    expect(read('reforma tributária cortando 5% dos impostos').action).toBe('CONFIGURAR');
  });
});

describe('números do país que não são imposto', () => {
  it('não confunde salário mínimo com tributo', () => {
    const leitura = read('Aumentar o salário mínimo para R$ 1.800');
    expect(leitura.intent).toBe('alterar_numero');
    expect(leitura.reading).toContain('Salário mínimo');
    expect(leitura.action).toBe('DIRETO');
  });

  it('continua lendo imposto como imposto', () => {
    expect(read('diminuir o imposto de renda').intent).toBe('reduzir_imposto');
    expect(read('aumentar a tributação de dividendos').intent).toBe('aumentar_imposto');
  });
});
