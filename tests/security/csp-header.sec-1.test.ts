import { expect, test } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CSPManager } from '../../src/security/csp-manager';

// SEC-1 static test: ensures production CSP string hardened (no 'unsafe-inline') and required directives present.
// This tests both the CSP manager implementation and the main process integration.

test('SEC-1 production CSP hardened (no unsafe-inline, directives present)', () => {
  // Test 1: Verify CSP Manager produces hardened production CSP
  const cspManager = new CSPManager();
  const prodCSP = cspManager.getProductionCSP();

  // Ensure no unsafe-inline in production CSP
  expect(prodCSP.includes('unsafe-inline')).toBe(false);

  // Verify required security directives are present
  const requiredDirectives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ];

  for (const directive of requiredDirectives) {
    expect(prodCSP).toContain(directive);
  }

  // Test 2: Verify main process uses CSP manager
  const mainPath = path.join(__dirname, '..', '..', 'electron-main.cjs');
  const src = fs.readFileSync(mainPath, 'utf8');

  // Verify CSP manager is imported and used
  expect(src).toContain('csp-manager');
  expect(src).toContain('cspManager.getSecurityHeaders');

  // Verify old hardcoded CSP array is removed
  expect(src.includes('const csp = [')).toBe(false);
});
