/**
 * Vocabulário compartilhado do simulador.
 *
 * AVISO: GOV3RNE é uma obra de ficção. Os números, os países do ranking e tudo
 * o que acontece durante a partida são simulação.
 */

/** Os cinco serviços públicos. Pontuação de 0 a 100. */
export const SERVICE_IDS = ['saude', 'educacao', 'seguranca', 'agricultura', 'infraestrutura'] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

/** Os cinco recursos nacionais. Quantidade de 0 a 1000. */
export const RESOURCE_IDS = ['comida', 'energia', 'tecnologia', 'turismo', 'capital_humano'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

/** Os cinco grupos sociais. Satisfação de 0 a 100. */
export const GROUP_IDS = ['pobres', 'ricos', 'militares', 'indigenas', 'empresarios'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

/** Parâmetros internacionais que uma medida pode alterar diretamente. */
export const INTERNATIONAL_IDS = ['hdi', 'commerce'] as const;
export type InternationalId = (typeof INTERNATIONAL_IDS)[number];

export const CARD_CATEGORIES = [
  'saude',
  'educacao',
  'seguranca',
  'agricultura',
  'infraestrutura',
  'economia_recursos',
  'politica_tributaria',
  'sociedade',
] as const;
export type CardCategory = (typeof CARD_CATEGORIES)[number];

export type Trend = 'up' | 'down' | 'flat';

/** Qualquer mapa com uma entrada por serviço / recurso / grupo. */
export type ByService<T> = Record<ServiceId, T>;
export type ByResource<T> = Record<ResourceId, T>;
export type ByGroup<T> = Record<GroupId, T>;

export type Timestamp = string;
