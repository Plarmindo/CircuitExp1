// Playwright test file – error handling & recovery flows
import { test, expect } from './fixtures';

test.describe('Error handling & recovery', () => {
  test('permission-denied scan shows banner and allows retry', async ({ page }) => {
    page.on('console', (msg) => console.log('[page console]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('[page error]', err.message));

    // Inject mock IPC handler that rejects with permission error
    await page.addInitScript(() => {
      (window as any).__mockScan = async () => {
        throw new Error('EACCES: permission denied');
      };
    });

    // Trigger scan with mocked path
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('metro:scanPath', { detail: '/protected' }));
    });

    // Expect error banner to appear
    const banner = page.locator('[role="alert"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('permission denied');

    // Click retry button inside banner
    const retryBtn = banner.locator('button', { hasText: /retry/i });
    await retryBtn.click();

    // Switch mock to success
    await page.addInitScript(() => {
      (window as any).__mockScan = async () => {
        // Minimal synthetic tree
        return [{ name: 'ok', type: 'folder', size: 0, children: [] }];
      };
    });

    // Retry should clear banner and load tree
    await expect(banner).not.toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('large dataset stress: 100k nodes stay within 16 ms frame budget', async ({ page }) => {
    page.on('console', (msg) => console.log('[page console]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('[page error]', err.message));

    // Wait for debug helpers
    await page.waitForFunction(() => (window as any).__metroDebug?.genTree, { timeout: 10000 });

    // Generate 100k nodes (100 × 1000 × 1)
    await page.evaluate(() => {
      (window as any).__metroDebug.genTree(100, 1000, 1);
    });

    // Wait for render
    await page.waitForFunction(() => (window as any).__metroDebug.getNodes?.().length >= 100000, {
      timeout: 30000,
    });

    // Measure FPS via debug metric
    const frameTime = await page.evaluate(() => (window as any).__metroDebug.getFrameTime?.());
    expect(frameTime).toBeLessThanOrEqual(16);
  });
});
