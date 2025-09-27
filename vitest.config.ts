import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Only collect actual test files
    include: ['tests/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.tsx'],
    // Exclude e2e, setup, and empty placeholder tests
    exclude: ['node_modules/**', 'tests/e2e/**', 'tests/setup.ts', 'tests/ollama-integration.test.ts'],
    // Add timeouts and isolation
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    isolate: true,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      // Narrowed to core algorithmic & critical modules for QA-1 (UI/stage rendering excluded pending QA-3 expansion)
      include: [
        'scan-manager.cjs',
        'src/visualization/graph-adapter.ts',
        'src/visualization/layout-v1.ts',
        'src/visualization/layout-v2.ts',
        'src/visualization/incremental-layout.ts',
        'src/visualization/line-routing.ts',
        'src/visualization/navigation-helpers.ts',
        'src/visualization/selection-helpers.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 75,
        statements: 80,
      },
    },
  },
});
