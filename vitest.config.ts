import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
  include: ['tests/**/*.{ts,tsx}'],
  exclude: ['node_modules/**','tests/e2e/**'],
    coverage: {
      provider: 'v8', // built-in instrumentation
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/visualization/graph-adapter.ts','src/visualization/layout-v2.ts'],
      lines: 85,
      branches: 80,
      functions: 80,
      statements: 85,
    }
  }
});
