import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const preserveLegacyScript: Plugin = {
  name: 'preserve-legacy-script',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'js/app.js',
      source: readFileSync(new URL('./js/app.js', import.meta.url)),
    });
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), preserveLegacyScript],
  build: {
    rollupOptions: {
      input: ['index.html', 'react-app.html'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
