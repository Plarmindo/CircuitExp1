import type { Application, Graphics, Text } from 'pixi.js';
import type { MutableRefObject } from 'react';
import type { LayoutPointV2 } from '../layout-v2';
import type { ScanNode } from '../../shared/scan-types';

export interface MetroDebugWindow {
  getScale: () => number;
  getLayoutCallCount: () => number;
  getFastPathUses: () => number;
  getLastFastPathAttempt: () => { stage: string; ctx?: Record<string, unknown> } | null;
  getLastPartitionAttempt: () => { stage: string; ctx?: Record<string, unknown> } | null;
  getPartitionStats: () => { applied: number; skipped: number; lastAttempt: { stage: string; ctx?: Record<string, unknown> } | null };
  setDisablePartition: (v: boolean) => void;
  getAggregationThreshold: () => number;
  setAggregationThreshold: (n: number) => void;
  getReusePct: () => number;
  getBenchResult: () => { baselineAvg: number; culledAvg: number; improvementPct: number; reusePct: number } | null;
  getNodes: () => Array<{ path: string; x: number; y: number; aggregated?: boolean }>;
  fastAppend: (nodes: Array<{ path: string; name: string; kind: 'file' | 'dir'; depth: number }>) => unknown;
  appendNodesTest: (nodes: Array<{ path: string; name: string; kind: 'file' | 'dir'; depth: number }>) => { usedFastPath: boolean; lastAttempt: { stage: string; ctx?: Record<string, unknown> } | null };
  runLayoutCycle: (opts?: { randomizePan?: boolean; randomizeZoom?: boolean }) => { scale: number; pan: { x: number; y: number }; spriteTotal: number } | null;
  getSpriteCounts: () => { nodes: number; lines: number; badges: number; labels: number; total: number };
  getViewport: () => { x: number; y: number; scale: number } | null;
  panViewport: (dx: number, dy: number) => boolean;
  centerViewportAt: (worldX: number, worldY: number) => boolean;
  [key: string]: unknown;
}

declare global {
  interface Window {
    __metroDebug?: MetroDebugWindow;
  }
}

export interface DebugInitRefs {
  scaleRef: MutableRefObject<number>;
  layoutIndexRef: MutableRefObject<Map<string, LayoutPointV2>>;
  fallbackNodesRef: MutableRefObject<
    Array<{ path: string; x: number; y: number; aggregated?: boolean }>
  >;
  adapterRef: MutableRefObject<{
    applyDelta: (nodes: ScanNode[]) => unknown;
    getNode: (p: string) => ScanNode | undefined;
  } | null>;
  pendingDelta: MutableRefObject<ScanNode[]>;
  fastPathUseCountRef: MutableRefObject<number>;
  lastFastPathAttemptRef: MutableRefObject<{ stage: string; ctx?: Record<string, unknown> } | null>;
  lastPartitionAttemptRef: MutableRefObject<{
    stage: string;
    ctx?: Record<string, unknown>;
  } | null>;
  partitionAppliedCountRef: MutableRefObject<number>;
  partitionSkipCountRef: MutableRefObject<number>;
  disablePartitionRef: MutableRefObject<boolean>;
  // (not yet used in this extracted subset but reserved for future modular moves)
  lastLayoutNodesRef: MutableRefObject<LayoutPointV2[]>;
  expandedAggregationsRef: MutableRefObject<Set<string>>;
  aggregationThresholdRef: MutableRefObject<number>;
  reuseStatsRef: MutableRefObject<{ totalAllocated: number; reusedPct: number }>;
  nodeColorRef: MutableRefObject<Map<string, number>>;
  spriteNodes: MutableRefObject<Map<string, Graphics>>;
  spriteLines: MutableRefObject<Map<string, Graphics>>;
  spriteBadges: MutableRefObject<Map<string, Text>>;
  spriteLabels: MutableRefObject<Map<string, Text>>;
  layoutCallCountRef: MutableRefObject<number>;
  benchResultRef: MutableRefObject<{
    baselineAvg: number;
    culledAvg: number;
    improvementPct: number;
    reusePct: number;
  } | null>;
  disableCullingRef: MutableRefObject<boolean>;
  appRef: MutableRefObject<Application | null>;
  fastAppend: (
    nodes: Array<{ path: string; name: string; kind: 'file' | 'dir'; depth: number }>
  ) => unknown;
  redraw: (applyPending?: boolean, opts?: { skipLayout?: boolean }) => void;
  // Newly added for legacy debug parity
  lastLayoutMsRef: MutableRefObject<number>;
  contextLostRef: MutableRefObject<boolean>;
  contextLostOverlayRef: MutableRefObject<HTMLDivElement | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
}

/** Minimal first extraction: attach lightweight getters; heavier benchmark & partition helpers remain inline until next step. */
export function initDebugAPI(r: DebugInitRefs) {
  if (typeof window === 'undefined') return;
  const prev = window.__metroDebug || {};
  const {
    scaleRef,
    layoutIndexRef,
    fallbackNodesRef,
    /* adapterRef unused here */ pendingDelta,
    fastPathUseCountRef,
    lastFastPathAttemptRef,
    lastPartitionAttemptRef,
    partitionAppliedCountRef,
    partitionSkipCountRef,
    disablePartitionRef,
    /* lastLayoutNodesRef, expandedAggregationsRef (unused) */ aggregationThresholdRef,
    reuseStatsRef,
    nodeColorRef,
    spriteNodes,
    spriteLines,
    spriteBadges,
    spriteLabels,
    layoutCallCountRef,
    benchResultRef,
    appRef,
    fastAppend,
    redraw,
    lastLayoutMsRef,
    contextLostRef,
    contextLostOverlayRef,
    containerRef,
  } = r;
  window.__metroDebug = {
    ...prev,
    getScale: () => scaleRef.current,
    getLayoutCallCount: () => layoutCallCountRef.current,
    getFastPathUses: () => fastPathUseCountRef.current,
    getLastFastPathAttempt: () => lastFastPathAttemptRef.current,
    getLastPartitionAttempt: () => lastPartitionAttemptRef.current,
    getPartitionStats: () => ({
      applied: partitionAppliedCountRef.current,
      skipped: partitionSkipCountRef.current,
      lastAttempt: lastPartitionAttemptRef.current,
    }),
    setDisablePartition: (v: boolean) => {
      disablePartitionRef.current = v;
    },
    getAggregationThreshold: () => aggregationThresholdRef.current,
    setAggregationThreshold: (n: number) => {
      if (typeof n === 'number' && n > 0) {
        aggregationThresholdRef.current = n;
        redraw(true);
      }
    },
    getReusePct: () => reuseStatsRef.current.reusedPct,
    getBenchResult: () => benchResultRef.current,
    getNodes: () => {
      if (fallbackNodesRef.current.length) return fallbackNodesRef.current;
      const idx = layoutIndexRef.current;
      const out: Array<{ path: string; x: number; y: number; aggregated?: boolean }> = [];
      for (const [p, v] of idx) out.push({ path: p, x: v.x, y: v.y, aggregated: v.aggregated });
      return out;
    },
    fastAppend,
    appendNodesTest: (
      nodes: Array<{ path: string; name: string; kind: 'file' | 'dir'; depth: number }>
    ) => {
      if (!Array.isArray(nodes) || !nodes.length)
        return { usedFastPath: false, lastAttempt: lastFastPathAttemptRef.current };
      const before = fastPathUseCountRef.current;
      pendingDelta.current.push(...(nodes as unknown as ScanNode[]));
      redraw(true);
      const after = fastPathUseCountRef.current;
      return { usedFastPath: after === before + 1, lastAttempt: lastFastPathAttemptRef.current };
    },
    runLayoutCycle: (opts?: { randomizePan?: boolean; randomizeZoom?: boolean }) => {
      try {
        if (!appRef.current) return null;
        const app = appRef.current;
        if (opts?.randomizeZoom !== false) {
          const newScale = 0.5 + Math.random() * 1.2;
          scaleRef.current = newScale;
          app.stage.scale.set(newScale);
        }
        if (opts?.randomizePan !== false) {
          app.stage.x += (Math.random() - 0.5) * 300;
          app.stage.y += (Math.random() - 0.5) * 300;
        }
        redraw(false);
        return {
          scale: scaleRef.current,
          pan: { x: app.stage.x, y: app.stage.y },
          spriteTotal:
            spriteNodes.current.size +
            spriteLines.current.size +
            spriteBadges.current.size +
            spriteLabels.current.size,
        };
      } catch (err) {
        console.warn('[MetroStage][runLayoutCycle] error', err);
        return null;
      }
    },
    getSpriteCounts: () => ({
      nodes: spriteNodes.current.size,
      lines: spriteLines.current.size,
      badges: spriteBadges.current.size,
      labels: spriteLabels.current.size,
      total:
        spriteNodes.current.size +
        spriteLines.current.size +
        spriteBadges.current.size +
        spriteLabels.current.size,
    }),
    getViewport: () => {
      try {
        if (!appRef.current) return null;
        const st = appRef.current.stage;
        return { x: st.x, y: st.y, scale: scaleRef.current };
      } catch {
        return null;
      }
    },
    panViewport: (dx: number, dy: number) => {
      if (!appRef.current) return false;
      appRef.current.stage.x += dx;
      appRef.current.stage.y += dy;
      redraw(false);
      return true;
    },
    centerViewportAt: (worldX: number, worldY: number) => {
      if (!appRef.current) return false;
      const app = appRef.current;
      const canvas = app.canvas as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      app.stage.x = rect.width / 2 - worldX * scaleRef.current;
      app.stage.y = rect.height / 2 - worldY * scaleRef.current;
      redraw(false);
      return true;
    },
    getNodeColor: (p: string) => nodeColorRef.current.get(p),
    getLastLayoutMs: () => lastLayoutMsRef.current,
    exportDataUrl: (transparent = false) => {
      let canvas: HTMLCanvasElement | null = null;
      try {
        const anyApp = appRef.current as unknown as { canvas?: HTMLCanvasElement } | null;
        if (anyApp?.canvas) canvas = anyApp.canvas ?? null;
      } catch {
        /* ignore */
      }
      if (!canvas) {
        try {
          canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
        } catch {
          /* ignore */
        }
      }
      if (!canvas) return null;
      try {
        if (transparent) {
          const off = document.createElement('canvas');
          off.width = canvas.width;
          off.height = canvas.height;
          const offCtx = off.getContext('2d');
          if (offCtx) offCtx.drawImage(canvas, 0, 0);
          const dataUrl = off.toDataURL('image/png');
          return {
            dataUrl,
            width: off.width,
            height: off.height,
            size: Math.round((dataUrl.length * 3) / 4),
            transparent: true,
          };
        }
        const dataUrl = canvas.toDataURL('image/png');
        return {
          dataUrl,
          width: canvas.width,
          height: canvas.height,
          size: Math.round((dataUrl.length * 3) / 4),
          transparent: false,
        };
      } catch (err) {
        console.error('[MetroStage] exportDataUrl error (debug-api)', err);
        return null;
      }
    },
    simulateContextLost: () => {
      if (contextLostRef.current) return true;
      contextLostRef.current = true;
      if (containerRef.current && !contextLostOverlayRef.current) {
        const ov = document.createElement('div');
        ov.style.position = 'absolute';
        ov.style.left = '0';
        ov.style.top = '0';
        ov.style.right = '0';
        ov.style.bottom = '0';
        ov.style.display = 'flex';
        ov.style.alignItems = 'center';
        ov.style.justifyContent = 'center';
        ov.style.background = 'rgba(0,0,0,0.6)';
        ov.style.color = '#fff';
        ov.style.font = '16px sans-serif';
        ov.style.zIndex = '50';
        ov.textContent = 'Rendering context lost – fallback export available';
        containerRef.current.appendChild(ov);
        contextLostOverlayRef.current = ov;
      }
      return true;
    },
  };
}
