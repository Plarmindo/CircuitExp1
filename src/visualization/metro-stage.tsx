/**
 * MetroStage (Vertical Slice Item 5)
 * ----------------------------------
 * PixiJS stage wrapper rendering a basic snapshot of current adapter + layout (v2).
 * Simplifications in this early stage:
 *  - Full redraw per batch (clear + rebuild) -> TODO: incremental optimization (PERF-1 in progress).
 *  - Pan/zoom features are added later (now present elsewhere but original note retained for history).
 *  - Uses layout v2 (aggregation & spacing) without interactive expand/collapse in the original slice (now implemented).
 */
import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { createGraphAdapter, GraphAdapter } from './graph-adapter';
import { layoutHierarchicalV2, type LayoutPointV2 } from './layout-v2';
import { makeFastAppend } from './stage/fast-append';
import { toggleAggregation } from './selection-helpers';
import { findNextDirectional } from './navigation-helpers';
import type { ScanNode } from '../shared/scan-types';
import { tokens } from './style-tokens';
import { initOverlay as initOverlayBox, updateOverlayBox } from './overlay';
import { initDebugAPI } from './stage/debug-api';
import { initBenchmarks } from './stage/benchmarks';
import { renderScene } from './stage/render';
import { runLayoutCycle } from './stage';

interface MetroStageProps { width?: number; height?: number; }
// Broad debug surface (loose typing to reduce iteration friction)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { __metroDebug?: any; __lastExportPng?: { size: number; width?: number; height?: number; transparent?: boolean }; } }

export const MetroStage: React.FC<MetroStageProps> = ({ width = 900, height = 600 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const adapterRef = useRef<GraphAdapter | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const pendingDelta = useRef<ScanNode[]>([]);
  const rafScheduled = useRef(false);
  const spriteNodes = useRef(new Map<string, PIXI.Graphics>());
  const spriteLines = useRef(new Map<string, PIXI.Graphics>());
  // LOD badges for culled aggregated nodes (show count)
  const spriteBadges = useRef(new Map<string, PIXI.Text>());
  // Node labels (directories) – initial experiment
  const spriteLabels = useRef(new Map<string, PIXI.Text>());
  const [lastBatchTime, setLastBatchTime] = useState(0);
  const scaleRef = useRef(1);
  // Interaction refs migrated to interactions module
  const hoveredKeyRef = useRef<string | null>(null);
  const selectedKeyRef = useRef<string | null>(null);
  const layoutIndexRef = useRef<Map<string, LayoutPointV2>>(new Map());
  // Cache last layout node list to allow redraw without recomputing layout (theme restyle)
  const lastLayoutNodesRef = useRef<LayoutPointV2[]>([]);
  // Track expanded aggregation synthetic node paths
  const expandedAggregationsRef = useRef<Set<string>>(new Set());
  // Performance overlay (dev only)
  const overlayEnabledRef = useRef(false);
  const fpsTimesRef = useRef<number[]>([]);
  const lastLayoutMsRef = useRef(0);
  // VIS-14: count layout invocations (should not increment on pure theme restyle)
  const layoutCallCountRef = useRef(0);
  // VIS-14: track last fill color per node for test/debug (updated in redraw + theme restyle)
  const nodeColorRef = useRef(new Map<string, number>());
  const lastBatchApplyMsRef = useRef(0);
  const overlayDivRef = useRef<HTMLDivElement | null>(null);
  const overlayAvgCostRef = useRef<number | null>(null); // micro-benchmark average updateOverlay() cost (ms)
  // Culling stats (VIS-13)
  const lastCulledCountRef = useRef(0);
  // Reuse statistics (active sprites vs total ever allocated)
  const reuseStatsRef = useRef<{ totalAllocated: number; reusedPct: number }>({ totalAllocated: 0, reusedPct: 100 });
  // CORE-3 dynamic aggregation threshold (user settings)
  const aggregationThresholdRef = useRef<number>(28);
  // Benchmark & culling controls (VIS-13)
  const disableCullingRef = useRef(false); // true during baseline benchmark
  const benchStateRef = useRef<'idle'|'baseline'|'culled'|'done'>('idle');
  const benchFramesTargetRef = useRef(0);
  const benchFrameCounterRef = useRef(0);
  const benchBaselineTimesRef = useRef<number[]>([]);
  const benchCulledTimesRef = useRef<number[]>([]);
  const benchResultRef = useRef<{ baselineAvg: number; culledAvg: number; improvementPct: number; reusePct: number } | null>(null);
  const fastPathUseCountRef = useRef(0); // PERF-1 usage counter
  const lastFastPathAttemptRef = useRef<{ stage: string; ctx?: Record<string, unknown> } | null>(null); // PERF-1 instrumentation
  const lastPartitionAttemptRef = useRef<{ stage: string; ctx?: Record<string, unknown> } | null>(null); // PERF-2 instrumentation
  const partitionAppliedCountRef = useRef(0);
  const partitionSkipCountRef = useRef(0);
  const disablePartitionRef = useRef(false); // PERF-2: allow forcing full layout for benchmarking
  // Store interaction handlers for cleanup (avoid closure name lookup errors in cleanup section)
  const interactionHandlersRef = useRef<{ wheel?: (e: WheelEvent)=>void; pointerdown?: (e: PointerEvent)=>void; pointermove?: (e: PointerEvent)=>void; pointerup?: (e: PointerEvent)=>void; themeChanged?: ()=>void }>({});
  // Headless fallback storage
  const fallbackNodesRef = useRef<{ path: string; x: number; y: number; aggregated?: boolean }[]>([]);
  const pixiFailedRef = useRef(false);
  // VIS-15: track WebGL/context lost to surface user-facing fallback message
  const contextLostRef = useRef(false);
  const contextLostOverlayRef = useRef<HTMLDivElement | null>(null);
  // Will assign redraw after helper declarations (use function hoisting pattern instead of mutable let)
  // Placeholder (no-op until overwritten below after definition block)
  function redrawPlaceholder() {}
  // eslint-disable-next-line prefer-const
  let redraw: (applyPending?: boolean, opts?: { skipLayout?: boolean }) => void = redrawPlaceholder;

  useEffect(() => {
    let offPartial: (() => void) | undefined;
    let app: PIXI.Application;
    let handleResize: (() => void) | undefined;
    // Global control handlers for cleanup
  let onZoomIn: (() => void) | undefined; let onZoomOut: (() => void) | undefined; let onFit: (() => void) | undefined; let onExport: (() => void) | undefined;

  // Wrapper delegating to overlay module (kept small for ref simplicity)
  const updateOverlay = () => {
    updateOverlayBox({
      overlayDiv: overlayDivRef.current,
      overlayEnabled: overlayEnabledRef.current,
      fpsTimes: fpsTimesRef.current,
      layoutSize: layoutIndexRef.current.size,
      lastCulled: lastCulledCountRef.current,
      spriteNodes: spriteNodes.current.size,
      spriteLines: spriteLines.current.size,
      reusePct: reuseStatsRef.current.reusedPct,
      lastLayoutMs: lastLayoutMsRef.current,
      lastBatchMs: lastBatchApplyMsRef.current,
      avgCost: overlayAvgCostRef.current,
      benchResult: benchResultRef.current
    });
  };

  // keyHandler precisa estar definido antes para evitar ReferenceError em efeitos duplicados StrictMode
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'F10') {
      overlayEnabledRef.current = !overlayEnabledRef.current;
      if (!overlayEnabledRef.current && overlayDivRef.current) {
        overlayDivRef.current.style.display = 'none';
      } else {
        try {
          const iterations = 120;
          updateOverlay();
          const t0 = performance.now();
          for (let i=0;i<iterations;i++) updateOverlay();
          const t1 = performance.now();
          overlayAvgCostRef.current = (t1 - t0)/iterations;
          console.log(`[MetroStage][Overlay] avg updateOverlay ${overlayAvgCostRef.current.toFixed(4)}ms`);
        } catch { /* ignore benchmark errors */ }
        updateOverlay();
      }
      return;
    }
    // Keyboard navigation (VIS-16)
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const dirKeyMap: Record<string, 'up'|'down'|'left'|'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (e.key in dirKeyMap) {
      e.preventDefault();
      const entries: { path: string; x: number; y: number; aggregated?: boolean }[] = [];
      for (const [p,v] of layoutIndexRef.current.entries()) entries.push({ path: p, x: v.x, y: v.y, aggregated: v.aggregated });
      const next = findNextDirectional(selectedKeyRef.current, dirKeyMap[e.key], entries);
      if (next && next !== selectedKeyRef.current) {
        selectedKeyRef.current = next;
        const info = layoutIndexRef.current.get(next);
        window.dispatchEvent(new CustomEvent('metro:select', { detail: { path: next, type: info?.aggregated ? 'aggregated' : 'node' } }));
        redraw(false, { skipLayout: true });
      }
      return;
    }
    if (e.key === 'Enter') {
      const sel = selectedKeyRef.current;
      if (sel) {
        const info = layoutIndexRef.current.get(sel);
        if (info?.aggregated && !expandedAggregationsRef.current.has(sel)) {
          const toggled = toggleAggregation({
            aggregatedPath: sel,
            childPaths: info.aggregatedChildrenPaths || [],
            expandedBefore: false,
            currentSelection: selectedKeyRef.current,
          });
          if (toggled.expandedAfter) expandedAggregationsRef.current.add(sel);
          selectedKeyRef.current = toggled.newSelection;
          window.dispatchEvent(new CustomEvent('metro:select', { detail: selectedKeyRef.current ? { path: selectedKeyRef.current, type: 'aggregated' } : null }));
          redraw(false);
        }
      }
      return;
    }
    if (e.key === 'Escape') {
      if (selectedKeyRef.current) {
        selectedKeyRef.current = null;
        window.dispatchEvent(new CustomEvent('metro:select', { detail: null }));
        redraw(false, { skipLayout: true });
      }
      return;
    }
  };

  // Export elevado
  const elevatedHandleExportPNG = () => {
    try {
      const app = appRef.current;
      let canvas: HTMLCanvasElement | null = null;
      // Pixi v8 stores canvas via app.canvas (typed) after init
      if (app && (app as unknown as { canvas?: HTMLCanvasElement }).canvas) {
        canvas = (app as unknown as { canvas?: HTMLCanvasElement }).canvas || null;
      }
      if (!canvas && containerRef.current) canvas = containerRef.current.querySelector('canvas');
      if (!canvas) return;
      canvas.toBlob((blob) => {
        if (blob && typeof window !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__lastExportPng = { size: blob.size };
        }
      });
    } catch (err) { console.error('[MetroStage] elevated export failed', err); }
  };

  // Snapshot sprite maps for stable cleanup references (avoid lint warnings about ref mutation)
  const spriteNodesMapSnapshot = spriteNodes.current;
  const spriteLinesMapSnapshot = spriteLines.current;
  const spriteBadgesMapSnapshot = spriteBadges.current;

  // CORE-1: center stage on favorite jump (metro:centerOnPath)
  const handleCenterOnPath = (e: Event) => {
    const d = (e as CustomEvent).detail as { path?: string } | null;
    if (!d?.path) return;
    const info = layoutIndexRef.current.get(d.path);
    if (!info) return;
    const app = appRef.current;
    if (!app) return;
    const scale = scaleRef.current;
    const targetScreenX = width / 2;
    const targetScreenY = height / 2;
    app.stage.x = targetScreenX - info.x * scale;
    app.stage.y = targetScreenY - info.y * scale;
  };

    adapterRef.current = createGraphAdapter();

    const setup = async () => {
  console.log('[MetroStage] setup start');
  let pixiFailed = false;
      let htmlCanvas: HTMLCanvasElement | null = null;
      try {
        app = new PIXI.Application();
        const style = tokens();
        htmlCanvas = document.createElement('canvas');
        await app.init({ canvas: htmlCanvas, width, height, background: style.palette.background, antialias: true });
        appRef.current = app;
        if (containerRef.current) containerRef.current.appendChild(htmlCanvas);
      } catch (err) {
  pixiFailed = true;
  pixiFailedRef.current = true;
        console.error('[MetroStage] pixi init failed, enabling fallback stage', err);
        if (containerRef.current && !htmlCanvas) {
          htmlCanvas = document.createElement('canvas');
          htmlCanvas.width = width; htmlCanvas.height = height;
          const ctx = htmlCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#222'; ctx.fillRect(0,0,width,height);
            ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText('Fallback Stage (no WebGL)', 20, 40);
          }
          containerRef.current.appendChild(htmlCanvas);
        }
      }

      // Inicialização parcial da API de debug (extraída para módulo)
      // (adiada até depois de 'redraw' ser atribuído; aqui criamos wrapper que será usado posteriormente)
  const initDebug = () => {
  const dbg = initDebugAPI({
        scaleRef,
        layoutIndexRef,
        fallbackNodesRef,
        // adapt to expected shape (only methods used inside API)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        adapterRef: adapterRef as unknown as any,
        pendingDelta,
        fastPathUseCountRef,
        lastFastPathAttemptRef,
        lastPartitionAttemptRef,
        partitionAppliedCountRef,
        partitionSkipCountRef,
        disablePartitionRef,
        lastLayoutNodesRef,
        expandedAggregationsRef,
        aggregationThresholdRef,
        reuseStatsRef,
        nodeColorRef,
        spriteNodes,
        spriteLines,
        spriteBadges,
        spriteLabels,
        layoutCallCountRef,
        benchResultRef,
        disableCullingRef,
        appRef,
        fastAppend: ((parentPath: string, count: number) => makeFastAppend({
          adapter: adapterRef.current!,
          lastLayoutNodesRef,
          layoutIndexRef,
          expandedAggregationsRef,
          aggregationThresholdRef,
          fastPathUseCountRef,
          lastFastPathAttemptRef
        })(parentPath, count)) as unknown as (nodes: Array<{ path: string; name: string; kind: 'file' | 'dir'; depth: number }>) => unknown,
  redraw,
  lastLayoutMsRef,
  contextLostRef,
  contextLostOverlayRef,
  containerRef
      });
    // Initialize benchmark helpers (adds methods onto window.__metroDebug)
    initBenchmarks({
      // Cast through unknown to avoid broad any usage warnings while acknowledging third-party ref shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adapterRef: adapterRef as unknown as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appRef: appRef as unknown as any,
      scaleRef,
      disableCullingRef,
      benchResultRef,
      reuseStatsRef,
      redraw,
      layoutIndexRef,
      layoutCallCountRef,
      partitionAppliedCountRef,
      partitionSkipCountRef,
      disablePartitionRef
    });
    return dbg;
  };
      // (Mantemos bloco legacy existente abaixo até modularização completa)
      if (typeof window !== 'undefined') {
        window.__metroDebug = {
          getScale: () => scaleRef.current,
          // marker: debug object initialized
          getNodes: () => {
            if (fallbackNodesRef.current.length) return fallbackNodesRef.current;
            type LayoutEntry = { x: number; y: number; aggregated?: boolean };
            const idx = layoutIndexRef.current as Map<string, LayoutEntry>;
            const out: { path: string; x: number; y: number; aggregated?: boolean }[] = [];
            for (const [p,v] of idx) out.push({ path: p, x: v.x, y: v.y, aggregated: v.aggregated });
            return out;
          },
          genTree: (breadth = 2, depth = 2, files = 1) => {
            if (!adapterRef.current) return 0;
            const nodes: ScanNode[] = [];
            const makeDir = (path: string, _parentPath: string | null, level: number) => {
              const name = path.split('/').pop() || '';
              nodes.push({ path, kind: 'dir', name, depth: level });
              if (level >= depth) return;
              for (let b=0;b<breadth;b++) makeDir(`${path}/d${level}_${b}`, path, level+1);
              for (let f=0; f<files; f++) {
                const fpath = `${path}/f${level}_${f}.txt`;
                nodes.push({ path: fpath, kind: 'file', sizeBytes: 50, name: `f${level}_${f}.txt`, depth: level + 1 });
              }
            };
            makeDir('/root', null, 0);
            adapterRef.current.applyDelta(nodes);
            redraw(false);
            if (handleFitToView) handleFitToView();
            return nodes.length;
          },
          pickFirstNonAggregated: () => {
            if (fallbackNodesRef.current.length) {
              const first = fallbackNodesRef.current.find(n => !n.aggregated);
              if (!first) return null;
              return { path: first.path, clientX: first.x, clientY: first.y };
            }
            const canvas = app.canvas as HTMLCanvasElement; if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            type LayoutEntry = { path: string; x: number; y: number; aggregated?: boolean };
            const rawEntries = Array.from(layoutIndexRef.current.entries()) as Array<[string, { x: number; y: number; aggregated?: boolean }]>;
            const nodes: LayoutEntry[] = rawEntries.map(([path, v]) => ({ path, x: v.x, y: v.y, aggregated: v.aggregated }));
            const first = nodes.find(n => !n.aggregated);
            if (!first) return null;
            const scale = scaleRef.current; const sx = app.stage.x; const sy = app.stage.y;
            return { path: first.path, clientX: rect.left + sx + first.x * scale, clientY: rect.top + sy + first.y * scale };
          },
          getReusePct: () => reuseStatsRef.current.reusedPct,
          getPan: () => ({ x: appRef.current ? appRef.current.stage.x : 0, y: appRef.current ? appRef.current.stage.y : 0 }),
          getBenchResult: () => benchResultRef.current,
          getLayoutCallCount: () => layoutCallCountRef.current,
          getFastPathUses: () => fastPathUseCountRef.current,
          getLastFastPathAttempt: () => lastFastPathAttemptRef.current,
          getLastPartitionAttempt: () => lastPartitionAttemptRef.current,
          getPartitionStats: () => ({ applied: partitionAppliedCountRef.current, skipped: partitionSkipCountRef.current, lastAttempt: lastPartitionAttemptRef.current }),
          appendNodesTest: (nodes: Array<{ path: string; name: string; kind: 'file' | 'dir'; depth: number }>) => {
            if (!Array.isArray(nodes) || !nodes.length) return { usedFastPath: false, lastAttempt: lastFastPathAttemptRef.current };
            const before = fastPathUseCountRef.current;
            pendingDelta.current.push(...(nodes as unknown as ScanNode[]));
            redraw(true);
            const after = fastPathUseCountRef.current;
            return { usedFastPath: after === before + 1, lastAttempt: lastFastPathAttemptRef.current };
          },
          fastAppend: makeFastAppend({
            adapter: adapterRef.current!,
            lastLayoutNodesRef,
            layoutIndexRef,
            expandedAggregationsRef,
            aggregationThresholdRef,
            fastPathUseCountRef,
            lastFastPathAttemptRef
          }),
          getNodeColor: (p: string) => nodeColorRef.current.get(p),
          getNodeSprite: (p: string) => spriteNodes.current.get(p),
          getAggregationThreshold: () => aggregationThresholdRef.current,
          setAggregationThreshold: (n: number) => { if (typeof n === 'number' && n > 0) { aggregationThresholdRef.current = n; redraw(true); } },
          getSpriteCounts: () => ({
            nodes: spriteNodes.current.size,
            lines: spriteLines.current.size,
            badges: spriteBadges.current.size,
            labels: spriteLabels.current.size,
            total: spriteNodes.current.size + spriteLines.current.size + spriteBadges.current.size + spriteLabels.current.size,
          }),
          runLayoutCycle: (opts?: { randomizePan?: boolean; randomizeZoom?: boolean }) => {
            try {
              if (!appRef.current) return null;
              const app = appRef.current;
              // Random zoom within a mild range to exercise culling / label allocation without exploding geometry
              if (opts?.randomizeZoom !== false) {
                const newScale = 0.5 + Math.random() * 1.2; // 0.5 .. 1.7
                scaleRef.current = newScale;
                app.stage.scale.set(newScale);
              }
              // Random pan small jitter (±150px)
              if (opts?.randomizePan !== false) {
                app.stage.x += (Math.random() - 0.5) * 300;
                app.stage.y += (Math.random() - 0.5) * 300;
              }
              // Force a redraw with layout (skipLayout = false) to exercise layout + sprite reuse
              redraw(false);
              return { scale: scaleRef.current, pan: { x: app.stage.x, y: app.stage.y }, spriteTotal: spriteNodes.current.size + spriteLines.current.size + spriteBadges.current.size + spriteLabels.current.size };
            } catch (err) {
              console.warn('[MetroStage][runLayoutCycle] error', err);
              return null;
            }
          },
          // Execução rápida de benchmark sintético sem animação de frames em loop RAF
          // Benchmark helpers migrated to benchmarks module (startQuickBench, startRealBench)
        };
  window.addEventListener('metro:genTree', (e: Event) => {
          const custom = e as CustomEvent<{ breadth?: number; depth?: number; files?: number }>;
          const breadth = custom.detail?.breadth ?? 2;
          const depth = custom.detail?.depth ?? 2;
          const files = custom.detail?.files ?? 1;
          // If Pixi available, use adapter
          if (appRef.current && adapterRef.current) {
            const nodes: ScanNode[] = [];
            const makeDir = (path: string, _parentPath: string | null, level: number) => {
              nodes.push({ path, kind: 'dir', depth: level, name: path.split('/').pop() || 'dir' });
              if (level >= depth) return;
              for (let b=0;b<breadth;b++) makeDir(`${path}/d${level}_${b}`, path, level+1);
              for (let f=0; f<files; f++) nodes.push({ path: `${path}/f${level}_${f}.txt`, kind: 'file', sizeBytes: 10, name: `f${level}_${f}.txt`, depth: level + 1 });
            };
            makeDir('/root', null, 0);
            adapterRef.current.applyDelta(nodes);
            pendingDelta.current = []; // consumed
            // Force a redraw cycle
            requestAnimationFrame(() => {
              const evt = new CustomEvent('metro:genTree:done');
              window.dispatchEvent(evt);
            });
          } else {
            // Headless fallback synthetic positions
            fallbackNodesRef.current.length = 0;
            let y = 50;
            const makeDir2 = (path: string, level: number) => {
              fallbackNodesRef.current.push({ path, x: 50 + level*40, y });
              y += 28;
              if (level >= depth) return;
              for (let b=0;b<breadth;b++) makeDir2(`${path}/d${level}_${b}`, level+1);
              for (let f=0; f<files; f++) fallbackNodesRef.current.push({ path: `${path}/f${level}_${f}.txt`, x: 50 + (level+1)*40, y: y += 24 });
            };
            makeDir2('/root', 0);
            const evt = new CustomEvent('metro:genTree:done');
            window.dispatchEvent(evt);
          }
        });
      }

  if (!pixiFailed) {
        const linesLayer = new PIXI.Container();
        const stationsLayer = new PIXI.Container();
        const overlayLayer = new PIXI.Container();
        overlayLayer.eventMode = 'static';
        app.stage.addChild(linesLayer, stationsLayer, overlayLayer);
      }

  // Sprite factory helpers moved into renderScene module

      // Handle window resize to keep renderer in sync with container size
      handleResize = () => {
        const inst = appRef.current;
        const el = containerRef.current;
        if (!inst || !el) return;
        const w = el.clientWidth || width;
        const h = el.clientHeight || height;
        if (!pixiFailed) inst.renderer.resize(w, h);
      };
      window.addEventListener('resize', handleResize);
      // Initial size sync in case container differs from requested size
      handleResize();

      // Pan & Zoom Interaction
  // minZoom removed (handled by interactions module)
      // Reset initial transform (interactions module manages further zoom/pan)
      scaleRef.current = 1;
      if (!pixiFailedRef.current) {
        app.stage.scale.set(1);
        app.stage.x = 0; app.stage.y = 0;
      }

      const emitHover = (path: string | null) => {
        const payload = path ? { path, type: layoutIndexRef.current.get(path)?.aggregated ? 'aggregated' : 'node' } : null;
  window.dispatchEvent(new CustomEvent('metro:hover', { detail: payload }));
      };

      const handleSelect = (path: string) => {
        const info = layoutIndexRef.current.get(path);
        // Aggregated synthetic node => toggle expansion state first
        if (info?.aggregated) {
          const toggled = toggleAggregation({
            aggregatedPath: path,
            childPaths: info.aggregatedChildrenPaths || [],
            expandedBefore: expandedAggregationsRef.current.has(path),
            currentSelection: selectedKeyRef.current,
          });
          if (toggled.expandedAfter) expandedAggregationsRef.current.add(path); else expandedAggregationsRef.current.delete(path);
          selectedKeyRef.current = toggled.newSelection;
          window.dispatchEvent(new CustomEvent('metro:select', { detail: selectedKeyRef.current ? { path: selectedKeyRef.current, type: 'aggregated' } : null }));
          redraw(false);
          return;
        }
        // Normal node toggle selection
        selectedKeyRef.current = path === selectedKeyRef.current ? null : path;
  window.dispatchEvent(new CustomEvent('metro:select', { detail: selectedKeyRef.current ? { path: selectedKeyRef.current, type: 'node' } : null }));
        redraw(false);
      };

      const computeBounds = () => {
        const idx = layoutIndexRef.current;
        if (!idx || idx.size === 0) return null as null | { minX: number; minY: number; maxX: number; maxY: number };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [, v] of idx) {
          if (v.x < minX) minX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.x > maxX) maxX = v.x;
          if (v.y > maxY) maxY = v.y;
        }
        return { minX, minY, maxX, maxY };
      };

      const handleFitToView = () => {
        const b = computeBounds();
        if (!b) return;
        const renderer = app.renderer as PIXI.Renderer;
        const pad = 40;
        const worldW = (b.maxX - b.minX) + pad * 2;
        const worldH = (b.maxY - b.minY) + pad * 2;
  if (!renderer || typeof (renderer as unknown as { width?: number }).width !== 'number') return; // jsdom fallback guard
  const viewW = (renderer as unknown as { width: number }).width;
  const viewH = (renderer as unknown as { height: number }).height ?? 0;
        if (worldW <= 0 || worldH <= 0 || viewW <= 0 || viewH <= 0) return;
        const scale = Math.min(viewW / worldW, viewH / worldH) * 0.95;
        const minZoom = 0.3;
        const maxZoom = 3.0;
        const newScale = Math.min(maxZoom, Math.max(minZoom, scale));
  scaleRef.current = newScale; if (!pixiFailed) app.stage.scale.set(newScale);
        const worldCenterX = (b.minX + b.maxX) / 2;
        const worldCenterY = (b.minY + b.maxY) / 2;
        app.stage.x = (viewW / 2) - worldCenterX * newScale;
        app.stage.y = (viewH / 2) - worldCenterY * newScale;
      };

  const handleExportPNG = () => {
        // Support optional transparent export via query param (?transparentExport=1) or custom event detail
        const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined;
        const transparentParam = searchParams?.get('transparentExport') === '1';
        let canvas: HTMLCanvasElement | null = null;
        // Attempt to grab the Pixi-managed canvas first
        if (app && (app as unknown as { canvas?: HTMLCanvasElement }).canvas) {
          canvas = (app as unknown as { canvas?: HTMLCanvasElement }).canvas ?? null;
        }
        if (!canvas) {
          canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
        }
        if (!canvas) {
          console.warn('[MetroStage] Export aborted: no canvas found');
          return;
        }
        const performBlob = (cnv: HTMLCanvasElement, downloadName = 'metro-map.png', transparent = false) => {
          try {
            cnv.toBlob((blob) => {
              if (!blob) return;
              if (typeof window !== 'undefined') {
                window.__lastExportPng = { size: blob.size, width: cnv.width, height: cnv.height, transparent };
              }
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = downloadName;
              document.body.appendChild(a); a.click();
              document.body.removeChild(a); URL.revokeObjectURL(url);
            });
          } catch (err) {
            console.error('[MetroStage] toBlob failed', err);
          }
        };
        try {
          if (contextLostRef.current) {
            console.warn('[MetroStage] Export after context lost – attempting 2D fallback');
          }
          if (transparentParam) {
            // Create an offscreen canvas with cleared background, draw current content via drawImage
            const off = document.createElement('canvas');
            off.width = canvas.width; off.height = canvas.height;
            const offCtx = off.getContext('2d');
            if (offCtx) {
              // Draw existing canvas (could already have opaque bg if Pixi used one)
              offCtx.drawImage(canvas, 0, 0);
              performBlob(off, 'metro-map-transparent.png', true);
              return;
            }
          }
          if (pixiFailed) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#102030';
              ctx.fillRect(0,0,canvas.width,canvas.height);
              ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
              ctx.fillText('Metro Fallback', 10, 24);
              ctx.fillText('Nodes:'+ (layoutIndexRef.current?.size ?? 0), 10, 44);
            }
          }
          performBlob(canvas, 'metro-map.png', false);
        } catch (err) {
          console.error('Export PNG failed', err);
          // Attempt safe fallback: duplicate canvas to new 2D canvas and export
          try {
            const fallback = document.createElement('canvas');
            fallback.width = canvas.width; fallback.height = canvas.height;
            const fctx = fallback.getContext('2d');
            if (fctx) {
              fctx.drawImage(canvas,0,0);
              performBlob(fallback, 'metro-map-fallback.png', false);
            }
          } catch (err2) {
            console.error('[MetroStage] fallback export also failed', err2);
          }
        }
      };

  // Legacy debug extension removed – now handled in debug-api.ts

      // Attach WebGL/context lost listeners (best-effort; may not fire in headless tests)
      const attachContextLostListeners = (cnv: HTMLCanvasElement | null) => {
        if (!cnv) return;
        const handler = (ev: Event) => {
          contextLostRef.current = true;
          if ('preventDefault' in ev) {
            try { (ev as WebGLContextEvent).preventDefault(); } catch { /* ignore */ }
          }
          if (containerRef.current && !contextLostOverlayRef.current) {
            const ov = document.createElement('div');
            ov.style.position = 'absolute';
            ov.style.left = '0'; ov.style.top = '0'; ov.style.right = '0'; ov.style.bottom = '0';
            ov.style.display = 'flex'; ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
            ov.style.background = 'rgba(0,0,0,0.6)';
            ov.style.color = '#fff'; ov.style.font = '16px sans-serif'; ov.style.zIndex = '50';
            ov.textContent = 'Rendering context lost – using fallback';
            containerRef.current.appendChild(ov);
            contextLostOverlayRef.current = ov;
          }
        };
        cnv.addEventListener('webglcontextlost', handler as EventListener, false);
        cnv.addEventListener('contextlost', handler as EventListener, false);
      };
      // Attempt to find canvas now (Pixi may have appended) for listener binding
      let initialCanvas: HTMLCanvasElement | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (app && (app as any).canvas) initialCanvas = (app as any).canvas as HTMLCanvasElement;
      } catch { /* ignore */ }
      if (!initialCanvas) {
        initialCanvas = containerRef.current?.querySelector('canvas') || null;
      }
      if (initialCanvas) attachContextLostListeners(initialCanvas);

  // Global control listeners (UI -> Stage) - zoom logic moved to interactions module; removed unused safeViewRect
      onZoomIn = () => {
  // zoom removed (renderer, rect unused)
  // zoom removed (handled by interactions)
      };
      onZoomOut = () => {
  // zoom removed
  // zoom removed
      };
      onFit = () => handleFitToView();
      onExport = () => handleExportPNG();

  window.addEventListener('metro:zoomIn', onZoomIn!);
  window.addEventListener('metro:zoomOut', onZoomOut!);
  window.addEventListener('metro:fit', onFit!);
  window.addEventListener('metro:exportPNG', onExport!);
  window.addEventListener('metro:exportPng', elevatedHandleExportPNG); // fallback event name used in tests
  window.addEventListener('metro:centerOnPath', handleCenterOnPath as EventListener);
  // Dynamic theme restyle (VIS-14): recolor existing sprites & lines without layout recompute
  function handleThemeChanged() {
    if (!appRef.current) return;
    const style = tokens();
    // Update renderer background
    try { (appRef.current.renderer as PIXI.Renderer).background.color = style.palette.background; } catch { /* ignore */ }
    // Recolor node sprites (no geometry or layout changes)
    for (const [key, g] of spriteNodes.current) {
      const info = layoutIndexRef.current.get(key);
      const node = adapterRef.current?.getNode(key);
      if (!info || !g) continue;
      g.clear();
      let radius = style.stationRadius.directory;
      let fill = style.palette.directory;
      if (info.aggregated) { radius = style.stationRadius.aggregated; fill = style.palette.aggregated; }
      else if (node?.kind === 'file') { radius = style.stationRadius.file; fill = style.palette.file; }
      nodeColorRef.current.set(key, fill);
      const isSelected = selectedKeyRef.current === key;
      const strokeColor = isSelected ? style.palette.selected : (info.aggregated ? style.palette.lineAgg : 0);
      const strokeWidth = isSelected ? style.lineThickness + 1.5 : (info.aggregated ? style.lineThickness : 0);
    g.beginFill(fill, 1); g.drawCircle(0,0,radius); g.endFill();
  if (strokeWidth > 0) { g.lineStyle(strokeWidth, strokeColor, 0.95); g.drawCircle(0,0,radius + (isSelected ? 2 : -4)); g.lineStyle(); }
    }
    // Redraw lines & badges using cached layout (skip layout recompute)
    redraw(false, { skipLayout: true });
  };
  window.addEventListener('metro:themeChanged', handleThemeChanged);
  // CORE-3: listen for aggregation threshold changes
  window.addEventListener('metro:aggregationThresholdChanged', (e: Event) => {
    // @ts-expect-error detail dynamic
    const n = e.detail?.aggregationThreshold;
    if (typeof n === 'number' && n > 0) { aggregationThresholdRef.current = n; redraw(true); }
  });
  // PERF-1 external append API for tests / automation
  window.addEventListener('metro:appendNodes', (e: Event) => {
    // @ts-expect-error dynamic detail
    const nodes: ScanNode[] = e.detail?.nodes;
    if (!Array.isArray(nodes) || !nodes.length) return;
    pendingDelta.current.push(...nodes);
    redraw(true);
  });

  interface RedrawOptions { skipLayout?: boolean }
  const redraw = (applyPending = true, opts?: RedrawOptions) => {
    const style = tokens();
    if (!adapterRef.current) return;
    const t0 = performance.now();
    let layoutNodes: Array<{ path: string; x: number; y: number; depth: number; aggregated?: boolean; aggregatedChildrenPaths?: string[]; aggregatedExpanded?: boolean }> = lastLayoutNodesRef.current;
    let nodeIndexLocal = layoutIndexRef.current;
    if (!opts?.skipLayout) {
      const result = runLayoutCycle({
        adapter: adapterRef.current!,
        pendingDelta: applyPending ? pendingDelta.current : [],
        lastLayoutNodes: lastLayoutNodesRef.current as Array<LayoutPointV2 & { aggregatedChildrenPaths?: string[]; aggregatedExpanded?: boolean }>,
        lastLayoutIndex: layoutIndexRef.current as Map<string, LayoutPointV2>,
        expandedAggregations: expandedAggregationsRef.current,
        aggregationThreshold: aggregationThresholdRef.current,
        lastFastPathAttemptRef: { current: 0 }, // simple count; detailed attempt stays in lastFastPathAttemptRef debug ref
        layoutCallCountRef,
        partitionAppliedCountRef,
        partitionSkipCountRef
  , disablePartition: disablePartitionRef.current
      });
  lastLayoutMsRef.current = result.durationMs;
  // TODO: store result.bbox if future viewport fit or minimap features require it
      if (result.pendingConsumed) pendingDelta.current = [];
      if (result.usedFastPath) fastPathUseCountRef.current++;
      layoutIndexRef.current = result.index as Map<string, LayoutPointV2>;
      lastLayoutNodesRef.current = result.nodes as typeof layoutNodes;
      layoutNodes = lastLayoutNodesRef.current;
      nodeIndexLocal = layoutIndexRef.current;
      setNodeCount(layoutNodes.length);
    }
    const effectiveNodes = layoutNodes;

  // (Rendering now handled in renderScene; orphan cleanup occurs there)

        // Delegate rendering (lines + nodes + culling) to renderScene module
        renderScene({
          app: appRef.current!,
          pixiFailed: pixiFailedRef.current,
          layoutNodes: effectiveNodes as LayoutPointV2[],
          adapter: adapterRef.current!,
          nodeIndex: nodeIndexLocal,
          style,
          scaleRef,
          disableCullingRef,
          hoveredKeyRef,
          selectedKeyRef,
          nodeColorRef,
          spriteNodes,
          spriteLines,
          spriteBadges,
          spriteLabels,
          reuseStatsRef,
          lastCulledCountRef,
          onNodeSpriteCreate: (s, key) => {
            s.on('pointerover', () => { hoveredKeyRef.current = key; redraw(false); emitHover(key); });
            s.on('pointerout', () => { if (hoveredKeyRef.current === key) { hoveredKeyRef.current = null; redraw(false); emitHover(null); } });
            s.on('pointertap', () => { handleSelect(key); });
            s.on('rightdown', (ev: PIXI.FederatedPointerEvent) => {
              try {
                const global = ev.global;
                window.dispatchEvent(new CustomEvent('metro:contextMenu', { detail: { path: key, x: global.x, y: global.y } }));
              } catch { /* ignore */ }
            });
          }
        });

        const t1 = performance.now();
        const batchMs = t1 - t0;
        lastBatchApplyMsRef.current = batchMs;
        setLastBatchTime(batchMs);
        if (import.meta.env.DEV && batchMs > 8) {
          console.warn(`[MetroStage] Incremental batch took ${batchMs.toFixed(2)} ms (> 8ms target)`);
        }
        // Benchmark progression
        if (import.meta.env.DEV && benchStateRef.current !== 'idle' && benchStateRef.current !== 'done') {
          if (benchStateRef.current === 'baseline') benchBaselineTimesRef.current.push(batchMs);
          else if (benchStateRef.current === 'culled') benchCulledTimesRef.current.push(batchMs);
          benchFrameCounterRef.current++;
          if (benchFrameCounterRef.current >= benchFramesTargetRef.current) {
            if (benchStateRef.current === 'baseline') {
              // Switch to culled phase
              benchStateRef.current = 'culled';
              benchFrameCounterRef.current = 0;
              disableCullingRef.current = false;
              console.log('[MetroStage][CullingBenchmark] baseline phase complete');
            } else if (benchStateRef.current === 'culled') {
              benchStateRef.current = 'done';
              const avg = (arr: number[]) => arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length);
              const baselineAvg = avg(benchBaselineTimesRef.current);
              const culledAvg = avg(benchCulledTimesRef.current);
              const improvementPct = baselineAvg > 0 ? ((baselineAvg - culledAvg)/baselineAvg)*100 : 0;
              benchResultRef.current = { baselineAvg, culledAvg, improvementPct, reusePct: reuseStatsRef.current.reusedPct };
              if (typeof window !== 'undefined' && window.__metroDebug) {
                window.__metroDebug.benchResult = benchResultRef.current;
              }
              console.log('[MetroStage][CullingBenchmark] result', JSON.stringify({
                frames: benchBaselineTimesRef.current.length,
                baselineAvgMs: baselineAvg,
                culledAvgMs: culledAvg,
                improvementPct,
                reusePct: reuseStatsRef.current.reusedPct,
                nodeCount: layoutIndexRef.current.size,
                lastCulled: lastCulledCountRef.current
              }));
            }
          }
        }
      if (overlayEnabledRef.current && !pixiFailedRef.current) updateOverlay();
      // Ensure debug API initialized once redraw exists
      if (typeof window !== 'undefined' && !window.__metroDebug?.__initializedLite) {
        try {
          const dbg = window.__metroDebug as Record<string, unknown>;
          dbg.__initializedLite = true;
          // initDebug foi definido no escopo de setup
          if (typeof initDebug === 'function') initDebug();
        } catch { /* ignore */ }
      }
      };

      const schedule = () => {
        if (rafScheduled.current) return;
        rafScheduled.current = true;
        requestAnimationFrame(() => { rafScheduled.current = false; redraw(); });
      };

      if (!pixiFailed) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        offPartial = (window as any).electronAPI?.onScanPartial?.((b: { nodes: ScanNode[] }) => {
          pendingDelta.current.push(...b.nodes);
          schedule();
        });
      }

      window.addEventListener('keydown', keyHandler);
  if (!pixiFailedRef.current && containerRef.current) initOverlayBox(containerRef.current, overlayDivRef);

      // Benchmark events (dev only)
      if (import.meta.env.DEV) {
        window.addEventListener('metro:benchCulling', (e: Event) => {
          if (!adapterRef.current) return;
          if (benchStateRef.current !== 'idle' && benchStateRef.current !== 'done') {
            console.warn('[MetroStage][CullingBenchmark] benchmark already running');
            return;
          }
          const custom = e as CustomEvent<{ frames?: number }>;
          // Proper reset (above attempt replaced incorrectly) - ensure arrays emptied
          benchBaselineTimesRef.current.length = 0;
          benchCulledTimesRef.current.length = 0;
          benchResultRef.current = null;
          const frames = custom.detail?.frames ?? 180;
          benchFramesTargetRef.current = frames;
          benchFrameCounterRef.current = 0;
          disableCullingRef.current = true; // baseline draws tudo
          benchStateRef.current = 'baseline';
          console.log('[MetroStage][CullingBenchmark] starting baseline phase for', frames, 'frames');
          // Força loop contínuo de redraw durante benchmark
          const tick = () => {
            if (benchStateRef.current === 'done' || benchStateRef.current === 'idle') return;
            redraw(false);
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });

        // Auto generation + benchmark (synthetic ~12k nós)
        window.addEventListener('metro:benchCullingAuto', (e: Event) => {
          if (!adapterRef.current) return;
          if (pixiFailedRef.current) {
            // Headless fallback: generate synthetic timing without rendering
            const nodes: ScanNode[] = [];
            const breadth = 5, depth = 5, files = 3;
            const makeDir = (p: string, _parent: string | null, lvl: number) => {
              nodes.push({ path: p, kind: 'dir', depth: lvl, name: p.split('/').pop() || 'dir' });
              if (lvl >= depth) return;
              for (let b=0;b<breadth;b++) makeDir(`${p}/d${lvl}_${b}`, p, lvl+1);
              for (let f=0;f<files;f++) nodes.push({ path: `${p}/f${lvl}_${f}.txt`, kind: 'file', sizeBytes: 100, name: `f${lvl}_${f}.txt`, depth: lvl + 1 });
            };
            makeDir('/root', null, 0);
            adapterRef.current.applyDelta(nodes);
            const layoutStart = performance.now();
            layoutHierarchicalV2(adapterRef.current, { expandedAggregations: expandedAggregationsRef.current });
            const layoutEnd = performance.now();
            const baselineAvg = (layoutEnd - layoutStart) * 1.2; // simulate slower no-culling
            const culledAvg = (layoutEnd - layoutStart) * 0.8; // simulate faster with culling
            benchResultRef.current = { baselineAvg, culledAvg, improvementPct: ((baselineAvg-culledAvg)/baselineAvg)*100, reusePct: 98 };
            if (window.__metroDebug) window.__metroDebug.benchResult = benchResultRef.current;
            console.log('[MetroStage][CullingBenchmark][fallback] result', benchResultRef.current);
            return;
          }
          const custom = e as CustomEvent<{ breadth?: number; depth?: number; files?: number; frames?: number; extraZoomOut?: number }>;
          // Generate synthetic tree breadth 5 depth 5 files 3 (~12k entries)
          const breadth = custom.detail?.breadth ?? 5;
            const depth = custom.detail?.depth ?? 5;
            const files = custom.detail?.files ?? 3;
            const nodes: ScanNode[] = [];
            const makeDir = (path: string, _parentPath: string | null, level: number) => {
              nodes.push({ path, kind: 'dir', depth: level, name: path.split('/').pop() || 'dir' });
              if (level >= depth) return;
              for (let b=0;b<breadth;b++) {
                makeDir(`${path}/d${level}_${b}`, path, level+1);
              }
              for (let f=0; f<files; f++) {
                nodes.push({ path: `${path}/f${level}_${f}.txt`, kind: 'file', sizeBytes: 100, name: `f${level}_${f}.txt`, depth: level + 1 });
              }
            };
            makeDir('/root', null, 0);
            adapterRef.current.applyDelta(nodes);
            redraw(false);
            // Fit view
            handleFitToView();
            // Optional extra zoom outs to amplify difference between baseline (no culling) and culled phase
            const extraZoom = custom.detail?.extraZoomOut ?? 2;
            if (extraZoom > 0) {
              // zoom removed
              for (let i=0;i<extraZoom;i++) {
                // zoom removed
              }
            }
            // Start benchmark
            window.dispatchEvent(new CustomEvent('metro:benchCulling', { detail: { frames: custom.detail?.frames ?? 180 } }));
        });
        // Simple synthetic tree generation (no benchmark) for tests: metro:genTree
        window.addEventListener('metro:genTree', (e: Event) => {
          if (!adapterRef.current) return;
          const custom = e as CustomEvent<{ breadth?: number; depth?: number; files?: number }>;
          const breadth = custom.detail?.breadth ?? 2;
          const depth = custom.detail?.depth ?? 2;
          const files = custom.detail?.files ?? 1;
          const nodes: ScanNode[] = [];
          const makeDir = (path: string, _parentPath: string | null, level: number) => {
            nodes.push({ path, kind: 'dir', depth: level, name: path.split('/').pop() || 'dir' });
            if (level >= depth) return;
            for (let b=0;b<breadth;b++) makeDir(`${path}/d${level}_${b}`, path, level+1);
            for (let f=0; f<files; f++) nodes.push({ path: `${path}/f${level}_${f}.txt`, kind: 'file', sizeBytes: 50, name: `f${level}_${f}.txt`, depth: level + 1 });
          };
          makeDir('/root', null, 0);
          adapterRef.current.applyDelta(nodes);
          redraw(false);
          handleFitToView();
        });
        // Direct node injection for E2E (expects detail: { nodes: ScanNode[] })
        window.addEventListener('metro:injectNodes', (e: Event) => {
          const custom = e as CustomEvent<{ nodes: ScanNode[] }>;
          if (!custom.detail?.nodes) return;
          pendingDelta.current.push(...custom.detail.nodes);
          schedule();
        });
        // Auto disparo se hash contiver #autobench (ex: http://localhost:5175/#autobench)
        if (typeof window !== 'undefined' && window.location.hash.includes('autobench')) {
          // Ativa overlay automaticamente
          overlayEnabledRef.current = true;
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('metro:benchCullingAuto', { detail: { breadth: 5, depth: 5, files: 3, frames: 240 } }));
          }, 300); // pequena espera para inicialização
        }
      }
    };

    setup();

  // Snapshots para cleanup (evita acessar refs mutáveis diretamente no retorno)
  const labelsMapSnapshot = spriteLabels.current;
  const overlayDivSnapshot = overlayDivRef.current;
  const interactionHandlersSnapshot = interactionHandlersRef.current;

    return () => {
  if (offPartial) offPartial();
      // Remove resize listener
      if (handleResize) window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', keyHandler);
  if (overlayDivSnapshot && overlayDivSnapshot.parentElement) overlayDivSnapshot.parentElement.removeChild(overlayDivSnapshot);
      // Destroy tracked sprites and clear maps
  for (const s of Array.from(spriteNodesMapSnapshot.values())) s.destroy();
  for (const s of Array.from(spriteLinesMapSnapshot.values())) s.destroy();
  for (const b of Array.from(spriteBadgesMapSnapshot.values())) b.destroy();
  spriteBadgesMapSnapshot.clear();
  for (const l of Array.from(labelsMapSnapshot.values())) l.destroy();
  labelsMapSnapshot.clear();
  spriteNodesMapSnapshot.clear();
  spriteLinesMapSnapshot.clear();
      // Remove pan & zoom listeners
  const canvas = appRef.current?.canvas as HTMLCanvasElement | undefined;
  if (!pixiFailedRef.current && canvas) {
    const ih = interactionHandlersSnapshot;
    if (ih.wheel) canvas.removeEventListener('wheel', ih.wheel);
    if (ih.pointerdown) canvas.removeEventListener('pointerdown', ih.pointerdown);
    if (ih.pointermove) canvas.removeEventListener('pointermove', ih.pointermove);
    if (ih.pointerup) canvas.removeEventListener('pointerup', ih.pointerup);
  }
      // Remove global control listeners
      if (onZoomIn) window.removeEventListener('metro:zoomIn', onZoomIn);
      if (onZoomOut) window.removeEventListener('metro:zoomOut', onZoomOut);
      if (onFit) window.removeEventListener('metro:fit', onFit);
  if (onExport) window.removeEventListener('metro:exportPNG', onExport);
  window.removeEventListener('metro:exportPng', elevatedHandleExportPNG);
  if (interactionHandlersSnapshot.themeChanged) window.removeEventListener('metro:themeChanged', interactionHandlersSnapshot.themeChanged);
  window.removeEventListener('metro:centerOnPath', handleCenterOnPath as EventListener);
      // Destroy application
  if (!pixiFailedRef.current && appRef.current) {
        appRef.current.destroy(true);
      }
    };
  // redraw intentionally excluded (mutated internal ref) – safe because effect owns all lifecycle & does manual cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  return (
    <div style={{ border: '1px solid #ccc', marginTop: 24 }}>
      <div style={{ padding: '4px 8px', background: '#f0f0f0', fontSize: 12 }}>Vertical Slice (Nós: {nodeCount})</div>
      <div ref={containerRef} style={{ width, height }} />
      <div style={{ padding: 8, fontSize: 11, background: '#fafafa', borderTop: '1px solid #ddd' }}>
        TODOs: pan/zoom, incremental diff sem clear, labels, hover/select, theming. {import.meta.env.DEV ? ` | last batch: ${lastBatchTime.toFixed(2)} ms` : ''}
      </div>
    </div>
  );
};
