/**
 * Quality Gates Configuration
 * Defines minimum quality thresholds for production readiness
 */

module.exports = {
  // Code coverage thresholds
  coverage: {
    global: {
      lines: 80,
      branches: 70,
      functions: 75,
      statements: 80,
    },
    // Per-file thresholds for critical modules
    perFile: {
      'src/visualization/graph-adapter.ts': {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
      'src/security/security-hardening.ts': {
        lines: 95,
        branches: 90,
        functions: 95,
        statements: 95,
      },
      'src/services/health-service.ts': {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
      },
    },
  },

  // Lint violation limits
  lint: {
    maxErrors: 0,
    maxWarnings: 50,
    // Critical rules that must have zero violations
    criticalRules: [
      '@typescript-eslint/no-explicit-any',
      'no-unused-vars',
      '@typescript-eslint/no-unused-vars',
      'no-console',
      'no-debugger',
    ],
  },

  // TypeScript configuration requirements
  typescript: {
    strict: true,
    noImplicitAny: true,
    noImplicitReturns: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
  },

  // Security requirements
  security: {
    maxVulnerabilities: {
      critical: 0,
      high: 0,
      moderate: 2,
      low: 10,
    },
    requiredSecurityHeaders: [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
    ],
  },

  // Performance thresholds
  performance: {
    bundleSize: {
      maxSize: '5MB',
      maxChunks: 10,
    },
    memoryLeaks: {
      maxGrowthRate: 1, // 1% per hour
      maxTotalGrowth: 50, // 50MB total
    },
    renderingPerformance: {
      minFPS: 30,
      maxFrameTime: 33, // milliseconds
    },
  },

  // Test requirements
  testing: {
    minUnitTests: 100,
    minE2ETests: 10,
    minSecurityTests: 20,
    maxTestDuration: 300, // 5 minutes
  },

  // Build requirements
  build: {
    maxBuildTime: 180, // 3 minutes
    requiredArtifacts: [
      'dist/index.html',
      'dist/assets/',
    ],
    maxArtifactSize: '100MB',
  },
};
