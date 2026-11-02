import { RESOURCE_GROWTH, RESOURCE_MAX, RESOURCE_MIN } from '../data/config';
import { RESOURCES } from '../data/meta';
import {
  RESOURCE_IDS,
  SERVICE_IDS,
  type ByResource,
  type ByService,
  type ServiceId,
} from '../types/common';
import { clamp, round1 } from '../utils/math';

/** Todo valor de recurso passa por aqui: de 0 a 1000, em décimos de ponto. */
export function clampResource(value: number): number {
  return clamp(round1(value), RESOURCE_MIN, RESOURCE_MAX);
}

/** Receita mensal de um recurso, em reais inteiros. */
export function resourceRevenue(resource: keyof typeof RESOURCES, quantity: number): number {
  return Math.round(round1(quantity) * RESOURCES[resource].revenuePerPoint);
}

export function totalRevenue(resources: ByResource<number>): {
  total: number;
  byResource: ByResource<number>;
} {
  const byResource = {} as ByResource<number>;
  let total = 0;
  for (const id of RESOURCE_IDS) {
    byResource[id] = resourceRevenue(id, resources[id]);
    total += byResource[id];
  }
  return { total, byResource };
}

/**
 * Sinal de um serviço no mês: quanto avançou desde o início do mês (limitado,
 * para uma obra grande não explodir o recurso) mais um bônus por bater a meta
 * ou um desconto por ficar abaixo dela.
 */
export function serviceSignal(
  now: number,
  start: number,
  target: number | null,
): number {
  const progress = clamp(now - start, -RESOURCE_GROWTH.maxProgress, RESOURCE_GROWTH.maxProgress);
  if (target === null) return progress;
  return progress + (now >= target ? RESOURCE_GROWTH.metBonus : -RESOURCE_GROWTH.missPenalty);
}

/** Média ponderada dos sinais dos serviços que influenciam o recurso. */
export function resourceSignal(
  resource: keyof typeof RESOURCES,
  signals: ByService<number>,
): number {
  const influences = RESOURCES[resource].influences;
  let weighted = 0;
  let weights = 0;
  for (const id of SERVICE_IDS) {
    const weight = influences[id] ?? 0;
    if (weight === 0) continue;
    weighted += weight * signals[id];
    weights += weight;
  }
  return weights === 0 ? 0 : weighted / weights;
}

export interface ResourceEvolution {
  resources: ByResource<number>;
  pressure: ByResource<number>;
  /** Variação aplicada, já limitada (o que de fato mudou). */
  deltas: ByResource<number>;
}

/**
 * Passo 4 da passagem do mês: serviços → recursos, de forma gradual.
 *
 * A pressão acumulada decai `pressureDecay` por mês e recebe o sinal novo; o
 * recurso anda `perPoint` × pressão. `directPenalty` é a perda direta (hoje,
 * a da pressão tributária), subtraída depois e sempre dentro de 0-1000.
 */
export function evolveResources(input: {
  resources: ByResource<number>;
  pressure: ByResource<number>;
  servicesNow: ByService<number>;
  servicesStart: ByService<number>;
  targets: ByService<number | null>;
  directPenalty?: Partial<ByResource<number>>;
}): ResourceEvolution {
  const signals = {} as ByService<number>;
  for (const id of SERVICE_IDS) {
    signals[id] = serviceSignal(input.servicesNow[id], input.servicesStart[id], input.targets[id]);
  }

  const resources = {} as ByResource<number>;
  const pressure = {} as ByResource<number>;
  const deltas = {} as ByResource<number>;
  for (const id of RESOURCE_IDS) {
    const nextPressure =
      input.pressure[id] * RESOURCE_GROWTH.pressureDecay + resourceSignal(id, signals);
    const growth = round1(RESOURCE_GROWTH.perPoint * nextPressure);
    const penalty = input.directPenalty?.[id] ?? 0;
    const next = clampResource(input.resources[id] + growth - penalty);
    pressure[id] = Math.round(nextPressure * 1000) / 1000;
    resources[id] = next;
    deltas[id] = round1(next - input.resources[id]);
  }
  return { resources, pressure, deltas };
}

/** Quais serviços influenciam o recurso, com o peso de cada um. Para a interface. */
export function influencesOf(resource: keyof typeof RESOURCES): { id: ServiceId; weight: number }[] {
  const influences = RESOURCES[resource].influences;
  return SERVICE_IDS.filter((id) => (influences[id] ?? 0) > 0).map((id) => ({
    id,
    weight: influences[id] ?? 0,
  }));
}
