#!/usr/bin/env node
// QA-1 coverage gate: enforce global and critical module coverage thresholds.
const fs = require('fs');
const path = require('path');
const summaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
if (!fs.existsSync(summaryPath)) {
  console.error('[QA-1] coverage-summary.json not found. Run tests with coverage first.');
  process.exit(1);
}
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const GLOBAL_MIN = 80; // lines
const CRITICAL_MIN = 85; // lines
const criticalFiles = [
  'src/visualization/graph-adapter.ts',
  'src/visualization/layout-v2.ts',
  'scan-manager.cjs',
];
function pct(obj) {
  return obj && typeof obj.pct === 'number' ? obj.pct : 0;
}
const globalLines = pct(summary.total.lines);
if (globalLines < GLOBAL_MIN) {
  console.error(`[QA-1] Global line coverage ${globalLines}% < ${GLOBAL_MIN}%`);
  process.exit(2);
}
let failed = false;
for (const f of criticalFiles) {
  const entry = summary[f];
  if (!entry) {
    console.error(`[QA-1] Missing coverage entry for ${f}`);
    failed = true;
    continue;
  }
  const l = pct(entry.lines);
  if (l < CRITICAL_MIN) {
    console.error(`[QA-1] Critical file ${f} lines ${l}% < ${CRITICAL_MIN}%`);
    failed = true;
  }
}
if (failed) process.exit(3);
console.log('[QA-1] Coverage gates passed (global lines', globalLines + '%)');
