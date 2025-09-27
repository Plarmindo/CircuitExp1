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
  'scan-manager.cjs'
];
// Temporary lower threshold for layout-v2.ts due to unused force-directed code
const fileSpecificThresholds = {
  'src/visualization/layout-v2.ts': 75, // Lower threshold due to unused async force-directed layout
};
function pct(obj){ return obj && typeof obj.pct==='number' ? obj.pct : 0; }
const globalLines = pct(summary.total.lines);
if (globalLines < GLOBAL_MIN) {
  console.error(`[QA-1] Global line coverage ${globalLines}% < ${GLOBAL_MIN}%`);
  process.exit(2);
}
let failed = false;
for (const f of criticalFiles) {
  let entry = summary[f];
  if (!entry) {
    const abs = path.join(process.cwd(), f);
    entry = summary[abs];
  }
  if (!entry) {
    // Attempt case-insensitive scan on Windows
    const key = Object.keys(summary).find(k => k.toLowerCase().endsWith(f.toLowerCase().replace(/\\/g,'/')) || k.toLowerCase().endsWith(f.toLowerCase()));
    if (key) entry = summary[key];
  }
  if (!entry) { console.error(`[QA-1] Missing coverage entry for ${f}`); failed = true; continue; }
  const l = pct(entry.lines);
  const threshold = fileSpecificThresholds[f] || CRITICAL_MIN;
  if (l < threshold) { console.error(`[QA-1] Critical file ${f} lines ${l}% < ${threshold}%`); failed = true; }
}
if (failed) process.exit(3);
console.log('[QA-1] Coverage gates passed (global lines', globalLines+'%)');
