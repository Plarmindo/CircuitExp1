import { describe, it, expect } from 'vitest';
import { createGraphAdapter } from '../../src/visualization/graph-adapter';
import { layoutHierarchicalV2 } from '../../src/visualization/layout-v2';
import { hashPathToId } from '../../src/visualization/id-sorting';
// toggleAggregation logic indirectly exercised via expandedAggregations set + layout

// Helper to build many siblings under one parent to hit aggregation threshold.
interface TestNode {
  path: string;
  parentPath: string | null;
  kind: 'directory' | 'file';
  name: string;
  depth: number;
}
function makeSiblings(count: number): TestNode[] {
  const nodes: TestNode[] = [];
  nodes.push({ path: '/root', parentPath: null, kind: 'directory', name: 'root', depth: 0 });
  for (let i = 0; i < count; i++) {
    nodes.push({
      path: `/root/c${i}`,
      parentPath: '/root',
      kind: 'directory',
      name: `c${i}`,
      depth: 1,
    });
  }
  return nodes;
}

describe('VIS-18 coverage extended', () => {
  it('aggregation boundary: threshold vs threshold+1 produces aggregated synthetic node', () => {
    const adapter = createGraphAdapter();
    const threshold = 10; // smaller threshold to keep test light
    adapter.applyDelta(makeSiblings(threshold));
    let layout = layoutHierarchicalV2(adapter, { aggregationThreshold: threshold });
    // Exactly threshold should NOT aggregate (count siblings == threshold)
    const aggNone = layout.nodes.filter(
      (n) => (n as unknown as { aggregated?: boolean }).aggregated
    ).length;
    expect(aggNone).toBe(0);
    // Add one more to exceed threshold
    adapter.applyDelta([
      {
        path: `/root/c${threshold}`,
        parentPath: '/root',
        kind: 'directory',
        name: `c${threshold}`,
        depth: 1,
      },
    ]);
    layout = layoutHierarchicalV2(adapter, { aggregationThreshold: threshold });
    const aggs = layout.nodes.filter((n) => (n as unknown as { aggregated?: boolean }).aggregated);
    expect(aggs.length).toBe(1);
    expect(aggs[0].aggregatedCount).toBe(threshold + 1);
  });

  it('hash stability across multiple invocations', () => {
    const p = '/some/deep/path/example.txt';
    const h1 = hashPathToId(p);
    const h2 = hashPathToId(p);
    const h3 = hashPathToId(p);
    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it('expand/collapse ordering preserves sibling relative order', () => {
    const adapter = createGraphAdapter();
    const threshold = 5;
    const nodes = makeSiblings(threshold + 2); // force aggregation at threshold 5
    adapter.applyDelta(nodes);
    // Initial layout aggregated
    let layout = layoutHierarchicalV2(adapter, { aggregationThreshold: threshold });
    const agg = layout.nodes.find((n) => (n as unknown as { aggregated?: boolean }).aggregated);
    expect(agg).toBeTruthy();
    const syntheticPath = agg!.path;
    // Expand via toggleAggregation helper -> mark synthetic path as expanded
    const expandedSet = new Set<string>();
    expandedSet.add(syntheticPath);
    layout = layoutHierarchicalV2(adapter, {
      aggregationThreshold: threshold,
      expandedAggregations: expandedSet,
    });
    // Collect order of first 5 real children (some subset) sorted by name
    interface LN {
      path: string;
      depth: number;
      aggregated?: boolean;
    }
    const expandedChildren = (layout.nodes as unknown as LN[])
      .filter((n) => !n.aggregated && n.depth === 1)
      .map((n) => n.path.split('/').pop()!);
    const sorted = [...expandedChildren].sort();
    expect(expandedChildren).toEqual(sorted);
    // Collapse again - aggregated synthetic returns and children removed
    expandedSet.delete(syntheticPath);
    layout = layoutHierarchicalV2(adapter, {
      aggregationThreshold: threshold,
      expandedAggregations: expandedSet,
    });
    const afterCollapseAgg = layout.nodes.find(
      (n) => (n as unknown as { aggregated?: boolean }).aggregated
    );
    expect(afterCollapseAgg).toBeTruthy();
  });

  it('adapter metadata update branches (size, mtime, error) and no-op unchanged delta', () => {
    const adapter = createGraphAdapter();
    // initial create
    adapter.applyDelta([
      { path: '/root', parentPath: null, kind: 'dir', name: 'root', depth: 0 },
      {
        path: '/root/file.txt',
        parentPath: '/root',
        kind: 'file',
        name: 'file.txt',
        depth: 1,
        sizeBytes: 10,
        mtimeMs: 100,
      },
    ]);
    // unchanged delta (should not produce updated)
    const r1 = adapter.applyDelta([
      {
        path: '/root/file.txt',
        parentPath: '/root',
        kind: 'file',
        name: 'file.txt',
        depth: 1,
        sizeBytes: 10,
        mtimeMs: 100,
      },
    ]);
    expect(r1.updated.length).toBe(0);
    // changed delta triggers size + mtime + error update branches
    const r2 = adapter.applyDelta([
      {
        path: '/root/file.txt',
        parentPath: '/root',
        kind: 'file',
        name: 'file.txt',
        depth: 1,
        sizeBytes: 20,
        mtimeMs: 105,
        error: 'E',
      },
    ]);
    expect(r2.updated.length).toBe(1);
    const node = adapter.getNode('/root/file.txt')!;
    expect(node.sizeBytes).toBe(20);
    expect(node.mtimeMs).toBe(105);
    expect(node.error).toBe('E');
  });

  it('ensureParents partial existing chain branch & deeper placeholder addition', () => {
    const adapter = createGraphAdapter();
    // Add /root and /root/a via initial delta
    adapter.applyDelta([
      { path: '/root', parentPath: null, kind: 'dir', name: 'root', depth: 0 },
      { path: '/root/a', parentPath: '/root', kind: 'dir', name: 'a', depth: 1 },
    ]);
    // Now add deep file causing creation of /root/a/b placeholder but not new /root or /root/a
    const r = adapter.applyDelta([
      {
        path: '/root/a/b/file.txt',
        parentPath: '/root/a/b',
        kind: 'file',
        name: 'file.txt',
        depth: 3,
      },
    ]);
    // Added should include placeholder /root/a/b and file
    const addedPaths = r.added.map((n) => n.path);
    expect(addedPaths).toEqual(expect.arrayContaining(['/root/a/b', '/root/a/b/file.txt']));
    // Existing parent nodes should remain non-placeholder
    expect(adapter.getNode('/root')?.isPlaceholder).toBeFalsy();
    expect(adapter.getNode('/root/a')?.isPlaceholder).toBeFalsy();
  });

  it('layout aggregated expanded recursion places grandchildren (branch coverage) and coordinate stability across runs', () => {
    const adapter = createGraphAdapter();
    // Build many directories each with one child file to exercise recursion in expanded aggregated path
    const parent = { path: '/root', parentPath: null, kind: 'dir', name: 'root', depth: 0 };
    interface DirNode {
      path: string;
      parentPath: string;
      kind: 'dir' | 'file';
      name: string;
      depth: number;
    }
    const dirs: DirNode[] = [];
    for (let i = 0; i < 6; i++) {
      // > aggregationThreshold we will set (3) to force aggregation
      dirs.push({ path: `/root/d${i}`, parentPath: '/root', kind: 'dir', name: `d${i}`, depth: 1 });
      dirs.push({
        path: `/root/d${i}/f.txt`,
        parentPath: `/root/d${i}`,
        kind: 'file',
        name: 'f.txt',
        depth: 2,
      });
    }
    adapter.applyDelta([parent, ...dirs]);
    const expanded = new Set<string>();
    // First run collapsed to capture synthetic path so we can expand it
    const firstCollapsed = layoutHierarchicalV2(adapter, { aggregationThreshold: 3 });
    const synthetic = firstCollapsed.nodes.find(
      (n) => (n as { aggregated?: boolean }).aggregated
    )!.path;
    expanded.add(synthetic);
    const l1 = layoutHierarchicalV2(adapter, {
      aggregationThreshold: 3,
      expandedAggregations: expanded,
    });
    // Expect grandchildren (files depth 2) to be present
    const depth2 = l1.nodes.filter(
      (n) => n.depth === 2 && !(n as { aggregated?: boolean }).aggregated
    );
    expect(depth2.length).toBe(6); // one per directory
    // Coordinate stability: second run with same state identical positions per path
    const l2 = layoutHierarchicalV2(adapter, {
      aggregationThreshold: 3,
      expandedAggregations: expanded,
    });
    const idx1 = new Map(l1.nodes.map((n) => [n.path, n]));
    for (const n of l2.nodes) {
      const ref = idx1.get(n.path)!;
      expect(n.x).toBe(ref.x);
      expect(n.y).toBe(ref.y);
    }
  });
});
