import { describe, it, expect } from 'vitest';
import { createGraphAdapter } from '../../src/visualization/graph-adapter';
import { layoutHierarchicalV2 } from '../../src/visualization/layout-v2';
import { hashPathToId } from '../../src/visualization/id-sorting';
// toggleAggregation logic indirectly exercised via expandedAggregations set + layout

// Helper to build many siblings under one parent to hit aggregation threshold.
interface TestNode { path: string; parentPath: string | null; kind: 'directory' | 'file'; name: string; depth: number }
function makeSiblings(count: number): TestNode[] {
  const nodes: TestNode[] = [];
  nodes.push({ path: '/root', parentPath: null, kind: 'directory', name: 'root', depth: 0 });
  for (let i=0;i<count;i++) {
    nodes.push({ path: `/root/c${i}`, parentPath: '/root', kind: 'directory', name: `c${i}`, depth: 1 });
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
  const aggNone = layout.nodes.filter(n => (n as unknown as { aggregated?: boolean }).aggregated).length;
    expect(aggNone).toBe(0);
    // Add one more to exceed threshold
  adapter.applyDelta([{ path: `/root/c${threshold}`, parentPath: '/root', kind: 'directory', name: `c${threshold}`, depth: 1 }]);
    layout = layoutHierarchicalV2(adapter, { aggregationThreshold: threshold });
  const aggs = layout.nodes.filter(n => (n as unknown as { aggregated?: boolean }).aggregated);
    expect(aggs.length).toBe(1);
    expect(aggs[0].aggregatedCount).toBe(threshold+1);
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
    const nodes = makeSiblings(threshold+2); // force aggregation at threshold 5
    adapter.applyDelta(nodes);
    // Initial layout aggregated
    let layout = layoutHierarchicalV2(adapter, { aggregationThreshold: threshold });
  const agg = layout.nodes.find(n => (n as unknown as { aggregated?: boolean }).aggregated);
    expect(agg).toBeTruthy();
    const syntheticPath = agg!.path;
    // Expand via toggleAggregation helper -> mark synthetic path as expanded
    const expandedSet = new Set<string>();
    expandedSet.add(syntheticPath);
    layout = layoutHierarchicalV2(adapter, { aggregationThreshold: threshold, expandedAggregations: expandedSet });
    // Collect order of first 5 real children (some subset) sorted by name
    interface LN { path: string; depth: number; aggregated?: boolean }
    const expandedChildren = (layout.nodes as unknown as LN[])
      .filter(n => !n.aggregated && n.depth === 1)
      .map(n => n.path.split('/').pop()!);
    const sorted = [...expandedChildren].sort();
    expect(expandedChildren).toEqual(sorted);
    // Collapse again - aggregated synthetic returns and children removed
    expandedSet.delete(syntheticPath);
    layout = layoutHierarchicalV2(adapter, { aggregationThreshold: threshold, expandedAggregations: expandedSet });
  const afterCollapseAgg = layout.nodes.find(n => (n as unknown as { aggregated?: boolean }).aggregated);
    expect(afterCollapseAgg).toBeTruthy();
  });
});
