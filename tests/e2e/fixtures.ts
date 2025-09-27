import {
  test as base,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import { captureMapSnapshot, analyseSnapshotFile } from './utils/mapSnapshot';

// Electron test fixtures: launch the real Electron app so preload APIs are available.
// This ensures window.electronAPI is defined, enabling CORE feature E2E coverage.
// Assumes dev server started via webServer in playwright.config.ts.

type Fixtures = { electronApp: ElectronApplication; page: Page };

export const test = base.extend<Fixtures>({
  // Playwright expects destructuring; pass unused config object
  electronApp: async ({}, use) => {
    const electronMain = path.join(process.cwd(), 'electron-main.cjs');
    const app = await electron.launch({
      args: [electronMain],
      env: { ...process.env, VITE_DEV_PORT: '5175', CI: process.env.CI || '1' },
    });
    try {
      await use(app);
    } finally {
      await app.close();
    }
  },
  page: async ({ electronApp }, use) => {
    const first = await electronApp.firstWindow();

    // Wait for Electron to load the dev URL; avoid racing on about:blank
    try {
      await first.waitForLoadState('domcontentloaded', { timeout: 15000 });
    } catch (error) {
      // Ignore load state timeout errors
      console.warn('Failed to wait for DOM content loaded:', error);
    }

    // Try to wait until Electron navigates to the dev server URL by itself
    const urlPattern = /http:\/\/localhost:\d+\/.*/;
    let currentUrl = first.url();
    try {
      await first.waitForURL(urlPattern, { timeout: 10000 });
      currentUrl = first.url();
    } catch {
      // Fallback: explicitly navigate to the expected dev server URL
      const port = process.env.VITE_DEV_PORT || '5175';
      currentUrl = `http://localhost:${port}/`;
      await first.goto(currentUrl, { waitUntil: 'domcontentloaded' });
    }

    // Ensure we have the #forceStage hash to render Full App view (Stage mounted, StrictMode disabled)
    try {
      const u = new URL(currentUrl);
      if (!u.hash.includes('forceStage')) u.hash = '#forceStage';
      // Preserve any existing search params (e.g., mode) while enforcing the hash
      await first.goto(u.toString(), { waitUntil: 'domcontentloaded' });
    } catch {
      // As a last resort, force the hash on the client side
      await first.evaluate(() => {
        const url = new URL(window.location.href);
        if (!url.hash.includes('forceStage')) url.hash = '#forceStage';
        window.location.replace(url.toString());
      });
    }

    // Do not require __metroDebug here; allow tests to set mode & then wait as needed
    await use(first);
  },
});

export { expect };

// Automatically capture and analyse a snapshot at the end of every test that uses a Page fixture.
base.afterEach(async ({ page }, testInfo) => {
  if (!page) return; // e.g. API-only tests
  try {
    const { jsonPath } = await captureMapSnapshot(page, `${testInfo.title}-final`);
    const issues = await analyseSnapshotFile(jsonPath);
    if (issues.length) {
      // Attach issues to the report for easier debugging
      await testInfo.attach('map-snapshot-issues', {
        body: JSON.stringify(issues, null, 2),
        contentType: 'application/json',
      });
      // Advisory only: do not fail the test flow due to snapshot anomalies.
    }
  } catch (err) {
    // Do not fail unrelated tests because the page might have closed early etc.
    await testInfo.attach('snapshot-error', {
      body: String(err),
      contentType: 'text/plain',
    });
  }
});
