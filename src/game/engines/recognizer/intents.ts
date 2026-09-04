import type { EntityKind, PolicyCategory } from '../../types/index';
import type { MinistryId } from '../../types/politics';

/**
 * BANCO DE INTENÇÕES
 *
 * O que uma pessoa pode querer fazer quando escreve uma frase de governo. Cada
 * intenção é declarada por dados, nunca por `if` espalhado pelo código: frases
 * inteiras, verbos, complementos e o tipo de entidade que ela espera.
 *
 * Três níveis de sinal, e a diferença entre eles é o que evita falso positivo:
 *
 *   phrases   a frase quase pronta        -> confiança alta sozinha
 *   verbs     o que se quer fazer         -> precisa de complemento
 *   objects   sobre o que                 -> precisa de verbo
 *
 * "Vender" sozinho não é privatização (pode ser venda de estoque); "vender" com
 * "estatal" ou com uma empresa estatal citada, é.
 *
 * Adicionar uma intenção nova é acrescentar uma entrada nesta lista. Nenhum
 * outro arquivo precisa saber que ela existe.
 */
export interface IntentSpec {
  id: string;
  label: string;
  /** Frases que praticamente definem a intenção. */
  phrases: string[];
  /** Verbos e radicais de ação. */
  verbs: string[];
  /** Complementos que dizem sobre o quê. */
  objects: string[];
  /** Tipos de entidade que a intenção espera encontrar no texto. */
  expects: EntityKind[];
  /** Construtor a abrir quando falta configuração. */
  builder?: string;
  /**
   * true quando a intenção SEMPRE precisa de painel, mesmo com alvo e número —
   * é o caso da reforma tributária, que é um pacote e não um número solto.
   */
  alwaysConfigure?: boolean;
  category: PolicyCategory;
  ministries: MinistryId[];
  /** Desempate: intenção mais específica ganha de intenção genérica. */
  specificity: number;
}

export const INTENTS: readonly IntentSpec[] = [
  // ------------------------------------------------------------- Societário
  {
    id: 'privatizar_empresa',
    label: 'Privatizar empresa estatal',
    phrases: [
      'privatizar',
      'privatizacao',
      'vender estatal',
      'vender a estatal',
      'vender empresa publica',
      'vender empresa estatal',
      'passar para a iniciativa privada',
      'colocar a venda',
      'abrir o capital',
      'desestatizar',
      'desestatizacao',
      'leiloar a estatal',
    ],
    verbs: ['privatiz', 'desestatiz', 'vender', 'venda', 'leiloar', 'alienar'],
    objects: ['estatal', 'empresa publica', 'empresa estatal', 'controle acionario'],
    expects: ['COMPANY'],
    builder: 'privatizacao',
    category: 'economia',
    ministries: ['fazenda'],
    specificity: 95,
  },
  {
    id: 'estatizar_empresa',
    label: 'Comprar participação em empresa',
    phrases: [
      'estatizar',
      'estatizacao',
      'nacionalizar',
      'comprar acoes da',
      'comprar participacao',
      'o estado comprar',
      'assumir o controle da',
    ],
    verbs: ['estatiz', 'nacionaliz', 'comprar', 'adquirir', 'assumir o controle'],
    objects: ['empresa', 'acoes', 'participacao', 'controle'],
    expects: ['COMPANY'],
    builder: 'estatizacao',
    category: 'economia',
    ministries: ['fazenda'],
    specificity: 92,
  },

  // -------------------------------------------------------------- Orçamento
  {
    id: 'cortar_orcamento',
    label: 'Cortar gastos',
    phrases: [
      'cortar gastos',
      'cortar despesas',
      'cortar orcamento',
      'cortar verba',
      'reduzir gastos',
      'reduzir despesas',
      'reduzir orcamento',
      'diminuir gastos',
      'diminuir orcamento',
      'economizar dinheiro',
      'gastar menos',
      'enxugar a maquina',
      'contencao de gastos',
      'ajuste fiscal',
    ],
    verbs: ['cortar', 'corte', 'reduzir', 'reduc', 'diminuir', 'enxugar', 'economiz', 'contingenci'],
    objects: ['gasto', 'despesa', 'orcamento', 'verba', 'custeio', 'maquina publica'],
    expects: ['BUDGET_AREA'],
    builder: 'corte_orcamento',
    category: 'economia',
    ministries: ['fazenda'],
    specificity: 88,
  },
  {
    id: 'ampliar_orcamento',
    label: 'Ampliar orçamento',
    phrases: [
      'aumentar o orcamento',
      'ampliar o orcamento',
      'mais verba para',
      'reforcar o orcamento',
      'recompor o orcamento',
      'destinar mais recursos',
    ],
    verbs: ['aument', 'ampli', 'reforc', 'recompor', 'destinar', 'elevar'],
    objects: ['orcamento', 'verba', 'recursos', 'dotacao'],
    expects: ['BUDGET_AREA'],
    builder: 'reforco_orcamento',
    category: 'economia',
    ministries: ['fazenda'],
    specificity: 80,
  },

  // --------------------------------------------------------------- Tributos
  {
    id: 'reforma_tributaria',
    label: 'Reforma tributária',
    phrases: [
      'reforma tributaria',
      'reformar os impostos',
      'reforma dos impostos',
      'reformar o sistema tributario',
      'mudar o sistema tributario',
      'reorganizar os impostos',
      'mudar os impostos',
      'reforma fiscal',
      'simplificar os impostos',
    ],
    verbs: ['reform', 'reorganiz', 'simplific', 'unificar'],
    objects: ['imposto', 'tributo', 'sistema tributario', 'carga tributaria'],
    expects: [],
    builder: 'reforma_tributaria',
    alwaysConfigure: true,
    category: 'economia',
    ministries: ['fazenda'],
    specificity: 96,
  },
  {
    id: 'reduzir_imposto',
    label: 'Reduzir imposto',
    phrases: [
      'reduzir imposto',
      'diminuir imposto',
      'baixar imposto',
      'cortar imposto',
      'desonerar',
      'desoneracao',
      'isentar de imposto',
      'reduzir a carga tributaria',
    ],
    verbs: ['reduzir', 'diminuir', 'baixar', 'cortar', 'desoner', 'isent', 'zerar'],
    objects: ['imposto', 'tributo', 'aliquota', 'carga tributaria', 'taxa'],
    expects: ['TAX', 'SOCIAL_GROUP', 'SECTOR'],
    builder: 'tributo_pontual',
    category: 'economia',
    ministries: ['fazenda'],
    specificity: 78,
  },
  {
    id: 'aumentar_imposto',
    label: 'Aumentar imposto',
    phrases: [
      'aumentar imposto',
      'elevar imposto',
      'subir imposto',
      'criar imposto',
      'taxar',
      'tributar',
      'criar um imposto sobre',
      'imposto sobre grandes fortunas',
    ],
    verbs: ['aument', 'elev', 'subir', 'criar', 'taxar', 'tribut', 'instituir'],
    objects: ['imposto', 'tributo', 'aliquota', 'taxa', 'fortunas', 'dividendos', 'heranca'],
    expects: ['TAX', 'NUMERIC_TARGET', 'SOCIAL_GROUP', 'SECTOR'],
    builder: 'tributo_pontual',
    category: 'economia',
    ministries: ['fazenda'],
    specificity: 78,
  },

  // ------------------------------------------------------- Apoio a setores
  {
    id: 'apoiar_pequenas_empresas',
    label: 'Apoiar pequenas empresas',
    phrases: [
      'apoiar pequenas empresas',
      'ajudar pequenas empresas',
      'incentivar pequenas empresas',
      'fortalecer pequenas empresas',
      'ajudar pequenos negocios',
      'apoiar pequenos negocios',
      'dar uma forca para as pequenas empresas',
      'ajudar os pequenos empresarios',
      'apoio ao empreendedor',
    ],
    verbs: ['apoiar', 'apoio', 'ajudar', 'ajuda', 'incentiv', 'fortalec', 'estimul', 'dar forca', 'socorrer'],
    objects: ['pequenas empresas', 'pequenos negocios', 'microempresa', 'mei', 'empreendedor', 'simples nacional'],
    expects: ['SOCIAL_GROUP'],
    builder: 'pequenas_empresas',
    category: 'economia',
    ministries: ['fazenda', 'desenvolvimento_social'],
    specificity: 90,
  },
  {
    id: 'ajudar_agricultores',
    label: 'Apoio à agricultura',
    phrases: [
      'ajudar agricultores',
      'apoiar agricultores',
      'ajudar o agro',
      'apoio ao produtor rural',
      'incentivar a agricultura',
      'credito rural',
      'seguro rural',
    ],
    verbs: ['apoiar', 'ajudar', 'incentiv', 'fortalec', 'financiar', 'subsidi'],
    objects: ['agricultor', 'produtor rural', 'agricultura', 'agro', 'lavoura', 'safra', 'campo'],
    expects: ['SOCIAL_GROUP', 'BUDGET_AREA'],
    builder: 'agricultura',
    category: 'agricultura',
    ministries: ['agricultura'],
    specificity: 88,
  },
  {
    id: 'programa_social',
    label: 'Programa social',
    phrases: [
      'ajudar os pobres',
      'ajudar a populacao pobre',
      'melhorar a vida dos pobres',
      'combater a pobreza',
      'combater a fome',
      'programa social',
      'transferencia de renda',
      'reduzir a desigualdade',
      'ajudar quem precisa',
    ],
    verbs: ['ajudar', 'apoiar', 'combater', 'reduzir', 'melhorar', 'atender', 'amparar'],
    objects: ['pobre', 'pobreza', 'fome', 'desigualdade', 'miseria', 'vulneravel', 'baixa renda'],
    expects: ['SOCIAL_GROUP', 'BUDGET_AREA'],
    builder: 'social',
    category: 'social',
    ministries: ['desenvolvimento_social'],
    specificity: 86,
  },
  {
    id: 'emprego_jovem',
    label: 'Emprego para jovens',
    phrases: [
      'ajudar os jovens a conseguir emprego',
      'emprego para jovens',
      'primeiro emprego',
      'gerar emprego para a juventude',
      'incentivar a contratacao de jovens',
    ],
    verbs: ['ajudar', 'gerar', 'incentiv', 'estimul', 'criar', 'apoiar'],
    objects: ['emprego', 'trabalho', 'contratacao', 'vaga', 'estagio', 'aprendiz'],
    expects: ['SOCIAL_GROUP'],
    builder: 'emprego_jovem',
    category: 'trabalho',
    ministries: ['fazenda', 'educacao'],
    specificity: 84,
  },

  // ------------------------------------------------------- Áreas de governo
  {
    id: 'investir_saude',
    label: 'Investir em saúde',
    phrases: [
      'investir na saude',
      'investir em saude',
      'melhorar a saude',
      'melhorar os hospitais',
      'ampliar o sus',
      'reduzir a fila do sus',
      'mais medicos',
    ],
    verbs: ['investir', 'melhorar', 'ampli', 'reforc', 'expandir', 'construir', 'contratar'],
    objects: ['saude', 'sus', 'hospital', 'posto de saude', 'ubs', 'medico', 'remedio', 'medicamento', 'fila'],
    expects: ['BUDGET_AREA'],
    builder: 'saude',
    category: 'saude',
    ministries: ['saude'],
    specificity: 85,
  },
  {
    id: 'investir_educacao',
    label: 'Investir em educação',
    phrases: [
      'melhorar a educacao',
      'investir na educacao',
      'investir em educacao',
      'melhorar as escolas',
      'valorizar os professores',
      'ampliar as creches',
    ],
    verbs: ['investir', 'melhorar', 'ampli', 'valoriz', 'construir', 'reforc', 'expandir'],
    objects: ['educacao', 'escola', 'professor', 'universidade', 'creche', 'ensino', 'aluno', 'merenda'],
    expects: ['BUDGET_AREA'],
    builder: 'educacao',
    category: 'educacao',
    ministries: ['educacao'],
    specificity: 85,
  },
  {
    id: 'investir_infraestrutura',
    label: 'Investir em infraestrutura',
    phrases: [
      'melhorar a infraestrutura',
      'investir em infraestrutura',
      'investir em obras',
      'melhorar as estradas',
      'construir ferrovias',
      'plano de obras',
    ],
    verbs: ['investir', 'melhorar', 'construir', 'ampli', 'duplic', 'reformar', 'pavimentar'],
    objects: [
      'infraestrutura',
      'estrada',
      'rodovia',
      'ferrovia',
      'porto',
      'aeroporto',
      'saneamento',
      'obra',
      'internet',
      'banda larga',
    ],
    expects: ['BUDGET_AREA'],
    builder: 'infraestrutura',
    category: 'infraestrutura',
    ministries: ['infraestrutura'],
    specificity: 85,
  },
  {
    id: 'seguranca_publica',
    label: 'Segurança pública',
    phrases: [
      'melhorar a seguranca',
      'combater o crime',
      'combater a criminalidade',
      'reforcar a policia',
      'reduzir os homicidios',
      'enfrentar o crime organizado',
    ],
    verbs: ['combater', 'reforc', 'melhorar', 'enfrent', 'reduzir', 'ampli', 'equipar'],
    objects: ['seguranca', 'crime', 'criminalidade', 'policia', 'homicidio', 'violencia', 'faccao', 'presidio'],
    expects: ['BUDGET_AREA'],
    builder: 'seguranca',
    category: 'seguranca',
    ministries: ['justica'],
    specificity: 85,
  },
  {
    id: 'alterar_numero',
    label: 'Alterar um número do país',
    phrases: [
      'aumentar o salario minimo',
      'reajustar o salario minimo',
      'subir o salario minimo',
      'aumentar o beneficio',
      'reajustar as aposentadorias',
      'aumentar o piso',
    ],
    verbs: ['aument', 'reduzir', 'reajust', 'fixar', 'elevar', 'diminuir', 'dobrar', 'subir', 'contratar'],
    objects: [],
    expects: ['NUMERIC_TARGET'],
    category: 'economia',
    ministries: ['fazenda'],
    specificity: 94,
  },
];

export const INTENT_BY_ID: Record<string, IntentSpec> = Object.fromEntries(
  INTENTS.map((intent) => [intent.id, intent]),
);
