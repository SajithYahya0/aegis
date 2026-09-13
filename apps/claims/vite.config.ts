import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

const SHARED = ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material'];

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'claims',
      filename: 'remoteEntry.js',
      exposes: { './ClaimIntake': './src/ClaimIntake.tsx' },
      shared: SHARED,
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
  preview: { headers: { 'Access-Control-Allow-Origin': '*' } },
  test: { globals: true, environment: 'jsdom', testTimeout: 20_000 },
});
