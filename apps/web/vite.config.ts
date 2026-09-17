import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

const CLAIMS_REMOTE =
  process.env.VITE_CLAIMS_REMOTE ?? 'http://localhost:5174/assets/remoteEntry.js';
const PUBLIC_SITE = process.env.VITE_PUBLIC_SITE ?? 'http://localhost:3000';

const SHARED = ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material'];

const SITE_PROXY = {
  '/site-api': {
    target: PUBLIC_SITE,
    changeOrigin: true,
    rewrite: (path: string): string => path.replace(/^\/site-api/, '/api'),
  },
};

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'console',
      remotes: { claims: CLAIMS_REMOTE },
      shared: SHARED,
    }),
  ],
  server: { watch: { usePolling: true }, proxy: SITE_PROXY },
  preview: { proxy: SITE_PROXY },
  build: { target: 'esnext' },
});
