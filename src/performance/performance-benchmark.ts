import { performance } from 'perf_hooks';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  context?: any;
}

export interface BenchmarkResult {
  testName: string;
  metrics: PerformanceMetric[];
  duration: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  baseline?: BenchmarkResult;
  regression?: boolean;
  regressionDetails?: string;
}

export interface PerformanceBaseline {
  version: string;
  timestamp: number;
  results: BenchmarkResult[];
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuCount: number;
    totalMemory: number;
  };
}

export interface RegressionConfig {
  threshold: number; // percentage threshold for regression detection
  criticalThreshold: number; // critical regression threshold
  ignoreFluctuation: boolean;
  warmupRuns: number;
  measurementRuns: number;
}

export class PerformanceBenchmark {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private results: BenchmarkResult[] = [];
  private config: RegressionConfig;
  private outputDir: string;

  constructor(config?: Partial<RegressionConfig>) {
    this.config = {
      threshold: 1, // 1% regression threshold for testing
      criticalThreshold: 5, // 5% critical regression for testing
      ignoreFluctuation: true,
      warmupRuns: 3,
      measurementRuns: 10,
      ...config,
    };

    this.outputDir = join(process.cwd(), 'benchmarks');
    mkdirSync(this.outputDir, { recursive: true });

    this.loadBaselines();
  }

  /**
   * Run a comprehensive performance benchmark
   */
  public async runBenchmark(
    testName: string,
    testFn: () => Promise<void> | void,
    options?: {
      baseline?: boolean;
      tags?: string[];
      context?: any;
    }
  ): Promise<BenchmarkResult> {
    console.log(`🚀 Running benchmark: ${testName}`);

    // Warmup runs
    for (let i = 0; i < this.config.warmupRuns; i++) {
      await testFn();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const metrics: PerformanceMetric[] = [];

    // Measurement runs
    const runDurations: number[] = [];
    for (let i = 0; i < this.config.measurementRuns; i++) {
      const runStart = performance.now();
      await testFn();
      const runEnd = performance.now();
      runDurations.push(runEnd - runStart);
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    // Calculate metrics
    const avgDuration = runDurations.reduce((a, b) => a + b, 0) / runDurations.length;
    const minDuration = Math.min(...runDurations);
    const maxDuration = Math.max(...runDurations);
    const stdDev = this.calculateStdDev(runDurations);

    metrics.push(
      { name: 'avg_duration', value: avgDuration, unit: 'ms', timestamp: Date.now(), context: options?.context },
      { name: 'min_duration', value: minDuration, unit: 'ms', timestamp: Date.now() },
      { name: 'max_duration', value: maxDuration, unit: 'ms', timestamp: Date.now() },
      { name: 'std_dev', value: stdDev, unit: 'ms', timestamp: Date.now() },
      { name: 'throughput', value: 1000 / avgDuration, unit: 'ops/sec', timestamp: Date.now() }
    );

    // Memory metrics
    metrics.push(
      { name: 'heap_used', value: endMemory.heapUsed / 1024 / 1024, unit: 'MB', timestamp: Date.now() },
      { name: 'heap_total', value: endMemory.heapTotal / 1024 / 1024, unit: 'MB', timestamp: Date.now() },
      { name: 'memory_leak', value: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024, unit: 'MB', timestamp: Date.now() }
    );

    const result: BenchmarkResult = {
      testName,
      metrics,
      duration: endTime - startTime,
      memoryUsage: endMemory,
    };

    // Check for regression if baseline exists
    if (!options?.baseline) {
      const baseline = this.getBaseline(testName);
      if (baseline) {
        const regression = this.checkRegression(baseline, result);
        result.regression = regression.regression;
        result.regressionDetails = regression.details;
      }
    }

    this.results.push(result);

    if (options?.baseline) {
      this.saveBaseline(testName, result);
    }

    console.log(`✅ Benchmark completed: ${testName} - ${avgDuration.toFixed(2)}ms avg`);

    return result;
  }

  /**
   * Run memory leak detection
   */
  public async detectMemoryLeak(
    testName: string,
    testFn: () => Promise<void> | void,
    iterations: number = 100
  ): Promise<{
    leakDetected: boolean;
    leakRate: number;
    memoryGrowth: number;
    details: PerformanceMetric[];
  }> {
    console.log(`🔍 Detecting memory leaks: ${testName}`);

    const metrics: PerformanceMetric[] = [];
    const memorySnapshots: number[] = [];

    // Initial garbage collection
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      await testFn();

      if (i % 10 === 0) {
        if (global.gc) {
          global.gc();
        }
        const currentMemory = process.memoryUsage().heapUsed;
        memorySnapshots.push(currentMemory);

        metrics.push({
          name: 'memory_snapshot',
          value: currentMemory / 1024 / 1024,
          unit: 'MB',
          timestamp: Date.now(),
          context: { iteration: i }
        });
      }
    }

    // Final garbage collection
    if (global.gc) {
      global.gc();
    }
    const finalMemory = process.memoryUsage().heapUsed;

    const memoryGrowth = finalMemory - initialMemory;
    const leakRate = memoryGrowth / iterations;
    const leakDetected = memoryGrowth > 5 * 1024 * 1024; // 5MB threshold

    console.log(`🧪 Memory leak detection: ${testName} - ${leakDetected ? 'LEAK DETECTED' : 'NO LEAK'}`);

    return {
      leakDetected,
      leakRate: leakRate / 1024 / 1024, // MB per iteration
      memoryGrowth: memoryGrowth / 1024 / 1024,
      details: metrics,
    };
  }

  /**
   * Run performance profiling
   */
  public async profilePerformance(
    testName: string,
    testFn: () => Promise<void> | void,
    duration: number = 5000
  ): Promise<{
    cpuProfile: any;
    heapProfile: any;
    eventLoopLag: number;
    asyncHooks: any[];
  }> {
    console.log(`📊 Profiling performance: ${testName}`);

    const { PerformanceObserver } = require('perf_hooks');
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        console.log(`${entry.name}: ${entry.duration}ms`);
      });
    });
    obs.observe({ entryTypes: ['measure', 'mark'] });

    // Event loop lag measurement
    const lagMeasurements: number[] = [];
    const measureLag = () => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000;
        lagMeasurements.push(lag);
      });
    };

    const lagInterval = setInterval(measureLag, 100);

    // Run test
    const startTime = Date.now();
    while (Date.now() - startTime < duration) {
      await testFn();
    }

    clearInterval(lagInterval);

    const avgLag = lagMeasurements.length > 0
      ? lagMeasurements.reduce((a, b) => a + b, 0) / lagMeasurements.length
      : 0;

    console.log(`✅ Performance profiling completed: ${testName}`);

    return {
      cpuProfile: {}, // Would integrate with actual profiler
      heapProfile: {}, // Would integrate with heap profiler
      eventLoopLag: avgLag,
      asyncHooks: [], // Would integrate with async_hooks
    };
  }

  /**
   * Compare performance against baseline
   */
  public compareWithBaseline(testName: string): {
    regression: boolean;
    improvement: boolean;
    percentageChange: number;
    details: string;
  } {
    // Find the most recent result for this test
    const results = this.results.filter(r => r.testName === testName);
    const current = results.length > 0 ? results[results.length - 1] : null;
    const baseline = this.getBaseline(testName);

    if (!current || !baseline) {
      return {
        regression: false,
        improvement: false,
        percentageChange: 0,
        details: 'No baseline or current result found',
      };
    }

    const currentMetric = current.metrics.find(m => m.name === 'avg_duration');
    const baselineMetric = baseline.metrics.find(m => m.name === 'avg_duration');

    if (!currentMetric || !baselineMetric) {
      return {
        regression: false,
        improvement: false,
        percentageChange: 0,
        details: 'Missing duration metrics',
      };
    }

    const percentageChange = ((currentMetric.value - baselineMetric.value) / baselineMetric.value) * 100;

    return {
      regression: percentageChange > this.config.threshold,
      improvement: percentageChange < -this.config.threshold,
      percentageChange: percentageChange,
      details: `${percentageChange.toFixed(2)}% change from baseline`,
    };
  }

  /**
   * Generate comprehensive performance report
   */
  public generateReport(): {
    summary: {
      totalTests: number;
      regressions: number;
      improvements: number;
      averageScore: number;
    };
    details: BenchmarkResult[];
    recommendations: string[];
    trends: any[];
  } {
    const regressions = this.results.filter(r => r.regression).length;
    const improvements = this.results.filter(r =>
      this.compareWithBaseline(r.testName).improvement
    ).length;

    const recommendations: string[] = [];

    if (regressions > 0) {
      recommendations.push(`${regressions} performance regressions detected - investigate immediately`);
    }

    const slowTests = this.results.filter(r => {
      const duration = r.metrics.find(m => m.name === 'avg_duration')?.value || 0;
      return duration > 1000; // Tests taking >1s
    });

    if (slowTests.length > 0) {
      recommendations.push(`${slowTests.length} slow tests identified - consider optimization`);
    }

    const memoryLeaks = this.results.filter(r => {
      const leak = r.metrics.find(m => m.name === 'memory_leak')?.value || 0;
      return leak > 1; // >1MB memory growth
    });

    if (memoryLeaks.length > 0) {
      recommendations.push(`${memoryLeaks.length} tests show memory growth - check for leaks`);
    }

    return {
      summary: {
        totalTests: this.results.length,
        regressions,
        improvements,
        averageScore: 100 - (regressions * 10), // Simple scoring
      },
      details: this.results,
      recommendations,
      trends: this.calculateTrends(),
    };
  }

  /**
   * Save benchmark results to file
   */
  public saveResults(filename?: string): string {
    const report = this.generateReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = join(
      this.outputDir,
      filename || `benchmark-results-${timestamp}.json`
    );

    writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`📄 Benchmark results saved: ${filepath}`);

    return filepath;
  }

  /**
   * Load baseline from file
   */
  private loadBaselines(): void {
    try {
      const baselinePath = join(this.outputDir, 'baselines.json');
      const data = readFileSync(baselinePath, 'utf-8');
      const baselines = JSON.parse(data);

      for (const [key, baseline] of Object.entries(baselines)) {
        this.baselines.set(key, baseline as PerformanceBaseline);
      }
    } catch {
      // No baselines file exists yet
    }
  }

  /**
   * Save baseline to file
   */
  private saveBaseline(testName: string, result: BenchmarkResult): void {
    const baseline: PerformanceBaseline = {
      version: require('../../package.json').version,
      timestamp: Date.now(),
      results: [result],
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuCount: require('os').cpus().length,
        totalMemory: require('os').totalmem(),
      },
    };

    this.baselines.set(testName, baseline);

    const baselines: Record<string, PerformanceBaseline> = {};
    for (const [key, value] of this.baselines) {
      baselines[key] = value;
    }

    writeFileSync(
      join(this.outputDir, 'baselines.json'),
      JSON.stringify(baselines, null, 2)
    );
  }

  /**
   * Get baseline for a test
   */
  private getBaseline(testName: string): BenchmarkResult | undefined {
    const baseline = this.baselines.get(testName);
    return baseline?.results[0];
  }

  /**
   * Check for regression
   */
  private checkRegression(baseline: BenchmarkResult, current: BenchmarkResult): {
    regression: boolean;
    critical: boolean;
    details: string;
  } {
    const baselineMetric = baseline.metrics.find(m => m.name === 'avg_duration');
    const currentMetric = current.metrics.find(m => m.name === 'avg_duration');

    if (!baselineMetric || !currentMetric) {
      return {
        regression: false,
        critical: false,
        details: 'Missing baseline or current metrics',
      };
    }

    const percentageChange = ((currentMetric.value - baselineMetric.value) / baselineMetric.value) * 100;

    return {
      regression: percentageChange > this.config.threshold,
      critical: percentageChange > this.config.criticalThreshold,
      details: percentageChange > this.config.criticalThreshold
        ? `CRITICAL: ${percentageChange.toFixed(2)}% regression detected`
        : percentageChange > this.config.threshold
        ? `REGRESSION: ${percentageChange.toFixed(2)}% regression detected`
        : `OK: ${percentageChange.toFixed(2)}% change within threshold`,
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Profile performance characteristics including event loop lag
   */
  public async profilePerformanceIterative(
    testName: string,
    testFn: () => Promise<void> | void,
    iterations: number = 100
  ): Promise<{
    eventLoopLag: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    stdDev: number;
    throughput: number;
  }> {
    console.log(`📊 Profiling performance: ${testName}`);

    const durations: number[] = [];
    const lagMeasurements: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      // Measure event loop lag
      const lag = await this.measureEventLoopLag();
      lagMeasurements.push(lag);

      await testFn();

      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const stdDev = this.calculateStdDev(durations);
    const throughput = 1000 / avgDuration;
    const eventLoopLag = lagMeasurements.reduce((a, b) => a + b, 0) / lagMeasurements.length;

    return {
      eventLoopLag: Math.max(0, eventLoopLag),
      avgDuration,
      minDuration,
      maxDuration,
      stdDev,
      throughput,
    };
  }

  /**
   * Measure event loop lag
   */
  private async measureEventLoopLag(): Promise<number> {
    const start = performance.now();
    return new Promise<number>((resolve) => {
      setImmediate(() => {
        resolve(performance.now() - start);
      });
    });
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): any[] {
    // This would implement trend analysis over time
    // For now, return basic trend data
    return this.results.map(result => ({
      testName: result.testName,
      avgDuration: result.metrics.find(m => m.name === 'avg_duration')?.value || 0,
      memoryUsage: result.memoryUsage.heapUsed / 1024 / 1024,
      timestamp: Date.now(),
    }));
  }
}

// Export singleton instance
export const performanceBenchmark = new PerformanceBenchmark();
