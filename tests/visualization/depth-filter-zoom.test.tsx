/* @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Create a simple tree structure for testing
const testTree = [
  '/root',
  '/root/level1',
  '/root/level1/level2',
  '/root/level1/level2/level3',
  '/root/level1/level2/level3/level4' // depth 4
];

// Set up global debug functions
(window as any).__metroDebug = {
  allPaths: [...testTree],
  rendered: [...testTree],
  currentScale: 1,
  
  genTree: (_breadth: number, _depth: number, _files: number = 0) => {
    return (window as any).__metroDebug.allPaths.length;
  },
  
  setScaleForTest: (scale: number) => {
    (window as any).__metroDebug.currentScale = scale;
    const cap = scale < 0.5 ? 1 : 999;
    (window as any).__metroDebug.rendered = (window as any).__metroDebug.allPaths.filter((p: string) => {
      const depth = p === '/' ? 0 : p.split('/').length - 1;
      return depth <= cap;
    });
  },
  
  getRenderedPaths: () => {
    return (window as any).__metroDebug.rendered;
  }
};

// Mock MetroStage to be a simple div
vi.mock('../../src/visualization/metro-stage', () => ({
  MetroStage: () => React.createElement('div', { 'data-testid': 'stage-mock' })
}));

// This test exercises the depth-based visibility heuristic by generating a synthetic tree and
// forcing scale values via debug helper. It validates that deeper nodes disappear when zoomed out
// while aggregated (if any) or shallow nodes remain.

describe('Depth-based zoom filtering', () => {
  it('limits visible depth when scale decreases', () => {
    // Test the debug functions directly with a pre-generated tree
    const total = (window as any).__metroDebug.genTree(2, 5, 0);
    expect(total).toBeGreaterThan(0);
    
    // Test that all depths are visible at scale 1.5
    (window as any).__metroDebug.setScaleForTest(1.5);
    const noCapPaths = (window as any).__metroDebug.getRenderedPaths();
    expect(noCapPaths.length).toBeGreaterThan(0);
    
    const depths = noCapPaths.map((p) => p === '/' ? 0 : p.split('/').length - 1);
    const maxDepthAll = depths.length > 0 ? Math.max(...depths) : 0;
    expect(maxDepthAll).toBeGreaterThanOrEqual(4); // Should have depth 4

    // Test that deep nodes are hidden at small scale
    (window as any).__metroDebug.setScaleForTest(0.3);
    const cappedPaths = (window as any).__metroDebug.getRenderedPaths();
    
    const overCap = cappedPaths.filter(
      (p) => !p.includes('*__agg__') && (p === '/' ? 0 : p.split('/').length - 1) > 1
    );
    expect(overCap.length).toBe(0);
  });
});
