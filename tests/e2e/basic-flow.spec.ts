// Playwright test file (executado via npm run test:e2e)
import { test, expect } from './fixtures';

// Basic UI flow: loads app, waits for scan items, selection, zooms, exports PNG (size check >1KB).

test('basic UI flow: generate tree, zoom, select, export PNG (>1KB)', async ({ page }) => {
  page.on('console', (msg) => console.log('[page console]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[page error]', err.message));

  // Generate synthetic tree (ensure some nodes)
  // Wait until debug helpers exist then generate tree
  await page.waitForFunction(
    () => (window as unknown as { __metroDebug?: unknown }).__metroDebug !== undefined,
    { timeout: 10000 }
  );
  await page.waitForFunction(
    () => (window as unknown as { __metroDebug?: { genTree?: unknown } }).__metroDebug?.genTree,
    { timeout: 10000 }
  );
  await page.evaluate(() => {
    // @ts-expect-error genTree exposed dynamically on debug helper
    window.__metroDebug.genTree(3, 3, 2);
  });
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __metroDebug?: { getNodes?: () => { length: number }[] } };
      return (w.__metroDebug?.getNodes?.().length || 0) > 10;
    },
    { timeout: 6000 }
  );

  // Perform a zoom in and zoom out cycle via events (centers roughly)
  await page.evaluate(() => {
    window.dispatchEvent(new Event('metro:zoomIn'));
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('metro:zoomOut'));
  });
  await page.waitForTimeout(120);

  // Select first non-aggregated node using debug helper
  const picked = await page.evaluate(() => {
    const dbg: any = (window as any).__metroDebug;
    const first = dbg?.pickFirstNonAggregated?.();
    if (first) {
      // Some code expects pointer tap; dispatch custom pointer events on canvas position
      const canvas = document.querySelector('canvas');
      if (canvas && first.clientX && first.clientY) {
        const evtPtr = new PointerEvent('pointerdown', {
          clientX: first.clientX,
          clientY: first.clientY,
        });
        canvas.dispatchEvent(evtPtr);
        const evtTap = new PointerEvent('pointerup', {
          clientX: first.clientX,
          clientY: first.clientY,
        });
        canvas.dispatchEvent(evtTap);
      }
    }
    return first?.path || null;
  });
  expect(picked).not.toBeNull();

  // Export PNG
  await page.evaluate(() => {
    const btn = document.querySelector('button[title="Export PNG"]') as HTMLButtonElement | null;
    if (btn) btn.click();
    else window.dispatchEvent(new CustomEvent('metro:exportPng'));
  });
  await page.waitForFunction(
    () => {
      return (window as any).__lastExportPng?.size > 1024;
    },
    { timeout: 8000 }
  );
  const size = await page.evaluate(() => {
    return (window as any).__lastExportPng.size;
  });
  expect(size).toBeGreaterThan(1024);
});
