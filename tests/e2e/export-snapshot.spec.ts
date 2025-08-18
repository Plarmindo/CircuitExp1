import { test, expect } from './fixtures';
// eslint-disable @typescript-eslint/no-explicit-any

// VIS-15 Export Snapshot (PNG) validation test
// Validates: non-empty PNG (size), dimensions, transparent export path

test('VIS-15 export snapshot opaque & transparent', async ({ page }) => {
  // The evaluation context is the browser; using any to access injected debug object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.waitForFunction(() => !!(window as any).__metroDebug);
  // Generate deterministic medium tree
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (window as any).__metroDebug.genTree?.(3,2,2));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opaqueMeta = await page.evaluate(() => (window as any).__metroDebug.exportDataUrl(false));
  expect(opaqueMeta).toBeTruthy();
  expect(opaqueMeta.width).toBeGreaterThan(100);
  expect(opaqueMeta.height).toBeGreaterThan(100);
  expect(opaqueMeta.size).toBeGreaterThan(1024); // >1KB ensures meaningful pixels
  expect(opaqueMeta.transparent).toBeFalsy();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transparentMeta = await page.evaluate(() => (window as any).__metroDebug.exportDataUrl(true));
  expect(transparentMeta).toBeTruthy();
  expect(transparentMeta.width).toBe(opaqueMeta.width);
  expect(transparentMeta.height).toBe(opaqueMeta.height);
  expect(transparentMeta.size).toBeGreaterThan(512); // still non-trivial
  expect(transparentMeta.transparent).toBeTruthy();
});

test('VIS-15 export after simulated context lost uses fallback', async ({ page }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.waitForFunction(() => !!(window as any).__metroDebug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (window as any).__metroDebug.genTree?.(2,2,1));
  // Simulate context lost
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lost = await page.evaluate(() => (window as any).__metroDebug.simulateContextLost?.());
  expect(lost).toBeTruthy();
  // Attempt export (opaque)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = await page.evaluate(() => (window as any).__metroDebug.exportDataUrl(false));
  expect(meta).toBeTruthy();
  expect(meta.size).toBeGreaterThan(256);
});
