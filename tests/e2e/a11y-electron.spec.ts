// Accessibility smoke test for Electron build
import { test, expect } from './fixtures';

test.describe('Accessibility – Electron parity', () => {
  test('axe-core passes on main window', async ({ electronApp: _electronApp, page }) => {
    page.on('console', (msg) => console.log('[page console]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('[page error]', err.message));

    // Inject axe-core
    await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/axe-core@4.10.0/axe.min.js' });

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
    await expect(sidebar).not.toBeVisible();
  });
});
