import { SERVICE_MAX, SERVICE_MIN, TARGETS } from '../data/config';
import { SERVICE_IDS, type ByService, type ServiceId } from '../types/common';
import { clamp } from '../utils/math';
import type { RandomSource } from '../utils/rng';

/** Todo valor de serviço passa por aqui: nunca abaixo de 0 nem acima de 100. */
export function clampService(value: number): number {
  return clamp(Math.round(value), SERVICE_MIN, SERVICE_MAX);
}

/**
 * METAS DO MÊS
 *
 * Cada serviço tem `TARGETS.chance` de receber meta; a meta fica de 0 a 2
 * pontos acima do valor atual (0 = "não perca o que tem"). Pelo menos um
 * serviço sempre recebe meta: sem nenhuma, o IDH não teria o que avaliar.
 *
 * Gasta sempre o mesmo número de sorteios por serviço, para o fluxo do
 * sorteador não depender do resultado.
 */
export function generateTargets(
  services: ByService<number>,
  rng: RandomSource,
): ByService<number | null> {
  const targets = {} as ByService<number | null>;
  for (const id of SERVICE_IDS) {
    const has = rng.next() < TARGETS.chance;
    const { delta } = rng.weighted(TARGETS.deltas, (entry) => entry.weight);
    targets[id] = has ? clampService(services[id] + delta) : null;
  }

  if (SERVICE_IDS.every((id) => targets[id] === null)) {
    const id: ServiceId = rng.pick(SERVICE_IDS);
    const { delta } = rng.weighted(TARGETS.deltas, (entry) => entry.weight);
    targets[id] = clampService(services[id] + delta);
  }
  return targets;
}

export interface TargetEvaluation {
  /** `true` bateu a meta, `false` ficou abaixo, `null` não tinha meta. */
  met: ByService<boolean | null>;
  hasTargets: boolean;
  /** Todos os serviços COM meta terminaram nela ou acima. */
  allMet: boolean;
}

export function evaluateTargets(
  services: ByService<number>,
  targets: ByService<number | null>,
): TargetEvaluation {
  const met = {} as ByService<boolean | null>;
  let hasTargets = false;
  let allMet = true;
  for (const id of SERVICE_IDS) {
    const target = targets[id];
    if (target === null) {
      met[id] = null;
      continue;
    }
    hasTargets = true;
    met[id] = services[id] >= target;
    if (!met[id]) allMet = false;
  }
  return { met, hasTargets, allMet };
}
