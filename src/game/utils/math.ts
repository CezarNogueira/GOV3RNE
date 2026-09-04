export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Trava em 0-100, o intervalo padrão dos índices do jogo. */
export function clamp100(value: number): number {
  return clamp(value, 0, 100);
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Move `current` na direção de `target` por uma fração `rate`.
 * Usado em toda parte: índices sociais não saltam, eles convergem.
 */
export function approach(current: number, target: number, rate: number): number {
  return current + (target - current) * clamp(rate, 0, 1);
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function weightedAverage(values: readonly { value: number; weight: number }[]): number {
  const totalWeight = sum(values.map((v) => v.weight));
  if (totalWeight === 0) return 0;
  return sum(values.map((v) => v.value * v.weight)) / totalWeight;
}

/** Curva suave 0-1 usada para converter distâncias em probabilidades. */
export function sigmoid(x: number, steepness = 1): number {
  return 1 / (1 + Math.exp(-x * steepness));
}

/** Retornos decrescentes: dobrar o gasto não dobra o resultado. */
export function diminishing(value: number, halfPoint: number): number {
  if (value <= 0) return 0;
  return value / (value + halfPoint);
}

export function percentDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}
