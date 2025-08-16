import { describe, it, expect } from 'vitest';
import { createGraphAdapter } from '../../src/visualization/graph-adapter';
import type { ScanNode } from '../../src/shared/scan-types';

function mkNode(path: string, kind: 'dir' | 'file', depth: number, extra: Partial<ScanNode> = {}): ScanNode {
  const name = path.split(/[/\\]/).pop() || path;
  return { name, path, kind, depth, ...extra } as ScanNode;
}

describe('graph-adapter', () => {
  it('adds simple ordered parent->child', () => {
    const ga = createGraphAdapter();
    const delta = [
      mkNode('/root', 'dir', 0),
      mkNode('/root/a', 'dir', 1),
      mkNode('/root/a/file.txt', 'file', 2),
    ];
    const res = ga.applyDelta(delta);
    expect(res.added.length).toBe(3);
    expect(ga.getNode('/root')?.children).toContain('/root/a');
    expect(ga.getNode('/root/a')?.children).toContain('/root/a/file.txt');
  });

  it('creates placeholder for missing parent when child arrives first then hydrates', () => {
    const ga = createGraphAdapter();
    const first = [ mkNode('/root/a/file.txt', 'file', 2) ];
    const r1 = ga.applyDelta(first);
    expect(r1.added.length).toBe(3); // placeholders for /root and /root/a plus file node
    const placeholderA = ga.getNode('/root/a');
    expect(placeholderA?.isPlaceholder).toBe(true);
    const second = [ mkNode('/root', 'dir', 0), mkNode('/root/a', 'dir', 1) ];
    const r2 = ga.applyDelta(second);
    expect(r2.placeholderHydrated.find(n => n.path === '/root/a')).toBeTruthy();
    expect(ga.getNode('/root/a')?.isPlaceholder).toBe(false);
  });

  it('avoids duplicate on re-processing same node', () => {
    const ga = createGraphAdapter();
    const n = mkNode('/root', 'dir', 0);
    ga.applyDelta([n]);
    const r2 = ga.applyDelta([n]);
    expect(r2.added.length).toBe(0);
    expect(r2.updated.length).toBe(0);
    expect(ga.size()).toBe(1);
  });
});
