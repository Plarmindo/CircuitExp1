import { describe, it, expect } from 'vitest';
import { createGraphAdapter } from '../../src/visualization/graph-adapter';
import { layoutHierarchical } from '../../src/visualization/layout-v1';
import type { ScanNode } from '../../src/shared/scan-types';

function mk(path: string, kind: 'dir' | 'file', depth: number): ScanNode {
  const name = path.split(/[/\\]/).pop() || path;
  return { name, path, kind, depth } as ScanNode;
}

describe('layout-v1', () => {
  it('single root positioned at 0,0', () => {
    const ga = createGraphAdapter();
    ga.applyDelta([mk('/root', 'dir', 0)]);
    const res = layoutHierarchical(ga, { horizontalSpacing: 100, verticalSpacing: 50 });
    expect(res.nodes.length).toBe(1);
    expect(res.nodes[0].x).toBe(0);
    expect(res.nodes[0].y).toBe(0);
  });

  it('multi branch ordering stable via siblingComparator', () => {
    const ga = createGraphAdapter();
    ga.applyDelta([
      mk('/root', 'dir', 0),
      mk('/root/b', 'dir', 1),
      mk('/root/a', 'dir', 1),
      mk('/root/a/file1', 'file', 2),
      mk('/root/b/file2', 'file', 2),
    ]);
    const res = layoutHierarchical(ga, { horizontalSpacing: 10, verticalSpacing: 5 });
    // Expect order: /root, /root/a, /root/a/file1, /root/b, /root/b/file2
    const order = res.nodes.map((n) => n.path);
    expect(order).toEqual(['/root', '/root/a', '/root/a/file1', '/root/b', '/root/b/file2']);
  });
});
