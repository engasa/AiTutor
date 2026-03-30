import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['app/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./app/__tests__/setup.ts'],
  },
});
