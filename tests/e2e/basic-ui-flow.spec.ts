import { test, expect } from './fixtures';

interface DebugAPI { genTree?: (b: number, d: number, f: number) => void; }
interface ExportMeta { size: number; width: number; height: number; transparent?: boolean }
interface DebugWindow extends Window { __metroDebug?: DebugAPI; __lastExportPng?: ExportMeta }

// QA-2 Basic UI Flow Test
// Acceptance focus: exported PNG artifact >1KB (non-empty meaningful render)
// This test uses the actual toolbar export button instead of direct debug API export to
// exercise a minimal real user interaction path.

test('QA-2 basic UI export flow produces non-empty PNG', async ({ page }) => {
  // Wait for stage debug API
  await page.waitForFunction(() => !!(window as DebugWindow).__metroDebug, undefined, { timeout: 10000 });
  // Generate a moderately sized tree (breadth, depth, files) for richer export
  await page.evaluate(() => (window as DebugWindow).__metroDebug?.genTree?.(4,3,3));
  // Click export button (title attribute used in toolbar)
  await page.getByTitle('Export PNG').click();
  // Wait for export metadata to appear on window (set by stage handler)
  const value = await page.waitForFunction(() => {
    const w = window as DebugWindow;
    return w.__lastExportPng ? JSON.stringify(w.__lastExportPng) : null;
  }, undefined, { timeout: 10000 });
  const parsed: ExportMeta = JSON.parse(value as unknown as string);
  expect(parsed.width).toBeGreaterThan(100);
  expect(parsed.height).toBeGreaterThan(100);
  expect(parsed.size).toBeGreaterThan(1024); // >1KB ensures non-trivial image content
});
