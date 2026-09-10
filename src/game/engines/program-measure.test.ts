import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import { buildMeasureFromPlan, composeMeasureText } from './builders/plan';
import { interpretLocally } from './fallback-interpreter';
import { createPolicy } from './policy';
import { tickMonth } from './index';
import { rulesForProgram } from '../data/program-rules';
import { NUMERIC_TARGETS } from '../data/numeric-targets';
import { Rng } from '../utils/rng';
import { proposalAnalysisSchema } from '../schemas/proposal';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import type { GameState, MeasurePlan } from '../types/index';

/**
 * MEXER NUM PROGRAMA PELO PAINEL
 *
 * O bug que este arquivo existe para impedir tinha uma cara muito específica na
 * tela: o jogador abria o Bolsa Família, escolhia "reduzir o orçamento", e a
 * ficha do gabinete dizia
 *
 *   R$ 664  →  R$ -9.999.999.336   (-1.506.024.096,4%)
 *   custo estimado: R$ 1,50 tri
 *
 * A causa era uma ida e volta pela linguagem. O painel escrevia "reduzir o
 * orçamento do Bolsa Família em R$ 10 bilhões por ano" e mandava o
 * interpretador ler de volta; ele achava a alavanca "benefício de transferência
 * de renda", que vale R$ 664 POR FAMÍLIA POR MÊS, e subtraía dez bilhões dela.
 *
 * Três coisas quebravam ao mesmo tempo, e as três estão cobradas aqui:
 *
 * 1. O painel colava a quantia em QUALQUER cláusula, inclusive nas que não
 *    falam de dinheiro ("alterar os critérios de elegibilidade em R$ 10 bilhões
 *    por ano").
 * 2. O controle de quantia não era mostrado no painel de programa, mas o valor
 *    padrão de R$ 10 bi viajava no plano assim mesmo. O jogador nunca escolheu
 *    aquele número.
 * 3. Nada no motor numérico impedia um valor absurdo de atravessar até a tela.
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
      difficulty: 'normal', startYear: 2027, reelection: true, seed,
    }),
  );
}

function planoDoBolsaFamilia(
  state: GameState,
  optionIds: string[],
  extra: Partial<MeasurePlan> = {},
): MeasurePlan {
  const programa = state.programs.find((entry) => entry.id === 'renda_base')!;
  return {
    builderId: 'programa',
    title: 'Programa de governo',
    optionIds,
    changes: [],
    entityId: programa.id,
    entityName: programa.name,
    ...extra,
  };
}

/** Assina a medida montada no painel e roda meses até ela valer. */
function enact(state: GameState, plan: MeasurePlan, meses = 3): GameState {
  const { analysis, text } = buildMeasureFromPlan(plan, state);
  const rng = new Rng(state.seed, state.rngCursor);
  const policy = createPolicy(analysis, text, state, rng, false);
  policy.status = 'aprovada';
  policy.stage = 'sancao';
  state.rngCursor = rng.cursor;
  state.policies.push(policy);

  let current = state;
  for (let index = 0; index < meses; index += 1) current = tickMonth(current).state;
  return current;
}

const OPERACOES = [
  'ampliar_orcamento',
  'reduzir_orcamento',
  'ampliar_beneficio',
  'ampliar_publico',
  'restringir_publico',
  'condicionalidades',
  'suspender',
  'encerrar',
];

describe('o painel de programa não produz mais número absurdo', () => {
  it('nenhuma operação gera valor fora da escala do programa', () => {
    const state = newGame();
    const programa = state.programs.find((entry) => entry.id === 'renda_base')!;
    const custoAnual = programa.monthlyCost * 12;

    for (const optionId of OPERACOES) {
      const plan = planoDoBolsaFamilia(state, [optionId], { amount: 10 });
      const { analysis } = buildMeasureFromPlan(plan, state);

      expect(proposalAnalysisSchema.safeParse(analysis).success, optionId).toBe(true);

      // O caso da tela: custo de R$ 1,5 tri por um corte de R$ 10 bi. Nenhuma
      // operação num programa de R$ 170 bi/ano pode custar mais que o dobro do
      // programa inteiro.
      const custoEmBi = Math.abs(analysis.estimatedCost) / 1e9;
      expect(custoEmBi, `${optionId} custou R$ ${custoEmBi.toFixed(0)} bi`).toBeLessThanOrEqual(
        custoAnual * 2,
      );

      // E o número que aparece na manchete tem de ser legível por um humano.
      expect(analysis.headline, optionId).not.toMatch(/-\d{4}/);
      expect(analysis.headline.length, optionId).toBeLessThanOrEqual(160);
    }
  });

  it('a quantia não se cola em cláusula que não fala de dinheiro', () => {
    const state = newGame();
    // Era isto que saía antes: "alterar os critérios de elegibilidade do Bolsa
    // Família EM R$ 10 BILHÕES POR ANO".
    const texto = composeMeasureText(
      planoDoBolsaFamilia(state, ['alterar_regras'], {
        ruleValues: { linha_renda: 300, frequencia_escolar: 80, regra_protecao: 24 },
      }),
      state,
    );

    expect(texto).not.toMatch(/elegibilidade.*bilh/i);
    expect(texto).toContain('linha de renda per capita');
  });

  it('extinguir pelo painel continua igual a digitar à mão', () => {
    const state = newGame();
    const doPainel = buildMeasureFromPlan(planoDoBolsaFamilia(state, ['encerrar']), state);
    const digitado = interpretLocally('Acabar com o Bolsa Família', state);

    expect(doPainel.analysis.headline).toBe(digitado.headline);
    expect(doPainel.analysis.estimatedCost).toBe(digitado.estimatedCost);
  });
});

describe('a leitura numérica se recusa a inventar conta', () => {
  it('número em outra unidade não vira variação da alavanca', () => {
    const state = newGame();
    // R$ 10 bi não é uma variação possível de um benefício de R$ 664 por mês.
    const analysis = interpretLocally(
      'Reduzir o orçamento do Bolsa Família em R$ 10 bilhões por ano',
      state,
    );

    expect(proposalAnalysisSchema.safeParse(analysis).success).toBe(true);
    expect(analysis.headline).not.toContain('-9.999');
    expect(Math.abs(analysis.estimatedCost)).toBeLessThanOrEqual(1e12);
  });

  it('valor final fora da faixa é grampeado na faixa declarada do alvo', () => {
    const state = newGame();
    // Todo alvo declara a faixa em que faz sentido existir. Pedir um valor fora
    // dela não pode atravessar o motor: entra grampeado no limite declarado, e
    // é o limite do PRÓPRIO alvo que manda, nunca um número escolhido aqui.
    const alvo = NUMERIC_TARGETS.find((entry) => entry.id === 'minimumWage')!;
    const analysis = interpretLocally('Aumentar o salário mínimo para R$ 900.000', state);
    const proposto = analysis.numericImpact?.change.proposedValue;

    expect(proposto).toBeDefined();
    expect(proposto!).toBeLessThanOrEqual(alvo.plausible.max);
    expect(proposto!).toBeGreaterThanOrEqual(alvo.plausible.min);
    expect(proposalAnalysisSchema.safeParse(analysis).success).toBe(true);
  });
});

describe('as três regras de entrada do Bolsa Família', () => {
  const regras = rulesForProgram('renda_base', 'social');

  it('são três, e começam no valor que vale hoje no Brasil', () => {
    expect(regras.rules).toHaveLength(3);
    expect(regras.rules.map((rule) => rule.id)).toEqual([
      'linha_renda',
      'frequencia_escolar',
      'regra_protecao',
    ]);

    // Os valores reais da regra vigente. Se um dia mudarem na vida real, este
    // teste é o lugar onde alguém repara.
    const porId = Object.fromEntries(regras.rules.map((rule) => [rule.id, rule.baseline]));
    expect(porId.linha_renda).toBe(218);
    expect(porId.frequencia_escolar).toBe(80);
    expect(porId.regra_protecao).toBe(24);
  });

  it('cada régua tem os dois lados escritos, e nenhuma é de graça', () => {
    for (const rule of regras.rules) {
      expect(rule.higher.length, rule.id).toBeGreaterThan(20);
      expect(rule.lower.length, rule.id).toBeGreaterThan(20);
      expect(rule.min, rule.id).toBeLessThan(rule.baseline);
      expect(rule.max, rule.id).toBeGreaterThan(rule.baseline);
      // Toda régua move alguém para cada lado: sem isso, não é um dilema.
      expect(rule.groupsPerStep.some((grupo) => grupo.delta > 0), rule.id).toBe(true);
      expect(rule.groupsPerStep.some((grupo) => grupo.delta < 0), rule.id).toBe(true);
    }
  });

  it('nenhuma régua declara efeito fiscal: quem paga é o custeio do programa', () => {
    // A conta dobrada é o erro clássico deste motor. O custo de abrir a regra
    // sai de `coveragePerStep`, que muda o `monthlyCost` do programa de
    // verdade; declarar `primaryBalance` aqui cobraria a mesma conta de novo.
    for (const rule of regras.rules) {
      expect(
        (rule.perStep as Record<string, number>).primaryBalance,
        `${rule.id} declarou primaryBalance`,
      ).toBeUndefined();
    }
  });

  it('mexer numa régua não produz o efeito de mexer em outra', () => {
    const state = newGame();
    const base = { linha_renda: 218, frequencia_escolar: 80, regra_protecao: 24 };

    const linha = buildMeasureFromPlan(
      planoDoBolsaFamilia(state, ['alterar_regras'], { ruleValues: { ...base, linha_renda: 400 } }),
      state,
    ).analysis;
    const frequencia = buildMeasureFromPlan(
      planoDoBolsaFamilia(state, ['alterar_regras'], {
        ruleValues: { ...base, frequencia_escolar: 95 },
      }),
      state,
    ).analysis;
    const protecao = buildMeasureFromPlan(
      planoDoBolsaFamilia(state, ['alterar_regras'], { ruleValues: { ...base, regra_protecao: 48 } }),
      state,
    ).analysis;

    // Abrir a linha de renda combate pobreza e custa caro.
    expect(linha.impacts.poverty ?? 0).toBeLessThan(0);
    expect(linha.estimatedCost).toBeGreaterThan(0);
    expect(linha.programChange?.coverageDelta ?? 0).toBeGreaterThan(0);

    // Apertar a frequência escolar melhora a escola e exclui família.
    expect(frequencia.impacts.educationIndex ?? 0).toBeGreaterThan(0);
    expect(frequencia.impacts.poverty ?? 0).toBeGreaterThan(0);
    expect(frequencia.programChange?.coverageDelta ?? 0).toBeLessThan(0);
    expect(frequencia.impacts.educationIndex ?? 0).toBeGreaterThan(linha.impacts.educationIndex ?? 0);

    // A Regra de Proteção mexe em emprego, que nenhuma das outras duas faz.
    expect(protecao.impacts.unemployment ?? 0).toBeLessThan(0);
    expect(linha.impacts.unemployment ?? undefined).toBeUndefined();

    // E as três produzem fichas diferentes, e não a mesma medida três vezes.
    const resumos = new Set([linha.summary, frequencia.summary, protecao.summary]);
    expect(resumos.size).toBe(3);
  });

  it('fechar a regra é o espelho de abrir: sinais trocados dos dois lados', () => {
    const state = newGame();
    const base = { frequencia_escolar: 80, regra_protecao: 24 };

    const abrir = buildMeasureFromPlan(
      planoDoBolsaFamilia(state, ['alterar_regras'], { ruleValues: { ...base, linha_renda: 400 } }),
      state,
    ).analysis;
    const fechar = buildMeasureFromPlan(
      planoDoBolsaFamilia(state, ['alterar_regras'], { ruleValues: { ...base, linha_renda: 100 } }),
      state,
    ).analysis;

    expect(abrir.impacts.poverty ?? 0).toBeLessThan(0);
    expect(fechar.impacts.poverty ?? 0).toBeGreaterThan(0);
    expect(abrir.estimatedCost).toBeGreaterThan(0);
    expect(fechar.estimatedCost).toBeLessThan(0);

    const baixaAbrir = abrir.groupImpacts.find((grupo) => grupo.groupId === 'baixa_renda');
    const baixaFechar = fechar.groupImpacts.find((grupo) => grupo.groupId === 'baixa_renda');
    expect(baixaAbrir?.delta ?? 0).toBeGreaterThan(0);
    expect(baixaFechar?.delta ?? 0).toBeLessThan(0);
  });

  it('deixar tudo no valor de hoje não vira medida', () => {
    const state = newGame();
    const { analysis } = buildMeasureFromPlan(
      planoDoBolsaFamilia(state, ['alterar_regras'], {
        ruleValues: { linha_renda: 218, frequencia_escolar: 80, regra_protecao: 24 },
      }),
      state,
    );

    expect(analysis.programChange?.coverageDelta ?? 0).toBe(0);
    expect(proposalAnalysisSchema.safeParse(analysis).success).toBe(true);
  });
});

describe('a regra aprovada muda o programa, e não só os indicadores', () => {
  it('abrir a linha de renda põe gente dentro do programa', () => {
    const antes = newGame();
    const programaAntes = antes.programs.find((entry) => entry.id === 'renda_base')!;
    const beneficiariosAntes = programaAntes.beneficiaries;
    const custoAntes = programaAntes.monthlyCost;

    const depois = enact(
      newGame(),
      planoDoBolsaFamilia(newGame(), ['alterar_regras'], {
        ruleValues: { linha_renda: 400, frequencia_escolar: 80, regra_protecao: 24 },
      }),
    );
    const programaDepois = depois.programs.find((entry) => entry.id === 'renda_base')!;

    expect(programaDepois.beneficiaries).toBeGreaterThan(beneficiariosAntes);
    expect(programaDepois.monthlyCost).toBeGreaterThan(custoAntes);
    // Porta mais larga, focalização pior: entra também quem precisa menos.
    expect(programaDepois.efficiency).toBeLessThan(programaAntes.efficiency);
  });

  it('fechar a linha de renda tira gente e devolve caixa', () => {
    const semMedida = enact(newGame(), planoDoBolsaFamilia(newGame(), []), 12);
    const comMedida = enact(
      newGame(),
      planoDoBolsaFamilia(newGame(), ['alterar_regras'], {
        ruleValues: { linha_renda: 100, frequencia_escolar: 80, regra_protecao: 24 },
      }),
      12,
    );

    const semPrograma = semMedida.programs.find((entry) => entry.id === 'renda_base')!;
    const comPrograma = comMedida.programs.find((entry) => entry.id === 'renda_base')!;

    expect(comPrograma.beneficiaries).toBeLessThan(semPrograma.beneficiaries);
    expect(comPrograma.monthlyCost).toBeLessThan(semPrograma.monthlyCost);
    // A economia é real e aparece no caixa, e a pobreza cobra o preço.
    expect(comMedida.economy.treasuryCash).toBeGreaterThan(semMedida.economy.treasuryCash);
    expect(comMedida.nation.povertyRate).toBeGreaterThan(semMedida.nation.povertyRate);
  });

  it('a conta não é cobrada duas vezes', () => {
    // O custeio novo passa a morar no programa. Se a medida também cobrasse o
    // custo dela por mês, o Tesouro pagaria a mesma expansão duas vezes.
    const state = newGame();
    const plan = planoDoBolsaFamilia(state, ['alterar_regras'], {
      ruleValues: { linha_renda: 400, frequencia_escolar: 80, regra_protecao: 24 },
    });
    const { analysis, text } = buildMeasureFromPlan(plan, state);
    const rng = new Rng(state.seed, state.rngCursor);
    const policy = createPolicy(analysis, text, state, rng, false);

    expect(analysis.programChange?.monthlyCostDelta ?? 0).toBeGreaterThan(0);
    expect(policy.monthlyCost).toBe(0);
  });
});

describe('todo programa do jogo tem regras próprias', () => {
  it('cada um dos oito herdados abre três réguas de verdade', () => {
    const state = newGame();

    for (const programa of state.programs) {
      const conjunto = rulesForProgram(programa.id, programa.category);
      expect(conjunto.rules.length, programa.name).toBe(3);
      expect(conjunto.intro.length, programa.name).toBeGreaterThan(30);

      for (const rule of conjunto.rules) {
        expect(rule.baseline, `${programa.name}/${rule.id}`).toBeGreaterThanOrEqual(rule.min);
        expect(rule.baseline, `${programa.name}/${rule.id}`).toBeLessThanOrEqual(rule.max);
        expect(rule.step, `${programa.name}/${rule.id}`).toBeGreaterThan(0);
        expect(rule.format(rule.baseline).length, `${programa.name}/${rule.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('cada programa produz uma medida válida pelas regras dele', () => {
    const state = newGame();

    for (const programa of state.programs) {
      const conjunto = rulesForProgram(programa.id, programa.category);
      const primeira = conjunto.rules[0]!;
      const plan: MeasurePlan = {
        builderId: 'programa',
        title: 'Programa de governo',
        optionIds: ['alterar_regras'],
        changes: [],
        entityId: programa.id,
        entityName: programa.name,
        ruleValues: { [primeira.id]: primeira.baseline + primeira.step * 2 },
      };

      const { analysis } = buildMeasureFromPlan(plan, state);
      expect(proposalAnalysisSchema.safeParse(analysis).success, programa.name).toBe(true);
      expect(analysis.programChange?.programId, programa.name).toBe(programa.id);
    }
  });
});
