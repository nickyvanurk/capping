import { resolve } from 'path';
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  resolve: {
    conditions: ['development', 'browser'],

    alias: {
      '@assets': resolve('src/assets'),
      '@viewer': resolve('src/viewer'),
    },
  },

  define: { global: 'window' },
  plugins: [glsl()],
  base: './',

  build: {
    target: 'esnext',
  },
});
