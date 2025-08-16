import { describe, it, expect } from 'vitest';
import { createGraphAdapter } from '../../src/visualization/graph-adapter';
import { layoutHierarchicalV2 } from '../../src/visualization/layout-v2';

interface TestScanNode { path: string; name: string; depth: number; kind: 'dir' | 'file'; }
function makeNode(path: string, depth: number, kind: 'dir' | 'file' = 'dir'): TestScanNode {
  return { path, name: path.split('/').pop() || path, depth, kind };
}

/** Build synthetic wide sibling set exceeding aggregation threshold */
function buildWide(adapter = createGraphAdapter(), count = 35) {
  const root = makeNode('/root', 0, 'dir');
  adapter.applyDelta([root]);
  const children = Array.from({ length: count }, (_, i) => makeNode(`/root/c${i}`, 1, 'dir'));
  adapter.applyDelta(children);
  return { adapter, childrenPaths: children.map(c => c.path) };
}

describe('aggregation expand/collapse layout v2', () => {
  it('aggregates wide sibling set when not expanded', () => {
    const { adapter } = buildWide();
    const res = layoutHierarchicalV2(adapter, { aggregationThreshold: 20 });
    const agg = res.nodes.find(n => n.aggregated);
    expect(agg).toBeTruthy();
    // Ensure children not individually placed
    for (const n of res.nodes) {
      if (!n.aggregated) expect(n.depth === 0 || n.depth > 1).toBeTruthy();
    }
  });

  it('expands aggregated node when marked expanded', () => {
    const { adapter, childrenPaths } = buildWide();
    const firstLayout = layoutHierarchicalV2(adapter, { aggregationThreshold: 20 });
    const agg = firstLayout.nodes.find(n => n.aggregated);
    expect(agg).toBeTruthy();
    const expanded = layoutHierarchicalV2(adapter, { aggregationThreshold: 20, expandedAggregations: new Set([agg!.path]) });
    // All children should now appear as non-aggregated nodes at depth 1
    const childPresent = childrenPaths.every(p => expanded.nodes.some(n => n.path === p));
    expect(childPresent).toBe(true);
    // Aggregated synthetic still present
    const stillAgg = expanded.nodes.find(n => n.path === agg!.path && n.aggregated);
    expect(stillAgg).toBeTruthy();
    expect(stillAgg!.aggregatedExpanded).toBe(true);
  });
});
