import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import { interpretLocally } from './fallback-interpreter';
import { createPolicy } from './policy';
import { tickMonth } from './index';
import { readProgramAbolition } from './program-text';
import { Rng } from '../utils/rng';
import { proposalAnalysisSchema } from '../schemas/proposal';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import type { GameState } from '../types/index';

/**
 * AS PROPOSTAS DE PLATAFORMA
 *
 * Oito bandeiras que o jogador escreve pelo nome, cada uma com muitas formas de
 * ser dita. O que este arquivo cobra é o que quebra na prática:
 *
 * 1. RECONHECIMENTO. "Acabar com a CLT", "extinguir a Justiça do Trabalho" e
 *    "desonerar a folha" são a MESMA medida e têm de chegar no mesmo lugar.
 * 2. DIREÇÃO. Este é o erro caro. A palavra-chave dessas propostas já É a ação
 *    ("cortar gasto", "acabar com a fila do SUS"), e a leitura padrão do jogo
 *    inverte o sinal quando vê um verbo de redução perto. Sem `selfDirected`,
 *    pedir aperto fiscal produzia expansão fiscal — e o jogo mentia em silêncio.
 * 3. CONTA A PAGAR. Nenhuma plataforma entra sem perdedor. Uma medida em que
 *    todo mundo ganha não é política, é propaganda.
 */
function newGame(seed = 11): GameState {
  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira',
        age: 54, gender: 'feminino', homeState: 'PE', 
        occupation: 'medico', religion: 'catolico',
        traits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida',
      cabinet: defaultCabinet(MINISTRY_IDS),
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      startYear: 2027, reelection: true, seed,
    }),
  );
}

/** Assina a medida escrita à mão e roda meses até ela entrar em vigor. */
function enact(base: GameState, texto: string, months = 6): GameState {
  const state = structuredClone(base);
  const analysis = interpretLocally(texto, state);
  const rng = new Rng(state.seed, state.rngCursor);
  const policy = createPolicy(analysis, texto, state, rng, false);
  policy.status = 'aprovada';
  policy.stage = 'sancao';
  state.rngCursor = rng.cursor;
  state.policies.push(policy);

  let current = state;
  for (let index = 0; index < months; index += 1) current = tickMonth(current).state;
  return current;
}

/**
 * Cada proposta e o pedaço do rótulo que prova que ela foi reconhecida, com
 * todas as formas de escrevê-la que o jogo precisa aceitar.
 */
const PROPOSTAS: { nome: string; rotulo: string; frases: string[] }[] = [
  {
    nome: 'Guerra ao Crime',
    rotulo: 'crime organizado',
    frases: [
      'Declarar guerra ao crime organizado',
      'Guerra contra o crime no Brasil inteiro',
      'Acabar com as faccoes criminosas de uma vez',
      'Adotar o modelo de El Salvador na seguranca publica',
      'Construir um CECOT brasileiro e prender os chefes do trafico',
      'Aplicar o direito penal do inimigo contra o crime organizado',
      'Fazer o que o Bukele fez com as gangues',
      'Mao dura com bandido',
      'Endurecer com o crime organizado',
      'Lancar uma ofensiva total contra as faccoes',
      'Criar programa de combate ao crime organizado',
      'Tolerancia zero com o crime',
    ],
  },
  {
    nome: 'Superpresídios',
    rotulo: 'presídios federais',
    frases: [
      'Construir superpresidios federais',
      'Criar presidios de seguranca maxima em local remoto',
      'Isolar os chefes das faccoes em penitenciaria federal',
      'Abrir mais vagas no sistema prisional',
      'Construir mais presidios',
      'Ampliar as vagas prisionais do pais',
    ],
  },
  {
    nome: 'Intervenção federal na segurança',
    rotulo: 'intervenção federal',
    frases: [
      'Decretar intervencao federal na seguranca do Rio de Janeiro',
      'Federalizar a seguranca publica',
      'Intervir na seguranca dos estados',
      'Assumir a seguranca do estado do Rio',
      'Decretar intervencao na seguranca publica',
    ],
  },
  {
    nome: 'PEC do Equilíbrio Fiscal',
    rotulo: 'ajuste fiscal',
    frases: [
      'Aprovar a PEC do Equilibrio Fiscal',
      'Fazer um ajuste fiscal duro',
      'Cortar gasto publico para conter a divida',
      'Criar uma ancora fiscal',
      'Reduzir o tamanho do Estado',
      'Enxugar a maquina publica',
      'Retomar o teto de gastos',
      'Fazer um corte de gastos para controlar a divida publica',
    ],
  },
  {
    nome: 'Fim da CLT',
    rotulo: 'CLT',
    frases: [
      'Acabar com a CLT',
      'Substituir a CLT por um novo marco trabalhista',
      'Extinguir a Justica do Trabalho',
      'Fazer uma reforma trabalhista ampla',
      'Flexibilizar as leis trabalhistas',
      'Desonerar a folha de pagamento',
      'Dar liberdade de contratar as empresas',
      'Modernizar as leis trabalhistas do pais',
    ],
  },
  {
    nome: 'Reforma municipal',
    rotulo: 'municípios',
    frases: [
      'Fazer a reforma municipal',
      'Fundir municipios inviaveis',
      'Reduzir o numero de municipios do pais',
      'Extinguir municipios pequenos demais',
      'Juntar municipios sem viabilidade',
    ],
  },
  {
    nome: 'SUS Fila Zero',
    rotulo: 'fila do SUS',
    frases: [
      'Implantar o SUS Fila Zero',
      'Acabar com a fila do SUS',
      'Zerar a fila do SUS',
      'Organizar a fila do SUS por risco clinico',
      'Priorizar por gravidade no atendimento do SUS',
      'Fazer mutirao de cirurgias',
      'Reduzir o tempo de espera no SUS',
    ],
  },
  {
    nome: 'Alfabetização na idade certa',
    rotulo: 'método fônico',
    frases: [
      'Adotar o metodo fonico na alfabetizacao',
      'Garantir alfabetizacao na idade certa',
      'Acabar com a progressao continuada',
      'Fim da aprovacao automatica nas escolas',
      'Criar metas de aprendizagem para diretores',
      'Avaliar o desempenho das escolas',
    ],
  },
];

const state = newGame();

describe('as propostas de plataforma chegam ao mesmo lugar', () => {
  for (const proposta of PROPOSTAS) {
    it(`entende as ${proposta.frases.length} formas de pedir: ${proposta.nome}`, () => {
      for (const frase of proposta.frases) {
        const analysis = interpretLocally(frase, state);

        expect(analysis.title, frase).toContain(proposta.rotulo);
        expect(proposalAnalysisSchema.safeParse(analysis).success, frase).toBe(true);
        expect(Object.keys(analysis.impacts).length, frase).toBeGreaterThan(0);
      }
    });
  }

  it('nenhuma delas sai de graça: toda plataforma tem perdedor declarado', () => {
    for (const proposta of PROPOSTAS) {
      for (const frase of proposta.frases) {
        const analysis = interpretLocally(frase, state);
        const perdedores = analysis.groupImpacts.filter((grupo) => grupo.delta < 0);

        expect(perdedores.length, `${frase} nao tem perdedor`).toBeGreaterThan(0);
        expect(analysis.groupImpacts.some((grupo) => grupo.delta > 0), frase).toBe(true);
      }
    }
  });
});

describe('a direção da medida é a que o presidente escreveu', () => {
  // O erro que este bloco existe para impedir: "cortar gasto publico" lido como
  // REDUCAO do ajuste fiscal, o que inverte todo indicador e transforma aperto
  // em gastanca.
  it('pedir aperto fiscal aperta, escrito de qualquer jeito', () => {
    for (const frase of [
      'Aprovar a PEC do Equilibrio Fiscal',
      'Cortar gasto publico para conter a divida',
      'Enxugar a maquina publica',
      'Reduzir o tamanho do Estado',
    ]) {
      const { impacts } = interpretLocally(frase, state);
      expect(impacts.primaryBalance ?? 0, frase).toBeGreaterThan(0);
      expect(impacts.countryRisk ?? 0, frase).toBeLessThan(0);
      // E cobra o preco: menos crescimento e mais desemprego no curto prazo.
      expect(impacts.unemployment ?? 0, frase).toBeGreaterThan(0);
    }
  });

  it('acabar com a CLT desregula o trabalho, e nao o contrário', () => {
    for (const frase of [
      'Acabar com a CLT',
      'Extinguir a Justica do Trabalho',
      'Flexibilizar as leis trabalhistas',
      'Desonerar a folha de pagamento',
    ]) {
      const { impacts, groupImpacts } = interpretLocally(frase, state);
      expect(impacts.unemployment ?? 0, frase).toBeLessThan(0);
      expect(impacts.businessConfidence ?? 0, frase).toBeGreaterThan(0);
      // A desigualdade sobe junto: e isso que separa a medida de um almoco gratis.
      expect(impacts.gini ?? 0, frase).toBeGreaterThan(0);

      const trabalhadores = groupImpacts.find((grupo) => grupo.groupId === 'trabalhadores');
      expect(trabalhadores?.delta ?? 0, frase).toBeLessThan(0);
    }
  });

  it('acabar com a fila do SUS melhora a saúde, e nao a corta', () => {
    for (const frase of [
      'Acabar com a fila do SUS',
      'Zerar a fila do SUS',
      'Implantar o SUS Fila Zero',
    ]) {
      const { impacts } = interpretLocally(frase, state);
      expect(impacts.healthIndex ?? 0, frase).toBeGreaterThan(0);
      expect(impacts.primaryBalance ?? 0, frase).toBeLessThan(0);
    }
  });

  it('reduzir o número de municípios É a reforma, e economiza', () => {
    for (const frase of [
      'Reduzir o numero de municipios do pais',
      'Extinguir municipios pequenos demais',
    ]) {
      const { impacts } = interpretLocally(frase, state);
      expect(impacts.primaryBalance ?? 0, frase).toBeGreaterThan(0);
    }
  });

  it('mas um verbo de cancelamento ainda inverte a leitura', () => {
    // Autodirigido nao quer dizer irreversivel: quem revoga a PEC desfaz o
    // aperto, e o jogo tem de ler isso.
    const { impacts } = interpretLocally('Revogar a PEC do equilibrio fiscal', state);
    expect(impacts.primaryBalance ?? 0).toBeLessThan(0);
  });
});

describe('a segurança dura cobra o preço da segurança dura', () => {
  it('guerra ao crime derruba homicídio e sobe o risco-país', () => {
    const { impacts, legalRisk, groupImpacts } = interpretLocally(
      'Declarar guerra ao crime organizado',
      state,
    );

    expect(impacts.homicideRate ?? 0).toBeLessThan(0);
    expect(impacts.securityIndex ?? 0).toBeGreaterThan(0);
    // O preco: risco juridico alto e o mundo cobrando.
    expect(legalRisk).toBeGreaterThan(60);
    expect(impacts.countryRisk ?? 0).toBeGreaterThan(0);
    expect(groupImpacts.find((grupo) => grupo.groupId === 'policiais')?.delta ?? 0).toBeGreaterThan(0);
  });

  it('a medida assinada muda o país de verdade, e não só a análise', () => {
    const antes = newGame();
    const depois = enact(antes, 'Declarar guerra ao crime organizado', 8);

    expect(depois.nation.homicideRate).toBeLessThan(antes.nation.homicideRate);
    expect(depois.nation.securityIndex).toBeGreaterThan(antes.nation.securityIndex);
  });
});

describe('as plataformas não atropelam outras partes do jogo', () => {
  it('falar de escola não apaga o programa Escola em Tempo Integral', () => {
    // "escola" e o apelido curto do programa. Sem casar palavra inteira,
    // "nas escolas" apagava um programa que a frase nem citou.
    for (const frase of [
      'Fim da aprovacao automatica nas escolas',
      'Acabar com a progressao continuada nas escolas',
      'Avaliar o desempenho das escolas',
    ]) {
      expect(readProgramAbolition(frase, state), frase).toHaveLength(0);
    }

    // E o programa continua na lista depois que a medida entra em vigor.
    const depois = enact(newGame(), 'Fim da aprovacao automatica nas escolas', 4);
    expect(depois.programs.some((programa) => programa.name.startsWith('Escola'))).toBe(true);
  });

  it('meta de aprendizagem é educação, não incentivo à contratação', () => {
    // "aprendiz" casava "aprendizagem" porque a busca aceita sufixo.
    expect(interpretLocally('Criar metas de aprendizagem para diretores', state).category).toBe(
      'educacao',
    );
    // E o Jovem Aprendiz continua sendo lido como politica de emprego.
    expect(interpretLocally('Ampliar o Jovem Aprendiz nas empresas', state).category).toBe(
      'trabalho',
    );
  });

  it('nenhuma plataforma longa entra por medida provisória', () => {
    // Bug real, e caro: a guerra ao crime era uma MP de 24 meses de execucao.
    // MP caduca em quatro e o motor REVERTE tudo o que ela entregou, entao a
    // medida devolvia MAIS homicidio do que havia antes de ser assinada. Uma
    // medida que leva mais tempo para entregar do que a MP dura nao pode ser MP.
    for (const proposta of PROPOSTAS) {
      const analysis = interpretLocally(proposta.frases[0] as string, state);
      if (analysis.executionMonths <= 4) continue;
      expect(analysis.instrument, proposta.nome).not.toBe('medida_provisoria');
    }
  });

  it('cada proposta cai na pasta certa da Esplanada', () => {
    const esperado: [string, string][] = [
      ['Declarar guerra ao crime organizado', 'justica'],
      ['Construir superpresidios federais', 'justica'],
      ['Federalizar a seguranca publica', 'justica'],
      ['Aprovar a PEC do Equilibrio Fiscal', 'fazenda'],
      ['Acabar com a CLT', 'fazenda'],
      ['Fazer a reforma municipal', 'casa_civil'],
      ['Implantar o SUS Fila Zero', 'saude'],
      ['Adotar o metodo fonico na alfabetizacao', 'educacao'],
    ];

    for (const [frase, pasta] of esperado) {
      expect(interpretLocally(frase, state).affectedMinistries, frase).toContain(pasta);
    }
  });
});
