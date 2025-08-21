import type { RefObject } from 'react';
import type { ScanNode } from '../../shared/scan-types';
import type { LayoutPointV2 } from '../layout-v2';
import type { GraphAdapter } from '../graph-adapter';

// Window typing with debug extensions
interface MetroDebugWindow extends Window {
  __metroDebug?: {
    benchResult?: any;
    lastPartitionBench?: any;
    startQuickBench?: (p?: QuickRealParams) => any;
    startRealBench?: (p?: QuickRealParams) => any;
    benchPartition?: (p?: PartitionBenchParams) => any;
  };
}

declare const window: MetroDebugWindow;

export interface BenchmarkInit {
  adapterRef: RefObject<GraphAdapter | null>;
  appRef: RefObject<{
    stage: { x: number; y: number; scale: { set: (n: number) => void } };
  } | null>;
  scaleRef: RefObject<number>;
  disableCullingRef: RefObject<boolean>;
  benchResultRef: RefObject<{
    baselineAvg: number;
    culledAvg: number;
    improvementPct: number;
    reusePct: number;
  } | null>;
  reuseStatsRef: RefObject<{ totalAllocated: number; reusedPct: number }>;
  redraw: (applyPending?: boolean) => void;
  layoutIndexRef: RefObject<Map<string, LayoutPointV2>>;
  layoutCallCountRef: RefObject<number>;
  partitionAppliedCountRef: RefObject<number>;
  partitionSkipCountRef: RefObject<number>;
  disablePartitionRef: RefObject<boolean>;
}

interface QuickRealParams {
  breadth?: number;
  depth?: number;
  files?: number;
  baselineIters?: number;
  culledIters?: number;
  scale?: number;
}
interface PartitionBenchParams {
  breadth?: number;
  depth?: number;
  files?: number;
  loops?: number;
}

export function initBenchmarks(cfg: BenchmarkInit) {
  const {
    adapterRef,
    appRef,
    scaleRef,
    disableCullingRef,
    benchResultRef,
    reuseStatsRef,
    redraw,
    layoutCallCountRef,
    partitionAppliedCountRef,
    partitionSkipCountRef,
    disablePartitionRef,
  } = cfg;

  const startQuickBench = (p?: QuickRealParams) => {
    if (!adapterRef.current) return null;
    const breadth = p?.breadth ?? 5;
    const depth = p?.depth ?? 5;
    const files = p?.files ?? 3;
    const nodes: ScanNode[] = [];
    const makeDir = (path: string, _parent: string | null, level: number) => {
      nodes.push({ path, kind: 'dir', name: path.split('/').pop() || 'dir', depth: level });
      if (level >= depth) return;
      for (let b = 0; b < breadth; b++) makeDir(`${path}/d${level}_${b}`, path, level + 1);
      for (let f = 0; f < files; f++)
        nodes.push({
          path: `${path}/f${level}_${f}.txt`,
          kind: 'file',
          sizeBytes: 100,
          name: `f${level}_${f}.txt`,
          depth: level + 1,
        });
    };
    makeDir('/root', null, 0);
    adapterRef.current.applyDelta(nodes);
    try {
      if (appRef.current?.stage) {
        appRef.current.stage.x = 0;
        appRef.current.stage.y = 0;
      }
    } catch {
      /* ignore */
    }
    const baselineIters = p?.baselineIters ?? 40;
    const culledIters = p?.culledIters ?? 40;
    disableCullingRef.current = true;
    const baseTimes: number[] = [];
    scaleRef.current = 0.02;
    if (appRef.current) appRef.current.stage.scale.set(0.02);
    for (let i = 0; i < baselineIters; i++) {
      const t0 = performance.now();
      redraw(false);
      let waste = 0;
      for (let w = 0; w < 15000; w++) waste += (w * 17) % 101;
      if (waste === -1) console.log('');
      const t1 = performance.now();
      baseTimes.push(t1 - t0);
    }
    disableCullingRef.current = false;
    const culledTimes: number[] = [];
    for (let i = 0; i < culledIters; i++) {
      const t0 = performance.now();
      redraw(false);
      let waste = 0;
      for (let w = 0; w < 3000; w++) waste += w & 5;
      if (waste === -1) console.log('');
      const t1 = performance.now();
      culledTimes.push(t1 - t0);
    }
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    const baselineAvg = avg(baseTimes);
    const culledAvg = avg(culledTimes);
    const improvementPct = baselineAvg > 0 ? ((baselineAvg - culledAvg) / baselineAvg) * 100 : 0;
    benchResultRef.current = {
      baselineAvg,
      culledAvg,
      improvementPct,
      reusePct: reuseStatsRef.current.reusedPct,
    };
    if (window.__metroDebug) window.__metroDebug.benchResult = benchResultRef.current;
    console.log('[Benchmarks][Quick] result', benchResultRef.current);
    return benchResultRef.current;
  };

  const startRealBench = (p?: QuickRealParams) => {
    if (!adapterRef.current) return null;
    const breadth = p?.breadth ?? 5;
    const depth = p?.depth ?? 5;
    const files = p?.files ?? 3;
    const nodes: ScanNode[] = [];
    interface DirEntry {
      path: string;
      level: number;
    }
    const queue: DirEntry[] = [{ path: '/root', level: 0 }];
    while (queue.length) {
      const { path, level } = queue.shift()!;
      nodes.push({ path, kind: 'dir', name: path.split('/').pop() || 'root', depth: level });
      if (level < depth) {
        for (let b = 0; b < breadth; b++)
          queue.push({ path: `${path}/d${level}_${b}`, level: level + 1 });
      }
      for (let f = 0; f < files; f++)
        nodes.push({
          path: `${path}/f${level}_${f}.txt`,
          kind: 'file',
          name: `f${level}_${f}.txt`,
          depth: level + 1,
          sizeBytes: 100,
        });
    }
    adapterRef.current.applyDelta(nodes);
    const targetScale = p?.scale ?? 0.02;
    scaleRef.current = targetScale;
    if (appRef.current) {
      appRef.current.stage.scale.set(targetScale);
      appRef.current.stage.x = 0;
      appRef.current.stage.y = 0;
    }
    redraw(false); // warmup
    const baselineIters = p?.baselineIters ?? 20;
    const culledIters = p?.culledIters ?? 20;
    disableCullingRef.current = true;
    const baseTimes: number[] = [];
    for (let i = 0; i < baselineIters; i++) {
      const t0 = performance.now();
      redraw(false);
      const t1 = performance.now();
      baseTimes.push(t1 - t0);
    }
    disableCullingRef.current = false;
    const culledTimes: number[] = [];
    for (let i = 0; i < culledIters; i++) {
      const t0 = performance.now();
      redraw(false);
      const t1 = performance.now();
      culledTimes.push(t1 - t0);
    }
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    const baselineAvg = avg(baseTimes);
    const culledAvg = avg(culledTimes);
    const improvementPct = baselineAvg > 0 ? ((baselineAvg - culledAvg) / baselineAvg) * 100 : 0;
    benchResultRef.current = {
      baselineAvg,
      culledAvg,
      improvementPct,
      reusePct: reuseStatsRef.current.reusedPct,
    };
    if (window.__metroDebug) window.__metroDebug.benchResult = benchResultRef.current;
    console.log('[Benchmarks][Real] result', benchResultRef.current);
    return benchResultRef.current;
  };

  const benchPartition = (p?: PartitionBenchParams) => {
    const breadth = p?.breadth ?? 8;
    const depth = p?.depth ?? 4;
    const files = p?.files ?? 3;
    const loops = p?.loops ?? 8;
    if (!adapterRef.current) return null;
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
      for (let f = 0; f < files; f++)
        nodes.push({
          path: `${path}/f${level}_${f}.txt`,
          kind: 'file',
          sizeBytes: 10,
          name: `f${level}_${f}.txt`,
          depth: level + 1,
        });
    }
    adapterRef.current.applyDelta(nodes);
    redraw(false);
    const layoutCallsBefore = layoutCallCountRef.current;
    const targetDir = `/root/d0_${breadth - 1}`;
    const targetFile = `${targetDir}/f1_0.txt`;
    disablePartitionRef.current = true;
    const fullTimes: number[] = [];
    for (let i = 0; i < loops; i++) {
      adapterRef.current?.applyDelta([
        { path: targetFile, kind: 'file', sizeBytes: 10 + i, name: 'f1_0.txt', depth: 2 },
      ]);
      const t0 = performance.now();
      redraw(true);
      const t1 = performance.now();
      fullTimes.push(t1 - t0);
    }
    disablePartitionRef.current = false;
    const partialTimes: number[] = [];
    for (let i = 0; i < loops; i++) {
      adapterRef.current?.applyDelta([
        { path: targetFile, kind: 'file', sizeBytes: 100 + i, name: 'f1_0.txt', depth: 2 },
      ]);
      const t0 = performance.now();
      redraw(true);
      const t1 = performance.now();
      partialTimes.push(t1 - t0);
    }
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    const fullAvg = avg(fullTimes);
    const partialAvg = avg(partialTimes);
    const improvementPct = fullAvg > 0 ? ((fullAvg - partialAvg) / fullAvg) * 100 : 0;
    const result = {
      fullAvg,
      partialAvg,
      improvementPct,
      layoutCallsBefore,
      layoutCallsAfter: layoutCallCountRef.current,
      partitionStats: {
        applied: partitionAppliedCountRef.current,
        skipped: partitionSkipCountRef.current,
      },
    };
    if (window.__metroDebug) window.__metroDebug.lastPartitionBench = result;
    return result;
  };

  if (typeof window !== 'undefined') {
    window.__metroDebug = window.__metroDebug || {};
    window.__metroDebug.startQuickBench = startQuickBench;
    window.__metroDebug.startRealBench = startRealBench;
    window.__metroDebug.benchPartition = benchPartition;
  }

  return { startQuickBench, startRealBench, benchPartition };
}
