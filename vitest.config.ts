import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
  include: ['tests/**/*.{ts,tsx}'],
  exclude: ['node_modules/**','tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}', 'scan-manager.cjs'],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 75,
        statements: 80,
      }
    }
  }
});
