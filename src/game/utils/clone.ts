/**
 * Clone profundo do estado da partida.
 *
 * O GameState é JSON puro por contrato (ver engines/save.ts), então o
 * round-trip por JSON é seguro e funciona igual no Node e no navegador —
 * sem depender de structuredClone, que não existe em todos os alvos.
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
