import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/plugins/tests/setup.ts'],
    include: ['src/plugins/**/*.test.ts', 'src/plugins/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'build'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/plugins/development/scaffolding.js',
        'src/plugins/deployment/deploy.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@plugins': resolve(__dirname, './src/plugins'),
      '@core': resolve(__dirname, './src/plugins/core'),
      '@test-utils': resolve(__dirname, './src/plugins/tests/utils')
    }
  }
});