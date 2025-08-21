import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

// SEC-1: Direct CSP header capture via process global exposed through preload helper.
// Confirms production CSP string matches hardened directives (no 'unsafe-inline').

test('SEC-1 production CSP captured matches hardened policy', async () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '..', '..', 'electron-main.cjs')],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const firstWindow = await electronApp.firstWindow();
  // Pull captured CSP via preload helper.
  const csp = await firstWindow.evaluate(() => {
    const w = window as unknown as { electronAPI?: { getLastProdCSP?: () => string | null } };
    if (w.electronAPI && typeof w.electronAPI.getLastProdCSP === 'function') {
      return w.electronAPI.getLastProdCSP();
    }
    return null;
  });
  expect(typeof csp).toBe('string');
  expect(csp).not.toContain("'unsafe-inline'");
  const required = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ];
  for (const dir of required) {
    expect(csp).toContain(dir);
  }
  await electronApp.close();
});
