import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

// https://vite.dev/config/
export default defineConfig({
  base: './', // necessário para Electron carregar assets via file:// sem paths absolutos
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    host: '0.0.0.0', // Allow Electron to connect
    fs: {
      allow: ['..'] // For Electron file access
    }
  },
  resolve: {
    symlinks: false // Fix Windows path issues
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020'
    }
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB for vendor chunks
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split large vendor libraries into separate chunks
            if (id.includes('pixi.js')) return 'vendor-pixi';
            if (id.includes(`${path.sep}d3`)) return 'vendor-d3';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('antd')) return 'vendor-antd';
            if (id.includes('@ant-design')) return 'vendor-antd';
            // Group smaller vendor libraries together
            return 'vendor-misc';
          }

          // Split application code by feature
          if (id.includes('src/visualization')) return 'app-visualization';
          if (id.includes('src/security')) return 'app-security';
          if (id.includes('src/plugins')) return 'app-plugins';
          if (id.includes('src/performance')) return 'app-performance';
        },
        // Optimize chunk naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
    },
  },
});
