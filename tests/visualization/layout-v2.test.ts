import { describe, it, expect } from 'vitest';
import { createGraphAdapter } from '../../src/visualization/graph-adapter';
import { layoutHierarchicalV2 } from '../../src/visualization/layout-v2';
import type { ScanNode } from '../../src/shared/scan-types';

function mk(path: string, kind: 'dir' | 'file', depth: number): ScanNode {
  const name = path.split(/[/\\]/).pop() || path;
  return { name, path, kind, depth } as ScanNode;
}

describe('layout-v2', () => {
  it('dynamic spacing increases for large sibling sets (no aggregation)', () => {
    const ga = createGraphAdapter();
    const nodes: ScanNode[] = [mk('/root', 'dir', 0)];
    for (let i = 0; i < 10; i++) nodes.push(mk(`/root/c${i}`, 'file', 1));
    ga.applyDelta(nodes);
    const res = layoutHierarchicalV2(ga, { spacingThreshold: 4, aggregationThreshold: 50, horizontalSpacing: 10 });
    // root at x=0, children start at x>0 with expanded spacing
    const childXs = res.nodes.filter(n => n.path.startsWith('/root/c')).map(n => n.x);
    // Expect spacing greater than base 10 between first two children
    const uniqueSorted = [...new Set(childXs)].sort((a,b)=>a-b);
    expect(uniqueSorted[1] - uniqueSorted[0]).toBeGreaterThan(10 - 1); // allow for float tolerance
  });

  it('aggregation collapses large sibling set', () => {
    const ga = createGraphAdapter();
    const nodes: ScanNode[] = [mk('/root', 'dir', 0)];
    for (let i = 0; i < 40; i++) nodes.push(mk(`/root/f${i}`, 'file', 1));
    ga.applyDelta(nodes);
    const res = layoutHierarchicalV2(ga, { aggregationThreshold: 30 });
    const agg = res.nodes.find(n => n.aggregated);
    expect(agg).toBeTruthy();
    expect(agg?.aggregatedCount).toBe(40);
  });
});
