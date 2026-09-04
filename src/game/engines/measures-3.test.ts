import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import { interpretLocally } from './fallback-interpreter';
import { TOPICS } from './interpreter-topics';
import { ESTADO_TOPICS } from './interpreter-topics-estado';
import { FUTURO_TOPICS } from './interpreter-topics-futuro';
import { proposalAnalysisSchema } from '../schemas/proposal';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import type { GameState } from '../types/index';

/**
 * TERCEIRO CATÁLOGO: ESTADO, TERRITÓRIO E FUTURO
 *
 * Cem medidas que o jogador pode escrever sobre máquina pública, justiça,
 * sistema financeiro, previdência, desenvolvimento regional, agricultura, meio
 * ambiente, energia e tecnologia.
 *
 * Estas medidas cobram do interpretador uma coisa que as anteriores não
 * cobravam: entender o OBJETIVO da proposta. "Criar uma reserva de petróleo
 * para usar quando o preço internacional disparar" não tem a palavra
 * "subsídio", "imposto" nem "programa social" — tem uma intenção, e o jogo
 * precisa transformar isso em custo, prazo, quem ganha e quem perde.
 *
 * O que este arquivo protege:
 *   1. nenhuma das 100 cai no "anúncio sem assunto reconhecido";
 *   2. cada uma produz ficha válida, com efeito e com perdedor;
 *   3. as que têm sentido fiscal claro entram com o SINAL certo — combater
 *      fraude previdenciária economiza, construir usina nuclear custa;
 *   4. paráfrases escritas com as palavras do jogador chegam ao mesmo lugar
 *      que a redação formal.
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
      reelection: false,
      seed: 4242,
    }),
  );
}

const state = buildState();

const MEASURES: Record<string, string[]> = {
  'Administração pública e Estado': [
    'Reduzir o número de ministérios do governo',
    'Criar um Ministério exclusivo para Inteligência Artificial',
    'Criar uma agência federal de combate à corrupção',
    'Criar uma agência federal de proteção de dados',
    'Unificar sistemas digitais dos órgãos federais',
    'Digitalizar todos os serviços públicos federais',
    'Criar identidade digital nacional para todos os cidadãos',
    'Criar carteira de trabalho totalmente digital',
    'Criar sistema único de acompanhamento de gastos públicos',
    'Exigir publicação dos gastos do governo em tempo real',
    'Criar avaliação anual de desempenho dos órgãos federais',
    'Criar metas obrigatórias para ministérios',
    'Cortar cargos comissionados do governo federal',
    'Aumentar o número de servidores em áreas essenciais',
    'Criar concurso público unificado para órgãos federais',
    'Congelar novas contratações no serviço público por um ano',
    'Criar programa de aposentadoria voluntária para servidores',
    'Permitir trabalho remoto para servidores em funções compatíveis',
    'Criar bônus para servidores que atingirem metas',
    'Criar punições administrativas mais rápidas para corrupção',
  ],
  'Justiça e legislação': [
    'Criar varas especializadas em crimes digitais',
    'Criar força-tarefa nacional contra lavagem de dinheiro',
    'Aumentar a estrutura da Justiça Federal',
    'Criar sistema nacional para acelerar processos judiciais',
    'Digitalizar completamente processos administrativos federais',
    'Criar programa nacional de conciliação de conflitos',
    'Criar cadastro nacional de devedores condenados por fraude',
    'Aumentar a proteção legal para denunciantes de corrupção',
    'Criar proteção especial para testemunhas de grandes organizações criminosas',
    'Criar sistema nacional de monitoramento de contratos públicos',
  ],
  'Sistema financeiro e dinheiro': [
    'Criar sistema de pagamentos instantâneos entre países',
    'Criar moeda digital oficial do Banco Central',
    'Permitir que impostos sejam pagos automaticamente pelo sistema bancário',
    'Criar programa de educação financeira nas escolas',
    'Criar proteção especial para pequenos investidores',
    'Criar fundo público para proteger investidores em grandes crises',
    'Criar regras mais rígidas para bancos considerados sistemicamente importantes',
    'Criar cadastro positivo automático para todos os consumidores',
    'Criar programa para reduzir tarifas bancárias',
    'Criar incentivo para bancos oferecerem crédito em regiões pouco atendidas',
  ],
  'Previdência e assistência social': [
    'Criar incentivo para trabalhadores adiarem a aposentadoria',
    'Criar benefício adicional para idosos que continuarem trabalhando',
    'Criar programa nacional de previdência complementar',
    'Permitir aposentadoria parcial com trabalho remunerado',
    'Criar programa de revisão de benefícios pagos indevidamente',
    'Criar sistema nacional para identificar fraudes previdenciárias',
    'Criar conta de poupança pública para crianças de baixa renda',
    'Criar benefício temporário para famílias que perderem sua principal fonte de renda',
    'Criar programa de reinserção profissional de beneficiários sociais',
    'Criar bônus para famílias que mantiverem crianças na escola',
  ],
  'Desenvolvimento regional': [
    'Criar zonas especiais de desenvolvimento no Nordeste',
    'Criar programa federal de desenvolvimento da Amazônia',
    'Criar incentivo para empresas se instalarem em cidades pequenas',
    'Criar fundo de desenvolvimento para municípios pobres',
    'Criar programa para levar médicos especialistas às regiões remotas',
    'Criar programa federal para desenvolver cidades de fronteira',
    'Criar incentivo para empresas contratarem moradores de regiões pobres',
    'Criar programa de desenvolvimento econômico para o semiárido',
    'Criar polos tecnológicos fora das capitais',
    'Criar universidades federais especializadas por região',
  ],
  'Agricultura e alimentos': [
    'Criar estoques estratégicos nacionais de alimentos',
    'Criar programa nacional de irrigação',
    'Subsidiar sistemas de armazenamento de grãos',
    'Criar seguro contra secas para pequenos agricultores',
    'Criar seguro contra enchentes para agricultores',
    'Criar programa de agricultura de precisão',
    'Criar incentivo para uso de drones na agricultura',
    'Criar banco público de sementes',
    'Criar programa para reduzir desperdício de alimentos',
    'Criar corredores especiais para transporte de produtos agrícolas',
  ],
  'Meio ambiente e recursos naturais': [
    'Criar mercado nacional de créditos de carbono',
    'Criar limite nacional para emissão de carbono',
    'Criar programa de reflorestamento de áreas degradadas',
    'Criar pagamento para proprietários que preservarem florestas',
    'Criar programa nacional de reciclagem',
    'Proibir gradualmente determinados plásticos descartáveis',
    'Criar incentivo para empresas reutilizarem resíduos industriais',
    'Criar sistema nacional de monitoramento de rios',
    'Criar fundo para prevenção de desastres climáticos',
    'Criar sistema nacional de alerta para enchentes e deslizamentos',
  ],
  'Energia e recursos estratégicos': [
    'Criar reserva estratégica nacional de petróleo',
    'Criar reserva estratégica nacional de gás natural',
    'Criar programa de expansão da energia nuclear',
    'Construir novas usinas nucleares',
    'Criar programa nacional de armazenamento de energia',
    'Criar incentivo para produção de hidrogênio verde',
    'Criar programa de biocombustíveis avançados',
    'Criar reserva estratégica de minerais críticos',
    'Criar programa nacional para reciclagem de baterias',
    'Criar incentivo para fabricação nacional de baterias',
  ],
  'Tecnologia e futuro': [
    'Criar uma supercomputação nacional para pesquisa',
    'Criar programa nacional de inteligência artificial',
    'Criar fundo público para startups de alta tecnologia',
    'Criar incentivo para empresas brasileiras desenvolverem semicondutores',
    'Criar programa nacional de cibersegurança',
    'Criar centro nacional de pesquisa em robótica',
    'Criar programa para automatizar serviços públicos com IA',
    'Criar infraestrutura nacional de computação em nuvem',
    'Criar programa para formar especialistas em inteligência artificial',
    'Criar agência brasileira de exploração espacial',
  ],
};

const ALL_MEASURES = Object.values(MEASURES).flat();

describe('terceiro catálogo de medidas de governo', () => {
  it('cobre as 100 medidas de Estado, território e futuro', () => {
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

          const hasEffect =
            Object.keys(analysis.impacts).length > 0 || analysis.groupImpacts.length > 0;
          expect(hasEffect, `"${measure}" não produziu efeito nenhum`).toBe(true);

          // Toda medida tem quem perca. Medida só com ganhador é medida mal lida.
          expect(
            analysis.groupImpacts.some((impact) => impact.delta < 0),
            `"${measure}" não tem nenhum grupo perdendo`,
          ).toBe(true);
        });
      }
    });
  }
});

describe('o assunto certo, e não o parecido', () => {
  function titleOf(measure: string): string {
    return interpretLocally(measure, state).title;
  }
  function categoryOf(measure: string): string {
    return interpretLocally(measure, state).category;
  }

  it('lê tarifa de banco como tarifa de banco, não como tarifa de importação', () => {
    expect(titleOf('Criar programa para reduzir tarifas bancárias')).toContain('tarifas bancárias');
    expect(categoryOf('Criar programa para reduzir tarifas bancárias')).toBe('economia');
  });

  it('lê educação financeira como o programa que é, não como política educacional inteira', () => {
    const analysis = interpretLocally('Criar programa de educação financeira nas escolas', state);
    expect(analysis.title).toContain('educação financeira');
    // O custo fica na ordem do programa específico, não na da pasta inteira.
    expect(Math.abs(analysis.estimatedCost) / 1e9).toBeLessThan(12);
  });

  it('lê banco de sementes como política agrícola, não como banco público', () => {
    expect(categoryOf('Criar banco público de sementes')).toBe('agricultura');
  });

  it('separa criar ministério de cortar ministério', () => {
    const criar = interpretLocally('Criar um Ministério exclusivo para Inteligência Artificial', state);
    const cortar = interpretLocally('Reduzir o número de ministérios do governo', state);

    expect(criar.estimatedCost).toBeGreaterThan(0);
    expect(cortar.estimatedCost).toBeLessThan(0);
  });
});

describe('sinal fiscal das medidas de Estado', () => {
  function costOf(measure: string): number {
    return interpretLocally(measure, state).estimatedCost / 1e9;
  }

  it('reconhece as medidas que ECONOMIZAM dinheiro público', () => {
    expect(costOf('Criar sistema nacional para identificar fraudes previdenciárias')).toBeLessThan(0);
    expect(costOf('Criar programa de revisão de benefícios pagos indevidamente')).toBeLessThan(0);
    expect(costOf('Congelar novas contratações no serviço público por um ano')).toBeLessThan(0);
    expect(costOf('Criar incentivo para trabalhadores adiarem a aposentadoria')).toBeLessThan(0);
    expect(costOf('Permitir trabalho remoto para servidores em funções compatíveis')).toBeLessThan(0);
  });

  it('reconhece as medidas que CUSTAM, e cobra proporcionalmente', () => {
    // Usina nuclear e semicondutor são as apostas mais caras da lista.
    expect(costOf('Construir novas usinas nucleares')).toBeGreaterThan(40);
    expect(costOf('Criar incentivo para empresas brasileiras desenvolverem semicondutores')).toBeGreaterThan(30);
    // Transparência e metas são baratas: mudam processo, não folha.
    expect(costOf('Exigir publicação dos gastos do governo em tempo real')).toBeLessThan(6);
    expect(costOf('Criar metas obrigatórias para ministérios')).toBeLessThan(6);
  });

  it('faz o combate à corrupção melhorar a percepção de integridade', () => {
    const analysis = interpretLocally('Criar sistema nacional de monitoramento de contratos públicos', state);
    expect(analysis.impacts.corruptionPerception ?? 0).toBeGreaterThan(0);
    expect(analysis.impacts.primaryBalance ?? 0).toBeGreaterThan(0);
  });
});

describe('o jogador escrevendo com as próprias palavras', () => {
  it('entende reserva estratégica descrita pelo objetivo, não pelo nome', () => {
    const analysis = interpretLocally(
      'Quero criar uma reserva de petróleo para o Brasil usar quando o preço internacional disparar.',
      state,
    );
    expect(analysis.title.toLowerCase()).toContain('reserva estratégica');
    expect(analysis.estimatedCost).toBeGreaterThan(0);
    // Reserva existe para amortecer choque externo: o risco-país cede.
    expect(analysis.impacts.countryRisk ?? 0).toBeLessThan(0);
  });

  it('entende subsídio ao seguro rural descrito como "dar dinheiro para o agricultor"', () => {
    const analysis = interpretLocally(
      'Quero dar dinheiro para agricultores comprarem seguro contra seca.',
      state,
    );
    expect(analysis.category).toBe('agricultura');
    expect(analysis.title.toLowerCase()).toContain('seguro rural');
    expect(analysis.groupImpacts.find((impact) => impact.groupId === 'agronegocio')?.delta ?? 0)
      .toBeGreaterThan(0);
  });

  it('entende digitalização descrita como "resolver tudo pelo celular"', () => {
    const analysis = interpretLocally(
      'Quero que todo serviço público possa ser resolvido pelo celular, sem ir a lugar nenhum.',
      state,
    );
    expect(analysis.title.toLowerCase()).toContain('digitalização');
  });

  it('entende pagamento por serviço ambiental, mesmo com "não" na frase', () => {
    const analysis = interpretLocally('Quero pagar quem tem floresta em pé para não derrubar.', state);
    // O "não derrubar" já derrubou a leitura antes: a frase é de AMPLIAR
    // preservação, e o verbo que manda é "pagar".
    expect(analysis.title).toContain('Ampliação');
    expect(analysis.estimatedCost).toBeGreaterThan(0);
    expect(analysis.impacts.environmentIndex ?? 0).toBeGreaterThan(0);
  });

  it('entende semicondutor descrito como "fabricar os próprios chips"', () => {
    const analysis = interpretLocally(
      'Quero que o Brasil fabrique seus próprios chips em vez de importar tudo.',
      state,
    );
    expect(analysis.title.toLowerCase()).toContain('semicondutores');
  });
});

describe('o que só aparece depois', () => {
  function delayedOf(measure: string) {
    return interpretLocally(measure, state).delayedEffects;
  }

  it('a reserva estratégica cobra agora e protege depois', () => {
    const analysis = interpretLocally('Criar reserva estratégica nacional de petróleo', state);

    // Agora: dinheiro saindo e risco fiscal subindo.
    expect(analysis.estimatedCost).toBeGreaterThan(0);
    // Depois: é para isso que a reserva existe.
    const futuro = analysis.delayedEffects[0];
    expect(futuro).toBeDefined();
    expect(futuro!.monthsAhead).toBeGreaterThan(6);
    expect(futuro!.impacts.countryRisk ?? 0).toBeLessThan(0);
    expect(futuro!.impacts.inflation ?? 0).toBeLessThan(0);
  });

  it('o benefício emergencial cobra a conta quando acaba', () => {
    const efeitos = delayedOf(
      'Criar benefício temporário para famílias que perderem sua principal fonte de renda',
    );
    expect(efeitos.length).toBeGreaterThan(0);
    expect(efeitos[0]!.impacts.poverty ?? 0).toBeGreaterThan(0);
    expect(efeitos[0]!.impacts.approval ?? 0).toBeLessThan(0);
  });

  it('o concurso público vira folha permanente no ano seguinte', () => {
    const efeitos = delayedOf('Criar concurso público unificado para órgãos federais');
    expect(efeitos.some((effect) => (effect.impacts.primaryBalance ?? 0) < 0)).toBe(true);
  });

  it('obra longa entrega depois do prazo do próprio anúncio', () => {
    for (const measure of [
      'Construir novas usinas nucleares',
      'Criar incentivo para empresas brasileiras desenvolverem semicondutores',
      'Criar corredores especiais para transporte de produtos agrícolas',
    ]) {
      const efeitos = delayedOf(measure);
      expect(efeitos.length, `"${measure}" não tem efeito futuro`).toBeGreaterThan(0);
      expect(efeitos[0]!.monthsAhead, `"${measure}" entrega rápido demais`).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('integridade do catálogo', () => {
  it('não tem id repetido entre os três blocos', () => {
    const ids = TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size, `ids repetidos: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`).toBe(
      ids.length,
    );
  });

  it('mantém a regra de que toda entrada nova tem ganhador e perdedor', () => {
    for (const topic of [...ESTADO_TOPICS, ...FUTURO_TOPICS]) {
      expect(topic.winners.length, `${topic.id} não tem ganhador`).toBeGreaterThan(0);
      expect(topic.losers.length, `${topic.id} não tem perdedor`).toBeGreaterThan(0);
      expect(topic.months, `${topic.id} tem prazo fora do mandato`).toBeLessThanOrEqual(48);
      expect(Object.keys(topic.expand).length, `${topic.id} não muda indicador nenhum`).toBeGreaterThan(0);
    }
  });

  it('usa apenas grupos sociais que existem no jogo', () => {
    const validGroups = new Set(state.socialGroups.map((group) => group.id));
    for (const topic of [...ESTADO_TOPICS, ...FUTURO_TOPICS]) {
      for (const entry of [...topic.winners, ...topic.losers]) {
        expect(validGroups.has(entry.groupId), `${topic.id} cita grupo inexistente: ${entry.groupId}`).toBe(
          true,
        );
      }
    }
  });
});
