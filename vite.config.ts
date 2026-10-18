/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Relative base + hash routing: the same build works on cromiqa.com,
// on <user>.github.io/<repo>/ and from `vite preview`.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Staging preview (npm run staging): stable file names so each republish replaces the last.
  build:
    mode === 'staging'
      ? {
          outDir: 'dist-staging',
          emptyOutDir: true,
          rollupOptions: { output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' } },
        }
      : undefined,
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
}));
