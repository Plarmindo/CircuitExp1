import { describe, it, expect } from 'vitest';
import { hashPathToId, assignStationId, siblingComparator } from '../../src/visualization/id-sorting';
import type { GraphNode } from '../../src/visualization/graph-adapter';

function mkNode(path: string, name: string, size?: number): GraphNode {
  return { path, name, kind: 'file', depth: 0, children: [], sizeBytes: size } as GraphNode;
}

describe('id-sorting', () => {
  it('hashPathToId stable', () => {
    const a = hashPathToId('/root/a');
    const b = hashPathToId('/root/a');
    expect(a).toBe(b);
  });

  it('assignStationId only once and stable', () => {
    const n = mkNode('/root/x', 'x');
    assignStationId(n);
    // @ts-expect-error dynamic field
    const first = n.stationId;
    assignStationId(n);
    // @ts-expect-error dynamic field
    expect(n.stationId).toBe(first);
  });

  it('siblingComparator alphabetical then size then id', () => {
    const n1 = mkNode('/p/A', 'A', 10);
    const n2 = mkNode('/p/a', 'a', 5);
    assignStationId(n1); assignStationId(n2);
    // names tie case-insensitive -> size descending (n1 before n2)
    const arr = [n2, n1];
    arr.sort(siblingComparator);
    expect(arr[0]).toBe(n1);
  });
});
