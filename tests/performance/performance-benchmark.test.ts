import { PerformanceBenchmark } from '../../src/performance/performance-benchmark';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('PerformanceBenchmark', () => {
  let benchmark: PerformanceBenchmark;
  const testDir = join(process.cwd(), 'benchmarks');

  beforeEach(() => {
    benchmark = new PerformanceBenchmark({
      threshold: 2, // Lower threshold for testing
      criticalThreshold: 5,
      warmupRuns: 1,
      measurementRuns: 3,
    });
  });

  afterEach(() => {
    // Clean up test files
    const fs = require('fs');
    if (existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach((file: string) => {
        if (file.startsWith('benchmark-results-') || file.includes('test-')) {
          fs.unlinkSync(join(testDir, file));
        }
      });
    }
  });

  describe('Basic Performance Testing', () => {
    it('should run simple performance benchmark', async () => {
      const testFn = () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
      };

      const result = await benchmark.runBenchmark('simple-calculation', testFn);

      expect(result.testName).toBe('simple-calculation');
      expect(result.metrics).toHaveLength(8); // avg_duration, min_duration, max_duration, std_dev, throughput, heap_used, heap_total, memory_leak
      expect(result.duration).toBeGreaterThan(0);
      expect(result.memoryUsage.heapUsed).toBeGreaterThan(0);
    });

    it('should measure async operations', async () => {
      const testFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const result = await benchmark.runBenchmark('async-operation', testFn);

      expect(result.testName).toBe('async-operation');
      expect(result.metrics.find(m => m.name === 'avg_duration')?.value).toBeGreaterThan(10);
    });

    it('should handle complex calculations', async () => {
      const testFn = () => {
        const data = Array.from({ length: 10000 }, (_, i) => i);
        return data
          .map(x => x * 2)
          .filter(x => x % 3 === 0)
          .reduce((sum, x) => sum + x, 0);
      };

      const result = await benchmark.runBenchmark('complex-calculation', testFn);

      expect(result.testName).toBe('complex-calculation');
      expect(result.metrics.find(m => m.name === 'throughput')?.value).toBeGreaterThan(0);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect memory leaks', async () => {
      let data: number[] = [];
      const leakyFn = () => {
        // Create a more aggressive memory leak
        data.push(...Array.from({ length: 10000 }, (_, i) => i));
        // Keep reference to prevent garbage collection
        global.leakyData = data;
      };

      const result = await benchmark.detectMemoryLeak('memory-leak-test', leakyFn, 50);

      expect(result.leakDetected).toBe(true);
      expect(result.memoryGrowth).toBeGreaterThan(0);
      expect(result.details).toHaveLength(5); // 50 iterations, snapshot every 10
    });

    it('should not detect false positives for stable memory', async () => {
      const stableFn = () => {
        const data = Array.from({ length: 100 }, (_, i) => i);
        return data.reduce((sum, x) => sum + x, 0);
      };

      const result = await benchmark.detectMemoryLeak('stable-memory-test', stableFn, 50);

      expect(result.leakDetected).toBe(false);
      expect(result.memoryGrowth).toBeLessThan(1); // Less than 1MB growth
    });
  });

  describe('Baseline Management', () => {
    it('should save and load baselines', async () => {
      const testFn = () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
      };

      // Create baseline
      await benchmark.runBenchmark('baseline-test', testFn, { baseline: true });

      // Run again to compare
      const result = await benchmark.runBenchmark('baseline-test', testFn);

      const comparison = benchmark.compareWithBaseline('baseline-test');
      expect(comparison).toBeDefined();
    });

    it('should detect performance regression', async () => {
      // Create baseline with very fast version
      const baselineResult = await benchmark.runBenchmark('regression-test', () => {
        // Ultra-fast baseline - minimal work
        let x = 0;
        for (let i = 0; i < 10; i++) x += i;
        return x;
      }, { baseline: true });

      // Run significantly slower version
      const slowFn = () => {
        // Create a much more intensive workload
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
        }
        return sum;
      };

      const result = await benchmark.runBenchmark('regression-test', slowFn);
      const comparison = benchmark.compareWithBaseline('regression-test');

      // Debug: log the actual values to file
      const fs = require('fs');
      const debugInfo = {
        baseline: baselineResult.metrics.find(m => m.name === 'avg_duration'),
        current: result.metrics.find(m => m.name === 'avg_duration'),
        comparison,
        threshold: (benchmark as any).config.threshold
      };
      fs.writeFileSync('debug-regression.json', JSON.stringify(debugInfo, null, 2));

      expect(comparison.regression).toBe(true);
      expect(comparison.percentageChange).toBeGreaterThan(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive report', async () => {
      const testFn = () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
      };

      await benchmark.runBenchmark('report-test-1', testFn);
      await benchmark.runBenchmark('report-test-2', testFn);

      const report = benchmark.generateReport();

      expect(report.summary.totalTests).toBe(2);
      expect(report.details).toHaveLength(2);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.trends).toBeInstanceOf(Array);
    });

    it('should save results to file', async () => {
      const testFn = () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
      };

      await benchmark.runBenchmark('file-save-test', testFn);

      const filepath = benchmark.saveResults('test-results.json');
      expect(existsSync(filepath)).toBe(true);

      const savedData = JSON.parse(readFileSync(filepath, 'utf-8'));
      expect(savedData.summary).toBeDefined();
      expect(savedData.details).toHaveLength(1);
    });
  });

  describe('Performance Profiling', () => {
    it('should profile performance characteristics', async () => {
      const testFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        const data = Array.from({ length: 1000 }, (_, i) => i * 2);
        return data.reduce((sum, x) => sum + x, 0);
      };

      const profile = await benchmark.profilePerformance('profiling-test', testFn, 100);

      expect(profile).toBeDefined();
      expect(typeof profile.eventLoopLag).toBe('number');
      expect(profile.eventLoopLag).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty test function', async () => {
      const testFn = () => {};

      const result = await benchmark.runBenchmark('empty-test', testFn);
      expect(result.testName).toBe('empty-test');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle async errors gracefully', async () => {
      const testFn = async () => {
        await new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Test error')), 1)
        );
      };

      await expect(benchmark.runBenchmark('error-test', testFn))
        .rejects.toThrow();
    });

    it('should handle very fast operations', async () => {
      const testFn = () => {
        return 1 + 1;
      };

      const result = await benchmark.runBenchmark('fast-operation', testFn);
      expect(result.metrics.find(m => m.name === 'avg_duration')?.value).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Regression Detection', () => {
    it('should detect critical regressions', async () => {
      const fastFn = () => {
        for (let i = 0; i < 100; i++) {
          // Intentionally empty for performance test
        }
      };

      const slowFn = () => {
        for (let i = 0; i < 10000; i++) {
          // Intentionally empty for performance test
        }
      };

      // Create baseline
      await benchmark.runBenchmark('critical-regression-test', fastFn, { baseline: true });

      // Run slow version
      const result = await benchmark.runBenchmark('critical-regression-test', slowFn);

      expect(result.regression).toBe(true);
      expect(result.regressionDetails).toContain('CRITICAL');
    });
  });
});
