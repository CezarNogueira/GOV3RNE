/**
 * Tipos primitivos e uniões compartilhadas por todo o simulador.
 *
 * AVISO: GOV3RNE é uma obra de ficção. Nomes, siglas e números partem de
 * referências públicas apenas como ponto de partida; tudo que acontece
 * durante uma partida é simulação.
 */

export type Region = 'norte' | 'nordeste' | 'centro-oeste' | 'sudeste' | 'sul';

export const REGIONS = [
  'norte',
  'nordeste',
  'centro-oeste',
  'sudeste',
  'sul',
] as const;

export const REGION_LABEL: Record<Region, string> = {
  norte: 'Norte',
  nordeste: 'Nordeste',
  'centro-oeste': 'Centro-Oeste',
  sudeste: 'Sudeste',
  sul: 'Sul',
};

export const DIFFICULTIES = ['facil', 'normal', 'dificil', 'realista'] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

/** Eixo econômico: -100 estatizante <-> +100 liberal. */
export type EconomicAxis = number;
/** Eixo de costumes: -100 progressista <-> +100 conservador. */
export type SocialAxis = number;
/** Eixo institucional: -100 rupturista <-> +100 legalista. */
export type InstitutionalAxis = number;

export interface IdeologyVector {
  economic: EconomicAxis;
  social: SocialAxis;
  institutional: InstitutionalAxis;
}

export type PolicyCategory =
  | 'economia'
  | 'saude'
  | 'educacao'
  | 'seguranca'
  | 'infraestrutura'
  | 'social'
  | 'meio_ambiente'
  | 'institucional'
  | 'diplomacia'
  | 'agricultura'
  | 'trabalho'
  | 'cultura';

export const POLICY_CATEGORIES = [
  'economia',
  'saude',
  'educacao',
  'seguranca',
  'infraestrutura',
  'social',
  'meio_ambiente',
  'institucional',
  'diplomacia',
  'agricultura',
  'trabalho',
  'cultura',
] as const;

export const CATEGORY_LABEL: Record<PolicyCategory, string> = {
  economia: 'Economia',
  saude: 'Saúde',
  educacao: 'Educação',
  seguranca: 'Segurança',
  infraestrutura: 'Infraestrutura',
  social: 'Social',
  meio_ambiente: 'Meio Ambiente',
  institucional: 'Institucional',
  diplomacia: 'Diplomacia',
  agricultura: 'Agricultura',
  trabalho: 'Trabalho',
  cultura: 'Cultura',
};

/** Instrumento jurídico usado para materializar uma decisão presidencial. */
export type LegalInstrument =
  | 'decreto'
  | 'medida_provisoria'
  | 'projeto_lei'
  | 'projeto_lei_complementar'
  | 'pec'
  | 'nomeacao'
  | 'programa'
  | 'ato_administrativo';

export const LEGAL_INSTRUMENTS = [
  'decreto',
  'medida_provisoria',
  'projeto_lei',
  'projeto_lei_complementar',
  'pec',
  'nomeacao',
  'programa',
  'ato_administrativo',
] as const;

/** Procedência de um número exibido na interface. */
export type DataOrigin = 'inicial' | 'simulado' | 'estimado';

export type Trend = 'up' | 'down' | 'flat';

/** Valor numérico acompanhado da sua procedência, para rotular a UI. */
export interface TrackedValue {
  value: number;
  origin: DataOrigin;
  previous?: number;
}

export interface Identified {
  id: string;
}

export type Timestamp = string;
