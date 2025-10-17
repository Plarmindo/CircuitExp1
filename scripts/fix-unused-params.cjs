#!/usr/bin/env node
/**
 * Automated script to fix unused function parameters
 * Prefixes unused parameters with underscore to indicate intentional non-use
 * 
 * Usage: node scripts/fix-unused-params.cjs
 */

const fs = require('fs');
const path = require('path');

// Patterns to fix: unused function parameters
const fixes = [
  // Stub/placeholder functions with unused context parameters
  { pattern: /const drawGrid = \(ctx: CanvasRenderingContext2D\) => \{/g, replacement: 'const drawGrid = (_ctx: CanvasRenderingContext2D) => {' },
  { pattern: /const drawLine = \(ctx: CanvasRenderingContext2D, line: any\) => \{/g, replacement: 'const drawLine = (_ctx: CanvasRenderingContext2D, _line: any) => {' },
  { pattern: /const drawStation = \(ctx: CanvasRenderingContext2D, station: any\) => \{/g, replacement: 'const drawStation = (_ctx: CanvasRenderingContext2D, _station: any) => {' },
  { pattern: /const drawLabels = \(ctx: CanvasRenderingContext2D, data: any\) => \{/g, replacement: 'const drawLabels = (_ctx: CanvasRenderingContext2D, _data: any) => {' },
  { pattern: /const detectStationAtPoint = \(x: number, y: number\) => \{/g, replacement: 'const detectStationAtPoint = (_x: number, _y: number) => {' },
  { pattern: /const detectLineAtPoint = \(x: number, y: number\) => \{/g, replacement: 'const detectLineAtPoint = (_x: number, _y: number) => {' },
];

const filesToFix = [
  'src/components/CanvasMetroMap.tsx',
];

let totalFixed = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let fileFixed = 0;

  fixes.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      fileFixed += matches.length;
    }
  });

  if (fileFixed > 0) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${fileFixed} unused parameters in ${filePath}`);
    totalFixed += fileFixed;
  } else {
    console.log(`✓  No changes needed in ${filePath}`);
  }
});

console.log(`\n🎉 Total: Fixed ${totalFixed} unused parameters across ${filesToFix.length} file(s)`);
console.log('\n💡 Run "npm run lint" to verify the fixes');
