// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MetroStage } from '../../src/visualization/stage';

describe('PERF-1 fast path integration (jsdom)', () => {
  it('pure append tail batch increments fastPathUses without new layoutCallCount', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    root.render(<MetroStage width={400} height={300} />);
    interface MetroDebug {
      getLayoutCallCount: () => number;
      getFastPathUses?: () => number;
      fastAppend?: (parentPath: string, count: number) => { usedFastPath: boolean; reason: string };
    }
    const getDbg = (): MetroDebug | undefined =>
      (window as unknown as { __metroDebug?: MetroDebug }).__metroDebug;
    let dbg: MetroDebug | undefined;
    for (let i = 0; i < 100 && !(dbg = getDbg()); i++) await new Promise((r) => setTimeout(r, 20));
    expect(dbg, 'debug object available').toBeTruthy();
    if (!dbg) return;
    // Seed baseline tree via deterministic generator to ensure full layout state before fast append
    const dbgAny = dbg as unknown as {
      genTree?: (b: number, d: number, f: number) => number;
      getNodes: () => Array<{ path: string }>;
    };
    const count = dbgAny.genTree?.(3, 2, 1); // breadth=3 depth=2 ensures /root/d0_2 exists as tail branch
    expect(count).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 40));
    // Ensure targeted parent path exists (/root/d0_2) or fallback to /root
    // Pick a tail subtree parent: choose the depth=1 directory with greatest x coordinate
    const nodesFlat = dbgAny.getNodes() as Array<{ path: string; x?: number; y?: number }>;
    const depth1 = nodesFlat.filter((n) => n.path.split('/').length === 3); // /root/name
    let parentPath = '/root';
    if (depth1.length) {
      // Heuristic: last lexicographic acts as tail given alphabetical ordering
      depth1.sort((a, b) => a.path.localeCompare(b.path));
      parentPath = depth1[depth1.length - 1].path;
    }
    const beforeLayoutCalls = dbg.getLayoutCallCount();
    const beforeFast = dbg.getFastPathUses?.() ?? 0;
    const res = dbg.fastAppend?.(parentPath, 3);
    const afterLayoutCalls = dbg.getLayoutCallCount();
    const afterFast = dbg.getFastPathUses?.() ?? 0;
    if (!res?.usedFastPath) {
      console.warn('fastAppend reason', res);
    }
    expect(afterLayoutCalls, 'no extra layout call').toBe(beforeLayoutCalls);
    expect(afterFast, 'fast path counter +1').toBe(beforeFast + 1);
  });
});
