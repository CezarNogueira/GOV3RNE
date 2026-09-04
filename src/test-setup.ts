import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * O jogo usa APIs de navegador que o happy-dom não implementa por completo.
 * Aqui elas ganham um substituto mínimo, para o teste medir o que interessa —
 * se a tela monta — em vez de quebrar em detalhe de ambiente.
 */
afterEach(() => cleanup());

// Recharts mede o contêiner via ResizeObserver.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as never;

// `prefers-reduced-motion` é consultado pelo contador animado.
globalThis.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as never;

// A checagem de disponibilidade da IA não deve fazer rede em teste.
globalThis.fetch = vi.fn(async () =>
  new Response(JSON.stringify({ available: false }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }),
) as never;
