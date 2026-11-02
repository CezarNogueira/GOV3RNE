import { CRISIS, SOCIAL_MAX, SOCIAL_MIN, SOCIAL_REACTION_STEP } from '../data/config';
import { GROUP_IDS, type ByGroup, type GroupId } from '../types/common';
import { clamp } from '../utils/math';

/** Toda satisfação passa por aqui: nunca abaixo de 0 nem acima de 100. */
export function clampSocial(value: number): number {
  return clamp(Math.round(value), SOCIAL_MIN, SOCIAL_MAX);
}

export function applySocialDeltas(
  society: ByGroup<number>,
  deltas: Partial<Record<GroupId, number>>,
): ByGroup<number> {
  const next = { ...society };
  for (const id of GROUP_IDS) next[id] = clampSocial(society[id] + (deltas[id] ?? 0));
  return next;
}

export function crisisSocialPenalty(): Partial<Record<GroupId, number>> {
  const penalty: Partial<Record<GroupId, number>> = {};
  for (const id of GROUP_IDS) penalty[id] = -CRISIS.groupPenalty;
  return penalty;
}

export interface MacroChanges {
  /** Variação do mês, SEM contar o que a carta já havia feito. */
  hdiDelta: number;
  commerceDelta: number;
  currencyDelta: number;
  debtDelta: number;
  allTargetsMet: boolean;
}

/**
 * Reação dos grupos aos indicadores do mês. Cada grupo reage só ao que a lista
 * de gostos e desgostos dele cita, em passos pequenos. O que a CARTA causou
 * (Saúde, Educação, impostos…) já está nas consequências sociais da própria
 * carta e NÃO é contado de novo aqui.
 */
export function macroReactions(changes: MacroChanges): Partial<Record<GroupId, number>> {
  const step = SOCIAL_REACTION_STEP;
  const out: Record<GroupId, number> = { pobres: 0, ricos: 0, militares: 0, indigenas: 0, empresarios: 0 };

  if (changes.hdiDelta > 0) out.indigenas += step;
  if (changes.hdiDelta < 0) out.militares -= step;
  if (changes.commerceDelta > 0) out.empresarios += step;
  if (changes.commerceDelta < 0) out.empresarios -= step;
  if (changes.currencyDelta > 0) out.ricos += step;
  if (changes.debtDelta > 0) {
    out.ricos -= step;
    out.militares -= step;
  }
  if (changes.allTargetsMet) out.pobres += step;
  return out;
}
