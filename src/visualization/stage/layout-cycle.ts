import type { GraphAdapter } from '../graph-adapter';
import { layoutHierarchicalV2, type LayoutPointV2, type LayoutBBox } from '../layout-v2';
import { tryIncrementalAppend } from '../incremental-layout';
import { tryPartitionedLayout } from './partitioned-layout';

export interface RunLayoutCycleParams {
  adapter: GraphAdapter;
  pendingDelta: { path: string }[];
  lastLayoutNodes: LayoutPointV2[];
  lastLayoutIndex: Map<string, LayoutPointV2>;
  expandedAggregations: Set<string>;
  aggregationThreshold: number;
  lastFastPathAttemptRef: { current: number };
  layoutCallCountRef: { current: number };
  partitionAppliedCountRef?: { current: number };
  partitionSkipCountRef?: { current: number };
  disablePartition?: boolean;
}

export interface RunLayoutCycleResult {
  nodes: LayoutPointV2[];
  index: Map<string, LayoutPointV2>;
  durationMs: number;
  usedFastPath: boolean;
  pendingConsumed: boolean;
  partitionApplied?: boolean;
  partitionSkippedReason?: string;
  bbox: LayoutBBox;
}

/**
 * Encapsulates decision logic for performing a layout cycle.
 * Order of attempts:
 *  1. Fast append path (PERF-1)
 *  2. Partitioned incremental layout (PERF-2) if fast path not used
 *  3. Full layout recompute
 */
export function runLayoutCycle(params: RunLayoutCycleParams): RunLayoutCycleResult {
  const {
    adapter,
    pendingDelta,
    lastLayoutNodes,
    lastLayoutIndex,
    expandedAggregations,
    aggregationThreshold,
    lastFastPathAttemptRef,
    layoutCallCountRef,
    partitionAppliedCountRef,
  partitionSkipCountRef,
  disablePartition
  } = params;

  const t0 = performance.now();
  let nodes = lastLayoutNodes;
  let index = lastLayoutIndex;
  let usedFastPath = false;
  let pendingConsumed = false;
  let partitionApplied: boolean | undefined;
  let partitionSkippedReason: string | undefined;

  layoutCallCountRef.current++;

  // Attempt fast append path (PERF-1) via incremental append util if single parent additions
  if (pendingDelta.length) {
    // Fast path constraint: all pending nodes share a parent
    const parentPaths = new Set<string>();
    for (const d of pendingDelta) {
      const parentPath = d.path.split('/').slice(0, -1).join('/') || '';
      parentPaths.add(parentPath);
      if (parentPaths.size > 1) break;
    }
    if (parentPaths.size === 1) {
      const parentPath = [...parentPaths][0];
      // Gather added paths for incremental append
      const added = pendingDelta.map(d => d.path);
      const fast = tryIncrementalAppend({
        adapter,
        addedPaths: added,
        parentPath,
        previousNodes: nodes.slice(),
        previousIndex: new Map(index),
        options: {
          horizontalSpacing: 140,
          verticalSpacing: 90,
          spacingThreshold: 6,
          spacingGrowthRate: 0.5,
          maxSpacingFactor: 3,
          aggregationThreshold,
        },
  debug: () => { /* capture attempt if needed later */ },
      });
      lastFastPathAttemptRef.current++;
      if (fast) {
        nodes = fast.nodes as LayoutPointV2[];
        index = fast.index as Map<string, LayoutPointV2>;
        usedFastPath = true;
        pendingConsumed = true;
      }
    }
  }

  // Partitioned layout attempt (PERF-2)
  if (!disablePartition && !usedFastPath && pendingDelta.length) {
    try {
      const part = tryPartitionedLayout({
        adapter,
        previousNodes: nodes,
        previousIndex: index,
        dirtyPaths: pendingDelta.map(d => d.path),
        options: { aggregationThreshold },
      });
      if (part?.attempt.applied) {
        nodes = part.nodes as LayoutPointV2[];
        index = part.index as Map<string, LayoutPointV2>;
        partitionApplied = true;
        pendingConsumed = true;
        if (partitionAppliedCountRef) partitionAppliedCountRef.current++;
      } else if (part) {
        partitionSkippedReason = part.attempt.reason || 'unknown';
        if (partitionSkipCountRef) partitionSkipCountRef.current++;
      }
    } catch {
      partitionSkippedReason = 'error';
      if (partitionSkipCountRef) partitionSkipCountRef.current++;
    }
  }

  // Full layout fallback
  let bbox: LayoutBBox | null = null;
  if (!usedFastPath && !partitionApplied) {
    const layout = layoutHierarchicalV2(adapter, { expandedAggregations, aggregationThreshold });
    nodes = layout.nodes as LayoutPointV2[];
    index = layout.nodeIndex as Map<string, LayoutPointV2>;
    bbox = layout.bbox;
    pendingConsumed = true;
  }

  // If we didn't set bbox yet (fast/partition path), compute incremental bbox by scanning all nodes (O(n))
  if (!bbox) {
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity; const minY = 0;
    for (const p of nodes) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
    if (!nodes.length) { minX = 0; maxX = 0; maxY = 0; }
    // approximate width/height using last known spacing (fallback 140/90 if none)
    const spacingX = nodes[0]?.__effSpacing || 140;
    const spacingY = 90;
    bbox = { minX, minY, maxX, maxY, width: (maxX - minX) + spacingX, height: (maxY - minY) + spacingY };
  }

  const durationMs = performance.now() - t0;
  return { nodes, index, durationMs, usedFastPath, pendingConsumed, partitionApplied, partitionSkippedReason, bbox };
}
