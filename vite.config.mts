import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    open: '/react.html',
    proxy: { '/api': `http://127.0.0.1:${process.env.AI_ARTIST_PORT || '8010'}` },
  },
  build: { outDir: 'dist', rolldownOptions: { input: resolve(import.meta.dirname, 'react.html') } },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/test/setup.ts'] },
});
