import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import { interpretLocally, readRateChange } from './fallback-interpreter';
import { proposalAnalysisSchema } from '../schemas/proposal';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import type { GameState, PolicyCategory } from '../types/index';

/**
 * COBERTURA DO CATÁLOGO DE MEDIDAS
 *
 * O interpretador local precisa reconhecer as medidas de governo que um jogador
 * de fato escreve. Este arquivo passa uma lista realista por ele e cobra três
 * coisas de cada uma:
 *
 *   1. que o assunto seja reconhecido (nada cai no genérico "anúncio sem
 *      instrumento definido");
 *   2. que a análise resultante passe na validação Zod, porque é ela que
 *      protege o estado da partida;
 *   3. que a direção esteja certa — reduzir encargo tem que baratear a folha,
 *      aumentar imposto tem que melhorar o primário.
 *
 * A terceira é a que mais pega regressão: é fácil um tópico novo roubar o
 * casamento de outro e inverter o sinal sem ninguém notar.
 */

function buildState(): GameState {
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
      seed: 7,
      reelection: false,
    }),
  );
}

const state = buildState();

/** Todas as medidas do catálogo de referência, agrupadas como o jogador pensa. */
const MEASURES: Record<string, string[]> = {
  'Trabalho, salários e encargos': [
    'Reduzir o FGTS patronal de 8% para 6%',
    'Aumentar o FGTS patronal de 8% para 10%',
    'Reduzir o FGTS para 5% para microempresas',
    'Criar FGTS progressivo conforme salário',
    'Isentar FGTS para o primeiro funcionário contratado por MEI',
    'Reduzir contribuição patronal ao INSS',
    'Aumentar contribuição patronal ao INSS',
    'Criar desconto previdenciário para empresas que aumentarem salários',
    'Reduzir RAT para empresas com baixo índice de acidentes',
    'Aumentar RAT para empresas com alto índice de acidentes',
    'Reduzir contribuição ao Sistema S',
    'Aumentar contribuição ao Sistema S',
    'Criar contribuição patronal temporária para financiar seguro-desemprego',
    'Criar bônus tributário para empresas que contratarem jovens',
    'Criar subsídio salarial para o primeiro emprego',
    'Reduzir encargos para contratação de trabalhadores acima de 60 anos',
    'Criar benefício fiscal para empresas que transformarem temporários em efetivos',
    'Criar imposto adicional sobre empresas com alta rotatividade de funcionários',
    'Reduzir encargos sobre horas extras para setores estratégicos',
    'Criar programa nacional de participação nos lucros',
  ],
  'Empresas e indústria': [
    'Reduzir Imposto de Renda empresarial',
    'Aumentar Imposto de Renda empresarial',
    'Criar crédito tributário para empresas que investirem em tecnologia',
    'Criar crédito tributário para compra de máquinas nacionais',
    'Criar programa de financiamento subsidiado para pequenas empresas',
    'Reduzir burocracia para abertura de empresas',
    'Criar empresa aberta em 24 horas',
    'Simplificar fechamento de empresas endividadas',
    'Criar incentivo fiscal para instalação de fábricas no interior',
    'Criar imposto sobre lucros extraordinários de determinados setores',
    'Criar programa de reindustrialização nacional',
    'Aumentar tarifas de importação de produtos estratégicos',
    'Reduzir tarifas de importação de máquinas e equipamentos',
    'Criar subsídio para exportadores',
    'Criar fundo de garantia para crédito empresarial',
  ],
  'Impostos e arrecadação': [
    'Reduzir imposto de renda para pessoas de baixa renda',
    'Aumentar imposto de renda para altas rendas',
    'Criar nova faixa de Imposto de Renda para milionários',
    'Aumentar faixa de isenção do IRPF',
    'Reduzir ICMS em produtos essenciais através de acordo com estados',
    'Aumentar imposto sobre produtos de luxo',
    'Reduzir IPI para veículos populares',
    'Aumentar IPI sobre produtos considerados supérfluos',
    'Reduzir impostos sobre medicamentos',
    'Reduzir impostos sobre alimentos básicos',
    'Criar imposto sobre grandes heranças',
    'Reduzir imposto sobre investimentos produtivos',
    'Criar imposto sobre dividendos',
    'Reduzir impostos sobre empresas exportadoras',
    'Criar programa nacional de combate à sonegação',
  ],
  'Bancos, crédito e mercado financeiro': [
    'Reduzir IOF sobre operações de crédito',
    'Aumentar IOF sobre operações financeiras especulativas',
    'Criar linha de crédito público para pequenas empresas',
    'Criar programa de renegociação de dívidas das famílias',
    'Criar programa de renegociação de dívidas empresariais',
    'Reduzir compulsório bancário',
    'Aumentar compulsório bancário',
    'Criar banco público digital para microempreendedores',
    'Subsidiar juros para compra da primeira casa',
    'Criar fundo público para reduzir risco de crédito rural',
  ],
  'Habitação e infraestrutura': [
    'Expandir programa habitacional federal',
    'Reduzir impostos sobre materiais de construção',
    'Criar subsídio para construção de moradias populares',
    'Criar programa nacional de saneamento básico',
    'Aumentar investimentos em rodovias',
    'Aumentar investimentos em ferrovias',
    'Criar programa de modernização de portos',
    'Conceder rodovias à iniciativa privada',
    'Criar programa de expansão da energia elétrica',
    'Criar fundo nacional de infraestrutura',
  ],
  'Saúde': [
    'Aumentar orçamento do SUS',
    'Criar programa nacional de construção de hospitais',
    'Aumentar remuneração de profissionais da saúde',
    'Criar incentivo para médicos trabalharem no interior',
    'Reduzir impostos sobre medicamentos produzidos no Brasil',
    'Criar programa nacional de medicamentos gratuitos',
    'Ampliar investimento em vacinação',
    'Criar bônus para municípios que reduzirem filas do SUS',
    'Criar parceria público-privada para hospitais',
    'Criar programa nacional de telemedicina',
  ],
  'Educação e qualificação': [
    'Aumentar investimento em educação básica',
    'Criar programa nacional de escolas técnicas',
    'Expandir universidades federais',
    'Criar bolsas para cursos profissionalizantes',
    'Criar incentivo fiscal para empresas que ofereçam formação profissional',
    'Criar programa nacional de alfabetização de adultos',
    'Aumentar salário dos professores federais',
    'Criar bônus para escolas com melhoria de desempenho',
    'Criar programa de computadores para estudantes de baixa renda',
    'Criar programa nacional de ensino de programação',
  ],
  'Energia, agricultura e meio ambiente': [
    'Criar subsídio para energia solar residencial',
    'Reduzir impostos sobre equipamentos de energia renovável',
    'Criar imposto sobre emissões de carbono',
    'Criar crédito agrícola subsidiado',
    'Criar seguro rural financiado parcialmente pelo governo',
    'Reduzir impostos sobre máquinas agrícolas',
    'Criar programa de recuperação de áreas degradadas',
    'Criar incentivo financeiro para preservação ambiental',
    'Aumentar fiscalização contra desmatamento ilegal',
    'Criar programa nacional de transição para veículos elétricos',
  ],
};

const ALL_MEASURES = Object.values(MEASURES).flat();

describe('catálogo de medidas de governo', () => {
  it('cobre 100 medidas de referência', () => {
    expect(ALL_MEASURES).toHaveLength(100);
  });

  for (const [group, measures] of Object.entries(MEASURES)) {
    describe(group, () => {
      for (const measure of measures) {
        it(`reconhece: ${measure}`, () => {
          const analysis = interpretLocally(measure, state);

          // 1. Assunto reconhecido — nada cai no genérico.
          expect(
            analysis.warnings.some((warning) => warning.includes('Nenhum assunto reconhecido')),
            `"${measure}" não foi reconhecida pelo interpretador`,
          ).toBe(false);

          // 2. A análise passa na validação que protege o estado da partida.
          const parsed = proposalAnalysisSchema.safeParse(analysis);
          expect(parsed.success, `"${measure}" gerou análise inválida`).toBe(true);

          // 3. A ficha é utilizável: tem título, resumo e ao menos um efeito.
          expect(analysis.title.length).toBeGreaterThan(3);
          expect(analysis.summary.length).toBeGreaterThan(10);
          const hasEffect =
            Object.keys(analysis.impacts).length > 0 || analysis.groupImpacts.length > 0;
          expect(hasEffect, `"${measure}" não produziu efeito nenhum`).toBe(true);
        });
      }
    });
  }
});

describe('direção das medidas', () => {
  /** Lê o impacto de uma medida sobre um indicador. */
  function impactOf(measure: string, key: keyof typeof state.economy | string): number {
    const analysis = interpretLocally(measure, state);
    return (analysis.impacts as Record<string, number | undefined>)[key] ?? 0;
  }

  function categoryOf(measure: string): PolicyCategory {
    return interpretLocally(measure, state).category;
  }

  function groupDelta(measure: string, groupId: string): number {
    const analysis = interpretLocally(measure, state);
    return analysis.groupImpacts.find((impact) => impact.groupId === groupId)?.delta ?? 0;
  }

  it('cortar encargo barateia a folha e agrada o empresariado', () => {
    expect(groupDelta('Reduzir o FGTS patronal de 8% para 6%', 'empresariado')).toBeGreaterThan(0);
    expect(groupDelta('Reduzir o FGTS patronal de 8% para 6%', 'trabalhadores')).toBeLessThan(0);
  });

  it('subir encargo protege o trabalhador e aperta a margem', () => {
    expect(groupDelta('Aumentar o FGTS patronal de 8% para 10%', 'trabalhadores')).toBeGreaterThan(0);
    expect(groupDelta('Aumentar o FGTS patronal de 8% para 10%', 'empresariado')).toBeLessThan(0);
  });

  it('subir contribuição patronal melhora o primário e encarece contratar', () => {
    expect(impactOf('Aumentar contribuição patronal ao INSS', 'primaryBalance')).toBeGreaterThan(0);
    expect(impactOf('Aumentar contribuição patronal ao INSS', 'unemployment')).toBeGreaterThan(0);
  });

  it('cortar contribuição patronal custa receita', () => {
    expect(impactOf('Reduzir contribuição patronal ao INSS', 'primaryBalance')).toBeLessThan(0);
  });

  it('tributar dividendos melhora o primário e desagrada o mercado', () => {
    expect(impactOf('Criar imposto sobre dividendos', 'primaryBalance')).toBeGreaterThan(0);
    expect(groupDelta('Criar imposto sobre dividendos', 'mercado_financeiro')).toBeLessThan(0);
  });

  it('desonerar medicamento é lido como saúde, não como tributação genérica', () => {
    expect(categoryOf('Reduzir impostos sobre medicamentos')).toBe('saude');
    expect(impactOf('Reduzir impostos sobre medicamentos', 'healthIndex')).toBeGreaterThan(0);
  });

  it('desonerar alimento básico derruba a inflação e a pobreza', () => {
    expect(impactOf('Reduzir impostos sobre alimentos básicos', 'inflation')).toBeLessThan(0);
    expect(impactOf('Reduzir impostos sobre alimentos básicos', 'poverty')).toBeLessThan(0);
  });

  it('imposto sobre carbono melhora o ambiente e irrita o agro', () => {
    expect(impactOf('Criar imposto sobre emissões de carbono', 'environmentIndex')).toBeGreaterThan(0);
    expect(groupDelta('Criar imposto sobre emissões de carbono', 'agronegocio')).toBeLessThan(0);
  });

  it('fiscalização ambiental agrada ambientalistas e desagrada o agro', () => {
    expect(groupDelta('Aumentar fiscalização contra desmatamento ilegal', 'ambientalistas')).toBeGreaterThan(0);
    expect(groupDelta('Aumentar fiscalização contra desmatamento ilegal', 'agronegocio')).toBeLessThan(0);
  });

  it('cortar burocracia agrada o empresariado', () => {
    expect(groupDelta('Reduzir burocracia para abertura de empresas', 'empresariado')).toBeGreaterThan(0);
  });

  it('subir compulsório contrai o crédito', () => {
    expect(impactOf('Aumentar compulsório bancário', 'gdpGrowth')).toBeLessThan(0);
    expect(impactOf('Reduzir compulsório bancário', 'gdpGrowth')).toBeGreaterThan(0);
  });

  it('rodovia e saneamento entram como infraestrutura, não como obra genérica', () => {
    expect(categoryOf('Aumentar investimentos em rodovias')).toBe('infraestrutura');
    expect(impactOf('Criar programa nacional de saneamento básico', 'sanitationIndex')).toBeGreaterThan(0);
  });

  it('reajuste de professor é lido como educação e agrada a categoria', () => {
    expect(categoryOf('Aumentar salário dos professores federais')).toBe('educacao');
    expect(groupDelta('Aumentar salário dos professores federais', 'professores')).toBeGreaterThan(0);
  });
});

describe('leitura de alíquota declarada', () => {
  it('extrai direção e magnitude de "de 8% para 6%"', () => {
    const change = readRateChange('reduzir o fgts patronal de 8% para 6%');
    expect(change?.direction).toBe(-1);
    expect(change?.intensity).toBeCloseTo(1, 1); // queda de 25% = medida de referência
  });

  it('extrai direção de alta em "de 8% para 10%"', () => {
    expect(readRateChange('aumentar o fgts patronal de 8% para 10%')?.direction).toBe(1);
  });

  it('aceita "por cento" por extenso', () => {
    expect(readRateChange('subir a aliquota de 10 para 15 por cento')?.direction).toBe(1);
  });

  it('ignora texto sem par de alíquotas', () => {
    expect(readRateChange('reduzir o imposto de renda')).toBeNull();
    expect(readRateChange('de 8% para 8%')).toBeNull();
  });

  it('a alíquota manda na direção quando o verbo contradiz o número', () => {
    // "reduzir ... de 6% para 8%" é contraditório; o par de números é o dado
    // mais confiável e precisa vencer o verbo.
    const analysis = interpretLocally('Reduzir o FGTS patronal de 6% para 8%', state);
    expect(analysis.groupImpacts.find((i) => i.groupId === 'trabalhadores')?.delta).toBeGreaterThan(0);
  });
});

describe('recorte da medida', () => {
  it('medida restrita a microempresa custa menos que a versão geral', () => {
    const geral = Math.abs(interpretLocally('Reduzir o FGTS patronal', state).estimatedCost);
    const restrita = Math.abs(
      interpretLocally('Reduzir o FGTS para 5% para microempresas', state).estimatedCost,
    );
    expect(restrita).toBeLessThan(geral);
  });

  it('avisa o jogador sobre o recorte que aplicou', () => {
    const analysis = interpretLocally(
      'Isentar FGTS para o primeiro funcionário contratado por MEI',
      state,
    );
    expect(analysis.warnings.some((warning) => warning.includes('restrita'))).toBe(true);
  });

  it('medida progressiva reduz a desigualdade e pesa no topo', () => {
    const analysis = interpretLocally('Criar FGTS progressivo conforme salário', state);
    expect(analysis.impacts.gini ?? 0).toBeLessThan(0);
    expect(
      analysis.groupImpacts.find((impact) => impact.groupId === 'mercado_financeiro')?.delta ?? 0,
    ).toBeLessThan(0);
  });
});
