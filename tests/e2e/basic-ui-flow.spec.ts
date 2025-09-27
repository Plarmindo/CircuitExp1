import { test, expect } from '@playwright/test';
import { captureMapSnapshot, analyseSnapshotFile } from './utils/mapSnapshot';

interface DebugAPI {
  genTree?: (b: number, d: number, f: number) => void;
  getNodes?: () => Array<{ path: string }>;
}
interface ExportMeta {
  size: number;
  width: number;
  height: number;
  transparent?: boolean;
}
interface DebugWindow extends Window {
  __metroDebug?: DebugAPI;
  __lastExportPng?: ExportMeta;
}

// QA-2 Basic UI Flow Test
// Acceptance focus: exported PNG artifact >1KB (non-empty meaningful render)
// This test uses the actual toolbar export button instead of direct debug API export to
// exercise a minimal real user interaction path.

test('QA-2 basic UI export flow produces non-empty PNG', async ({ page }) => {
  // Ensure we are on a stage-enabled route with a mode that renders MetroStage
  await page.goto('/?mode=zoom#forceStage', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\?mode=zoom.*#forceStage/i, { timeout: 30000 });

  // Wait for early debug bootstrap (ensures stage mounted enough to receive events)
  await page.waitForFunction(() => (window as DebugWindow).__metroDebug !== undefined, {
    timeout: 30000,
  });

  // Prefer event-based generator: it updates internal layout and triggers redraw
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('metro:genTree', { detail: { breadth: 4, depth: 3, files: 2 } })
    );
  });

  // Wait until nodes are available via debug helper (canvas path) with a retry dispatch
  await page.waitForFunction(
    () => {
      const w = window as unknown as DebugWindow & { ___genTreeRetry?: number };
      const count = w.__metroDebug?.getNodes?.()?.length ?? 0;
      if (count > 5) return true;
      // If first check fails, re-dispatch the event once to ensure listener is active
      if (!w.___genTreeRetry) {
        w.___genTreeRetry = 1;
        window.dispatchEvent(
          new CustomEvent('metro:genTree', { detail: { breadth: 4, depth: 3, files: 2 } })
        );
      }
      return false;
    },
    { timeout: 15000, polling: 200 }
  );

  // Capture snapshot after generating the tree and ensure no anomalies were found
  const { jsonPath } = await captureMapSnapshot(page, 'after-gen-tree');
  const issues = await analyseSnapshotFile(jsonPath);
  expect(issues).toHaveLength(0);

  // Click export button (title attribute used in toolbar)
  await page.getByTitle('Export PNG').click();

  // Wait for export metadata to appear on window (set by stage handler)
  const value = await page.waitForFunction(
    () => {
      const w = window as DebugWindow;
      return w.__lastExportPng ? JSON.stringify(w.__lastExportPng) : null;
    },
    undefined,
    { timeout: 20000 }
  );

  const parsed: ExportMeta = JSON.parse(value as unknown as string);
  expect(parsed.width).toBeGreaterThan(100);
  expect(parsed.height).toBeGreaterThan(100);
  expect(parsed.size).toBeGreaterThan(1024); // >1KB ensures non-trivial image content
});
