import { describe, it, expect } from 'vitest';
import { GraphAdapter } from '../../src/visualization/graph-adapter';
import type { ScanNode } from '../../src/shared/scan-types';
import { layoutHierarchicalV2 } from '../../src/visualization/layout-v2';
import { tryIncrementalAppend } from '../../src/visualization/incremental-layout';

describe('PERF-1 incremental append fast path', () => {
  it('appends new leaf siblings at tail without full recompute', () => {
    // Build root '/root' with two child dirs
    const adapter = new GraphAdapter();
    const initial: ScanNode[] = [
      { path: '/root', name: 'root', kind: 'dir', depth: 0 },
      { path: '/root/A', name: 'A', kind: 'dir', depth: 1 },
      { path: '/root/B', name: 'B', kind: 'dir', depth: 1 },
    ];
    adapter.applyDelta(initial);
    const full = layoutHierarchicalV2(adapter);
    const index = full.nodeIndex;
    adapter.applyDelta([
      { path: '/root/C', name: 'C', kind: 'dir', depth: 1 },
      { path: '/root/D', name: 'D', kind: 'dir', depth: 1 },
    ]);
    const added = ['/root/C', '/root/D'];
    const result = tryIncrementalAppend({
      adapter,
      addedPaths: added,
  parentPath: '/root',
      previousNodes: full.nodes,
      previousIndex: index,
      options: { horizontalSpacing: 140, verticalSpacing: 90, spacingThreshold: 6, spacingGrowthRate: 0.5, maxSpacingFactor: 3, aggregationThreshold: 28 }
    });
    expect(result).not.toBeNull();
    const r = result!;
    const app = r.appended.map(p => p.path);
  expect(app).toEqual(['/root/C', '/root/D']);
    const full2 = layoutHierarchicalV2(adapter);
    expect(full2.nodes.map(n => n.path)).toEqual(r.nodes.map(n => n.path));
    for (const p of added) {
      const inc = r.index.get(p)!; const fullNode = full2.nodeIndex.get(p)!;
      expect(inc.x).toBe(fullNode.x); expect(inc.y).toBe(fullNode.y);
    }
  });
});
