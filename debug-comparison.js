import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the baselines file
const baselinePath = join(__dirname, 'benchmarks', 'baselines.json');
const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

// Read the debug file
const debugPath = join(__dirname, 'debug-regression.json');
const debugData = JSON.parse(fs.readFileSync(debugPath, 'utf8'));

console.log('=== DEBUG COMPARISON ===');
console.log('Baseline avg_duration:', debugData.baseline.value);
console.log('Current avg_duration:', debugData.current.value);

// Manual calculation
const baseline = debugData.baseline.value;
const current = debugData.current.value;
const percentageChange = ((current - baseline) / baseline) * 100;

console.log('Manual calculation:');
console.log(`(${current} - ${baseline}) / ${baseline} * 100 = ${percentageChange}%`);

console.log('Expected regression:', percentageChange > 2);
console.log('Expected percentage:', percentageChange.toFixed(2) + '%');

// Check if baseline exists for regression-test
console.log('\n=== BASELINE CHECK ===');
console.log('Available baselines:', Object.keys(baselineData));
console.log('regression-test baseline exists:', !!baselineData['regression-test']);

if (baselineData['regression-test']) {
  const baselineMetric = baselineData['regression-test'].results[0].metrics.find(m => m.name === 'avg_duration');
  console.log('regression-test baseline avg_duration:', baselineMetric.value);
}