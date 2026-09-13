import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [['**/route.test.ts', 'node']],
    testTimeout: 20_000,
  },
});
