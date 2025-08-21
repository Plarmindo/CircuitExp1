import { describe, it, expect } from 'vitest';
import { createGraphAdapter } from '../../src/visualization/graph-adapter';
import { layoutHierarchicalV2 } from '../../src/visualization/layout-v2';
import type { ScanNode } from '../../src/shared/scan-types';

/**
 * VIS-19 Incremental Consistency Integration Test
 * ------------------------------------------------
 * Feeds a sequence of deltas (simulating out-of-order and batched scan arrival)
 * and compares final adapter+layout result with a single-pass construction using
 * the same logical full node set.
 *
 * Acceptance Criteria Mapping:
 * - Sequence of deltas (out-of-order, batched) applied.
 * - Final rendered graph (positions & node set) equals single-pass result,
 *   ignoring transient aggregation placeholders (layout v2 deterministic).
 */

type D = Omit<ScanNode, 'children'>; // we operate in delta mode (no nested children arrays)

// Helper to build a ScanNode quickly
function sn(path: string, kind: 'file' | 'dir', depth: number): D {
  const name = path.split(/[/\\]/).pop() || path;
  return { path, name, kind, depth } as D;
}

describe('VIS-19 incremental consistency', () => {
  it('final layout matches single-pass layout ignoring aggregation placeholders', () => {
    // Full logical tree (acyclic simple hierarchy):
    // /root
    //   /root/a
    //     /root/a/f1.txt
    //     /root/a/f2.txt
    //   /root/b
    //     /root/b/c
    //       /root/b/c/f3.txt
    //   /root/d
    const full: D[] = [
      sn('/root', 'dir', 0),
      sn('/root/a', 'dir', 1),
      sn('/root/a/f1.txt', 'file', 2),
      sn('/root/a/f2.txt', 'file', 2),
      sn('/root/b', 'dir', 1),
      sn('/root/b/c', 'dir', 2),
      sn('/root/b/c/f3.txt', 'file', 3),
      sn('/root/d', 'dir', 1),
    ];

    // Construct single-pass baseline
    const baselineAdapter = createGraphAdapter();
    baselineAdapter.applyDelta(full as ScanNode[]);
    const baselineLayout = layoutHierarchicalV2(baselineAdapter, { aggregationThreshold: 50 }); // disable aggregation for clarity

    // Simulated incremental / out-of-order batches
    const batches: D[][] = [
      // Deep file before its parents -> triggers placeholder creation
      [sn('/root/b/c/f3.txt', 'file', 3)],
      // Later parents for that chain (out-of-order hydration)
      [sn('/root', 'dir', 0), sn('/root/b', 'dir', 1)],
      // Insert sibling branch + leaf
      [sn('/root/a', 'dir', 1), sn('/root/a/f1.txt', 'file', 2)],
      // Remaining nodes & second file in /root/a plus mid parent /root/b/c and another top-level /root/d
      [sn('/root/a/f2.txt', 'file', 2), sn('/root/b/c', 'dir', 2), sn('/root/d', 'dir', 1)],
    ];

    const incAdapter = createGraphAdapter();
    for (const batch of batches) {
      incAdapter.applyDelta(batch as ScanNode[]);
    }
    const incLayout = layoutHierarchicalV2(incAdapter, { aggregationThreshold: 50 });

    // Compare node sets (paths)
    const baselinePaths = new Set(baselineLayout.nodes.map((n) => n.path));
    const incPaths = new Set(incLayout.nodes.map((n) => n.path));
    expect(incPaths).toEqual(baselinePaths);

    // Compare coordinates per path
    const baseIndex = new Map(
      baselineLayout.nodes.map((n) => [n.path, { x: n.x, y: n.y, depth: n.depth }])
    );
    for (const node of incLayout.nodes) {
      const ref = baseIndex.get(node.path);
      expect(ref).toBeTruthy();
      expect(node.x).toBe(ref!.x);
      expect(node.y).toBe(ref!.y);
      expect(node.depth).toBe(ref!.depth);
    }
  });

  it('final layout matches with aggregation active (small threshold)', () => {
    const full: D[] = [
      sn('/root', 'dir', 0),
      sn('/root/a', 'dir', 1),
      sn('/root/a/f1.txt', 'file', 2),
      sn('/root/b', 'dir', 1),
      sn('/root/b/c', 'dir', 2),
      sn('/root/b/c/f3.txt', 'file', 3),
      sn('/root/d', 'dir', 1),
    ];
    const baselineAdapter = createGraphAdapter();
    baselineAdapter.applyDelta(full as ScanNode[]);
    const aggThreshold = 2; // force aggregation at root (3 children > 2)
    const baselineLayout = layoutHierarchicalV2(baselineAdapter, {
      aggregationThreshold: aggThreshold,
    });

    const batches: D[][] = [
      [sn('/root/b/c/f3.txt', 'file', 3)],
      [sn('/root', 'dir', 0), sn('/root/b', 'dir', 1)],
      [sn('/root/a', 'dir', 1), sn('/root/a/f1.txt', 'file', 2)],
      [sn('/root/b/c', 'dir', 2), sn('/root/d', 'dir', 1)],
    ];
    const incAdapter = createGraphAdapter();
    for (const batch of batches) incAdapter.applyDelta(batch as ScanNode[]);
    const incLayout = layoutHierarchicalV2(incAdapter, { aggregationThreshold: aggThreshold });

    const basePaths = new Set(baselineLayout.nodes.map((n) => n.path));
    const incPaths = new Set(incLayout.nodes.map((n) => n.path));
    expect(incPaths).toEqual(basePaths); // synthetic aggregated path deterministic

    // If both have synthetic aggregated, ensure aggregatedCount matches expected (3 root children collapsed)
    interface AggLike {
      aggregated?: boolean;
      aggregatedCount?: number;
    }
    const isAgg = (o: unknown): o is AggLike =>
      !!o && typeof o === 'object' && 'aggregated' in (o as Record<string, unknown>);
    const baseAgg = baselineLayout.nodes.find((n) => isAgg(n) && n.aggregated);
    const incAgg = incLayout.nodes.find((n) => isAgg(n) && n.aggregated);
    expect(baseAgg && incAgg).toBeTruthy();
    if (baseAgg && incAgg) {
      expect(baseAgg.aggregatedCount).toBe(3);
      expect(incAgg.aggregatedCount).toBe(3);
    }
  });
});
