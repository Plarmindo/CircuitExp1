#!/usr/bin/env node

const fs = require('fs');

// More TypeScript any type fixes
const moreAnyFixes = {
  'src/security/security-middleware.ts': [
    { from: 'httpSecurity = (req: any, res: any, next: any) => {', to: 'httpSecurity = (req: unknown, res: unknown, next: () => void) => {' },
    { from: 'validateInput = (data: any, type: string) => {', to: 'validateInput = (data: unknown, type: string) => {' },
    { from: 'validateFileUpload = (file: any) => {', to: 'validateFileUpload = (file: Record<string, unknown>) => {' },
    { from: 'validateCSRF = (req: any, res: any, next: any) => {', to: 'validateCSRF = (req: unknown, res: unknown, next: () => void) => {' },
    { from: 'wsSecurity = (ws: any, req: any) => {', to: 'wsSecurity = (ws: unknown, req: unknown) => {' },
    { from: 'getThreatTypeCounts = (events: any[]) => {', to: 'getThreatTypeCounts = (events: Record<string, unknown>[]) => {' },
    { from: 'generateRecommendations = (events: any[]) => {', to: 'generateRecommendations = (events: Record<string, unknown>[]) => {' },
  ],

  'src/visualization/stage/benchmarks.ts': [
    { from: 'benchResult?: any;', to: 'benchResult?: Record<string, unknown>;' },
    { from: 'lastPartitionBench?: any;', to: 'lastPartitionBench?: Record<string, unknown>;' },
    { from: 'startQuickBench?: (p?: QuickRealParams) => any;', to: 'startQuickBench?: (p?: QuickRealParams) => unknown;' },
    { from: 'startRealBench?: (p?: QuickRealParams) => any;', to: 'startRealBench?: (p?: QuickRealParams) => unknown;' },
  ],

  'src/visualization/stage/index.ts': [
    { from: 'const globalAny = window as unknown as { __metroDebug?: any };', to: 'const globalAny = window as unknown as { __metroDebug?: Record<string, unknown> };' },
  ],

  'src/visualization/performance/force-directed-layout.ts': [
    { from: ': { nodes: Array<{ path: string; x: number; y: number; depth: number }>; bbox: any }', to: ': { nodes: Array<{ path: string; x: number; y: number; depth: number }>; bbox: { minX: number; maxX: number; minY: number; maxY: number } }' },
  ],

  'src/components/MetroUI.tsx': [
    { from: ': any', to: ': unknown' }, // Generic replacement for remaining any types
  ],

  'src/components/MetroLineDemo.tsx': [
    { from: ': any', to: ': unknown' }, // Generic replacement
  ],

  'src/components/CanvasMetroMap.tsx': [
    { from: ': any', to: ': unknown' }, // Generic replacement
  ],

  'src/components/ErrorHandler.tsx': [
    { from: ': any', to: ': unknown' }, // Generic replacement
  ],

  'src/components/MiniMap.tsx': [
    { from: ': any', to: ': unknown' }, // Generic replacement
  ],

  'src/components/ResponsiveMetroStage.tsx': [
    { from: ': any', to: ': unknown' }, // Generic replacement
  ],
};

function fixMoreAnyTypes(filePath, fixes) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const fix of fixes) {
    if (content.includes(fix.from)) {
      content = content.replace(new RegExp(fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fix.to);
      changed = true;
      console.log(`Fixed any type in ${filePath}: ${fix.from} -> ${fix.to}`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }

  return changed;
}

// Process more any type fixes
let totalFixed = 0;
for (const [filePath, fixes] of Object.entries(moreAnyFixes)) {
  if (fixMoreAnyTypes(filePath, fixes)) {
    totalFixed++;
  }
}

console.log(`\nCompleted: Updated ${totalFixed} files with more any type fixes`);
