import { test, expect } from '@playwright/test';

// Verifies that zoom keyboard shortcuts are gated to the Stage container focus and do not trigger from toolbar/select/etc.
test.describe('Keyboard gating for zoom shortcuts', () => {
  test('No zoom when focus is outside stage; zoom works when stage focused; Ctrl+0 fits', async ({ page }) => {
    // Navigate initially with params so App mounts in Full view and ModeProvider picks Semantic Zoom
    await page.goto('/?mode=zoom#forceStage', { waitUntil: 'domcontentloaded' });

    // Ensure debug helpers ready after initial navigation
    await page.waitForFunction(() => !!(window as any).__metroDebug, { timeout: 20000 });

    // Generate synthetic content robustly and wait for nodes to appear
    const ensureSyntheticContent = async () => {
      // Try event-based generation first
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('metro:genTree', { detail: { breadth: 3, depth: 3, files: 2 } })
        );
      });

      // Poll for nodes; if not enough, try fallback direct genTree if exposed
      const ok = await page
        .waitForFunction(
          () => {
            const w = window as any;
            const count = w.__metroDebug?.getNodes?.()?.length ?? 0;
            if (count > 10) return true;
            if (w.__metroDebug?.genTree) {
              // Fallback: some environments expose direct generator on debug API
              try {
                w.__metroDebug.genTree(3, 3, 2);
              } catch (error) {
                // Ignore debug API errors
                console.warn('Failed to generate debug tree:', error);
              }
            }
            return false;
          },
          { timeout: 10000, polling: 200 }
        )
        .catch(() => false);

      if (!ok) {
        // Last attempt: dispatch event again and wait a bit more
        await page.evaluate(() => {
          window.dispatchEvent(
            new CustomEvent('metro:genTree', { detail: { breadth: 3, depth: 3, files: 2 } })
          );
        });
        await page.waitForTimeout(500);
      }

      // Final assertion that nodes exist
      await page.waitForFunction(
        () => ((window as any).__metroDebug?.getNodes?.()?.length ?? 0) > 10,
        { timeout: 8000 }
      );
    };

    await ensureSyntheticContent();

    // Ensure we can read a finite scale from the debug API.
    // Some builds expose getScale(); others expose getViewport().scale.
    await page.waitForFunction(
      () => {
        const w = window as any;
        const dbg = w.__metroDebug;
        if (!dbg) return false;
        const s = typeof dbg.getScale === 'function' ? dbg.getScale() : dbg.getViewport?.()?.scale;
        return Number.isFinite(s);
      },
      { timeout: 20000, polling: 200 }
    );

    const getScale = async () =>
      await page.evaluate(() => {
        const w = window as any;
        const dbg = w.__metroDebug;
        if (!dbg) return undefined;
        if (typeof dbg.getScale === 'function') return dbg.getScale();
        const v = dbg.getViewport?.();
        return v?.scale;
      });

    // Focus the Visualization Mode select (outside stage) — use any toolbar control as proxy when present
    const possibleToolbar = page.getByRole('button', { name: 'Generate Synthetic Test Tree' });
    if (await possibleToolbar.isVisible().catch(() => false)) {
      await possibleToolbar.focus();
    } else {
      // Fallback: focus document body
      await page.evaluate(() => (document.activeElement as any)?.blur?.());
    }

    const scaleBefore = await getScale();

    // Send '+' and '-' - should NOT change scale while focus is outside stage
    await page.keyboard.press('=');
    await page.keyboard.press('-');
    await page.waitForTimeout(150);
    const scaleAfterToolbar = await getScale();
    expect(scaleAfterToolbar).toBeCloseTo(scaleBefore!, 5);

    // Focus the stage container and try again
    const stage = page.locator('.stage-container');
    await stage.waitFor();
    await stage.focus();

    await page.keyboard.press('='); // zoom in
    await page.waitForTimeout(180);
    const scaleAfterZoomIn = await getScale();
    expect(scaleAfterZoomIn!).toBeGreaterThan(scaleAfterToolbar!);

    await page.keyboard.press('-'); // zoom out
    await page.waitForTimeout(180);
    const scaleAfterZoomOut = await getScale();
    expect(scaleAfterZoomOut!).toBeLessThan(scaleAfterZoomIn!);

    // Ctrl/Cmd+0 should fit to view
    const accel = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(accel);
    await page.keyboard.press('Digit0');
    await page.keyboard.up(accel);
    await page.waitForTimeout(200);
    const scaleAfterFit = await getScale();
    expect(scaleAfterFit!).toBeGreaterThan(0.29);
    expect(scaleAfterFit!).toBeLessThan(3.01);
  });
});
