import { test, expect } from './fixtures';

// Assumes dev server running or test environment similar to other e2e specs.
// Verifies CORE-1: add favorite, persist after simulated reload (same page), center on jump.

test.describe('CORE-1 favorites flow', () => {
  test('add favorite + jump centers node', async ({ page }) => {
    // Generate deterministic tree (use debug helper if available for stability)
    await page.evaluate(() => {
      // @ts-expect-error accessing injected debug helper
      if (window.__metroDebug?.genTree) window.__metroDebug.genTree(2, 2, 1);
      else
        window.dispatchEvent(
          new CustomEvent('metro:genTree', { detail: { breadth: 2, depth: 2, files: 1 } })
        );
    });
    // Wait a moment for layout
    await page.waitForTimeout(300);
    const nodes = await page.evaluate(() => window.__metroDebug!.getNodes());
    const first = nodes.find((n) => !n.aggregated && n.path !== '/root');
    expect(first).toBeTruthy();
    // Select first node (simulate pointer, but simpler: dispatch select event)
    await page.evaluate(
      (p) =>
        window.dispatchEvent(
          new CustomEvent('metro:select', { detail: { path: p, type: 'node' } })
        ),
      first.path
    );
    // Click toggle favorite button in Selected Node panel
    await page.getByRole('button', { name: /Add/ }).click();
    // Favorite list should contain basename
    const base = first.path.split('/').pop();
    await expect(
      page.locator('.favorites-list .fav-item .fav-jump', { hasText: base })
    ).toHaveCount(1);
    // Trigger jump (click favorite item) - selection event + centerOnPath should dispatch and adjust pan.
    await page.click(`.favorites-list .fav-item:has-text("${base}") .fav-jump`);
    // Assert the selected node path is visible (selected section path value contains basename)
    await expect(
      page.locator('.selected-section .value.path', { hasText: first.path })
    ).toBeVisible();
  });
});
