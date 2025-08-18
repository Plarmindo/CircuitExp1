import { test as base, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

// Electron test fixtures: launch the real Electron app so preload APIs are available.
// This ensures window.electronAPI is defined, enabling CORE feature E2E coverage.
// Assumes dev server started via webServer in playwright.config.ts.

type Fixtures = { electronApp: ElectronApplication; page: Page };

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
export const test = base.extend<Fixtures>({
  // Playwright expects destructuring; pass unused config object
  electronApp: async ({}, use) => {
    const electronMain = path.join(process.cwd(), 'electron-main.cjs');
    const app = await electron.launch({
      args: [electronMain],
      env: { ...process.env, VITE_DEV_PORT: '5175', CI: process.env.CI || '1' },
    });
    try { await use(app); } finally { await app.close(); }
  },
  page: async ({ electronApp }, use) => {
    const first = await electronApp.firstWindow();
    const url = first.url();
    if (!url.includes('#forceStage')) {
      await first.goto(url + (url.includes('#') ? '' : '#forceStage'));
    }
  await first.waitForFunction(() => !!(window as any).__metroDebug, { timeout: 15000 });
    await use(first);
  }
});

export { expect };
