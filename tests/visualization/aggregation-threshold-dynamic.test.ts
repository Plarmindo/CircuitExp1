import { describe, it, expect } from 'vitest';
import { createGraphAdapter } from '../../src/visualization/graph-adapter';
import { layoutHierarchicalV2 } from '../../src/visualization/layout-v2';

interface TestScanNode { path: string; name: string; depth: number; kind: 'dir' | 'file'; }
function makeNode(path: string, depth: number, kind: 'dir' | 'file' = 'dir'): TestScanNode {
  return { path, name: path.split('/').pop() || path, depth, kind };
}

function buildWide(count: number) {
  const adapter = createGraphAdapter();
  const root = makeNode('/root', 0, 'dir');
  adapter.applyDelta([root]);
  const children = Array.from({ length: count }, (_, i) => makeNode(`/root/c${i}`, 1, 'dir'));
  adapter.applyDelta(children);
  return { adapter, childrenPaths: children.map(c => c.path) };
}

/**
 * CORE-3 dynamic aggregation threshold evidence test
 * Steps:
 * 1. Layout wide siblings with high threshold (no aggregation expected)
 * 2. Re-layout with lower threshold (aggregation expected)
 * 3. Re-layout with expandedAggregations including synthetic path -> children reappear
 */
describe('CORE-3 dynamic aggregation threshold relayout', () => {
  it('re-aggregates when threshold lowered then expands correctly', () => {
    const { adapter, childrenPaths } = buildWide(18); // sibling count 18
    // Threshold above count => no aggregation
    const high = layoutHierarchicalV2(adapter, { aggregationThreshold: 30 });
    expect(high.nodes.some(n => n.aggregated)).toBe(false);
    const nodeCountNoAgg = high.nodes.length;
    // Lower threshold below count to force aggregation
    const low = layoutHierarchicalV2(adapter, { aggregationThreshold: 10 });
    const agg = low.nodes.find(n => n.aggregated);
    expect(agg).toBeTruthy();
    expect(agg!.aggregatedCount).toBe(childrenPaths.length);
    // Node count should shrink vs no-aggregation case (1 synthetic replaces many children)
    expect(low.nodes.length).toBeLessThan(nodeCountNoAgg);
    // Expand synthetic
    const expanded = layoutHierarchicalV2(adapter, { aggregationThreshold: 10, expandedAggregations: new Set([agg!.path]) });
    // All children paths should now be visible again
    const allChildrenVisible = childrenPaths.every(p => expanded.nodes.some(n => n.path === p));
    expect(allChildrenVisible).toBe(true);
    // Synthetic remains present & flagged expanded
    const syntheticStill = expanded.nodes.find(n => n.path === agg!.path && n.aggregated);
    expect(syntheticStill).toBeTruthy();
    expect(syntheticStill!.aggregatedExpanded).toBe(true);
  });
});
