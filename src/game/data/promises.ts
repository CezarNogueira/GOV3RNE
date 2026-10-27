import type { CampaignPromise } from '../types/index';

/**
 * Catálogo de promessas. O jogador escolhe cinco na criação da candidatura e
 * elas viram a régua do mandato: aparecem no Painel todo mês com o número atual
 * ao lado e são cobradas na avaliação final.
 *
 * `metric` é um caminho dentro do GameState, resolvido por PromiseEngine.
 */
export const PROMISE_CATALOG: readonly Omit<CampaignPromise, 'status' | 'progress'>[] = [
  // ---------------------------------------------------------------- ECONOMIA
  {
    id: 'imposto_menor',
    title: 'Baixar o imposto de quem trabalha',
    quote: 'Quem trabalha vai pagar menos imposto no fim do meu governo do que pagava no começo.',
    category: 'economia',
    targetLabel: 'carga tributária efetiva abaixo de 31% do PIB',
    metric: 'derived.taxBurden',
    comparator: 'lte',
    targetValue: 31,
    estimatedCost: 120,
    difficulty: 72,
    horizonMonths: 36,
    politicalRisk: 54,
    benefits: ['classe_media', 'empresariado'],
    harms: ['servidores'],
  },

  // ---------------------------------------------------------------- EMPREGO
  {
    id: 'crescimento',
    title: 'PIB crescendo acima de 3%',
    quote: 'Este país vai voltar a crescer que nem gente grande.',
    category: 'economia',
    targetLabel: 'crescimento do PIB acima de 3% ao ano',
    metric: 'economy.gdpGrowth',
    comparator: 'gte',
    targetValue: 3,
    estimatedCost: 0,
    difficulty: 70,
    horizonMonths: 40,
    politicalRisk: 36,
    benefits: ['empresariado', 'trabalhadores', 'classe_media'],
    harms: [],
  },

  // ---------------------------------------------------------------- SAÚDE
  {
    id: 'expectativa_vida',
    title: 'Brasileiro vivendo mais',
    quote: 'Saúde não é gasto, é o único investimento que devolve tempo de vida.',
    category: 'saude',
    targetLabel: 'expectativa de vida acima de 76 anos',
    metric: 'nation.lifeExpectancy',
    comparator: 'gte',
    targetValue: 76,
    estimatedCost: 200,
    difficulty: 78,
    horizonMonths: 48,
    politicalRisk: 30,
    benefits: ['baixa_renda', 'catolicos', 'professores'],
    harms: [],
  },

  // ---------------------------------------------------------------- EDUCAÇÃO
  {
    id: 'alfabetizacao',
    title: 'País alfabetizado',
    quote: 'Nenhuma criança vai sair do quarto ano sem saber ler.',
    category: 'educacao',
    targetLabel: 'alfabetização acima de 95%',
    metric: 'nation.literacy',
    comparator: 'gte',
    targetValue: 95,
    estimatedCost: 90,
    difficulty: 66,
    horizonMonths: 48,
    politicalRisk: 24,
    benefits: ['professores', 'baixa_renda'],
    harms: [],
  },

  // ---------------------------------------------------------------- SEGURANÇA
  {
    id: 'homicidios',
    title: 'Menos violência nas ruas',
    quote: 'Vou derrubar o número de homicídios deste país abaixo de 20 por cem mil.',
    category: 'seguranca',
    targetLabel: 'homicídios abaixo de 20 por 100 mil',
    metric: 'nation.homicideRate',
    comparator: 'lte',
    targetValue: 20,
    estimatedCost: 130,
    difficulty: 72,
    horizonMonths: 42,
    politicalRisk: 48,
    benefits: ['policiais', 'classe_media', 'baixa_renda'],
    harms: ['universitarios'],
  },

  // ---------------------------------------------------------------- SOCIAL
  {
    id: 'desigualdade',
    title: 'País menos desigual',
    quote: 'A distância entre o topo e a base deste país vai diminuir no meu governo.',
    category: 'social',
    targetLabel: 'índice de Gini abaixo de 0,50',
    metric: 'nation.gini',
    comparator: 'lte',
    targetValue: 0.5,
    estimatedCost: 220,
    difficulty: 80,
    horizonMonths: 48,
    politicalRisk: 58,
    benefits: ['baixa_renda', 'trabalhadores'],
    harms: ['empresariado', 'mercado_financeiro'],
  },

  // ---------------------------------------------------------------- AMBIENTE
  {
    id: 'meio_ambiente',
    title: 'Floresta de pé',
    quote: 'O Brasil vai voltar a ser respeitado por proteger o que é seu.',
    category: 'meio_ambiente',
    targetLabel: 'índice ambiental acima de 68',
    metric: 'nation.environmentIndex',
    comparator: 'gte',
    targetValue: 68,
    estimatedCost: 70,
    difficulty: 72,
    horizonMonths: 44,
    politicalRisk: 62,
    benefits: ['ambientalistas', 'indigenas', 'universitarios'],
    harms: ['agronegocio'],
  },

  // ---------------------------------------------------------------- INSTITUCIONAL
  {
    id: 'abrir_empresa',
    title: 'O país mais fácil de abrir empresa',
    quote: 'Quem quer trabalhar não vai mais precisar de despachante.',
    category: 'institucional',
    targetLabel: 'aprovação do empresariado acima de 74',
    metric: 'group.empresariado',
    comparator: 'gte',
    targetValue: 74,
    estimatedCost: 15,
    difficulty: 60,
    horizonMonths: 36,
    politicalRisk: 44,
    benefits: ['empresariado', 'classe_media'],
    harms: ['servidores'],
  },

  // ---------------------------------------------------------------- DIPLOMACIA
  {
    id: 'brasil_no_mundo',
    title: 'Brasil de volta ao mundo',
    quote: 'Este país vai voltar a ser ouvido nas mesas que importam.',
    category: 'diplomacia',
    targetLabel: 'isolamento diplomático abaixo de 20',
    metric: 'diplomacy.isolation',
    comparator: 'lte',
    targetValue: 20,
    estimatedCost: 30,
    difficulty: 54,
    horizonMonths: 40,
    politicalRisk: 30,
    benefits: ['empresariado', 'agronegocio', 'universitarios'],
    harms: [],
  },

  // ---------------------------------------------------------------- APROVAÇÃO
  {
    id: 'aprovacao_alta',
    title: 'Sair mais forte do que entrei',
    quote: 'No último dia deste mandato eu quero olhar a pesquisa sem medo.',
    category: 'institucional',
    targetLabel: 'aprovação do governo acima de 55%',
    metric: 'approval.overall',
    comparator: 'gte',
    targetValue: 55,
    estimatedCost: 0,
    difficulty: 70,
    horizonMonths: 48,
    politicalRisk: 34,
    benefits: [],
    harms: [],
  },
];

export const PROMISE_BY_ID = Object.fromEntries(
  PROMISE_CATALOG.map((promise) => [promise.id, promise]),
);

export const MAX_PROMISES = 3;
