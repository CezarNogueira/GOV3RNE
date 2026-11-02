import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
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

// O happy-dom implementa `Element.animate` pela metade: ao desmontar, o
// framer-motion cancela a animação e o DOM de teste rejeita a promessa, que
// vira "Unhandled Rejection" e derruba a suíte. Sem a API, o framer-motion usa
// o animador em JavaScript, que é o que o teste precisa.
delete (Element.prototype as { animate?: unknown }).animate;
