import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// Headless-stable benchmark: prefer quick synthetic bench (no RAF) if available; fallback to auto event.

interface BenchResult { baselineAvg: number; culledAvg: number; reusePct?: number; improvementPct?: number }
async function waitForBench(page: Page): Promise<BenchResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.waitForFunction(() => !!(window as any).__metroDebug?.benchResult, { timeout: 30000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await page.evaluate(() => (window as any).__metroDebug.benchResult as BenchResult);
}

const AUTO_PARAMS = { breadth: 4, depth: 4, files: 3, frames: 140, extraZoomOut: 2 };

test('culling benchmark >=20% improvement & reuse >=95%', async ({ page }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.waitForFunction(() => !!(window as any).__metroDebug?.getScale, { timeout: 15000 });
  const usedQuick = await page.evaluate((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbg: any = (window as any).__metroDebug;
    if (dbg?.startQuickBench) { dbg.startQuickBench(150); return true; }
    window.dispatchEvent(new CustomEvent('metro:benchCullingAuto', { detail: p }));
    return false;
  }, AUTO_PARAMS);
  const result = await waitForBench(page);
  expect(result).toBeTruthy();
  expect(result.baselineAvg).toBeGreaterThan(0);
  expect(result.culledAvg).toBeGreaterThan(0);
  const improvement = ((result.baselineAvg - result.culledAvg) / result.baselineAvg) * 100;
  expect(improvement).toBeGreaterThanOrEqual(20);
  expect(result.reusePct || 0).toBeGreaterThanOrEqual(95);
  // Record which path used for future diagnostics
  console.log('benchmark path', usedQuick ? 'quick' : 'auto');
});
