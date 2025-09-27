import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join as _join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the debug-regression.json to see the actual values
const debugData = JSON.parse(readFileSync('debug-regression.json', 'utf8'));
console.log('Debug data:', debugData);

// Read the baselines.json to see the actual baseline
const baselines = JSON.parse(readFileSync('benchmarks/baselines.json', 'utf8'));
console.log('Baselines:', baselines);

// Calculate what the percentage change should be
const baselineDuration = debugData.baseline?.value || 0.0039;
const currentDuration = debugData.current?.value || 46.8;
const actualPercentage = ((currentDuration - baselineDuration) / baselineDuration) * 100;

console.log(`\nActual calculation:`);
console.log(`Baseline: ${baselineDuration}ms`);
console.log(`Current: ${currentDuration}ms`);
console.log(`Expected percentage change: ${actualPercentage}%`);
console.log(`Expected regression: ${actualPercentage > 2}`);

// Check if the comparison object matches
console.log(`\nComparison object:`);
console.log(`Reported percentage: ${debugData.comparison?.percentageChange}%`);
console.log(`Reported regression: ${debugData.comparison?.regression}`);
