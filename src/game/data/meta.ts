import type {
  ByGroup,
  ByResource,
  ByService,
  CardCategory,
  GroupId,
  ResourceId,
  ServiceId,
} from '../types/common';
import { INITIAL_SERVICE, INITIAL_SOCIAL } from './config';

// ----------------------------------------------------------------- serviços
export const SERVICE_LABEL: ByService<string> = {
  saude: 'Saúde',
  educacao: 'Educação',
  seguranca: 'Segurança',
  agricultura: 'Agricultura',
  infraestrutura: 'Infraestrutura',
};

export const SERVICE_BLURB: ByService<string> = {
  saude: 'Hospitais, vacinação e atendimento básico.',
  educacao: 'Escolas, professores e universidades.',
  seguranca: 'Policiamento, inteligência e prevenção.',
  agricultura: 'Produção rural, crédito e irrigação.',
  infraestrutura: 'Estradas, energia, portos e saneamento.',
};

export const INITIAL_SERVICES: ByService<number> = {
  saude: INITIAL_SERVICE,
  educacao: INITIAL_SERVICE,
  seguranca: INITIAL_SERVICE,
  agricultura: INITIAL_SERVICE,
  infraestrutura: INITIAL_SERVICE,
};

// ----------------------------------------------------------------- recursos
export interface ResourceMeta {
  label: string;
  blurb: string;
  initial: number;
  /** Receita mensal, em reais, por ponto do recurso. */
  revenuePerPoint: number;
  /** Peso de cada serviço na evolução do recurso. Ausente = não influencia. */
  influences: Partial<Record<ServiceId, number>>;
}

export const RESOURCES: ByResource<ResourceMeta> = {
  comida: {
    label: 'Comida',
    blurb: 'Capacidade de produzir alimentos. Cresce com a Agricultura.',
    initial: 800,
    revenuePerPoint: 6_400,
    influences: { agricultura: 1 },
  },
  energia: {
    label: 'Energia',
    blurb: 'Produção e distribuição de energia. Cresce com a Infraestrutura.',
    initial: 400,
    revenuePerPoint: 24_850,
    influences: { infraestrutura: 1 },
  },
  tecnologia: {
    label: 'Tecnologia',
    blurb: 'Capacidade de desenvolvimento tecnológico. Cresce com a Educação.',
    initial: 100,
    revenuePerPoint: 35_150,
    influences: { educacao: 1 },
  },
  turismo: {
    label: 'Turismo',
    blurb: 'Atrai visitantes. Todos os serviços pesam; a Segurança pesa três vezes mais.',
    initial: 500,
    revenuePerPoint: 4_250,
    influences: { saude: 1, educacao: 1, seguranca: 3, agricultura: 1, infraestrutura: 1 },
  },
  capital_humano: {
    label: 'Capital Humano',
    blurb: 'Qualificação e saúde da força de trabalho. Educação pesa mais.',
    initial: 300,
    revenuePerPoint: 21_750,
    influences: { saude: 2, educacao: 3, seguranca: 1 },
  },
};

export const INITIAL_RESOURCES: ByResource<number> = {
  comida: RESOURCES.comida.initial,
  energia: RESOURCES.energia.initial,
  tecnologia: RESOURCES.tecnologia.initial,
  turismo: RESOURCES.turismo.initial,
  capital_humano: RESOURCES.capital_humano.initial,
};

export const RESOURCE_LABEL: ByResource<string> = {
  comida: RESOURCES.comida.label,
  energia: RESOURCES.energia.label,
  tecnologia: RESOURCES.tecnologia.label,
  turismo: RESOURCES.turismo.label,
  capital_humano: RESOURCES.capital_humano.label,
};

// ------------------------------------------------------------------- grupos
export interface GroupMeta {
  label: string;
  /** O que agrada o grupo. Texto da tela de Sociedade. */
  likes: string[];
  /** O que desagrada o grupo. */
  dislikes: string[];
}

export const GROUPS: ByGroup<GroupMeta> = {
  pobres: {
    label: 'Pobres',
    likes: ['Mais Saúde', 'Mais Educação', 'Melhoria dos serviços públicos'],
    dislikes: ['Cortes de gastos', 'Austeridade', 'Menos investimento social'],
  },
  ricos: {
    label: 'Ricos',
    likes: ['Mais Educação', 'Valorização da moeda'],
    dislikes: ['Aumento da dívida', 'Aumento dos impostos'],
  },
  militares: {
    label: 'Militares',
    likes: ['Mais Segurança', 'Mais Infraestrutura'],
    dislikes: ['Aumento da dívida', 'Queda do IDH'],
  },
  indigenas: {
    label: 'Indígenas',
    likes: ['Alta do IDH', 'Preservação ambiental', 'Melhorias sociais'],
    dislikes: [
      'Novas estruturas: escolas, pontes, indústrias, hospitais e estradas',
      'Grandes obras em seus territórios',
    ],
  },
  empresarios: {
    label: 'Empresários',
    likes: ['Menos impostos', 'Mais Infraestrutura', 'Mais Agricultura', 'Crescimento do Comércio'],
    dislikes: ['Aumento dos impostos', 'Queda do Comércio'],
  },
};

export const GROUP_LABEL: ByGroup<string> = {
  pobres: GROUPS.pobres.label,
  ricos: GROUPS.ricos.label,
  militares: GROUPS.militares.label,
  indigenas: GROUPS.indigenas.label,
  empresarios: GROUPS.empresarios.label,
};

export const INITIAL_SOCIETY: ByGroup<number> = {
  pobres: INITIAL_SOCIAL,
  ricos: INITIAL_SOCIAL,
  militares: INITIAL_SOCIAL,
  indigenas: INITIAL_SOCIAL,
  empresarios: INITIAL_SOCIAL,
};

// --------------------------------------------------------------- categorias
export const CATEGORY_LABEL: Record<CardCategory, string> = {
  saude: 'Saúde',
  educacao: 'Educação',
  seguranca: 'Segurança',
  agricultura: 'Agricultura',
  infraestrutura: 'Infraestrutura',
  economia_recursos: 'Economia e recursos',
  politica_tributaria: 'Política econômica e tributária',
  sociedade: 'Sociedade e desenvolvimento',
};

export const INTERNATIONAL_LABEL = { hdi: 'IDH', commerce: 'Comércio' } as const;

export type { GroupId, ResourceId, ServiceId };
