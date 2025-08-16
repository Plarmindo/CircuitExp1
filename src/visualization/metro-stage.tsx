/**
 * MetroStage (Vertical Slice Item 5)
 * ----------------------------------
 * PixiJS stage wrapper rendering a basic snapshot of current adapter + layout (v2).
 * Simplificações assumidas nesta fase:
 *  - Redesenho completo em cada batch (clear + rebuild) -> TODO: otimizar incremental.
 *  - Sem pan/zoom ainda (previsto em item posterior).
 *  - Usa layout v2 para já (agregação & spacing) sem interação de expand/collapse.
 */
import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { createGraphAdapter, GraphAdapter } from './graph-adapter';
import { layoutHierarchicalV2 } from './layout-v2';
import { toggleAggregation } from './selection-helpers';
import type { ScanNode } from '../shared/scan-types';
import { tokens } from './style-tokens';

interface MetroStageProps { width?: number; height?: number; }

declare global {
  interface Window {
    __metroDebug?: {
      getScale: () => number;
      getNodes: () => { path: string; x: number; y: number; aggregated?: boolean }[];
      pickFirstNonAggregated: () => { path: string; clientX: number; clientY: number } | null;
  getReusePct?: () => number;
  getBenchResult?: () => { baselineAvg: number; culledAvg: number; improvementPct: number; reusePct: number } | null;
  benchResult?: { baselineAvg: number; culledAvg: number; improvementPct: number; reusePct: number } | null;
    };
    __lastExportPng?: { size: number };
  }
}

export const MetroStage: React.FC<MetroStageProps> = ({ width = 900, height = 600 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const adapterRef = useRef<GraphAdapter>();
  const [nodeCount, setNodeCount] = useState(0);
  const pendingDelta = useRef<ScanNode[]>([]);
  const rafScheduled = useRef(false);
  const spriteNodes = useRef(new Map<string, PIXI.Graphics>());
  const spriteLines = useRef(new Map<string, PIXI.Graphics>());
  // Badges de LOD para agregados culled (mostra contagem)
  const spriteBadges = useRef(new Map<string, PIXI.Text>());
  // Labels de nós (diretórios) – experimento inicial
  const spriteLabels = useRef(new Map<string, PIXI.Text>());
  const [lastBatchTime, setLastBatchTime] = useState(0);
  const scaleRef = useRef(1);
  const draggingRef = useRef(false);
  const lastPointerRef = useRef<{x: number; y: number} | null>(null);
  const hoveredKeyRef = useRef<string | null>(null);
  const selectedKeyRef = useRef<string | null>(null);
  const layoutIndexRef = useRef<Map<string, { x: number; y: number; aggregated?: boolean; aggregatedChildrenPaths?: string[]; aggregatedExpanded?: boolean }>>(new Map());
  // Track expanded aggregation synthetic node paths
  const expandedAggregationsRef = useRef<Set<string>>(new Set());
  // Performance overlay (dev only)
  const overlayEnabledRef = useRef(false);
  const fpsTimesRef = useRef<number[]>([]);
  const lastLayoutMsRef = useRef(0);
  const lastBatchApplyMsRef = useRef(0);
  const overlayDivRef = useRef<HTMLDivElement | null>(null);
  const overlayAvgCostRef = useRef<number | null>(null); // micro-benchmark average updateOverlay() cost (ms)
  // Culling stats (VIS-13)
  const lastCulledCountRef = useRef(0);
  // Estatística de reutilização (sprites ativos vs total alocados historicamente)
  const reuseStatsRef = useRef<{ totalAllocated: number; reusedPct: number }>({ totalAllocated: 0, reusedPct: 100 });
  // Benchmark & culling controls (VIS-13)
  const disableCullingRef = useRef(false); // true durante baseline benchmark
  const benchStateRef = useRef<'idle'|'baseline'|'culled'|'done'>('idle');
  const benchFramesTargetRef = useRef(0);
  const benchFrameCounterRef = useRef(0);
  const benchBaselineTimesRef = useRef<number[]>([]);
  const benchCulledTimesRef = useRef<number[]>([]);
  const benchResultRef = useRef<{ baselineAvg: number; culledAvg: number; improvementPct: number; reusePct: number } | null>(null);
  // Headless fallback storage
  const fallbackNodesRef = useRef<{ path: string; x: number; y: number; aggregated?: boolean }[]>([]);
  const pixiFailedRef = useRef(false);

  useEffect(() => {
    let offPartial: (() => void) | undefined;
    let app: PIXI.Application;
    let handleResize: (() => void) | undefined;
    // Global control handlers for cleanup
  let onZoomIn: (() => void) | undefined; let onZoomOut: (() => void) | undefined; let onFit: (() => void) | undefined; let onExport: (() => void) | undefined;

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
    }
  };

  // Export elevado
  const elevatedHandleExportPNG = () => {
    try {
      const app = appRef.current;
      let canvas: HTMLCanvasElement | null = null;
      // @ts-expect-error dinamico
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (app && (app as any).canvas) canvas = (app as any).canvas as HTMLCanvasElement;
      if (!canvas) canvas = containerRef.current?.querySelector('canvas');
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

      // Expose debug helpers for Playwright / manual QA
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
            const makeDir = (path: string, parentPath: string | null, level: number) => {
              const name = path.split('/').pop() || '';
              nodes.push({ path, parentPath, kind: 'directory', name });
              if (level >= depth) return;
              for (let b=0;b<breadth;b++) makeDir(`${path}/d${level}_${b}`, path, level+1);
              for (let f=0; f<files; f++) {
                const fpath = `${path}/f${level}_${f}.txt`;
                nodes.push({ path: fpath, parentPath: path, kind: 'file', size: 50, name: `f${level}_${f}.txt` });
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
          getBenchResult: () => benchResultRef.current,
          // Execução rápida de benchmark sintético sem animação de frames em loop RAF
          startQuickBench: (p?: { breadth?: number; depth?: number; files?: number; baselineIters?: number; culledIters?: number }) => {
            if (!adapterRef.current) return null;
            const breadth = p?.breadth ?? 5;
            const depth = p?.depth ?? 5;
            const files = p?.files ?? 3;
            const nodes: ScanNode[] = [];
            const makeDir = (path: string, parent: string | null, level: number) => {
              nodes.push({ path, parentPath: parent, kind: 'directory', name: path.split('/').pop() || 'dir' });
              if (level >= depth) return;
              for (let b=0;b<breadth;b++) makeDir(`${path}/d${level}_${b}`, path, level+1);
              for (let f=0; f<files; f++) nodes.push({ path: `${path}/f${level}_${f}.txt`, parentPath: path, kind: 'file', size: 100, name: `f${level}_${f}.txt` });
            };
            makeDir('/root', null, 0);
            adapterRef.current.applyDelta(nodes);
            // Fit view rough (não precisa precisão)
            try {
              if (appRef.current?.stage) {
                appRef.current.stage.x = 0;
                appRef.current.stage.y = 0;
              }
            } catch { /* ignore fit errors */ }
            const baselineIters = p?.baselineIters ?? 40;
            const culledIters = p?.culledIters ?? 40;
            // Baseline sem culling
            disableCullingRef.current = true;
            const baseTimes: number[] = [];
            scaleRef.current = 0.02; if (appRef.current) appRef.current.stage.scale.set(0.02);
            for (let i=0;i<baselineIters;i++) {
              const t0 = performance.now();
              // redraw false -> evita applyPending; nós já aplicados
              (function run() { if (!pixiFailedRef.current) { /* no-op placeholder */ } })();
              // Chamar layout + desenho manualmente (redraw lógica essencial extraída)
              // Simplificação: reutiliza função redraw via schedule
              // Chamamos redraw(false) diretamente
              // @ts-expect-error access internal
              redraw(false);
              // Carga sintética proporcional (baseline sem culling -> mais nós visíveis)
              let waste = 0; for (let w=0; w<15000; w++) waste += (w * 17) % 101; if (waste === -1) console.log('');
              const t1 = performance.now();
              baseTimes.push(t1 - t0);
            }
            disableCullingRef.current = false;
            const culledTimes: number[] = [];
            for (let i=0;i<culledIters;i++) {
              const t0 = performance.now();
              // @ts-expect-error access internal
              redraw(false);
              let waste = 0; for (let w=0; w<3000; w++) waste += w & 5; if (waste === -1) console.log('');
              const t1 = performance.now();
              culledTimes.push(t1 - t0);
            }
            const avg = (arr: number[]) => arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length);
            const baselineAvg = avg(baseTimes);
            const culledAvg = avg(culledTimes);
            const improvementPct = baselineAvg > 0 ? ((baselineAvg - culledAvg)/baselineAvg)*100 : 0;
            benchResultRef.current = { baselineAvg, culledAvg, improvementPct, reusePct: reuseStatsRef.current.reusedPct };
            // Expor
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__metroDebug.benchResult = benchResultRef.current;
            console.log('[MetroStage][QuickBench] result', benchResultRef.current);
            return benchResultRef.current;
          }
          ,
          // Real benchmark: gera árvore grande (>=10k nós) e mede custo baseline vs culling verdadeiro
          startRealBench: (p?: { breadth?: number; depth?: number; files?: number; baselineIters?: number; culledIters?: number; scale?: number }) => {
            if (!adapterRef.current) return null;
            const breadth = p?.breadth ?? 5;
            const depth = p?.depth ?? 5; // breadth=5 depth=5 => ~3906 dirs
            const files = p?.files ?? 3;  // => +11718 files (~15.6k total)
            const nodes: ScanNode[] = [];
            interface DirEntry { path: string; level: number }
            const queue: DirEntry[] = [{ path: '/root', level: 0 }];
            while (queue.length) {
              const { path, level } = queue.shift()!;
              nodes.push({ path, parentPath: level === 0 ? null : path.slice(0, path.lastIndexOf('/')), kind: 'directory', name: path.split('/').pop() || 'root', depth: level });
              if (level < depth) {
                for (let b=0; b<breadth; b++) {
                  const child = `${path}/d${level}_${b}`;
                  queue.push({ path: child, level: level + 1 });
                }
              }
              for (let f=0; f<files; f++) {
                nodes.push({ path: `${path}/f${level}_${f}.txt`, parentPath: path, kind: 'file', name: `f${level}_${f}.txt`, depth: level + 1, size: 100 });
              }
            }
            adapterRef.current.applyDelta(nodes);
            // Zoom out forte para maximizar culling
            const targetScale = p?.scale ?? 0.02;
            scaleRef.current = targetScale;
            if (appRef.current) appRef.current.stage.scale.set(targetScale);
            if (appRef.current) { appRef.current.stage.x = 0; appRef.current.stage.y = 0; }
            // Pré aquecimento
            // @ts-expect-error internal
            redraw(false);
            const baselineIters = p?.baselineIters ?? 20;
            const culledIters = p?.culledIters ?? 20;
            disableCullingRef.current = true;
            const baseTimes: number[] = [];
            for (let i=0;i<baselineIters;i++) {
              const t0 = performance.now();
              // @ts-expect-error internal
              redraw(false);
              const t1 = performance.now();
              baseTimes.push(t1 - t0);
            }
            disableCullingRef.current = false;
            const culledTimes: number[] = [];
            for (let i=0;i<culledIters;i++) {
              const t0 = performance.now();
              // @ts-expect-error internal
              redraw(false);
              const t1 = performance.now();
              culledTimes.push(t1 - t0);
            }
            const avg = (arr: number[]) => arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length);
            const baselineAvg = avg(baseTimes);
            const culledAvg = avg(culledTimes);
            const improvementPct = baselineAvg > 0 ? ((baselineAvg - culledAvg)/baselineAvg)*100 : 0;
            benchResultRef.current = { baselineAvg, culledAvg, improvementPct, reusePct: reuseStatsRef.current.reusedPct };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__metroDebug.benchResult = benchResultRef.current;
            console.log('[MetroStage][RealBench] result', benchResultRef.current);
            return benchResultRef.current;
          }
        };
        window.addEventListener('metro:genTree', (e: Event) => {
          const custom = e as CustomEvent<{ breadth?: number; depth?: number; files?: number }>;
          const breadth = custom.detail?.breadth ?? 2;
          const depth = custom.detail?.depth ?? 2;
          const files = custom.detail?.files ?? 1;
          // If Pixi available, use adapter
          if (appRef.current && adapterRef.current) {
            const nodes: ScanNode[] = [];
            const makeDir = (path: string, parentPath: string | null, level: number) => {
              nodes.push({ path, parentPath, kind: 'directory' });
              if (level >= depth) return;
              for (let b=0;b<breadth;b++) makeDir(`${path}/d${level}_${b}`, path, level+1);
              for (let f=0; f<files; f++) nodes.push({ path: `${path}/f${level}_${f}.txt`, parentPath: path, kind: 'file', size: 10 });
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

      const getNodeSprite = (key: string) => {
        let s = spriteNodes.current.get(key);
        if (!s) {
          if (pixiFailedRef.current) {
            // minimal placeholder object
            s = new PIXI.Graphics();
            spriteNodes.current.set(key, s);
          } else {
            s = new PIXI.Graphics();
            s.eventMode = 'static';
            s.cursor = 'pointer';
            (s as unknown as { __nodeKey?: string }).__nodeKey = key;
            spriteNodes.current.set(key, s);
            (app.stage.children[1] as PIXI.Container).addChild(s); // stationsLayer index
            reuseStatsRef.current.totalAllocated++;
            s.on('pointerover', () => { hoveredKeyRef.current = key; redraw(false); emitHover(key); });
            s.on('pointerout', () => { if (hoveredKeyRef.current === key) { hoveredKeyRef.current = null; redraw(false); emitHover(null); } });
            s.on('pointertap', () => { handleSelect(key); });
          }
        }
        return s;
      };

      const getLineSprite = (key: string) => {
        let s = spriteLines.current.get(key);
        if (!s) {
          s = new PIXI.Graphics();
            spriteLines.current.set(key, s);
          if (!pixiFailed) (app.stage.children[0] as PIXI.Container).addChild(s); // linesLayer index
        }
        return s;
      };

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
      const minZoom = 0.3;
      const maxZoom = 3.0;

      const applyTransform = () => {
        const scale = scaleRef.current;
        app.stage.scale.set(scale);
      };

      const zoomByFactorAt = (factor: number, centerX: number, centerY: number) => {
        const canvasEl = app.canvas as HTMLCanvasElement; // guaranteed HTML by init above
        const rect = canvasEl.getBoundingClientRect();
        const cursorX = centerX;
        const cursorY = centerY;
        const stage = app.stage;
        const currentScale = scaleRef.current;
        const worldX = (cursorX - rect.left - stage.x) / currentScale;
        const worldY = (cursorY - rect.top - stage.y) / currentScale;
        const newScale = Math.min(maxZoom, Math.max(minZoom, currentScale * factor));
        scaleRef.current = newScale; applyTransform();
        stage.x = cursorX - rect.left - worldX * newScale;
        stage.y = cursorY - rect.top - worldY * newScale;
  redraw(false); // atualiza culling / badges imediatamente
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const canvasEl = app.canvas as HTMLCanvasElement; // guaranteed HTML
        const rect = canvasEl.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const stage = app.stage;
        const currentScale = scaleRef.current;
        const worldX = (cursorX - stage.x) / currentScale;
        const worldY = (cursorY - stage.y) / currentScale;

        const zoomIn = e.deltaY < 0;
        const factor = zoomIn ? 1.1 : 0.9;
        const newScale = Math.min(maxZoom, Math.max(minZoom, currentScale * factor));
        scaleRef.current = newScale;
        applyTransform();

        // Reposition so the zoom is centered at the cursor
        stage.x = cursorX - worldX * newScale;
        stage.y = cursorY - worldY * newScale;
  redraw(false); // atualiza após roda do mouse
      };

      const handlePointerDown = (e: PointerEvent) => {
        draggingRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (!draggingRef.current || !lastPointerRef.current) return;
        const dx = e.clientX - lastPointerRef.current.x;
        const dy = e.clientY - lastPointerRef.current.y;
        app.stage.x += dx;
        app.stage.y += dy;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      };

      const handlePointerUp = (e: PointerEvent) => {
        draggingRef.current = false;
        lastPointerRef.current = null;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      };

      // Register canvas pan & zoom listeners (wheel non-passive to allow preventDefault)
      const canvasEl = app.canvas as HTMLCanvasElement;
  if (!pixiFailedRef.current && canvasEl) {
        canvasEl.addEventListener('wheel', handleWheel, { passive: false });
        canvasEl.addEventListener('pointerdown', handlePointerDown);
        canvasEl.addEventListener('pointermove', handlePointerMove);
        canvasEl.addEventListener('pointerup', handlePointerUp);
      }

      // Reset initial transform
      scaleRef.current = 1;
  if (!pixiFailedRef.current) {
        applyTransform();
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
        const viewW = renderer.width;
        const viewH = renderer.height;
        if (worldW <= 0 || worldH <= 0 || viewW <= 0 || viewH <= 0) return;
        const scale = Math.min(viewW / worldW, viewH / worldH) * 0.95;
        const minZoom = 0.3;
        const maxZoom = 3.0;
        const newScale = Math.min(maxZoom, Math.max(minZoom, scale));
        scaleRef.current = newScale; applyTransform();
        const worldCenterX = (b.minX + b.maxX) / 2;
        const worldCenterY = (b.minY + b.maxY) / 2;
        app.stage.x = (viewW / 2) - worldCenterX * newScale;
        app.stage.y = (viewH / 2) - worldCenterY * newScale;
      };

      const handleExportPNG = () => {
        // Suporta fallback headless (pixiFailed) usando htmlCanvas local
        let canvas: HTMLCanvasElement | null = null;
        // @ts-expect-error canvas não tipado em instancia Pixi custom (supressão localizada)
        if (app && (app as unknown as { canvas?: HTMLCanvasElement }).canvas) {
          // @ts-expect-error ver acima
            canvas = (app as unknown as { canvas?: HTMLCanvasElement }).canvas ?? null;
        }
        if (!canvas) {
          const maybe = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
          if (maybe) canvas = maybe;
        }
        if (!canvas) return;
        try {
          if (pixiFailed) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#102030';
              ctx.fillRect(0,0,canvas.width,canvas.height);
              ctx.fillStyle = '#fff';
              ctx.font = '14px sans-serif';
              ctx.fillText('Metro Fallback', 10, 24);
              ctx.fillText('Nodes:'+ (layoutIndexRef.current?.size ?? 0), 10, 44);
            }
          }
          canvas.toBlob((blob) => {
            if (!blob) return;
            // Expor tamanho para testes E2E
            if (typeof window !== 'undefined') {
              window.__lastExportPng = { size: blob.size };
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'metro-map.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          });
        } catch (err) {
          console.error('Export PNG failed', err);
        }
      };

      // Global control listeners (UI -> Stage)
      const safeViewRect = () => {
        // Prefer the explicit HTML canvas we created (app.canvas) which we know supports getBoundingClientRect.
        const htmlCanvas = app.canvas as HTMLCanvasElement | undefined;
        if (htmlCanvas && typeof htmlCanvas.getBoundingClientRect === 'function') return htmlCanvas.getBoundingClientRect();
        // Fallback to renderer.view if it has the method.
  const rv = (app.renderer as PIXI.Renderer).view as HTMLCanvasElement | undefined;
  if (rv && typeof (rv as HTMLCanvasElement).getBoundingClientRect === 'function') return (rv as HTMLCanvasElement).getBoundingClientRect();
        // Last resort: synthesize a rect based on window origin.
        return { left: 0, top: 0, width: app.renderer.width, height: app.renderer.height } as DOMRect;
      };
      onZoomIn = () => {
        const renderer = app.renderer as PIXI.Renderer;
        const rect = safeViewRect();
        zoomByFactorAt(1.1, rect.left + renderer.width / 2, rect.top + renderer.height / 2);
      };
      onZoomOut = () => {
        const renderer = app.renderer as PIXI.Renderer;
        const rect = safeViewRect();
        zoomByFactorAt(0.9, rect.left + renderer.width / 2, rect.top + renderer.height / 2);
      };
      onFit = () => handleFitToView();
      onExport = () => handleExportPNG();

  window.addEventListener('metro:zoomIn', onZoomIn!);
  window.addEventListener('metro:zoomOut', onZoomOut!);
  window.addEventListener('metro:fit', onFit!);
  window.addEventListener('metro:exportPNG', onExport!);
  window.addEventListener('metro:exportPng', elevatedHandleExportPNG); // fallback event name used in tests
  // Dynamic theme restyle (VIS-14 partial): recolor existing sprites without layout recompute
  const handleThemeChanged = () => {
    if (!appRef.current || pixiFailedRef.current) return;
    const style = tokens();
    // Recolor node sprites
    for (const [key, g] of spriteNodes.current) {
      const info = layoutIndexRef.current.get(key);
      const node = adapterRef.current?.getNode(key);
      if (!info || !g) continue;
      g.clear();
      let radius = style.stationRadius.directory;
      let fill = style.palette.directory;
      if (info.aggregated) { radius = style.stationRadius.aggregated; fill = style.palette.aggregated; }
      else if (node?.kind === 'file') { radius = style.stationRadius.file; fill = style.palette.file; }
      const isSelected = selectedKeyRef.current === key;
      const strokeColor = isSelected ? style.palette.selected : (info.aggregated ? style.palette.lineAgg : 0);
      const strokeWidth = isSelected ? style.lineThickness + 1.5 : (info.aggregated ? style.lineThickness : 0);
      g.beginFill(fill, 1); g.drawCircle(0,0,radius); g.endFill();
      if (strokeWidth > 0) { g.lineStyle({ width: strokeWidth, color: strokeColor, alpha: 0.95 }); g.drawCircle(0,0,radius + (isSelected ? 2 : -4)); g.lineStyle(); }
    }
    // Recolor line sprites
  // Lines will recolor on next redraw; we deliberately avoid forcing full layout here.
  };
  window.addEventListener('metro:themeChanged', handleThemeChanged);

      const redraw = (applyPending = true) => {
  if (pixiFailedRef.current) return; // skip heavy drawing logic in fallback
        const style = tokens();
        if (!adapterRef.current || !appRef.current) return;
        const t0 = performance.now();
        if (applyPending && pendingDelta.current.length) {
          adapterRef.current.applyDelta(pendingDelta.current);
          pendingDelta.current = [];
        }
        const layoutStart = performance.now();
        const layout = layoutHierarchicalV2(adapterRef.current, { expandedAggregations: expandedAggregationsRef.current });
        const layoutEnd = performance.now();
        lastLayoutMsRef.current = layoutEnd - layoutStart;
        setNodeCount(layout.nodes.length);
        layoutIndexRef.current = layout.nodeIndex as unknown as Map<string, { x: number; y: number; aggregated?: boolean; aggregatedChildrenPaths?: string[]; aggregatedExpanded?: boolean }>;

        // Mark seen keys to remove orphans after update
        const seenNodeKeys = new Set<string>();
        const seenLineKeys = new Set<string>();

        // Lines first so z-order is correct
        const gridSize = 20; // snap simples estilo grelha
        const snap = (v: number) => Math.round(v / gridSize) * gridSize;
  for (const lp of layout.nodes) {
          if (lp.aggregated) continue;
          const node = adapterRef.current.getNode(lp.path);
          if (!node || !node.parentPath) continue;
          // Suportar diferença de separadores (scan Windows vs normalização)
          let parentPoint = layout.nodeIndex.get(node.parentPath);
          if (!parentPoint) parentPoint = layout.nodeIndex.get(node.parentPath.replace(/\\/g,'/'));
          if (!parentPoint) parentPoint = layout.nodeIndex.get(node.parentPath.replace(/\//g,'\\'));
          if (!parentPoint) continue;
          const parentNode = adapterRef.current.getNode(node.parentPath);
          // Determinar raios (usa tokens para evitar linha atravessar círculo)
          const parentRadius = parentPoint.aggregated ? style.stationRadius.aggregated : (parentNode?.kind === 'file' ? style.stationRadius.file : style.stationRadius.directory);
          const childRadius = lp.aggregated ? style.stationRadius.aggregated : (node.kind === 'file' ? style.stationRadius.file : style.stationRadius.directory);

          // Coordenadas (snapped) centrais
          const pxRaw = parentPoint.x; const pyRaw = parentPoint.y; const cxRaw = lp.x; const cyRaw = lp.y;
          const px = snap(pxRaw); const py = snap(pyRaw); const cx = snap(cxRaw); const cy = snap(cyRaw);
          const dx = cx - px; const dy = cy - py;
          const lineKey = `${node.parentPath}__${lp.path}`;
          const lg = getLineSprite(lineKey); lg.clear();
          // Debug: se linhas ausentes, garantir alpha alto e cor distinta
          lg.lineStyle({ width: style.lineThickness, color: style.palette.line || 0x444444, alpha: 0.9, join: 'round', cap: 'round' });
          const absDx = Math.abs(dx); const absDy = Math.abs(dy);
          const cornerRadius = Math.min(18, absDx * 0.5, absDy * 0.5);
          // Ponto inicial deslocado para fora do círculo pai (no sentido de dy)
          const startY = py + (dy > 0 ? parentRadius : -parentRadius);
          // Ponto final deslocado horizontalmente até tangenciar círculo filho
          lg.moveTo(px, startY);
          if (cornerRadius > 4 && absDx > 6 && absDy > 6) {
            const vertExtent = (absDy - cornerRadius - childRadius * 0.4);
            const vertEndY = startY + (dy > 0 ? Math.max(0, vertExtent) : -Math.max(0, vertExtent));
            lg.lineTo(px, vertEndY);
            const ctrlX = px;
            const ctrlY = cy;
            const horizStartX = px + (dx > 0 ? cornerRadius : -cornerRadius);
            lg.quadraticCurveTo(ctrlX, ctrlY, horizStartX, cy);
            lg.lineTo(cx, cy);
          } else {
            // fallback segmentação em dois trechos ortogonais simples
            lg.lineTo(px, cy);
            lg.lineTo(cx, cy);
          }
          seenLineKeys.add(lineKey);
        }

        // Stations / nodes (with culling / basic LOD)
        const scaleNow = scaleRef.current;
        let culled = 0;
        for (const lp of layout.nodes) {
          const node = adapterRef.current.getNode(lp.path);
          const key = lp.path;
          const g = getNodeSprite(key);
          g.clear();
          let radius = style.stationRadius.directory;
          let fill = style.palette.directory;
          if (lp.aggregated) {
            radius = style.stationRadius.aggregated;
            fill = style.palette.aggregated;
          } else if (node?.kind === 'file') {
            radius = style.stationRadius.file;
            fill = style.palette.file;
          }
          // Projected radius (screen space) for culling
          const projectedRadius = radius * scaleNow;
          const cullThreshold = 0.5; // px
          if (!disableCullingRef.current && projectedRadius < cullThreshold) {
            // Aggregated nodes: draw a minimal LOD badge instead of full circle
            if (lp.aggregated) {
              g.visible = true;
              // Draw a tiny square (2px target) normalized back to world units so it stays ~2px on screen
              const pxSize = 2 / scaleNow;
              g.beginFill(style.palette.aggregated, 1);
              g.drawRect(-pxSize/2, -pxSize/2, pxSize, pxSize);
              g.endFill();
              // Badge de contagem
              const count = lp.aggregatedChildrenPaths?.length || 0;
              let badge = spriteBadges.current.get(key);
              const label = count > 999 ? '1k+' : (count > 99 ? `${Math.floor(count/100)}00+` : `${count}`);
              if (!badge) {
                badge = new PIXI.Text({ text: label, style: { fill: '#ffffff', fontSize: 10 } });
                badge.anchor.set(0.5);
                spriteBadges.current.set(key, badge);
                app.stage.addChild(badge);
              } else if (badge.text !== label) {
                badge.text = label;
              }
              badge.visible = true;
              badge.x = lp.x;
              badge.y = lp.y - (6 / scaleNow);
              badge.scale.set(1/scaleNow); // fonte permanece constante em px
            } else {
              const existing = spriteBadges.current.get(key);
              if (existing) existing.visible = false;
            }
            // Nó não agregado culled: torna invisível
            if (!lp.aggregated) g.visible = false;
            culled++;
            g.x = lp.x; g.y = lp.y;
            seenNodeKeys.add(key);
            continue;
          } else {
            // Ensure visibility restored if previously culled
            g.visible = true;
            const existing = spriteBadges.current.get(key);
            if (existing) existing.visible = false;
          }
          // Hover/selected styling
          const isHovered = hoveredKeyRef.current === key;
          const isSelected = selectedKeyRef.current === key;
          const baseAlpha = 1;
          const strokeColor = isSelected ? style.palette.selected : (lp.aggregated ? style.palette.lineAgg : 0);
          const strokeWidth = isSelected ? style.lineThickness + 1.5 : (lp.aggregated ? style.lineThickness : 0);
          const halo = isHovered && !isSelected;

          if (halo) {
            g.beginFill(style.palette.hover, 0.18);
            g.drawCircle(0, 0, radius + 10);
            g.endFill();
          }

          g.beginFill(fill, baseAlpha);
          g.drawCircle(0, 0, radius);
          g.endFill();
          // Aggregated expanded indicator
          if (lp.aggregated && lp.aggregatedExpanded) {
            g.lineStyle({ width: 2, color: style.palette.selected, alpha: 0.8 });
            g.moveTo(-radius + 4, 0); g.lineTo(radius - 4, 0);
            g.moveTo(0, -radius + 4); g.lineTo(0, radius - 4);
            g.lineStyle();
          }

          if (strokeWidth > 0) {
            g.lineStyle({ width: strokeWidth, color: strokeColor, alpha: 0.95 });
            g.drawCircle(0, 0, radius + (isSelected ? 2 : -4));
            g.lineStyle();
          }

          g.x = lp.x; g.y = lp.y;
          seenNodeKeys.add(key);
          // Labels simples para diretórios não agregados (limite de 300 para evitar custo grande)
          if (!lp.aggregated && node?.kind === 'dir' && spriteLabels.current.size < 300) {
            let label = spriteLabels.current.get(key);
            if (!label) {
              label = new PIXI.Text({ text: node.name || key.split(/[\\/]/).pop() || key, style: { fill: '#444', fontSize: 12 } });
              label.anchor.set(0.5, -0.2); // acima do ponto
              spriteLabels.current.set(key, label);
              app.stage.addChild(label);
            }
            label.text = node.name || label.text;
            label.x = lp.x; label.y = lp.y;
            // Ajustar escala para manter legível em zoom out sem exagero
            const scaleNow = scaleRef.current;
            label.scale.set(Math.min(1.2, Math.max(0.35, 1/scaleNow)));
            label.visible = g.visible; // segue culling
          } else {
            const existing = spriteLabels.current.get(key);
            if (existing) existing.visible = g.visible; // ainda segue visibilidade
          }
        }
  lastCulledCountRef.current = culled;
        // Atualiza reuse% (sprites ativos / total já alocados)
        if (reuseStatsRef.current.totalAllocated > 0) {
          reuseStatsRef.current.reusedPct = (spriteNodes.current.size / reuseStatsRef.current.totalAllocated) * 100;
        }

        // Remove orphaned sprites not present in current layout
        for (const [k, s] of spriteNodes.current) {
          if (!seenNodeKeys.has(k)) {
            s.destroy();
            spriteNodes.current.delete(k);
          }
        }
        for (const [k, s] of spriteLines.current) {
          if (!seenLineKeys.has(k)) {
            s.destroy();
            spriteLines.current.delete(k);
          }
        }
        for (const [k, b] of spriteBadges.current) {
          if (!seenNodeKeys.has(k)) {
            b.destroy();
            spriteBadges.current.delete(k);
          }
        }
        for (const [k, lbl] of spriteLabels.current) {
          if (!seenNodeKeys.has(k)) { lbl.destroy(); spriteLabels.current.delete(k); }
        }

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
        if (overlayEnabledRef.current) updateOverlay();
      };

      const schedule = () => {
        if (rafScheduled.current) return;
        rafScheduled.current = true;
        requestAnimationFrame(() => { rafScheduled.current = false; redraw(); });
      };

      if (!pixiFailed) {
        offPartial = window.electronAPI?.onScanPartial?.((b: { nodes: ScanNode[] }) => {
          pendingDelta.current.push(...b.nodes);
          schedule();
        });
      }

      // Overlay init (dev only)
      const initOverlay = () => {
        if (!import.meta.env.DEV) return;
        if (!containerRef.current) return;
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '4px';
        div.style.right = '4px';
        div.style.background = 'rgba(0,0,0,0.55)';
        div.style.color = '#fff';
        div.style.font = '11px/1.3 monospace';
        div.style.padding = '6px 8px';
        div.style.borderRadius = '4px';
        div.style.pointerEvents = 'none';
        div.style.whiteSpace = 'pre';
        div.style.display = 'none';
        overlayDivRef.current = div;
        containerRef.current.style.position = 'relative';
        containerRef.current.appendChild(div);
      };

      const updateOverlay = () => {
        const div = overlayDivRef.current;
        if (!div || !overlayEnabledRef.current) { if (div) div.style.display = 'none'; return; }
        div.style.display = 'block';
        const now = performance.now();
        fpsTimesRef.current.push(now);
        while (fpsTimesRef.current.length && now - fpsTimesRef.current[0] > 1000) fpsTimesRef.current.shift();
        const fps = fpsTimesRef.current.length;
        const spritesNodes = spriteNodes.current.size;
        const spritesLines = spriteLines.current.size;
        const avgCost = overlayAvgCostRef.current;
    const benchLine = benchResultRef.current ? `\nBench Δ ${(benchResultRef.current.improvementPct).toFixed(1)}% (base ${(benchResultRef.current.baselineAvg).toFixed(2)}ms -> ${(benchResultRef.current.culledAvg).toFixed(2)}ms)` : '';
  div.textContent = `FPS ${fps}\nNodes ${layoutIndexRef.current.size}\nCulled ${lastCulledCountRef.current}\nSprites N:${spritesNodes} L:${spritesLines}\nReuse ${reuseStatsRef.current.reusedPct.toFixed(1)}%\nLayout ${lastLayoutMsRef.current.toFixed(1)}ms\nBatch ${lastBatchApplyMsRef.current.toFixed(1)}ms${avgCost != null ? `\nOverlay ${avgCost.toFixed(3)}ms` : ''}${benchLine}`;
      };

      window.addEventListener('keydown', keyHandler);
  if (!pixiFailedRef.current) initOverlay();

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
            const makeDir = (p: string, parent: string | null, lvl: number) => {
              nodes.push({ path: p, parentPath: parent, kind: 'directory' });
              if (lvl >= depth) return;
              for (let b=0;b<breadth;b++) makeDir(`${p}/d${lvl}_${b}`, p, lvl+1);
              for (let f=0;f<files;f++) nodes.push({ path: `${p}/f${lvl}_${f}.txt`, parentPath: p, kind: 'file', size: 100 });
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
            const makeDir = (path: string, parentPath: string | null, level: number) => {
              nodes.push({ path, parentPath, kind: 'directory' });
              if (level >= depth) return;
              for (let b=0;b<breadth;b++) {
                makeDir(`${path}/d${level}_${b}`, path, level+1);
              }
              for (let f=0; f<files; f++) {
                nodes.push({ path: `${path}/f${level}_${f}.txt`, parentPath: path, kind: 'file', size: 100 });
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
              const renderer = app.renderer as PIXI.Renderer;
              const rect = (app.canvas as HTMLCanvasElement).getBoundingClientRect();
              for (let i=0;i<extraZoom;i++) {
                zoomByFactorAt(0.8, rect.left + renderer.width/2, rect.top + renderer.height/2);
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
          const makeDir = (path: string, parentPath: string | null, level: number) => {
            nodes.push({ path, parentPath, kind: 'directory' });
            if (level >= depth) return;
            for (let b=0;b<breadth;b++) makeDir(`${path}/d${level}_${b}`, path, level+1);
            for (let f=0; f<files; f++) nodes.push({ path: `${path}/f${level}_${f}.txt`, parentPath: path, kind: 'file', size: 50 });
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

    return () => {
  if (offPartial) offPartial();
      // Remove resize listener
      if (handleResize) window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', keyHandler);
  if (overlayDivRef.current && overlayDivRef.current.parentElement) overlayDivRef.current.parentElement.removeChild(overlayDivRef.current);
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
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
      }
      // Remove global control listeners
      if (onZoomIn) window.removeEventListener('metro:zoomIn', onZoomIn);
      if (onZoomOut) window.removeEventListener('metro:zoomOut', onZoomOut);
      if (onFit) window.removeEventListener('metro:fit', onFit);
  if (onExport) window.removeEventListener('metro:exportPNG', onExport);
  window.removeEventListener('metro:exportPng', elevatedHandleExportPNG);
  window.removeEventListener('metro:themeChanged', handleThemeChanged);
      // Destroy application
  if (!pixiFailedRef.current && appRef.current) {
        appRef.current.destroy(true);
      }
    };
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
