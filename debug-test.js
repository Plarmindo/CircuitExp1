import { PerformanceBenchmark } from './dist/performance/performance-benchmark.js';
import _fs from 'fs';

const benchmark = new PerformanceBenchmark({
  iterations: 10,
  threshold: 2,
  criticalThreshold: 10,
  outputDir: './benchmarks'
});

async function debugComparison() {
  console.log('=== DEBUGGING COMPARISON METHOD ===');

  // Create baseline
  console.log('1. Creating baseline...');
  const baselineResult = await benchmark.runBenchmark('debug-test', () => {
    let x = 0;
    for (let i = 0; i < 10; i++) x += i;
    return x;
  }, { baseline: true });

  console.log('Baseline result:', {
    testName: baselineResult.testName,
    avg_duration: baselineResult.metrics.find(m => m.name === 'avg_duration').value
  });

  // Run slow version
  console.log('2. Running slow version...');
  const currentResult = await benchmark.runBenchmark('debug-test', () => {
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    return sum;
  });

  console.log('Current result:', {
    testName: currentResult.testName,
    avg_duration: currentResult.metrics.find(m => m.name === 'avg_duration').value
  });

  // Check what's in results
  console.log('3. Results in benchmark:', benchmark.results.map(r => ({
    testName: r.testName,
    avg_duration: r.metrics.find(m => m.name === 'avg_duration').value
  })));

  // Compare
  console.log('4. Comparing...');
  const comparison = benchmark.compareWithBaseline('debug-test');
  console.log('Comparison result:', comparison);

  // Manual calculation
  const baselineMetric = baselineResult.metrics.find(m => m.name === 'avg_duration');
  const currentMetric = currentResult.metrics.find(m => m.name === 'avg_duration');
  const manualChange = ((currentMetric.value - baselineMetric.value) / baselineMetric.value) * 100;

  console.log('5. Manual calculation:');
  console.log(`(${currentMetric.value} - ${baselineMetric.value}) / ${baselineMetric.value} * 100 = ${manualChange}%`);
}

debugComparison().catch(console.error);
