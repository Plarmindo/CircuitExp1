import { test, expect } from './fixtures';

interface DebugRouteCommand {
  type: 'M' | 'L' | 'Q';
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
}
interface DebugRoute {
  key: string;
  commands: DebugRouteCommand[];
}
interface DebugApi {
  lastRoutes?: DebugRoute[];
}

// VIS-23 stronger E2E: verify at least one route emits a quadratic command (Q) and
// that no single-segment diagonal (direct M->L skipping orthogonal turn) with large dx & dy exists.

test.describe('VIS-23 line routing debug verification', () => {
  test('emits at least one Q curve and avoids long raw diagonals', async ({ page }) => {
    await page.waitForFunction(
      () => !!(window as unknown as { __metroDebug?: DebugApi }).__metroDebug
    );
    // Generate a reasonably sized tree
    await page.evaluate(() => {
      (window as unknown as { dispatchEvent: (e: Event) => void }).dispatchEvent(
        new CustomEvent('metro:genTree', { detail: { breadth: 6, depth: 3, files: 4 } })
      );
    });
    // Attempt a few redraw cycles to ensure routes collected
    const routeInfo = await page.evaluate(async () => {
      const w = window as unknown as { __metroDebug?: DebugApi };
      for (let i = 0; i < 5; i++) {
        (window as unknown as { dispatchEvent: (e: Event) => void }).dispatchEvent(
          new CustomEvent('metro:themeChanged')
        );
        await new Promise((r) => setTimeout(r, 250));
        if (w.__metroDebug?.lastRoutes && w.__metroDebug.lastRoutes.length > 0) break;
      }
      return (w.__metroDebug?.lastRoutes || []) as DebugRoute[];
    });
    expect(Array.isArray(routeInfo)).toBe(true);
    expect(routeInfo.length).toBeGreaterThan(0);
    const hasQ = routeInfo.some((r) => r.commands.some((c) => c.type === 'Q'));
    expect(hasQ).toBe(true);
    const badDiagonal = routeInfo.find((r) => {
      // Consider a "bad" diagonal if commands are exactly M,L with both large dx & dy and no intermediate orthogonal step
      if (r.commands.length !== 2) return false;
      const [m, l] = r.commands;
      if (m.type !== 'M' || l.type !== 'L') return false;
      const dx = Math.abs((l.x ?? 0) - (m.x ?? 0));
      const dy = Math.abs((l.y ?? 0) - (m.y ?? 0));
      return dx > 40 && dy > 40; // large diagonal which should be orthogonalized
    });
    expect(badDiagonal, 'Should not find large direct diagonal segment').toBeFalsy();
  });
});
