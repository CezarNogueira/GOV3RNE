import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import { interpretLocally } from './fallback-interpreter';
import { proposalAnalysisSchema } from '../schemas/proposal';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import type { GameState } from '../types/index';

/**
 * SEGUNDO LOTE DE MEDIDAS (100 adicionais)
 *
 * Mesma cobrança do primeiro catálogo (measures.test.ts): cada uma das 100
 * frases que o presidente pode escrever precisa (1) ser reconhecida por um
 * assunto — nunca cair no genérico —, (2) produzir uma análise válida pelo
 * schema Zod que protege o estado da partida, e (3) ter pelo menos um efeito.
 * Um segundo bloco cobra a direção de casos que já quebraram antes: verbo
 * incomum ("permitir", "perdoar"), tributo sobre incentivo ("reduzir encargos
 * para contratar jovens") e ambiguidade entre tópicos parecidos.
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
      seed: 11,
      reelection: false,
    }),
  );
}

const state = buildState();

/** As 100 medidas adicionais, exatamente como o presidente escreveria. */
const MEASURES: Record<string, string[]> = {
  'Economia e impostos': [
    'Reduzir o Imposto de Renda para quem ganha até R$ 5 mil',
    'Aumentar o Imposto de Renda para quem ganha mais de R$ 20 mil',
    'Reduzir o imposto sobre pequenas empresas',
    'Aumentar o imposto sobre empresas muito lucrativas',
    'Reduzir o ICMS sobre alimentos básicos',
    'Aumentar o imposto sobre produtos de luxo',
    'Reduzir o imposto sobre medicamentos',
    'Reduzir o imposto sobre carros populares',
    'Aumentar o imposto sobre bebidas açucaradas',
    'Criar imposto sobre grandes heranças',
    'Reduzir impostos para empresas que contratarem funcionários',
    'Aumentar impostos sobre empresas que poluem muito',
    'Criar desconto de imposto para empresas que investirem no Brasil',
    'Perdoar parte das dívidas tributárias de pequenas empresas',
    'Aumentar a fiscalização contra sonegação de impostos',
    'Criar imposto sobre grandes propriedades improdutivas',
    'Reduzir impostos para produtos fabricados no Brasil',
    'Aumentar impostos sobre produtos importados',
    'Reduzir impostos sobre equipamentos de informática',
    'Criar programa de redução temporária de impostos durante crises',
  ],
  'Trabalho e emprego': [
    'Reduzir o FGTS pago pelas empresas de 8% para 6%',
    'Aumentar o FGTS pago pelas empresas de 8% para 10%',
    'Reduzir a contribuição patronal ao INSS',
    'Aumentar a contribuição patronal ao INSS',
    'Reduzir encargos para empresas que contratarem jovens',
    'Criar subsídio para o primeiro emprego',
    'Aumentar o salário mínimo',
    'Congelar o salário mínimo por dois anos',
    'Criar salário mínimo regional',
    'Reduzir impostos sobre horas extras',
    'Criar benefício para empresas que reduzirem acidentes de trabalho',
    'Aumentar multas para empresas que descumprirem direitos trabalhistas',
    'Criar programa de qualificação profissional gratuita',
    'Criar incentivo para empresas contratarem pessoas desempregadas há mais de um ano',
    'Reduzir encargos para contratação de trabalhadores acima de 60 anos',
  ],
  'Empresas e indústria': [
    'Criar programa de financiamento para pequenas empresas',
    'Criar crédito barato para empresas comprarem máquinas',
    'Criar incentivo para instalar fábricas no interior',
    'Criar programa de reindustrialização do Brasil',
    'Dar prioridade a empresas brasileiras em compras do governo',
    'Reduzir burocracia para abrir uma empresa',
    'Permitir abertura de empresas totalmente pela internet',
    'Criar programa para ajudar empresas brasileiras a exportar',
    'Criar fundo para salvar empresas estratégicas em crise',
    'Criar incentivo para fabricação nacional de semicondutores',
    'Criar incentivo para produção nacional de medicamentos',
    'Criar incentivo para produção nacional de computadores',
    'Criar programa de modernização das fábricas brasileiras',
    'Criar benefício fiscal para empresas que fizerem pesquisa',
    'Criar programa de apoio a startups brasileiras',
  ],
  'Habitação e infraestrutura': [
    'Construir 500 mil casas populares',
    'Aumentar o financiamento para compra da primeira casa',
    'Reduzir impostos sobre materiais de construção',
    'Criar programa de reforma de casas de famílias pobres',
    'Construir novas redes de saneamento',
    'Construir novas estações de tratamento de água',
    'Construir novas rodovias federais',
    'Duplicar rodovias consideradas perigosas',
    'Construir novas ferrovias',
    'Modernizar os portos brasileiros',
    'Ampliar aeroportos regionais',
    'Construir novas linhas de metrô',
    'Criar programa de recuperação de pontes',
    'Investir na expansão da internet de alta velocidade',
    'Criar programa de iluminação pública eficiente',
  ],
  'Saúde': [
    'Construir novos hospitais públicos',
    'Aumentar o orçamento do SUS',
    'Contratar mais médicos para regiões carentes',
    'Aumentar o salário dos profissionais de saúde',
    'Criar programa para reduzir filas de cirurgias',
    'Aumentar a oferta de medicamentos gratuitos',
    'Criar novas unidades básicas de saúde',
    'Ampliar o atendimento psicológico pelo SUS',
    'Criar programa nacional de prevenção ao câncer',
    'Aumentar investimentos em vacinação',
    'Criar programa para reduzir o tempo de espera por exames',
    'Construir novos centros de atendimento de emergência',
    'Criar incentivo para médicos trabalharem no interior',
    'Modernizar hospitais públicos',
    'Criar programa nacional de telemedicina',
  ],
  'Educação': [
    'Aumentar o salário dos professores',
    'Construir novas escolas públicas',
    'Construir novas escolas técnicas',
    'Aumentar o número de vagas nas universidades federais',
    'Criar mais bolsas universitárias',
    'Criar programa de computador para cada aluno da rede pública',
    'Oferecer ensino integral em mais escolas',
    'Criar aulas gratuitas de programação',
    'Aumentar o investimento em creches públicas',
    'Criar programa nacional de alfabetização',
  ],
  'Segurança e justiça': [
    'Aumentar o número de policiais federais',
    'Aumentar o investimento nas polícias estaduais',
    'Comprar novos equipamentos para as forças policiais',
    'Construir novos presídios',
    'Criar programa de ressocialização de presos',
    'Aumentar a pena para crimes violentos',
    'Criar sistema nacional de reconhecimento de criminosos procurados',
    'Aumentar o combate ao tráfico de drogas',
    'Criar programa de combate ao crime organizado',
    'Aumentar o investimento em investigação policial',
  ],
};

const ALL_MEASURES = Object.values(MEASURES).flat();

describe('segundo catálogo de medidas de governo', () => {
  it('cobre 100 medidas adicionais', () => {
    expect(ALL_MEASURES).toHaveLength(100);
  });

  for (const [group, measures] of Object.entries(MEASURES)) {
    describe(group, () => {
      for (const measure of measures) {
        it(`reconhece: ${measure}`, () => {
          const analysis = interpretLocally(measure, state);

          expect(
            analysis.warnings.some((warning) => warning.includes('Nenhum assunto reconhecido')),
            `"${measure}" não foi reconhecida pelo interpretador`,
          ).toBe(false);

          const parsed = proposalAnalysisSchema.safeParse(analysis);
          expect(parsed.success, `"${measure}" gerou análise inválida`).toBe(true);

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

describe('direção das medidas do segundo lote', () => {
  function impactOf(measure: string, key: string): number {
    const analysis = interpretLocally(measure, state);
    return (analysis.impacts as Record<string, number | undefined>)[key] ?? 0;
  }

  function groupDelta(measure: string, groupId: string): number {
    const analysis = interpretLocally(measure, state);
    return analysis.groupImpacts.find((impact) => impact.groupId === groupId)?.delta ?? 0;
  }

  function categoryOf(measure: string) {
    return interpretLocally(measure, state).category;
  }

  it('reduzir imposto para quem ganha pouco favorece a baixa renda', () => {
    const analysis = interpretLocally('Reduzir o Imposto de Renda para quem ganha até R$ 5 mil', state);
    expect(analysis.impacts.primaryBalance ?? 0).toBeLessThan(0);
  });

  it('subir imposto sobre quem ganha mais é lido como progressivo', () => {
    const analysis = interpretLocally('Aumentar o Imposto de Renda para quem ganha mais de R$ 20 mil', state);
    expect(analysis.impacts.primaryBalance ?? 0).toBeGreaterThan(0);
  });

  it('perdoar dívida tributária de pequena empresa custa e agrada o empresariado', () => {
    expect(impactOf('Perdoar parte das dívidas tributárias de pequenas empresas', 'primaryBalance')).toBeLessThan(0);
    expect(groupDelta('Perdoar parte das dívidas tributárias de pequenas empresas', 'empresariado')).toBeGreaterThan(0);
  });

  it('reduzir encargo para contratar jovens é lido como mais incentivo, não menos', () => {
    expect(groupDelta('Reduzir encargos para empresas que contratarem jovens', 'empresariado')).toBeGreaterThan(0);
  });

  it('reduzir encargo para trabalhador acima de 60 anos amplia a contratação, não reduz', () => {
    const analysis = interpretLocally('Reduzir encargos para contratação de trabalhadores acima de 60 anos', state);
    expect(analysis.impacts.unemployment ?? 0).toBeLessThanOrEqual(0);
  });

  it('congelar o salário mínimo é lido como contração, não como reajuste', () => {
    const analysis = interpretLocally('Congelar o salário mínimo por dois anos', state);
    expect(analysis.impacts.minimumWage ?? 0).toBeLessThanOrEqual(0);
  });

  it('reduzir impostos para produção nacional é lido como expansão da política industrial', () => {
    const analysis = interpretLocally('Reduzir impostos para produtos fabricados no Brasil', state);
    expect(analysis.impacts.gdpGrowth ?? 0).toBeGreaterThan(0);
    expect(groupDelta('Reduzir impostos para produtos fabricados no Brasil', 'empresariado')).toBeGreaterThan(0);
  });

  it('reduzir imposto sobre equipamento de informática barateia o acesso', () => {
    const analysis = interpretLocally('Reduzir impostos sobre equipamentos de informática', state);
    expect(analysis.impacts.inflation ?? 0).toBeLessThan(0);
  });

  it('bebida açucarada tributada é lida como saúde, não como tributação genérica', () => {
    expect(categoryOf('Aumentar o imposto sobre bebidas açucaradas')).toBe('saude');
  });

  it('reduzir ICMS sobre alimentos básicos derruba a inflação, não a arrecadação genérica', () => {
    const analysis = interpretLocally('Reduzir o ICMS sobre alimentos básicos', state);
    expect(analysis.impacts.inflation ?? 0).toBeLessThan(0);
  });

  it('imposto sobre propriedade improdutiva desagrada o agronegócio', () => {
    expect(groupDelta('Criar imposto sobre grandes propriedades improdutivas', 'agronegocio')).toBeLessThan(0);
  });

  it('fundo para salvar empresas estratégicas custa caro e preocupa o mercado', () => {
    expect(impactOf('Criar fundo para salvar empresas estratégicas em crise', 'primaryBalance')).toBeLessThan(0);
    expect(groupDelta('Criar fundo para salvar empresas estratégicas em crise', 'mercado_financeiro')).toBeLessThan(0);
  });

  it('multar quem descumpre direitos trabalhistas agrada o trabalhador e preocupa o empresariado', () => {
    expect(groupDelta('Aumentar multas para empresas que descumprirem direitos trabalhistas', 'trabalhadores')).toBeGreaterThan(0);
    expect(groupDelta('Aumentar multas para empresas que descumprirem direitos trabalhistas', 'empresariado')).toBeLessThan(0);
  });

  it('mais orçamento do SUS é lido como saúde', () => {
    expect(categoryOf('Aumentar o orçamento do SUS')).toBe('saude');
  });

  it('mais vagas em universidades federais é lido como educação', () => {
    expect(categoryOf('Aumentar o número de vagas nas universidades federais')).toBe('educacao');
  });

  it('aumentar o número de policiais é lido como segurança', () => {
    expect(categoryOf('Aumentar o número de policiais federais')).toBe('seguranca');
  });
});
