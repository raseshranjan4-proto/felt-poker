import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:3001', ws: true } },
  },
  test: { root: '.', include: ['tests/**/*.test.ts'] },
} as any);
