import { expect, test } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// SEC-1 static test: ensures production CSP string hardened (no 'unsafe-inline') and required directives present.
// This does not execute Electron runtime; it scans the main process source.

test('SEC-1 production CSP hardened (no unsafe-inline, directives present)', () => {
  const mainPath = path.join(__dirname, '..', '..', 'electron-main.cjs');
  const src = fs.readFileSync(mainPath, 'utf8');
  // Extract the CSP assembly block (array join) then flatten into single line for assertions.
  const lines = src.split(/\n/);
  const idx = lines.findIndex((l) => l.includes("Content-Security-Policy': [csp]"));
  expect(idx).toBeGreaterThan(-1);
  // Reconstruct csp variable assignment region
  const cspAssignIdx = lines.findIndex((l) => l.includes('const csp = ['));
  expect(cspAssignIdx).toBeGreaterThan(-1);
  const region = lines.slice(cspAssignIdx, cspAssignIdx + 30).join(' ');
  const flattened = region.replace(/\s+/g, ' ');
  expect(flattened.includes('unsafe-inline')).toBe(false);
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ];
  for (const d of directives) {
    expect(flattened).toContain(d);
  }
});
