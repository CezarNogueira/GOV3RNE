import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Cópia em JavaScript de vitest.config.ts.
 *
 * Existe porque um config em TypeScript precisa ser transpilado para um arquivo
 * temporário dentro de node_modules antes de rodar, e este ambiente de execução
 * não permite escrita dentro do projeto. Um config .mjs é carregado direto, sem
 * arquivo intermediário.
 *
 * Se este arquivo divergir de vitest.config.ts, o config TypeScript é o que
 * vale: ele é o usado por `npm test`.
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
