import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

// https://vite.dev/config/
export default defineConfig({
  base: './', // necessário para Electron carregar assets via file:// sem paths absolutos
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pixi.js')) return 'vendor-pixi';
            if (id.includes(`${path.sep}d3`)) return 'vendor-d3';
          }
        },
      },
    },
  },
});
