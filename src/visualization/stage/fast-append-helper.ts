// Fast append (PERF-1) orchestrator decoupled from metro-stage monolith
import { tryIncrementalAppend } from '../incremental-layout';
import type { LayoutPointV2 } from '../layout-v2';
import type { GraphAdapter } from '../graph-adapter';

export interface FastAppendOptions {
  adapter: GraphAdapter;
  parentPath: string;
  count: number;
  aggregationThreshold: number;
  previousNodes: LayoutPointV2[];
  previousIndex: Map<string, LayoutPointV2>;
  updateState: (nodes: LayoutPointV2[], index: Map<string, LayoutPointV2>) => void;
  incrementFastPath: () => void;
}

export function performFastAppend(opts: FastAppendOptions) {
  const { adapter, parentPath, count, aggregationThreshold, previousNodes, previousIndex, updateState, incrementFastPath } = opts;
  if (count <= 0) return { usedFastPath: false, reason: 'no-count' };
  const parent = adapter.getNode(parentPath);
  if (!parent) return { usedFastPath: false, reason: 'missing-parent' };
  const depth = parent.depth + 1;
  const stamp = Date.now();
  const newNodes: Array<{ path: string; name: string; kind: 'dir'; depth: number }> = [];
  for (let i=0;i<count;i++) {
    const path = `${parentPath}/zfast-${stamp}-${i}`;
    newNodes.push({ path, name: `zfast-${i}`, kind: 'dir', depth });
  }
  // Apply before attempting fast layout
  adapter.applyDelta(newNodes as any);
  let attempt: { stage: string; ctx?: Record<string, unknown> } | null = null;
  const fast = tryIncrementalAppend({
    adapter,
    addedPaths: newNodes.map(n => n.path),
    parentPath,
    previousNodes,
    previousIndex,
    options: { horizontalSpacing: 140, verticalSpacing: 90, spacingThreshold: 6, spacingGrowthRate: 0.5, maxSpacingFactor: 3, aggregationThreshold },
    debug: (stage, ctx) => { attempt = { stage, ctx }; }
  });
  if (fast) {
    incrementFastPath();
    updateState(fast.nodes as any, fast.index as any);
    return { usedFastPath: true, reason: attempt?.stage || 'success', appended: newNodes.length };
  }
  return { usedFastPath: false, reason: attempt?.stage || 'bail-unknown' };
}
