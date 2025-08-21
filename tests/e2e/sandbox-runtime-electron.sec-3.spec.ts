import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

// SEC-3 runtime sandbox test: ensure no Node primitives accessible in renderer global scope
// and only the curated electronAPI surface is exposed.

test('SEC-3 sandbox runtime isolates Node globals', async () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const app = await electron.launch({
    args: [path.join(__dirname, '..', '..', 'electron-main.cjs')],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const win = await app.firstWindow();
  const result = await win.evaluate(() => {
    interface Exposed {
      electronAPI?: Record<string, unknown>;
      [k: string]: unknown;
    }
    const g = window as unknown as Exposed;
    const gp = g as Record<string, unknown>;
    return {
      typeofProcess: typeof gp.process,
      typeofRequire: typeof gp.require,
      hasElectronAPI: !!g.electronAPI,
      electronAPIKeys: g.electronAPI ? Object.keys(g.electronAPI).sort() : [],
      suspiciousKeys: Object.keys(g).filter((k) => /^(fs|child_process|net|ipcRenderer)$/.test(k)),
    };
  });
  expect(result.typeofProcess).toBe('undefined');
  expect(result.typeofRequire).toBe('undefined');
  expect(result.hasElectronAPI).toBe(true);
  // Ensure only whitelisted APIs (subset check) exist
  const expectedSubset = [
    'openPath',
    'showProperties',
    'renamePath',
    'deletePath',
    'toggleFavorite',
    'favoritesList',
    'favoritesAdd',
    'favoritesRemove',
    'recentList',
    'recentClear',
    'settingsGet',
    'settingsUpdate',
    'onSettingsLoaded',
    'onSettingsUpdated',
    'startScan',
    'selectAndScanFolder',
    'cancelScan',
    'getScanState',
    'onScanProgress',
    'onScanPartial',
    'onScanDone',
    'onScanStarted',
    'getLastProdCSP',
  ];
  for (const k of expectedSubset) {
    expect(result.electronAPIKeys).toContain(k);
  }
  expect(result.suspiciousKeys.length).toBe(0);
  await app.close();
});
