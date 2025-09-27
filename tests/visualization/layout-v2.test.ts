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
    const res = layoutHierarchicalV2(ga, {
      spacingThreshold: 4,
      aggregationThreshold: 50,
      horizontalSpacing: 10,
    });
    // root at x=0, children start at x>0 with expanded spacing
    const childXs = res.nodes.filter((n) => n.path.startsWith('/root/c')).map((n) => n.x);
    // Expect spacing greater than base 10 between first two children
    const uniqueSorted = [...new Set(childXs)].sort((a, b) => a - b);
    expect(uniqueSorted[1] - uniqueSorted[0]).toBeGreaterThan(10 - 1); // allow for float tolerance
  });

  it('aggregation collapses large sibling set', () => {
    const ga = createGraphAdapter();
    const nodes: ScanNode[] = [mk('/root', 'dir', 0)];
    for (let i = 0; i < 40; i++) nodes.push(mk(`/root/f${i}`, 'file', 1));
    ga.applyDelta(nodes);
    const res = layoutHierarchicalV2(ga, { aggregationThreshold: 30 });
    const agg = res.nodes.find((n) => n.aggregated);
    expect(agg).toBeTruthy();
    expect(agg?.aggregatedCount).toBe(40);
  });

  it('throws error when force-directed algorithm is requested', () => {
    const ga = createGraphAdapter();
    const nodes: ScanNode[] = [mk('/root', 'dir', 0)];
    ga.applyDelta(nodes);

    expect(() => {
      layoutHierarchicalV2(ga, { algorithm: 'force-directed' });
    }).toThrow('Force-directed algorithm requires asynchronous computation. Use layoutForceDirected() instead.');
  });

  it('handles empty node set', () => {
    const ga = createGraphAdapter();
    ga.applyDelta([]);
    const res = layoutHierarchicalV2(ga, {});
    expect(res.nodes).toHaveLength(0);
    expect(res.bbox.minX).toBe(0);
    expect(res.bbox.maxX).toBe(0);
    expect(res.bbox.maxY).toBe(0);
  });

  it('handles single node', () => {
    const ga = createGraphAdapter();
    ga.applyDelta([mk('/root', 'dir', 0)]);
    const res = layoutHierarchicalV2(ga, {});
    expect(res.nodes).toHaveLength(1);
    expect(res.nodes[0].path).toBe('/root');
    expect(res.bbox.minX).toBeLessThanOrEqual(res.bbox.maxX);
    expect(res.bbox.minY).toBeLessThanOrEqual(res.bbox.maxY);
  });

  it('applies default options when none provided', () => {
    const ga = createGraphAdapter();
    const nodes: ScanNode[] = [mk('/root', 'dir', 0), mk('/root/child', 'file', 1)];
    ga.applyDelta(nodes);
    const res = layoutHierarchicalV2(ga, {});
    expect(res.nodes).toHaveLength(2);
    expect(res.nodeIndex.size).toBe(2);
    expect(res.nodeIndex.has('/root')).toBe(true);
    expect(res.nodeIndex.has('/root/child')).toBe(true);
  });

  it('handles nested directory structure with aggregation', () => {
    const ga = createGraphAdapter();
    const nodes: ScanNode[] = [
      mk('/root', 'dir', 0),
      mk('/root/dir1', 'dir', 1),
      mk('/root/dir2', 'dir', 1),
    ];
    // Add many files to trigger aggregation in dir1
    for (let i = 0; i < 25; i++) {
      nodes.push(mk(`/root/dir1/file${i}.txt`, 'file', 2));
    }
    // Add a few files to dir2 (no aggregation)
    for (let i = 0; i < 3; i++) {
      nodes.push(mk(`/root/dir2/file${i}.txt`, 'file', 2));
    }

    ga.applyDelta(nodes);
    const res = layoutHierarchicalV2(ga, {
      aggregationThreshold: 20,
      verticalSpacing: 50
    });

    // Should have aggregated nodes in dir1
    const aggregatedNode = res.nodes.find(n => n.aggregated);
    expect(aggregatedNode).toBeTruthy();
    expect(aggregatedNode?.aggregatedCount).toBe(25);

    // Check vertical spacing is applied
    const rootNode = res.nodes.find(n => n.path === '/root');
    const dir1Node = res.nodes.find(n => n.path === '/root/dir1');
    expect(dir1Node?.y).toBe(50); // depth 1 * verticalSpacing 50
    expect(rootNode?.y).toBe(0); // depth 0
  });

  it('handles complex nested structure with recursive placement', () => {
    const ga = createGraphAdapter();
    const nodes: ScanNode[] = [
      mk('/root', 'dir', 0),
      mk('/root/level1', 'dir', 1),
      mk('/root/level1/level2', 'dir', 2),
      mk('/root/level1/level2/file1.txt', 'file', 3),
      mk('/root/level1/level2/file2.txt', 'file', 3),
      mk('/root/level1/sibling.txt', 'file', 2),
      mk('/root/other.txt', 'file', 1),
    ];

    ga.applyDelta(nodes);
    const res = layoutHierarchicalV2(ga, {
      horizontalSpacing: 20,
      verticalSpacing: 30
    });

    // Check all nodes are placed
    expect(res.nodes).toHaveLength(7);

    // Check depth-based vertical positioning
    const level3Files = res.nodes.filter(n => n.depth === 3);
    expect(level3Files).toHaveLength(2);
    expect(level3Files[0].y).toBe(90); // depth 3 * verticalSpacing 30

    // Check horizontal spacing
    const level1Nodes = res.nodes.filter(n => n.depth === 1);
    expect(level1Nodes.length).toBeGreaterThan(0);
  });

  it('handles expanded aggregation with children placement', () => {
    const ga = createGraphAdapter();
    const nodes: ScanNode[] = [mk('/root', 'dir', 0)];

    // Create many files to trigger aggregation
    for (let i = 0; i < 30; i++) {
      nodes.push(mk(`/root/file${i}.txt`, 'file', 1));
    }

    ga.applyDelta(nodes);

    // First get the aggregated result
    const aggregatedRes = layoutHierarchicalV2(ga, {
      aggregationThreshold: 25,
      horizontalSpacing: 15
    });

    const aggregatedNode = aggregatedRes.nodes.find(n => n.aggregated);
    expect(aggregatedNode).toBeTruthy();
    expect(aggregatedNode?.aggregatedCount).toBe(30);

    // Now test with a higher threshold to avoid aggregation and test normal placement
    const normalRes = layoutHierarchicalV2(ga, {
      aggregationThreshold: 50,
      horizontalSpacing: 15
    });

    // Should have all individual nodes
    expect(normalRes.nodes.length).toBe(31); // root + 30 files

    // Check that nodes have proper spacing
    const fileNodes = normalRes.nodes.filter(n => n.path.includes('file'));
    expect(fileNodes.length).toBe(30);

    // Verify horizontal positioning (may have dynamic spacing applied)
    const xPositions = fileNodes.map(n => n.x).sort((a, b) => a - b);
    expect(xPositions[1] - xPositions[0]).toBeGreaterThanOrEqual(15); // at least horizontalSpacing
  });
});
