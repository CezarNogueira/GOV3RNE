/**
 * RNG determinístico (mulberry32). A partida guarda seed + cursor, então
 * recarregar um save reproduz exatamente a mesma sequência de sorteios.
 */
export class Rng {
  private state: number;

  constructor(seed: number, cursor = 0) {
    this.state = (seed >>> 0) + cursor * 0x6d2b79f5;
    this.cursorValue = cursor;
    this.seedValue = seed >>> 0;
  }

  private cursorValue: number;
  private readonly seedValue: number;

  get cursor(): number {
    return this.cursorValue;
  }

  get seed(): number {
    return this.seedValue;
  }

  /** Float em [0, 1). */
  next(): number {
    this.cursorValue += 1;
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float em [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Inteiro em [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick recebeu lista vazia');
    const item = items[Math.floor(this.next() * items.length)];
    return item as T;
  }

  /** Sorteio ponderado. Pesos não precisam somar 1. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    if (items.length === 0) throw new Error('Rng.weighted recebeu lista vazia');
    const weights = items.map((item) => Math.max(0, weightOf(item)));
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i += 1) {
      roll -= weights[i] ?? 0;
      if (roll <= 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const a = copy[i] as T;
      const b = copy[j] as T;
      copy[i] = b;
      copy[j] = a;
    }
    return copy;
  }

  /** Ruído gaussiano aproximado (soma de uniformes), média 0. */
  noise(scale = 1): number {
    const sum = this.next() + this.next() + this.next() - 1.5;
    return sum * scale * 0.8165;
  }
}

export function createSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
