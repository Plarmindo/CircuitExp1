// Stage modularization: shared types & interfaces extracted from monolithic metro-stage.tsx
import type { LayoutPointV2 } from '../layout-v2';

export interface FastAppendResult { usedFastPath: boolean; reason: string; appended?: number }

export interface MetroDebugApi {
  getScale: () => number;
  getNodes: () => { path: string; x: number; y: number; aggregated?: boolean }[];
  pickFirstNonAggregated: () => { path: string; clientX: number; clientY: number } | null;
  getPan?: () => { x: number; y: number };
  getReusePct?: () => number;
  getBenchResult?: () => { baselineAvg: number; culledAvg: number; improvementPct: number; reusePct: number } | null;
  getLayoutCallCount?: () => number;
  getFastPathUses?: () => number;
  getLastFastPathAttempt?: () => { stage: string; ctx?: Record<string, unknown> } | null;
  appendNodesTest?: (nodes: Array<{ path: string; name: string; kind: 'file' | 'dir'; depth: number }>) => { usedFastPath: boolean; lastAttempt: { stage: string; ctx?: Record<string, unknown> } | null };
  fastAppend?: (parentPath: string, count: number) => FastAppendResult;
  exportDataUrl?: (transparent?: boolean) => { dataUrl: string; width: number; height: number; size: number; transparent: boolean } | null;
}

export interface RouteCommand { type: string; [k: string]: unknown }

export type LayoutNodeLite = Pick<LayoutPointV2, 'path' | 'x' | 'y' | 'depth'> & { aggregated?: boolean; aggregatedChildrenPaths?: string[]; aggregatedExpanded?: boolean };
