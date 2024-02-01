import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['development', 'browser'],

    alias: {
      '@assets': resolve('src/assets'),
    },
  },

  define: { global: 'window' },
  base: './',
});
