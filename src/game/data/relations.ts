import type { RelationTierId } from '../types/index';

/**
 * FAIXAS DE RELAÇÃO BILATERAL
 *
 * A relação com cada país vai de -100 a +100 e é dividida em seis faixas. A
 * faixa não é só um rótulo: ela decide o que está disponível na mesa de
 * negociação. Comércio básico já rende com uma relação apenas "Boa"; projeto
 * de infraestrutura e cooperação militar exigem "Muito boa"; o acordo em
 * moeda local, que depende de confiança mútua, só aparece com um "Aliado
 * estratégico".
 */
export interface RelationTier {
  id: RelationTierId;
  label: string;
  emoji: string;
  min: number;
  max: number;
  description: string;
  actions: string;
  tone: 'danger' | 'warn' | 'neutral' | 'gov' | 'info';
}

export const RELATION_TIERS: readonly RelationTier[] = [
  {
    id: 'hostil',
    label: 'Hostil',
    emoji: '🔴',
    min: -100,
    max: -60,
    description: 'Rompimento de fato. O parceiro trata o Brasil como adversário.',
    actions: 'Sanções, protestos, ameaças',
    tone: 'danger',
  },
  {
    id: 'ruim',
    label: 'Ruim',
    emoji: '🟠',
    min: -59,
    max: -20,
    description: 'Desconfiança declarada. Qualquer avanço exige gesto público antes.',
    actions: 'Negociações limitadas',
    tone: 'danger',
  },
  {
    id: 'neutra',
    label: 'Neutra',
    emoji: '🟡',
    min: -19,
    max: 19,
    description: 'Sem hostilidade e sem parceria. A relação existe, mas não rende nada sozinha.',
    actions: 'Diplomacia básica',
    tone: 'neutral',
  },
  {
    id: 'boa',
    label: 'Boa',
    emoji: '🟢',
    min: 20,
    max: 59,
    description: 'Parceria funcional. Comércio e cooperação já entram em pauta.',
    actions: 'Comércio e cooperação',
    tone: 'gov',
  },
  {
    id: 'muito_boa',
    label: 'Muito boa',
    emoji: '🔵',
    min: 60,
    max: 79,
    description: 'Confiança consolidada. Espaço para grandes acordos estruturantes.',
    actions: 'Grandes acordos',
    tone: 'info',
  },
  {
    id: 'aliado',
    label: 'Aliado estratégico',
    emoji: '🟣',
    min: 80,
    max: 100,
    description: 'O mais próximo de uma aliança que existe fora de tratado militar formal.',
    actions: 'Tratados e projetos especiais',
    tone: 'info',
  },
];

/** Devolve a faixa correspondente a um valor de relação, -100 a +100. */
export function relationTier(relation: number): RelationTier {
  const found = RELATION_TIERS.find((tier) => relation >= tier.min && relation <= tier.max);
  // relation é sempre clampado a [-100, 100] pelo motor; isto é só uma rede de segurança.
  return found ?? (relation > 0 ? (RELATION_TIERS[RELATION_TIERS.length - 1] as RelationTier) : (RELATION_TIERS[0] as RelationTier));
}
