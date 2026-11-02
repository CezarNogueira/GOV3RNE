import type { RandomSource } from './utils/rng';
import { createGame } from './engines/setup';
import { DEFAULT_AVATAR } from './data/avatar';
import type { GameState } from './types/state';

/**
 * Sorteador roteirizado para testes: devolve os valores da fila, na ordem, e
 * `fallback` quando ela acaba. `shuffle` não embaralha, o que deixa o sorteio de
 * cartas previsível (as três primeiras disponíveis, na ordem do catálogo).
 */
export class ScriptedRng implements RandomSource {
  private readonly queue: number[];

  constructor(
    values: number[] = [],
    private readonly fallback = 0.5,
  ) {
    this.queue = [...values];
  }

  next(): number {
    return this.queue.length > 0 ? (this.queue.shift() as number) : this.fallback;
  }
  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }
  int(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))] as T;
  }
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    const total = items.reduce((sum, item) => sum + weightOf(item), 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= weightOf(item);
      if (roll <= 0) return item;
    }
    return items[items.length - 1] as T;
  }
  shuffle<T>(items: readonly T[]): T[] {
    return [...items];
  }
}

export function newTestGame(seed = 1): GameState {
  return createGame({
    seed,
    president: { firstName: 'Ana', lastName: 'Souza', politicalName: 'Ana Souza', avatar: DEFAULT_AVATAR },
  });
}

/** Troca as três cartas do mês e as metas, para o teste não depender de sorteio. */
export function withTurn(
  state: GameState,
  offered: [string, string, string],
  targets?: Partial<GameState['turn']['targets']>,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  next.turn.offeredCardIds = offered;
  if (targets) {
    next.turn.targets = {
      saude: null,
      educacao: null,
      seguranca: null,
      agricultura: null,
      infraestrutura: null,
      ...targets,
    };
  }
  return next;
}
