import type { Ministry, MinistryId } from '../types/index';

/**
 * Dez pastas. O jogo agrega áreas correlatas para manter cada decisão legível:
 * cada pasta é ao mesmo tempo uma unidade orçamentária e uma moeda política.
 * Orçamentos são parâmetros de simulação, não a LOA real.
 */
export const MINISTRIES: readonly Ministry[] = [
  {
    id: 'casa_civil',
    name: 'Casa Civil',
    shortName: 'Casa Civil',
    weight: 10,
    budget: 8,
    dirty: false,
    categories: ['institucional'],
    description:
      'Coordena o governo inteiro e filtra o que chega até você. Um titular fraco aqui trava as outras nove pastas.',
  },
  {
    id: 'fazenda',
    name: 'Ministério da Fazenda',
    shortName: 'Fazenda',
    weight: 10,
    budget: 40,
    dirty: false,
    categories: ['economia', 'trabalho'],
    description:
      'Quem assina aqui define se o mercado acredita no seu governo. Trocar o titular custa risco-país no mesmo dia.',
  },
  {
    id: 'justica',
    name: 'Ministério da Justiça e Segurança Pública',
    shortName: 'Justiça',
    weight: 10,
    budget: 25,
    dirty: false,
    categories: ['seguranca', 'institucional'],
    description:
      'Polícia Federal, presídios e a fronteira. É a pasta que aparece no telejornal quando alguma coisa dá errado.',
  },
  {
    id: 'saude',
    name: 'Ministério da Saúde',
    shortName: 'Saúde',
    weight: 10,
    budget: 220,
    dirty: true,
    categories: ['saude'],
    description:
      'O maior orçamento executável do governo e a maior fila de fornecedores. Rende aprovação e rende CPI.',
  },
  {
    id: 'educacao',
    name: 'Ministério da Educação',
    shortName: 'Educação',
    weight: 9,
    budget: 155,
    dirty: false,
    categories: ['educacao'],
    description:
      'Resultado aparece em uma década, cobrança aparece em um mês. Pasta de prestígio e de greve.',
  },
  {
    id: 'defesa',
    name: 'Ministério da Defesa',
    shortName: 'Defesa',
    weight: 9,
    budget: 130,
    dirty: false,
    categories: ['seguranca', 'diplomacia'],
    description:
      'Meio milhão de fardas que não votam em bloco mas falam alto. Soldo atrasado vira crise institucional.',
  },
  {
    id: 'infraestrutura',
    name: 'Ministério da Infraestrutura, Transportes e Energia',
    shortName: 'Infraestrutura',
    weight: 9,
    budget: 71,
    dirty: true,
    categories: ['infraestrutura', 'economia'],
    description:
      'Obra é foto, emprego e palanque. Também é o lugar onde o dinheiro some com mais criatividade.',
  },
  {
    id: 'desenvolvimento_social',
    name: 'Ministério do Desenvolvimento Social e Trabalho',
    shortName: 'Desenvolvimento Social',
    weight: 9,
    budget: 340,
    dirty: false,
    categories: ['social', 'trabalho'],
    description:
      'Transferência de renda direta. Mexer aqui move aprovação em semanas e move o primário no mesmo mês.',
  },
  {
    id: 'agricultura',
    name: 'Ministério da Agricultura e Meio Ambiente',
    shortName: 'Agricultura e Meio Ambiente',
    weight: 8,
    budget: 36,
    dirty: false,
    categories: ['agricultura', 'meio_ambiente'],
    description:
      'Duas bancadas que se odeiam dentro da mesma pasta. Agradar uma é perder a outra, sempre.',
  },
  {
    id: 'relacoes_exteriores',
    name: 'Ministério das Relações Exteriores',
    shortName: 'Relações Exteriores',
    weight: 8,
    budget: 5,
    dirty: false,
    categories: ['diplomacia'],
    description:
      'Orçamento minúsculo e consequência enorme. Uma frase mal colocada aqui derruba um acordo comercial.',
  },
];

export const MINISTRY_BY_ID: Record<MinistryId, Ministry> = Object.fromEntries(
  MINISTRIES.map((ministry) => [ministry.id, ministry]),
) as Record<MinistryId, Ministry>;

/** Tupla literal: z.enum precisa de tupla, e isso preserva os tipos no schema. */
export const MINISTRY_IDS = [
  'casa_civil',
  'fazenda',
  'justica',
  'saude',
  'educacao',
  'defesa',
  'infraestrutura',
  'desenvolvimento_social',
  'agricultura',
  'relacoes_exteriores',
] as const satisfies readonly MinistryId[];
