import { describe, it, expect } from 'vitest';
import { createGraphAdapter } from '../../src/visualization/graph-adapter';
import type { ScanNode } from '../../src/shared/scan-types';

function mkNode(
  path: string,
  kind: 'dir' | 'file',
  depth: number,
  extra: Partial<ScanNode> = {}
): ScanNode {
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
    const first = [mkNode('/root/a/file.txt', 'file', 2)];
    const r1 = ga.applyDelta(first);
    expect(r1.added.length).toBe(3); // placeholders for /root and /root/a plus file node
    const placeholderA = ga.getNode('/root/a');
    expect(placeholderA?.isPlaceholder).toBe(true);
    const second = [mkNode('/root', 'dir', 0), mkNode('/root/a', 'dir', 1)];
    const r2 = ga.applyDelta(second);
    expect(r2.placeholderHydrated.find((n) => n.path === '/root/a')).toBeTruthy();
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

  it('late parent hydration retains existing children chain (VIS-17)', () => {
    const ga = createGraphAdapter();
    // Feed deepest file first -> creates placeholder chain: /root, /root/a, /root/a/b
    const first = [mkNode('/root/a/b/file.txt', 'file', 3)];
    const r1 = ga.applyDelta(first);
    // Expect 4 nodes added (3 placeholders + file)
    expect(r1.added.length).toBe(4);
    const phRoot = ga.getNode('/root');
    const phA = ga.getNode('/root/a');
    const phB = ga.getNode('/root/a/b');
    expect(phRoot?.isPlaceholder).toBe(true);
    expect(phA?.isPlaceholder).toBe(true);
    expect(phB?.isPlaceholder).toBe(true);
    // Validate placeholder child links exist pre-hydration
    expect(phRoot?.children).toContain('/root/a');
    expect(phA?.children).toContain('/root/a/b');
    expect(phB?.children).toContain('/root/a/b/file.txt');
    // Hydrate parents out of order (root then a then b)
    const second = [
      mkNode('/root', 'dir', 0),
      mkNode('/root/a', 'dir', 1),
      mkNode('/root/a/b', 'dir', 2),
    ];
    const r2 = ga.applyDelta(second);
    // All three should be in placeholderHydrated set; order not guaranteed
    const hydratedPaths = r2.placeholderHydrated.map((n) => n.path);
    expect(hydratedPaths).toEqual(expect.arrayContaining(['/root', '/root/a', '/root/a/b']));
    expect(ga.getNode('/root')?.isPlaceholder).toBe(false);
    expect(ga.getNode('/root/a')?.isPlaceholder).toBe(false);
    expect(ga.getNode('/root/a/b')?.isPlaceholder).toBe(false);
    // Children arrays preserved
    expect(ga.getNode('/root')?.children).toContain('/root/a');
    expect(ga.getNode('/root/a')?.children).toContain('/root/a/b');
    expect(ga.getNode('/root/a/b')?.children).toContain('/root/a/b/file.txt');
  });
});
