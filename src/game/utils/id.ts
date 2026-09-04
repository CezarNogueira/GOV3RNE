import type { Rng } from './rng';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Id curto e determinístico quando gerado a partir do Rng da partida. */
export function makeId(prefix: string, rng?: Rng): string {
  let body = '';
  for (let i = 0; i < 8; i += 1) {
    const roll = rng ? rng.next() : Math.random();
    body += ALPHABET[Math.floor(roll * ALPHABET.length)];
  }
  return `${prefix}_${body}`;
}
