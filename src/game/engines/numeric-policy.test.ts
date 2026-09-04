import { describe, expect, it } from 'vitest';
import {
  analyzeNumericPolicy,
  buildNumericChange,
  createGame,
  findNumbers,
  interpretLocally,
  parseBrazilianNumber,
  processPolicies,
  createPolicy,
  readNumericIntent,
  resolveProposedValue,
  revokePolicy,
  type GameState,
} from './index';
import { Rng } from '../utils/rng';
import { deepClone } from '../utils/clone';
import { newGameSchema } from '../schemas/setup';
import { proposalAnalysisSchema } from '../schemas/proposal';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * MEDIDAS NUMÉRICAS
 *
 * O bug que estes testes existem para impedir: "salário mínimo para R$ 1.700" e
 * "para R$ 1.800" produzirem o mesmo custo, a mesma reação e o mesmo texto.
 *
 * A regra que eles protegem: nenhum impacto pode vir do NOME da medida. Todo
 * impacto vem do valor atual, do valor proposto, da diferença entre os dois, de
 * quem é atingido e do estado da economia. Duas propostas diferentes têm de
 * produzir simulações diferentes — e propostas próximas, resultados próximos
 * mas não idênticos, porque a matemática é contínua.
 */
function newGame(seed = 4242): GameState {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = MINISTER_POOL[index % MINISTER_POOL.length]!.id;
  });

  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina',
        lastName: 'Teixeira',
        politicalName: 'Marina Teixeira',
        age: 54,
        gender: 'feminino',
        homeState: 'PE',
        homeCity: 'Recife',
        occupation: 'medico',
        education: 'medicina',
        religion: 'catolico',
        traits: [],
        habits: [],
        avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB',
      customParty: null,
      viceId: 'vp_almeida',
      cabinet,
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal',
      startYear: 2027,
      reelection: false,
      seed,
    }),
  );
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
describe('parser de números em português', () => {
  it('distingue separador de milhar de vírgula decimal', () => {
    expect(parseBrazilianNumber('1.700')).toBe(1700);
    expect(parseBrazilianNumber('1,7')).toBeCloseTo(1.7, 5);
    expect(parseBrazilianNumber('1.234,56')).toBeCloseTo(1234.56, 5);
    expect(parseBrazilianNumber('8,5')).toBeCloseTo(8.5, 5);
    // Grafia mista, comum em quem digita rápido: ponto com um ou dois dígitos
    // é decimal, não milhar.
    expect(parseBrazilianNumber('8.5')).toBeCloseTo(8.5, 5);
    expect(parseBrazilianNumber('1.234.567')).toBe(1234567);
  });

  it('entende as escalas escritas como brasileiro escreve', () => {
    const cases: [string, number][] = [
      ['r$ 1.700', 1700],
      ['1,7 mil', 1700],
      ['r$ 2 bilhoes', 2e9],
      ['2 bi', 2e9],
      ['20 bilhoes', 20e9],
      ['500 mil', 500_000],
      ['3 milhoes', 3e6],
    ];

    for (const [text, expected] of cases) {
      const [first] = findNumbers(text);
      expect(first?.value, `"${text}" deveria virar ${expected}`).toBe(expected);
    }
  });

  it('não confunde "mil" com "milhão"', () => {
    // O prefixo "mi" de "mil" já multiplicou medidas por mil por engano.
    expect(findNumbers('500 mil casas')[0]?.value).toBe(500_000);
    expect(findNumbers('500 milhoes de reais')[0]?.value).toBe(500e6);
  });

  it('reconhece percentual em qualquer grafia', () => {
    expect(findNumbers('8%')[0]?.kind).toBe('percent');
    expect(findNumbers('8,5%')[0]?.value).toBeCloseTo(8.5, 5);
    expect(findNumbers('8.5%')[0]?.value).toBeCloseTo(8.5, 5);
    expect(findNumbers('10 por cento')[0]?.kind).toBe('percent');
  });
});

// ---------------------------------------------------------------------------
// Leitura da intenção
// ---------------------------------------------------------------------------
describe('leitura da intenção numérica', () => {
  const state = newGame();

  it('lê "para X" como valor final, e não como acréscimo', () => {
    const intent = readNumericIntent('Aumentar o salário mínimo para R$ 1.700', state);
    expect(intent?.operation).toBe('SET_VALUE');
    expect(resolveProposedValue(intent!, 1620)).toBe(1700);
  });

  it('lê "em R$ X" como acréscimo sobre o valor atual', () => {
    const intent = readNumericIntent('Aumentar o salário mínimo em R$ 100', state);
    expect(intent?.operation).toBe('INCREASE_ABSOLUTE');
    expect(resolveProposedValue(intent!, 1620)).toBe(1720);
  });

  it('lê "em X%" como variação relativa', () => {
    const intent = readNumericIntent('Aumentar o salário mínimo em 10%', state);
    expect(intent?.operation).toBe('INCREASE_PERCENT');
    expect(resolveProposedValue(intent!, 1620)).toBeCloseTo(1782, 5);
  });

  it('lê "de X para Y" com o ponto de partida e o de chegada', () => {
    const intent = readNumericIntent('Reduzir o FGTS patronal de 8% para 6%', state);
    expect(intent?.operation).toBe('SET_VALUE');
    expect(intent?.statedCurrent).toBe(8);
    expect(intent?.value).toBe(6);
  });

  it('nunca usa o valor atual que o texto afirma, e sim o do estado', () => {
    // O jogador erra o valor vigente de propósito: o motor ignora e usa o real.
    const change = buildNumericChange(
      readNumericIntent('Reduzir o FGTS patronal de 30% para 6%', state)!,
      state,
    );
    expect(change.currentValue).toBe(state.companies.levers.fgtsRate);
    expect(change.proposedValue).toBe(6);
  });

  it('lê prazo e transição sem confundir com o valor da medida', () => {
    const temporary = readNumericIntent(
      'Reduzir o IOF para 10% durante 6 meses',
      state,
    );
    expect(temporary?.value).toBe(10);
    expect(temporary?.temporary).toBe(true);
    expect(temporary?.durationMonths).toBe(6);

    const gradual = readNumericIntent(
      'Aumentar o salário mínimo para R$ 1.800 ao longo de dois anos',
      state,
    );
    expect(gradual?.value).toBe(1800);
    expect(gradual?.gradualMonths).toBe(24);
  });
});

// ---------------------------------------------------------------------------
// O bug original
// ---------------------------------------------------------------------------
describe('salário mínimo: 1.700 e 1.800 não podem ser a mesma medida', () => {
  const state = newGame();
  const caseA = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.700', state)!;
  const caseB = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.800', state)!;

  it('calcula o delta e a variação corretos em cada caso', () => {
    expect(caseA.change.currentValue).toBe(1620);
    expect(caseA.change.absoluteDelta).toBe(80);
    expect(caseA.change.percentageDelta).toBeCloseTo(4.938, 2);

    expect(caseB.change.absoluteDelta).toBe(180);
    expect(caseB.change.percentageDelta).toBeCloseTo(11.111, 2);
  });

  it('produz impacto fiscal, empresarial e econômico diferentes', () => {
    expect(caseA.fiscal.netAnnual).not.toBe(caseB.fiscal.netAnnual);
    expect(caseB.fiscal.netAnnual).toBeGreaterThan(caseA.fiscal.netAnnual * 1.6);

    expect(caseB.business.payrollCostAnnual).toBeGreaterThan(caseA.business.payrollCostAnnual * 1.6);
    expect(caseB.households.extraIncomeAnnual).toBeGreaterThan(caseA.households.extraIncomeAnnual);
    expect(caseB.households.consumptionChange).toBeGreaterThan(caseA.households.consumptionChange);
    expect((caseB.macro.inflation ?? 0)).toBeGreaterThan(caseA.macro.inflation ?? 0);
    expect((caseB.macro.unemployment ?? 0)).toBeGreaterThan(caseA.macro.unemployment ?? 0);
  });

  it('classifica a magnitude sem deixar a faixa substituir a conta', () => {
    expect(caseA.change.magnitude).toBe('moderate');
    expect(caseB.change.magnitude).toBe('veryLarge');

    // Duas medidas na MESMA faixa continuam diferentes: é a conta que manda.
    const seis = analyzeNumericPolicy('Aumentar o salário mínimo em 6%', state)!;
    const noveEMeio = analyzeNumericPolicy('Aumentar o salário mínimo em 9,5%', state)!;
    expect(seis.change.magnitude).toBe(noveEMeio.change.magnitude);
    expect(seis.fiscal.netAnnual).not.toBe(noveEMeio.fiscal.netAnnual);
    expect(seis.macro.inflation).not.toBe(noveEMeio.macro.inflation);
  });

  it('produz efeitos contínuos: 4,9% e 5,1% são próximos, não iguais', () => {
    const a = analyzeNumericPolicy('Aumentar o salário mínimo em 4,9%', state)!;
    const b = analyzeNumericPolicy('Aumentar o salário mínimo em 5,1%', state)!;

    expect(a.fiscal.netAnnual).not.toBe(b.fiscal.netAnnual);
    const diferenca = Math.abs(b.fiscal.netAnnual - a.fiscal.netAnnual);
    expect(diferenca).toBeLessThan(a.fiscal.netAnnual * 0.15);
  });

  it('gera títulos, resumos e manchetes diferentes', () => {
    const a = interpretLocally('Aumentar o salário mínimo para R$ 1.700', state);
    const b = interpretLocally('Aumentar o salário mínimo para R$ 1.800', state);

    expect(a.title).not.toBe(b.title);
    expect(a.summary).not.toBe(b.summary);
    expect(a.headline).not.toBe(b.headline);
    expect(a.estimatedCost).not.toBe(b.estimatedCost);
    // A manchete cita o número real da proposta.
    expect(b.headline).toContain('1.800');
  });

  it('reage com intensidade proporcional em cada grupo social', () => {
    const trabalhadoresA = caseA.groups.find((group) => group.groupId === 'baixa_renda')?.delta ?? 0;
    const trabalhadoresB = caseB.groups.find((group) => group.groupId === 'baixa_renda')?.delta ?? 0;
    const empresasA = caseA.groups.find((group) => group.groupId === 'empresariado')?.delta ?? 0;
    const empresasB = caseB.groups.find((group) => group.groupId === 'empresariado')?.delta ?? 0;

    expect(trabalhadoresB).toBeGreaterThan(trabalhadoresA);
    expect(empresasB).toBeLessThan(empresasA);
  });
});

// ---------------------------------------------------------------------------
// Conceito: quem paga o quê
// ---------------------------------------------------------------------------
describe('salário mínimo não é despesa federal sobre todo trabalhador', () => {
  const state = newGame();
  const impact = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.700', state)!;

  it('separa a folha privada do custo do Tesouro', () => {
    // A folha do setor privado é paga pelo empregador e NÃO entra na conta
    // fiscal federal. Somar as duas era o erro que produzia números absurdos.
    expect(impact.business.payrollCostAnnual).toBeGreaterThan(0);
    const rotulos = impact.fiscal.components.map((component) => component.label.toLowerCase());
    expect(rotulos.some((label) => label.includes('folha privada'))).toBe(false);
  });

  it('abre a conta federal por componente, com a previdência à frente', () => {
    const previdencia = impact.fiscal.components.find((component) =>
      component.label.toLowerCase().includes('previd'),
    );
    expect(previdencia).toBeDefined();
    expect(previdencia!.annualBillions).toBeGreaterThan(0);

    // A parcela previdenciária é a maior despesa isolada do reajuste.
    const maiorDespesa = [...impact.fiscal.components]
      .filter((component) => component.annualBillions > 0)
      .sort((a, b) => b.annualBillions - a.annualBillions)[0];
    expect(maiorDespesa!.label).toBe(previdencia!.label);
  });

  it('desconta a arrecadação que a própria medida gera', () => {
    expect(impact.fiscal.revenueOffsetAnnual).toBeGreaterThan(0);
    expect(impact.fiscal.netAnnual).toBeLessThan(impact.fiscal.grossAnnual);
  });

  it('mantém o custo bruto na ordem de grandeza de R$ 0,4 bi por real de reajuste', () => {
    // Régua de sanidade da calibragem: cada R$ 1 no piso custa perto de
    // R$ 0,4 bi por ano ao orçamento federal bruto.
    const porReal = impact.fiscal.grossAnnual / impact.change.absoluteDelta;
    expect(porReal).toBeGreaterThan(0.25);
    expect(porReal).toBeLessThan(0.6);
  });

  it('mede o ganho real descontando a inflação, e não subtraindo direto', () => {
    const nominal = impact.change.percentageDelta / 100;
    const inflacao = state.economy.inflation / 100;
    const esperado = ((1 + nominal) / (1 + inflacao) - 1) * 100;
    expect(impact.households.realGain).toBeCloseTo(esperado, 2);
  });
});

// ---------------------------------------------------------------------------
// Outras medidas numéricas
// ---------------------------------------------------------------------------
describe('FGTS', () => {
  const state = newGame();

  it('distingue pontos percentuais de variação relativa', () => {
    const impact = analyzeNumericPolicy('Reduzir o FGTS patronal de 8% para 6%', state)!;
    expect(impact.change.pointDelta).toBe(-2);
    expect(impact.change.percentageDelta).toBeCloseTo(-25, 5);
  });

  it('faz cortes de tamanhos diferentes custarem valores diferentes', () => {
    const leve = analyzeNumericPolicy('Reduzir o FGTS patronal para 7%', state)!;
    const forte = analyzeNumericPolicy('Reduzir o FGTS patronal para 4%', state)!;

    expect(leve.change.absoluteDelta).toBe(-1);
    expect(forte.change.absoluteDelta).toBe(-4);
    expect(Math.abs(forte.fiscal.netAnnual)).toBeGreaterThan(Math.abs(leve.fiscal.netAnnual) * 3);
    expect(Math.abs(forte.business.payrollCostAnnual)).toBeGreaterThan(
      Math.abs(leve.business.payrollCostAnnual) * 3,
    );
    expect(Math.abs(forte.macro.unemployment ?? 0)).toBeGreaterThan(
      Math.abs(leve.macro.unemployment ?? 0),
    );
  });

  it('aplica o recorte quando a medida é restrita a um grupo de empresas', () => {
    const geral = analyzeNumericPolicy('Reduzir o FGTS patronal para 5%', state)!;
    const restrita = analyzeNumericPolicy(
      'Reduzir o FGTS para 5% para microempresas',
      state,
    )!;

    expect(restrita.change.scopeFactor).toBeLessThan(1);
    expect(Math.abs(restrita.fiscal.netAnnual)).toBeLessThan(Math.abs(geral.fiscal.netAnnual));
    expect(restrita.change.affectedPopulation).toBeLessThan(geral.change.affectedPopulation);
  });
});

describe('tributos', () => {
  const state = newGame();

  it('faz 1 ponto e 10 pontos de IRPJ produzirem resultados muito diferentes', () => {
    const pequeno = analyzeNumericPolicy('Reduzir o imposto sobre o lucro em 1 ponto', state);
    const grande = analyzeNumericPolicy('Reduzir o imposto sobre o lucro para 24%', state)!;

    const leve = pequeno ?? analyzeNumericPolicy('Reduzir o imposto sobre o lucro para 33%', state)!;
    expect(Math.abs(grande.change.absoluteDelta)).toBeGreaterThan(
      Math.abs(leve.change.absoluteDelta) * 5,
    );
    expect(Math.abs(grande.fiscal.netAnnual)).toBeGreaterThan(Math.abs(leve.fiscal.netAnnual) * 5);
  });

  it('leva a fuga de base em conta: dobrar a alíquota não dobra a arrecadação', () => {
    const dobro = analyzeNumericPolicy('Aumentar os tributos sobre consumo para 53%', state)!;
    const metade = analyzeNumericPolicy('Aumentar os tributos sobre consumo para 39,75%', state)!;

    const arrecadacaoDobro = Math.abs(dobro.fiscal.revenueOffsetAnnual);
    const arrecadacaoMetade = Math.abs(metade.fiscal.revenueOffsetAnnual);
    expect(arrecadacaoDobro).toBeLessThan(arrecadacaoMetade * 2);
  });
});

describe('orçamentos', () => {
  const state = newGame();

  it('faz R$ 10 bi e R$ 100 bi na saúde produzirem impactos diferentes', () => {
    const pequeno = analyzeNumericPolicy('Aumentar o orçamento da saúde em R$ 10 bilhões', state)!;
    const grande = analyzeNumericPolicy('Aumentar o orçamento da saúde em R$ 100 bilhões', state)!;

    expect(pequeno.change.absoluteDelta).toBe(10);
    expect(grande.change.absoluteDelta).toBe(100);
    expect(grande.fiscal.netAnnual).toBeGreaterThan(pequeno.fiscal.netAnnual * 5);
    expect(grande.macro.healthIndex ?? 0).toBeGreaterThan(pequeno.macro.healthIndex ?? 0);
  });

  it('satura: dez vezes o dinheiro não entrega dez vezes o resultado', () => {
    const pequeno = analyzeNumericPolicy('Aumentar o orçamento da saúde em R$ 10 bilhões', state)!;
    const grande = analyzeNumericPolicy('Aumentar o orçamento da saúde em R$ 100 bilhões', state)!;

    const ganhoPequeno = pequeno.macro.healthIndex ?? 0;
    const ganhoGrande = grande.macro.healthIndex ?? 0;
    expect(ganhoGrande).toBeLessThan(ganhoPequeno * 10);
  });
});

describe('medidas extremas', () => {
  const state = newGame();

  it('não normaliza um pedido absurdo: ele custa o que custa', () => {
    const impact = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 50.000', state)!;

    expect(impact.change.proposedValue).toBe(50_000);
    expect(impact.change.magnitude).toBe('extreme');
    expect(impact.fiscal.netAnnual).toBeGreaterThan(1_000);
    expect(impact.macro.inflation ?? 0).toBeGreaterThan(1);
    expect(impact.macro.unemployment ?? 0).toBeGreaterThan(1);
  });

  it('cresce de forma não linear: 50% custa muito mais que cinco vezes 10%', () => {
    const dez = analyzeNumericPolicy('Aumentar o salário mínimo em 10%', state)!;
    const cinquenta = analyzeNumericPolicy('Aumentar o salário mínimo em 50%', state)!;

    const inflacaoDez = dez.macro.inflation ?? 0;
    const inflacaoCinquenta = cinquenta.macro.inflation ?? 0;
    expect(inflacaoCinquenta).toBeGreaterThan(inflacaoDez * 5);
  });

  it('mantém a ficha válida mesmo quando o número estoura a escala do país', () => {
    const analysis = interpretLocally('Aumentar o salário mínimo para R$ 500.000', state);
    expect(proposalAnalysisSchema.safeParse(analysis).success).toBe(true);
    expect(analysis.warnings.some((warning) => warning.includes('ruptura'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Determinismo e ciclo de vida
// ---------------------------------------------------------------------------
describe('determinismo e aplicação', () => {
  it('produz sempre o mesmo cálculo para o mesmo estado e o mesmo texto', () => {
    const state = newGame();
    const primeira = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.800', state)!;
    const segunda = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.800', state)!;

    expect(segunda.fiscal.netAnnual).toBe(primeira.fiscal.netAnnual);
    expect(segunda.macro.inflation).toBe(primeira.macro.inflation);
    expect(segunda.business.payrollCostAnnual).toBe(primeira.business.payrollCostAnnual);
  });

  it('muda o cálculo quando a economia muda, com a mesma proposta', () => {
    const calma = newGame();
    const inflacionada = deepClone(calma);
    inflacionada.economy.inflation = 15;

    const a = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.800', calma)!;
    const b = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.800', inflacionada)!;

    // O mesmo reajuste nominal vale muito menos com inflação alta.
    expect(b.households.realGain).toBeLessThan(a.households.realGain);
    expect(b.macro.inflation ?? 0).toBeLessThan(a.macro.inflation ?? 0);
  });

  it('grava o valor novo no estado só quando a medida entra em vigor', () => {
    const state = newGame();
    const analysis = interpretLocally('Aumentar o salário mínimo para R$ 1.800', state);
    const rng = new Rng(state.seed, state.rngCursor);
    const policy = createPolicy(analysis, 'Aumentar o salário mínimo para R$ 1.800', state, rng, false);
    state.policies.push(policy);

    // Assinada, mas ainda não vigente: o piso continua onde estava.
    expect(state.economy.minimumWage).toBe(1620);

    policy.status = 'assinada';
    processPolicies(state, rng);
    expect(state.economy.minimumWage).toBe(1800);

    // Revogada: volta ao valor anterior.
    revokePolicy(state, policy.id);
    expect(state.economy.minimumWage).toBe(1620);
  });
});

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------
describe('nada de multiplicador na tela', () => {
  it('não menciona "intensidade" em nenhum texto mostrado ao jogador', () => {
    const state = newGame();
    const textos = [
      'Aumentar o salário mínimo para R$ 1.700',
      'Reduzir o FGTS patronal de 8% para 6%',
      'Aumentar o orçamento da saúde em R$ 20 bilhões',
      'Criar programa de reforma de casas de famílias pobres',
      'Vou melhorar a educação do país',
    ];

    for (const texto of textos) {
      const analysis = interpretLocally(texto, state);
      const visivel = [
        analysis.title,
        analysis.summary,
        analysis.headline,
        analysis.rationale,
        ...analysis.warnings,
      ]
        .join(' ')
        .toLowerCase();

      expect(visivel, `"${texto}" ainda fala em intensidade`).not.toMatch(/intensidade/);
      expect(visivel, `"${texto}" ainda mostra multiplicador`).not.toMatch(/\d[,.]\d\s*x\b/);
    }
  });

  it('mostra valor atual, valor proposto e as duas variações', () => {
    const state = newGame();
    const analysis = interpretLocally('Reduzir o FGTS patronal de 8% para 6%', state);
    const change = analysis.numericImpact!.change;

    expect(change.currentValue).toBe(8);
    expect(change.proposedValue).toBe(6);
    expect(change.pointDelta).toBe(-2);
    expect(change.percentageDelta).toBeCloseTo(-25, 5);
    expect(analysis.title).toContain('8%');
    expect(analysis.title).toContain('6%');
  });
});
