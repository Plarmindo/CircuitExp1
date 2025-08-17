#!/usr/bin/env node
/**
 * VIS-12 Large Tree Stress Script
 * Generates synthetic tree data (not hitting filesystem) and measures:
 *  - Generation time
 *  - Adapter apply time
 *  - Layout v2 time
 *  - RSS snapshots (before/apply/layout/after) + peak
 *  - Sprite counts (theoretical stations + connection lines, matching stage rules)
 * Params via CLI flags:
 *  --depth <n>
 *  --breadth <n>  (directories per directory)
 *  --filesPerDir <n>
 *  --aggregationThreshold <n> (optional override for layout)
 * Output: single JSON to stdout
 */
import { createGraphAdapter } from '../src/visualization/graph-adapter';
import { layoutHierarchicalV2, type LayoutPointV2, type LayoutResultV2 } from '../src/visualization/layout-v2';
import type { ScanNode } from '../src/shared/scan-types';

interface Args { depth: number; breadth: number; filesPerDir: number; aggregationThreshold?: number; }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const arg = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i+1] : undefined; };
  const num = (v: string | undefined, d: number) => v ? Number(v) : d;
  const depth = num(arg('--depth'), 4);
  const breadth = num(arg('--breadth'), 6);
  const filesPerDir = num(arg('--filesPerDir'), 4);
  const aggregationThreshold = arg('--aggregationThreshold') ? Number(arg('--aggregationThreshold')) : undefined;
  return { depth, breadth, filesPerDir, aggregationThreshold };
}

interface SyntheticNode { path: string; name: string; kind: 'dir'|'file'; depth: number; sizeBytes?: number; mtimeMs?: number; }

function generateTree(args: Args) {
  const t0 = performance.now();
  const nodes: SyntheticNode[] = [];
  const { depth, breadth, filesPerDir } = args;
  function visit(currentPath: string, currentDepth: number) {
    if (currentDepth > depth) return;
    if (currentDepth === 0) {
      nodes.push({ path: currentPath, name: currentPath.split('/') .pop() || currentPath, kind: 'dir', depth: 0 });
    }
    if (currentDepth === depth) return;
    for (let i = 0; i < breadth; i++) {
      const dirPath = `${currentPath}/d${currentDepth}-${i}`;
      nodes.push({ path: dirPath, name: `d${currentDepth}-${i}`, kind: 'dir', depth: currentDepth + 1 });
      visit(dirPath, currentDepth + 1);
      for (let f = 0; f < filesPerDir; f++) {
        const filePath = `${dirPath}/f${f}.txt`;
        nodes.push({ path: filePath, name: `f${f}.txt`, kind: 'file', depth: currentDepth + 2 });
      }
    }
  }
  visit('/root', 0);
  const t1 = performance.now();
  return { nodes, genMs: t1 - t0 };
}

async function main() {
  const args = parseArgs();
  const { nodes, genMs } = generateTree(args);
  const adapter = createGraphAdapter();
  const rssBefore = process.memoryUsage().rss;
  let rssPeak = rssBefore;
  const trackPeak = () => { const r = process.memoryUsage().rss; if (r > rssPeak) rssPeak = r; return r; };
  const tApply0 = performance.now();
  const scanNodes: ScanNode[] = nodes.map(n => ({
    name: n.name,
    path: n.path,
    kind: n.kind,
    depth: n.depth,
    sizeBytes: n.sizeBytes,
    mtimeMs: n.mtimeMs,
  }));
  adapter.applyDelta(scanNodes);
  const rssAfterApply = trackPeak();
  const tApply1 = performance.now();
  const applyMs = tApply1 - tApply0;
  const tLayout0 = performance.now();
  const layout = layoutHierarchicalV2(adapter, args.aggregationThreshold ? { aggregationThreshold: args.aggregationThreshold } : {});
  const rssAfterLayout = trackPeak();
  const tLayout1 = performance.now();
  const layoutMs = tLayout1 - tLayout0;
  // Compute theoretical render sprite counts (stations + connection lines) similar to stage rules
  let lineCount = 0;
  let aggregatedPoints = 0;
  for (const lp of layout.nodes as LayoutPointV2[]) {
    if (lp.aggregated) { aggregatedPoints++; continue; } // aggregated synthetic has no direct line
    const node = adapter.getNode(lp.path);
    if (!node || !node.parentPath) continue;
    const parentPoint = (layout as LayoutResultV2).nodeIndex.get(node.parentPath) as LayoutPointV2 | undefined;
    if (!parentPoint || parentPoint.aggregated) continue; // skip lines from aggregated placeholder
    lineCount++;
  }
  const stationCount = layout.nodes.length;
  const rssAfter = trackPeak();
  const result = {
    meta: { timestamp: new Date().toISOString(), nodeVersion: process.version },
    params: args,
    counts: { nodes: adapter.size(), layoutPoints: layout.nodes.length, aggregatedPoints },
    timingsMs: { generation: genMs, apply: applyMs, layout: layoutMs },
    memory: { rssBefore, rssAfterApply, rssAfterLayout, rssAfter, peakRss: rssPeak, rssDelta: rssAfter - rssBefore },
    render: { stationCount, lineCount, totalSprites: stationCount + lineCount, spriteCountNote: 'Counts are theoretical (stage parity) — no headless Pixi instantiation performed.' },
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(err => { console.error(err); process.exit(1); });
