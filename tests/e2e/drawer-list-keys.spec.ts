import { test, expect } from './fixtures';

// Verifies that Drawer Explorer listbox keyboard navigation doesn't affect stage zoom
// and Enter activates item without large, unintended zoom changes.
test.describe('Drawer Explorer list keyboard handling', () => {
  test('Arrow/Home/End navigates list without changing zoom; Enter activates item', async ({ page }) => {
    // Ensure debug helpers ready
    await page.waitForFunction(() => !!(window as any).__metroDebug, { timeout: 15000 });

    // Force Drawer Explorer mode via URL param
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'drawer');
      if (!url.hash.includes('forceStage')) url.hash = '#forceStage';
      window.location.href = url.toString();
    });
    await page.waitForFunction(() => !!(window as any).__metroDebug, { timeout: 15000 });

    // Generate some content and wait for nodes
    await page.waitForFunction(() => (window as any).__metroDebug?.genTree, { timeout: 15000 });
    await page.evaluate(() => (window as any).__metroDebug.genTree(3, 3, 2));
    await page.waitForFunction(
      () => {
        const w = window as any;
        const count = w.__metroDebug?.getNodes?.()?.length ?? 0;
        return count > 10;
      },
      { timeout: 8000 }
    );

    const getScale = async () => await page.evaluate(() => (window as any).__metroDebug?.getScale?.());

    const list = page.getByRole('listbox', { name: /Favorites|Recent list/ });
    await list.focus();

    const scaleBefore = await getScale();

    // Navigate with arrows and home/end
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Home');
    await page.keyboard.press('End');
    await page.waitForTimeout(150);
    const scaleAfterNav = await getScale();

    // Scale should remain effectively the same (tolerance for float noise)
    expect(scaleAfterNav!).toBeCloseTo(scaleBefore!, 5);

    // Press Enter to activate focused item
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const scaleAfterEnter = await getScale();

    // Still no large unintended zoom change
    expect(scaleAfterEnter!).toBeCloseTo(scaleBefore!, 3);
  });
});