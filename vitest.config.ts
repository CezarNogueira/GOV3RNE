import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Dois tipos de teste rodam aqui:
 *   - motor (src/game/**): lógica pura, sem DOM;
 *   - render (src/**\/*.render.test.tsx): monta as telas num DOM real para
 *     pegar erro de runtime que o typecheck não pega — acesso a índice
 *     inexistente, hook mal usado, dado faltando na primeira renderização.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
