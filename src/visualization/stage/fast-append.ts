// Modular fast-append helper (PERF-1) extracted from metro-stage to reduce complexity.
// Provides the same semantics exposed previously via __metroDebug.fastAppend.
import type { MutableRefObject } from 'react';
import { layoutHierarchicalV2, type LayoutPointV2 } from '../layout-v2';
import { tryIncrementalAppend } from '../incremental-layout';
import type { GraphAdapter } from '../graph-adapter';

export interface FastAppendDeps {
  adapter: GraphAdapter;
  lastLayoutNodesRef: MutableRefObject<LayoutPointV2[]>;
  layoutIndexRef: MutableRefObject<Map<string, LayoutPointV2>>;
  expandedAggregationsRef: MutableRefObject<Set<string>>;
  aggregationThresholdRef: MutableRefObject<number>;
  fastPathUseCountRef: MutableRefObject<number>;
  lastFastPathAttemptRef: MutableRefObject<{ stage: string; ctx?: Record<string, unknown> } | null>;
}

export interface FastAppendResult {
  usedFastPath: boolean;
  reason: string;
  appended?: number;
}

export function makeFastAppend(deps: FastAppendDeps) {
  const {
    adapter,
    lastLayoutNodesRef,
    layoutIndexRef,
    expandedAggregationsRef,
    aggregationThresholdRef,
    fastPathUseCountRef,
    lastFastPathAttemptRef,
  } = deps;

  return function fastAppend(parentPath: string, count: number): FastAppendResult {
    if (!adapter) return { usedFastPath: false, reason: 'no-adapter' };
    if (count <= 0) return { usedFastPath: false, reason: 'no-count' };

    // Ensure initial layout exists before attempting fast path.
    if (!lastLayoutNodesRef.current.length) {
      const full = layoutHierarchicalV2(adapter, {
        expandedAggregations: expandedAggregationsRef.current,
        aggregationThreshold: aggregationThresholdRef.current,
      });
      lastLayoutNodesRef.current = full.nodes as LayoutPointV2[];
      layoutIndexRef.current = full.nodeIndex as Map<string, LayoutPointV2>;
    }
    const parentNode = adapter.getNode(parentPath);
    if (!parentNode) return { usedFastPath: false, reason: 'missing-parent' };

    const prevNodes = lastLayoutNodesRef.current.slice();
    const prevIndex = new Map(layoutIndexRef.current);
    const depth = parentNode.depth + 1;
    const stamp = Date.now();
    const newNodes: Array<{ path: string; name: string; kind: 'dir'; depth: number }> = [];
    for (let i = 0; i < count; i++) {
      const path = `${parentPath}/zfast-${stamp}-${i}`; // 'z' keeps lexical tail ordering
      newNodes.push({ path, name: `zfast-${i}`, kind: 'dir', depth });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter.applyDelta(newNodes as any);

    // Explicit loose typing to avoid TS 'never' narrowing after conditional branches.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let attempt: any = null;
    const fast = tryIncrementalAppend({
      adapter,
      addedPaths: newNodes.map((n) => n.path),
      parentPath,
      previousNodes: prevNodes,
      previousIndex: prevIndex,
      options: {
        horizontalSpacing: 140,
        verticalSpacing: 90,
        spacingThreshold: 6,
        spacingGrowthRate: 0.5,
        maxSpacingFactor: 3,
        aggregationThreshold: aggregationThresholdRef.current,
      },
      debug: (stage, ctx) => {
        attempt = { stage, ctx };
      },
    });
    lastFastPathAttemptRef.current = attempt;
    const stageName: string = attempt?.stage || 'unknown';
    if (fast) {
      fastPathUseCountRef.current++;
      lastLayoutNodesRef.current = fast.nodes as LayoutPointV2[];
      layoutIndexRef.current = fast.index as Map<string, LayoutPointV2>;
      return { usedFastPath: true, reason: stageName, appended: newNodes.length };
    }
    // Fallback full layout keeps state consistent.
    const full = layoutHierarchicalV2(adapter, {
      expandedAggregations: expandedAggregationsRef.current,
      aggregationThreshold: aggregationThresholdRef.current,
    });
    lastLayoutNodesRef.current = full.nodes as LayoutPointV2[];
    layoutIndexRef.current = full.nodeIndex as Map<string, LayoutPointV2>;
    return { usedFastPath: false, reason: stageName };
  };
}
