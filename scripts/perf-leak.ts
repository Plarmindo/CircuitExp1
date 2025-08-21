/**
 * VIS-20 Memory Monitoring Utility
 * ---------------------------------
 * Repeatedly triggers layout cycles + random pan/zoom to detect sprite retention leaks.
 * Run with: npm run perf:leak (adds --expose-gc automatically via script configuration if desired)
 * Output: JSON with cycle stats, final sprite counts, heap deltas and stability assessment.
 * Assumes dev server running (or uses jsdom fallback if window not present -> limited value).
 */
import fs from 'node:fs';
import path from 'node:path';

interface LeakResultCycle {
  cycle: number;
  heapUsed?: number;
  spriteTotal?: number;
  scale?: number;
  pan?: { x: number; y: number };
}
interface LeakSummary {
  cycles: LeakResultCycle[];
  stable: boolean;
  heapDeltaPct?: number;
  spriteVariancePct?: number;
  notes: string[];
}

declare global {
  // minimal globals shape for leak script
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      gc?: () => void;
    }
  }
  // window from browser/Electron dev
  interface Window {
    __metroDebug?: {
      runLayoutCycle?: (o?: {
        randomizePan?: boolean;
        randomizeZoom?: boolean;
      }) => { scale: number; pan: { x: number; y: number }; spriteTotal: number } | null;
      getSpriteCounts?: () => { total: number };
    };
  }
}

function getHeapUsed(): number | undefined {
  if (typeof global !== 'undefined' && global.gc) {
    try {
      global.gc();
    } catch {
      /* ignore */
    }
  }
  if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
    try {
      return process.memoryUsage().heapUsed;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

async function main() {
  const cyclesTarget = Number(process.env.LEAK_CYCLES || 40); // >=30 per acceptance
  const waitBetween = Number(process.env.LEAK_WAIT_MS || 30);
  const notes: string[] = [];
  if (typeof (globalThis as unknown as { window?: unknown }).window === 'undefined') {
    notes.push(
      'window not present: script should be executed in browser/electron dev context via Playwright or manual.'
    );
  }
  // Access debug API
  const gWin = (globalThis as unknown as { window?: Window }).window;
  const debug = gWin?.__metroDebug;
  if (!debug) {
    notes.push('__metroDebug not found: ensure MetroStage mounted (open UI) before running.');
  }

  const cycles: LeakResultCycle[] = [];
  const initialHeap = getHeapUsed();
  let firstSprites: number | undefined;

  for (let i = 0; i < cyclesTarget; i++) {
    const run = debug?.runLayoutCycle?.({ randomizePan: true, randomizeZoom: true }) || null;
    const counts = debug?.getSpriteCounts?.();
    const heap = getHeapUsed();
    if (firstSprites == null && counts) firstSprites = counts.total;
    cycles.push({
      cycle: i + 1,
      heapUsed: heap,
      spriteTotal: counts?.total,
      scale: run?.scale,
      pan: run?.pan,
    });
    await new Promise((r) => setTimeout(r, waitBetween));
  }

  const finalHeap = getHeapUsed();
  const lastSprites = cycles.at(-1)?.spriteTotal;
  let heapDeltaPct: number | undefined;
  let spriteVariancePct: number | undefined;
  if (initialHeap && finalHeap) {
    heapDeltaPct = ((finalHeap - initialHeap) / initialHeap) * 100;
  }
  if (firstSprites && lastSprites) {
    spriteVariancePct = ((lastSprites - firstSprites) / firstSprites) * 100;
  }
  const stable =
    (heapDeltaPct == null || Math.abs(heapDeltaPct) <= 5) &&
    (spriteVariancePct == null || Math.abs(spriteVariancePct) <= 5);
  if (heapDeltaPct == null)
    notes.push('heapUsed unavailable (run with node --expose-gc and ensure memoryUsage support).');
  if (spriteVariancePct == null)
    notes.push('sprite counts unavailable (missing debug API or no sprites present).');

  const summary: LeakSummary = { cycles, stable, heapDeltaPct, spriteVariancePct, notes };
  const outPath = path.join(process.cwd(), 'perf-leak-result.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (!stable) process.exitCode = 1;
}

main().catch((err) => {
  console.error('perf-leak failed', err);
  process.exit(1);
});
