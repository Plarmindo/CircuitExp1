// Accessibility smoke test for Electron build
import { test, expect } from './fixtures';

// Skip entire file when running under non-electron projects
// This avoids running Electron-specific accessibility tests in plain web browsers.
// Playwright exposes the active project name via the test info parameter.
// We check for the substring "electron" to stay compatible with naming like "electron", "electron-dev" etc.
// Docs: https://playwright.dev/docs/api/class-test#test-skip
// Skip rule disabled - playwright/valid-test-skip doesn't exist
// @ts-expect-error – projectName is available via callback signature
// prettier-ignore
// deno-lint-ignore no-explicit-any
// Use inline condition to skip at runtime
// @ts-expect-error - PW_PROJECT_NAME may not be defined in all environments
// Skip when not running Electron project
if (!process.env.PW_PROJECT_NAME?.includes('electron')) {
  test.describe.configure({ mode: 'skip' });
}


test.describe('Accessibility – Electron parity', () => {
  test('axe-core passes on main window', async ({ electronApp: _electronApp, page }) => {
    page.on('console', (msg) => console.log('[page console]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('[page error]', err.message));

    // Inject axe-core from local node_modules to bypass CSP
    const axePath = require.resolve('axe-core/axe.min.js');
    await page.addScriptTag({ path: axePath });

    // Run axe scan
    const results = await page.evaluate(() => {
      return (window as any).axe.run();
    });

    // Expect no critical violations
    const critical = results.violations.filter((v: any) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  test('keyboard navigation: sidebar toggle via shortcut', async ({
    electronApp: _electronApp,
    page,
  }) => {
    page.on('console', (msg) => console.log('[page console]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('[page error]', err.message));

    // Focus canvas
    await page.click('canvas');

    // Press Ctrl+Shift+F to toggle favorites sidebar
    await page.keyboard.press('Control+Shift+F');

    // Expect sidebar to appear and be focusable
    const sidebar = page.locator('[role="complementary"]');
    await expect(sidebar).toBeVisible();
    await sidebar.focus();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
  });
});
