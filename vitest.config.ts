import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['app/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./app/__tests__/setup.ts'],
  },
});
