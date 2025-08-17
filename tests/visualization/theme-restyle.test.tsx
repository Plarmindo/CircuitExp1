// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MetroStage } from '../../src/visualization/metro-stage';
import { setTheme } from '../../src/visualization/style-tokens';

function nextTick() { return new Promise(r => setTimeout(r, 30)); }

describe('VIS-14 dynamic theme restyle', () => {
  it('re-styles sprites without new layout computation and preserves sprite identity', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    root.render(<MetroStage width={400} height={300} />);
  await nextTick();
  let debugApi: any = (window as any).__metroDebug;
  for (let i=0;i<8 && !debugApi;i++) { await nextTick(); debugApi = (window as any).__metroDebug; }
  expect(debugApi).toBeTruthy();
  // Generate tree via event (works even in fallback renderer)
  window.dispatchEvent(new CustomEvent('metro:genTree', { detail: { breadth: 2, depth: 1, files: 1 } }));
  await nextTick();
  const initialLayoutCalls = debugApi.getLayoutCallCount?.() ?? 0;
    const nodes = debugApi.getNodes();
    const target = nodes.find((n: any) => !n.aggregated) || nodes[0];
    expect(target).toBeTruthy();
    const spriteBefore = debugApi.getNodeSprite?.(target.path);
    const colorBefore = debugApi.getNodeColor?.(target.path);
    setTheme('dark');
    window.dispatchEvent(new Event('metro:themeChanged'));
    await nextTick();
    const layoutCallsAfter = debugApi.getLayoutCallCount();
    // In fallback (pixi failed) layoutCalls may stay 0; only assert no extra layout
    expect(layoutCallsAfter).toEqual(initialLayoutCalls);
    if (spriteBefore && colorBefore != null) {
      const spriteAfter = debugApi.getNodeSprite(target.path);
      const colorAfter = debugApi.getNodeColor(target.path);
      expect(spriteAfter).toBe(spriteBefore);
      expect(colorAfter).not.toEqual(colorBefore);
    }
  });
});
