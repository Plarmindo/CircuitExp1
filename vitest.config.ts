import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.{ts,tsx}'],
    exclude: ['node_modules/**', 'tests/e2e/**'],
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
