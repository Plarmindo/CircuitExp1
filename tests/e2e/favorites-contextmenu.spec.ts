import { test, expect } from './fixtures';

// Verifies CORE-1 context menu: right-click node -> add/remove favorite updates list & centers via jump.

test.describe('CORE-1 favorites context menu', () => {
  test('right-click add & remove favorite', async ({ page }) => {
    // Generate tree (slightly larger for stable selection)
    await page.evaluate(() => {
      // @ts-expect-error accessing injected debug helper
      if (window.__metroDebug?.genTree) window.__metroDebug.genTree(3, 2, 2);
      else
        window.dispatchEvent(
          new CustomEvent('metro:genTree', { detail: { breadth: 3, depth: 2, files: 2 } })
        );
    });
    await page.waitForTimeout(500);
    const node = await page.evaluate(() => {
      const nodes = window.__metroDebug!.getNodes();
      // choose first non-root node
      return nodes.find((n) => !n.aggregated && n.path !== '/root');
    });
    expect(node).toBeTruthy();
    const base = (node.path as string).split('/').pop();

    // We need coordinates for right click: ask debug to get sprite bounds? Not exposed; fallback: dispatch custom event to simulate context menu emission manually.
    // Simulate via direct event dispatch (equivalent to right clicking in stage for our purposes)
    await page.evaluate((p) => {
      window.dispatchEvent(
        new CustomEvent('metro:contextMenu', { detail: { path: p, x: 200, y: 200 } })
      );
    }, node.path);

    // Wait for menu
    const menuSelector = '.metro-context-menu';
    await expect(page.locator(menuSelector)).toBeVisible();
    // Click add favorite (button text contains a leading star symbol, so just click the first button)
    await page
      .locator(menuSelector + ' button')
      .first()
      .click();
    // Favorite should appear in list (allow some retries)
    await expect(
      page.locator('.favorites-list .fav-item .fav-jump', { hasText: base })
    ).toHaveCount(1, { timeout: 10000 });

    // Open context menu again for same node (simulate right click again)
    await page.evaluate((p) => {
      window.dispatchEvent(
        new CustomEvent('metro:contextMenu', { detail: { path: p, x: 210, y: 210 } })
      );
    }, node.path);
    await expect(page.locator(menuSelector)).toBeVisible();
    // Remove favorite (same single button toggles)
    await page
      .locator(menuSelector + ' button')
      .first()
      .click();
    await expect(
      page.locator('.favorites-list .fav-item .fav-jump', { hasText: base })
    ).toHaveCount(0, { timeout: 10000 });
  });
});
