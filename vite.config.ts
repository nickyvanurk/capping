import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['development', 'browser'],

    alias: {
      '@assets': resolve('src/assets'),
      '@viewer': resolve('src/viewer'),
    },
  },

  define: { global: 'window' },
  base: './',

  build: {
    target: 'esnext',
  },
});
