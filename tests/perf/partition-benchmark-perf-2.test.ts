/** @vitest-environment node */
/**
 * PERF-2 Automated Benchmark Test
 * --------------------------------
 * Validates that partitioned (tail-subtree) layout recomputation achieves >=25% average
 * reduction in layout time vs full layout recompute for repeated dirty path updates.
 *
 * Strategy:
 * 1. Generate a moderately large balanced tree (breadth=8, depth=4, files=2) -> ~ (sum_{i=0..4} 8^i) directories + files.
 * 2. Perform initial full layout (baseline state).
 * 3. Baseline loop: mutate a file inside the tail subtree (last root directory's descendant) and run full layout each iteration (record durations).
 * 4. Partition loop: mutate same file path each iteration and invoke tryPartitionedLayout; fallback to full layout only if partition guard fails (should not happen for tail subtree).
 * 5. Compute improvementPct = (fullAvg - partialAvg)/fullAvg*100 and assert >= 25.
 * 6. Assert partition applied for all iterations (no skips) to ensure measurement validity.
 *
 * Rationale: Tail subtree modifications avoid shifting earlier siblings' x positions, satisfying
 * current partition guard conditions. Subtree is ~1/8 of total tree, so expected improvement > 75%.
 */
import { describe, it, expect } from 'vitest';
import { createGraphAdapter, GraphAdapter } from '../../src/visualization/graph-adapter';
import { layoutHierarchicalV2, type LayoutPointV2 } from '../../src/visualization/layout-v2';
import { tryPartitionedLayout } from '../../src/visualization/stage/partitioned-layout';
import type { ScanNode } from '../../src/shared/scan-types';

interface GenParams {
  breadth: number;
  depth: number;
  files: number;
}

function generateTree(p: GenParams): ScanNode[] {
  const { breadth, depth, files } = p;
  const nodes: ScanNode[] = [];
  interface DirEntry {
    path: string;
    level: number;
  }
  const q: DirEntry[] = [{ path: '/root', level: 0 }];
  while (q.length) {
    const { path, level } = q.shift()!;
    nodes.push({ path, kind: 'dir', depth: level, name: path.split('/').pop() || 'dir' });
    if (level < depth) {
      for (let b = 0; b < breadth; b++)
        q.push({ path: `${path}/d${level}_${b}`, level: level + 1 });
    }
    if (level < depth) {
      for (let f = 0; f < files; f++)
        nodes.push({
          path: `${path}/f${level}_${f}.txt`,
          kind: 'file',
          sizeBytes: 10,
          name: `f${level}_${f}.txt`,
          depth: level + 1,
        });
    }
  }
  return nodes;
}

function timeMs(fn: () => void): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

describe('PERF-2 partition benchmark (node environment)', () => {
  it('achieves required (>=25%) average layout time reduction via partitioned subtree recompute', () => {
    const adapter: GraphAdapter = createGraphAdapter();
    const breadth = 8;
    const depth = 4;
    const files = 2;
    const baselineNodes = generateTree({ breadth, depth, files });
    adapter.applyDelta(baselineNodes);
    // Initial full layout
    const fullInitial = layoutHierarchicalV2(adapter);
    let lastNodes: LayoutPointV2[] = fullInitial.nodes as LayoutPointV2[];
    let lastIndex = fullInitial.nodeIndex as Map<string, LayoutPointV2>;

    const loops = 24; // sufficient for stable average while keeping test quick
    const targetDir = `/root/d0_${breadth - 1}`; // last root child => tail subtree root
    // Pick one deep descendant file path inside tail subtree; ensure exists
    const subDir = `${targetDir}/d1_${breadth - 1}`;
    const targetFileA = `${subDir}/f2_0.txt`; // existing file (depth 3)
    const targetFileB = `${subDir}/f2_1.txt`;
    expect(adapter.getNode(targetFileA)).toBeTruthy();
    expect(adapter.getNode(targetFileB)).toBeTruthy();

    // Baseline loop: full layout each mutation
    const fullTimes: number[] = [];
    for (let i = 0; i < loops; i++) {
      // mutate same file plus introduce another sibling file update to enlarge affected set in full layout
      adapter.applyDelta([
        { path: targetFileA, kind: 'file', sizeBytes: 100 + i, name: 'f2_0.txt', depth: 3 },
        { path: targetFileB, kind: 'file', sizeBytes: 50 + i, name: 'f2_1.txt', depth: 3 },
      ]);
      const dur = timeMs(() => {
        const layout = layoutHierarchicalV2(adapter);
        lastNodes = layout.nodes as LayoutPointV2[];
        lastIndex = layout.nodeIndex as Map<string, LayoutPointV2>;
      });
      fullTimes.push(dur);
    }

    // Reset one more full layout for clean partition starting point
    const resetLayout = layoutHierarchicalV2(adapter);
    lastNodes = resetLayout.nodes as LayoutPointV2[];
    lastIndex = resetLayout.nodeIndex as Map<string, LayoutPointV2>;

    // Partition loop
    const partTimes: number[] = [];
    let appliedCount = 0;
    const debugEvents: Array<{ stage: string; ctx?: Record<string, unknown> }> = [];
    for (let i = 0; i < loops; i++) {
      adapter.applyDelta([
        { path: targetFileA, kind: 'file', sizeBytes: 200 + i, name: 'f2_0.txt', depth: 3 },
        { path: targetFileB, kind: 'file', sizeBytes: 150 + i, name: 'f2_1.txt', depth: 3 },
      ]);
      const dur = timeMs(() => {
        const part = tryPartitionedLayout({
          adapter,
          previousNodes: lastNodes,
          previousIndex: lastIndex,
          dirtyPaths: [targetFileA, targetFileB],
          options: { aggregationThreshold: 28 },
          debug: (stage, ctx) => {
            debugEvents.push({ stage, ctx });
          },
        });
        if (part?.attempt.applied) {
          appliedCount++;
          lastNodes = part.nodes as LayoutPointV2[];
          lastIndex = part.index as Map<string, LayoutPointV2>;
        } else {
          // Fallback full layout (should not happen)
          const layout = layoutHierarchicalV2(adapter);
          lastNodes = layout.nodes as LayoutPointV2[];
          lastIndex = layout.nodeIndex as Map<string, LayoutPointV2>;
        }
      });
      partTimes.push(dur);
    }

    expect(appliedCount).toBe(loops);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    const fullAvg = avg(fullTimes);
    const partAvg = avg(partTimes);
    const improvementPct = fullAvg > 0 ? ((fullAvg - partAvg) / fullAvg) * 100 : 0;

    // Assertion: >=25% improvement (acceptance threshold)
    expect(improvementPct).toBeGreaterThanOrEqual(25);

    // Guard: partition path must not be drastically slower
    expect(partAvg).toBeLessThan(fullAvg);

    // Provide debug output (not part of assertion threshold besides improvement)
    console.log('[PERF-2][Benchmark]', {
      fullAvg: fullAvg.toFixed(3),
      partAvg: partAvg.toFixed(3),
      improvementPct: improvementPct.toFixed(2),
      loops,
      appliedCount,
    });
  }, 20000);
});
