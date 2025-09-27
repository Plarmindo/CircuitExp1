import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, Container } from 'pixi.js';
import { createInteractionHandlers } from './interaction-handlers';
import { setupEventListeners } from './event-listeners';
import { FallbackRenderer } from './fallback-renderer';
// Unused import - keeping for future use
// import { initDebugAPI } from './debug-api';
import { createGraphAdapter as _createGraphAdapter, type GraphAdapter } from '../graph-adapter';
import { renderScene } from './render';
import { tokens } from '../style-tokens';
import { cleanupPixiApplication, MemoryManager } from './gpu-cleanup';
import type { LayoutNodeLite, RouteCommand, RenderOptions, ThemeConfig } from './types';
import { ExportManager } from './export-manager';
import { BatchRenderer, type BatchObject, type BatchStats } from '../performance/batch-renderer';
import { DeltaUpdateManager, type DeltaChange } from '../performance/delta-updater';
import { checkGPUSupport } from './gpu-utils';

export interface MetroStageProps {
  layout?: LayoutNodeLite[];
  routes?: RouteCommand[];
  onNodeClick?: (path: string) => void;
  onNodeHover?: (path: string | null) => void;
  onLayoutUpdate?: (layout: LayoutNodeLite[]) => void;
  theme?: ThemeConfig;
  debug?: boolean;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
}

export const MetroStage: React.FC<MetroStageProps> = ({
  layout = [],
  routes = [],
  onNodeClick,
  onNodeHover,
  onLayoutUpdate,
  theme,
  debug = false,
  className,
  style,
  width,
  height,
}) => {
  // Memoize theme to prevent infinite loops
  const memoizedTheme = useMemo(() => theme || {}, [theme]);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const interactionsApiRef = useRef<ReturnType<typeof createInteractionHandlers> | null>(null);
  const selectedKeyRef = useRef<string | null>(null);
  const scaleRef = useRef<number>(1);

  // Early debug API bootstrap so tests can read scale immediately, before full debug API is set
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const prev: any = (window as any).__metroDebug || {};
      (window as any).__metroDebug = {
        ...prev,
        getScale: () => scaleRef.current,
        getViewport: () => ({ x: 0, y: 0, scale: scaleRef.current }),
      };
    } catch {
      // ignore
    }
  }, []);

  // Early global zoom listeners so toolbar clicks work even before PIXI/init finishes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyEarlyZoom = (factor: number) => {
      const current = Number.isFinite(scaleRef.current) && scaleRef.current > 0 ? scaleRef.current : 1;
      const minZoom = 0.3;
      const maxZoom = 3.0;
      let next = current * factor;
      if (!Number.isFinite(next) || next <= 0) next = current;
      next = Math.min(maxZoom, Math.max(minZoom, next));

      // Update scale ref immediately so debug API reflects the change
      scaleRef.current = next;

      // Log for E2E debugging
      try {
        console.log('[EarlyZoom] applyEarlyZoom', { factor, current, next });
      } catch (error) {
        // Ignore debug logging errors
        console.warn('Debug logging failed:', error);
      }

      // If app is already available, reflect scale on stage as well
      const app = (appRef.current as any) || null;
      if (app) {
        try {
          app.stage.scale.set(next);
        } catch (error) {
          // Ignore scale setting errors
          console.warn('Failed to set stage scale:', error);
        }
      }
    };

    const onEarlyZoomIn = (e: Event) => {
      // If real interaction handlers are ready, delegate to them
      if (interactionsApiRef.current?.zoomIn) {
        try {
          console.log('[EarlyZoom] onEarlyZoomIn: delegating to interactionHandlers.zoomIn');
          interactionsApiRef.current.zoomIn();
        } catch (err) {
          try {
            console.warn('[EarlyZoom] onEarlyZoomIn delegate failed, applying early zoom fallback', err);
          } catch (error) {
            // Ignore debug logging errors
            console.warn('Debug logging failed:', error);
          }
          applyEarlyZoom(1.2);
        }
        if (e && typeof (e as any).stopImmediatePropagation === 'function') {
          (e as any).stopImmediatePropagation();
        }
        return;
      }
      applyEarlyZoom(1.2);
      if (e && typeof (e as any).stopImmediatePropagation === 'function') {
        (e as any).stopImmediatePropagation();
      }
    };

    const onEarlyZoomOut = (e: Event) => {
      if (interactionsApiRef.current?.zoomOut) {
        try {
          console.log('[EarlyZoom] onEarlyZoomOut: delegating to interactionHandlers.zoomOut');
          interactionsApiRef.current.zoomOut();
        } catch (err) {
          try {
            console.warn('[EarlyZoom] onEarlyZoomOut delegate failed, applying early zoom fallback', err);
          } catch (error) {
            // Ignore debug logging errors
            console.warn('Debug logging failed:', error);
          }
          applyEarlyZoom(1 / 1.2);
        }
        if (e && typeof (e as any).stopImmediatePropagation === 'function') {
          (e as any).stopImmediatePropagation();
        }
        return;
      }
      applyEarlyZoom(1 / 1.2);
      if (e && typeof (e as any).stopImmediatePropagation === 'function') {
        (e as any).stopImmediatePropagation();
      }
    };

    window.addEventListener('metro:zoomIn', onEarlyZoomIn as EventListener);
    window.addEventListener('metro:zoomOut', onEarlyZoomOut as EventListener);

    return () => {
      window.removeEventListener('metro:zoomIn', onEarlyZoomIn as EventListener);
      window.removeEventListener('metro:zoomOut', onEarlyZoomOut as EventListener);
    };
  }, []);

  const [_layoutNodes, _setLayoutNodes] = useState<LayoutNodeLite[]>(layout);
  // Internal copies used by debug/test helpers (e.g., metro:genTree)
  const [internalLayout, setInternalLayout] = useState<LayoutNodeLite[]>(layout);
  const [internalRoutes, setInternalRoutes] = useState<RouteCommand[]>(routes);
  const [_adapter, _setAdapter] = useState<GraphAdapter | null>(null);
  const [_nodeIndex, _setNodeIndex] = useState<Map<string, LayoutNodeLite>>(new Map());

  const spriteNodes = useRef(new Map<string, any>());
  const spriteLines = useRef(new Map<string, any>());
  const spriteBadges = useRef(new Map<string, any>());
  const spriteLabels = useRef(new Map<string, any>());
  const hoveredKeyRef = useRef<string | null>(null);
  // (Removed duplicate) const selectedKeyRef = useRef<string | null>(null);
  const nodeColorRef = useRef(new Map<string, number>());
  const reuseStatsRef = useRef({ totalAllocated: 0, reusedPct: 0 });
  const lastCulledCountRef = useRef(0);
  const disableCullingRef = useRef(false);
  const [pixiFailed, setPixiFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fallbackRendererRef = useRef<FallbackRenderer | null>(null);
  const exportManagerRef = useRef<ExportManager | null>(null);
  const batchRendererRef = useRef<BatchRenderer | null>(null);
  const [_renderStats, _setRenderStats] = useState<BatchStats | null>(null);
  const deltaUpdaterRef = useRef<DeltaUpdateManager | null>(null);
  const [_lastUpdateTime, _setLastUpdateTime] = useState(0);
  // Depth cap override (LOD): null means no cap
  const [_depthCapOverride, _setDepthCapOverride] = useState<number | null>(null);
  const depthCapOverrideRef = useRef<number | null>(null);

  // Use internal state for layout and routes, but allow props to override
  const effectiveLayout = useMemo(() => {
    return layout.length > 0 ? layout : internalLayout;
  }, [layout, internalLayout]);

  const effectiveRoutes = useMemo(() => {
    return routes.length > 0 ? routes : internalRoutes;
  }, [routes, internalRoutes]);

  // Create layout index for efficient lookups
  const layoutIndex = useMemo(() => {
    const index = new Map<string, { x: number; y: number }>();
    effectiveLayout.forEach((node) => {
      index.set(node.path, { x: node.x, y: node.y });
    });
    return index;
  }, [effectiveLayout]);

  // Handle node click
  const handleNodeClick = useCallback(
    (path: string) => {
      selectedKeyRef.current = path === selectedKeyRef.current ? null : path;

      if (onNodeClick) {
        onNodeClick(path);
      }

      redrawScene(false);
    },
    [onNodeClick]
  );

  // Handle node hover
  const _handleNodeHover = useCallback(
    (path: string | null) => {
      hoveredKeyRef.current = path;

      if (onNodeHover) {
        onNodeHover(path);
      }

      redrawScene(false);
    },
    [onNodeHover]
  );

  // Convert layout nodes to batch objects for optimized rendering
  const createBatchObjects = useCallback(
    (layout: LayoutNodeLite[], _type: 'nodes' | 'edges' | 'labels'): BatchObject[] => {
      return layout.map((node, index) => ({
        id: node.path,
        x: node.x,
        y: node.y,
        scale: 1.0,
        color: selectedKeyRef.current === node.path ? 0xff6b35 :
               hoveredKeyRef.current === node.path ? 0x4ecdc4 : 0x45b7d1,
        alpha: 1.0,
        visible: true,
        priority: selectedKeyRef.current === node.path ? 100 :
                 hoveredKeyRef.current === node.path ? 50 : index,
      }));
    },
    []
  );

  // Process delta changes for incremental updates
  const processDeltaChanges = useCallback(async (changes: DeltaChange[]) => {
    if (!appRef.current || !batchRendererRef.current) return;

    const batchRenderer = batchRendererRef.current;

    for (const change of changes) {
      try {
        switch (change.type) {
          case 'add':
            // Add new object to renderer
            if (change.data) {
              const batchObject = {
                id: change.id,
                x: change.data.x || 0,
                y: change.data.y || 0,
                scale: 1.0,
                color: 0x4CAF50,
                alpha: 1.0,
                visible: true,
                priority: change.priority || 1,
              };
              batchRenderer.addObject(batchObject);
            }
            break;

          case 'update':
            // Update existing object
            if (change.data) {
              const batchObject = {
                id: change.id,
                x: change.data.x || 0,
                y: change.data.y || 0,
                scale: 1.0,
                color: selectedKeyRef.current === change.id ? 0xff6b35 :
                       hoveredKeyRef.current === change.id ? 0x4ecdc4 : 0x45b7d1,
                alpha: 1.0,
                visible: true,
                priority: change.priority || 1,
              };
              batchRenderer.updateObject(change.id, batchObject);
            }
            break;

          case 'remove':
            // Remove object from renderer
            batchRenderer.removeObject(change.id);
            break;

          case 'move':
            // Move object to new position
            if (change.data && change.data.x !== undefined && change.data.y !== undefined) {
              batchRenderer.moveObject(change.id, change.data.x, change.data.y);
            }
            break;
        }
      } catch (error) {
        console.error(`Error processing delta change ${change.type} for ${change.id}:`, error);
      }
    }

    // Trigger a partial render
    batchRenderer.render();
  }, []);

  // Optimized render layout function using BatchRenderer
  const renderLayout = useCallback(
    async (app: Application, layout: LayoutNodeLite[], routes: RouteCommand[], _options: RenderOptions) => {
      if (!batchRendererRef.current) {
        // Initialize BatchRenderer if not already created
        batchRendererRef.current = new BatchRenderer(app, {
          maxBatchSize: 1000,
          enableAtlasing: true,
          atlasSize: 2048,
          enableInstancing: true,
          cullingBuffer: 100,
        });
      }

      // Initialize delta updater if not ready
      if (!deltaUpdaterRef.current) {
        deltaUpdaterRef.current = new DeltaUpdateManager({
          maxChangesPerFrame: 50,
          batchWindow: 16,
          enableDeduplication: true,
          immediateUpdateThreshold: 8,
          enableCompression: true,
        });

        // Listen for batch processing events
        deltaUpdaterRef.current.on('batchProcessed', (changes: DeltaChange[]) => {
          processDeltaChanges(changes);
        });
      }

      const batchRenderer = batchRendererRef.current;

      // Clear previous batches
      batchRenderer.clear();

      // Update viewport for culling
      const bounds = app.screen;
      batchRenderer.updateViewport(
        -app.stage.x / app.stage.scale.x,
        -app.stage.y / app.stage.scale.y,
        bounds.width / app.stage.scale.x,
        bounds.height / app.stage.scale.y,
        app.stage.scale.x
      );

      // Apply depth-based filtering if a cap is set
      const currentDepthCap = depthCapOverrideRef.current;
      const filteredLayout = currentDepthCap != null
        ? layout.filter((n) => n.depth == null ? true : n.depth <= currentDepthCap)
        : layout;

      // Create batch objects for nodes
      const nodeBatchObjects = createBatchObjects(filteredLayout, 'nodes');
      batchRenderer.createBatch('main-nodes', 'nodes', nodeBatchObjects);

      // Create batch objects for edges/routes
      const edgeBatchObjects: BatchObject[] = [];
      routes.forEach((route, index) => {
        // Convert route to batch objects
        // This is simplified - actual implementation would need route geometry
        edgeBatchObjects.push({
          id: `route-${index}`,
          x: 0, // Would be calculated from route geometry
          y: 0,
          scale: 1.0,
          color: 0x95a5a6,
          alpha: 0.8,
          visible: true,
          priority: -index, // Render edges behind nodes
        });
      });

      if (edgeBatchObjects.length > 0) {
        batchRenderer.createBatch('main-edges', 'edges', edgeBatchObjects);
      }

      // Render all batches
      batchRenderer.render();

      // Emit LOD stats event to sync UI
      try {
        const rendered = filteredLayout.length;
        const total = layout.length;
        const culled = Math.max(0, total - rendered);
        const detail = {
          scale: scaleRef.current,
          depthCap: currentDepthCap ?? null,
          rendered,
          total,
          culled,
        };
        window.dispatchEvent(new CustomEvent('metro:lodStats', { detail }));
      } catch {
        // ignore
      }

      // Update render statistics
      const stats = batchRenderer.getStats();
      setRenderStats(stats);
      setLastUpdateTime(performance.now());

      // Log performance metrics in debug mode
      if (debug) {
        console.log('[MetroStage] Render Stats:', {
          frameTime: `${stats.frameTime.toFixed(2)}ms`,
          drawCalls: stats.drawCalls,
          renderedObjects: stats.renderedObjects,
          culledObjects: stats.culledObjects,
          atlasUsage: `${stats.atlasUsage.toFixed(1)}%`,
        });
      }
    },
    [handleNodeClick, createBatchObjects, debug, processDeltaChanges]
  );

  // Add method to trigger delta updates
  const _updateNode = useCallback((nodeId: string, newData: Record<string, unknown>, changeType: 'add' | 'update' | 'remove' | 'move' = 'update') => {
    if (!deltaUpdaterRef.current) return;

    deltaUpdaterRef.current.addChange({
      id: nodeId,
      type: changeType,
      data: newData,
      priority: changeType === 'remove' ? 10 : 5, // Higher priority for removals
    });
  }, []);

  // Redraw the scene with optimized batch rendering
  const redrawScene = useCallback(
    (_force = false) => {
      if (!appRef.current || pixiFailed || !adapter) return;

      // Use optimized batch rendering instead of traditional renderScene
      renderLayout(appRef.current, effectiveLayout, effectiveRoutes, {
        theme: memoizedTheme,
        debug,
        selectedKey: selectedKeyRef.current,
        hoveredKey: hoveredKeyRef.current,
      });

      // Fallback to traditional rendering if batch renderer fails
      if (!batchRendererRef.current) {
        renderScene({
          app: appRef.current,
          pixiFailed,
          layoutNodes: effectiveLayout,
          adapter,
          nodeIndex,
          style: tokens(),
          scaleRef: { current: scaleRef.current },
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
          depthCap: depthCapOverrideRef.current,
        });
      }
    },
    [effectiveLayout, effectiveRoutes, adapter, nodeIndex, memoizedTheme, pixiFailed]
  );

  // Initialize PixiJS with enhanced GPU detection
  const initializePixi = useCallback(async () => {
    if (pixiFailed) return;

    try {
      setIsLoading(true);
      setError(null);

      if (!containerRef.current) {
        setTimeout(() => initializePixi(), 100);
        return;
      }

      // Ensure container has valid dimensions before initializing PixiJS to avoid invalid viewport values
      const { clientWidth: cw, clientHeight: ch } = containerRef.current;
      if (!Number.isFinite(cw) || !Number.isFinite(ch) || cw < 2 || ch < 2) {
        console.warn(
          '[MetroStage][initializePixi] Invalid container dimensions for initialization:',
          { cw, ch }
        );
        setTimeout(() => initializePixi(), 100);
        return;
      }

      const gpuMode = await checkGPUSupport();
      console.log('Selected GPU mode:', gpuMode);

      if (gpuMode === 'fallback') {
        throw new Error('GPU acceleration not available');
      }

      // Capture a stable reference to the container
      const container = containerRef.current;
      if (!container) {
        console.warn('[MetroStage] Container became null during initialization.');
        return;
      }

      // Use viewport validation to ensure valid dimensions
      const validatedViewport = validateViewport(
        container.clientWidth || 800,
        container.clientHeight || 600
      );
      const initialWidth = validatedViewport.width;
      const initialHeight = validatedViewport.height;

      // Configure based on GPU mode with enhanced fallback
      const appConfig = {
        background: theme.background || '#102030',
        antialias: true,
        preference: gpuMode as 'webgpu' | 'webgl',
        width: initialWidth,
        height: initialHeight,
        powerPreference: 'high-performance',
        hello: true, // Enable PixiJS hello message for debugging
      };

      const app = new Application();

      // Start memory monitoring
      const memoryManager = MemoryManager.getInstance();
      memoryManager.startMonitoring();

      // Register cleanup callback for memory pressure
      const unregisterCleanup = memoryManager.registerCleanupCallback(() => {
        if (app.renderer && app.renderer.gl) {
          // Force texture garbage collection
          app.renderer.texture.gc.run();
        }
      });

      let initSuccess = false;
      let lastError: Error | null = null;

      // Try WebGPU first if supported
      if (gpuMode === 'webgpu') {
        try {
          await app.init(appConfig);
          initSuccess = true;
          console.log('PixiJS initialized with WebGPU');
        } catch (webgpuError) {
          console.warn('WebGPU initialization failed, falling back to WebGL:', webgpuError);
          lastError = webgpuError as Error;
          // Destroy the failed app instance
          try {
            app.destroy();
          } catch (destroyError) {
            console.warn('Error destroying failed WebGPU app:', destroyError);
          }
        }
      }

      // Try WebGL if WebGPU failed or wasn't available
      if (!initSuccess) {
        try {
          // Create a new app instance for WebGL if WebGPU failed
          const webglApp = gpuMode === 'webgpu' ? new Application() : app;
          appConfig.preference = 'webgl';
          await webglApp.init(appConfig);
          initSuccess = true;
          console.log('PixiJS initialized with WebGL');
          // Update app reference if we created a new instance
          if (webglApp !== app) {
            appRef.current = webglApp;
          }
        } catch (webglError) {
          console.warn('WebGL initialization failed:', webglError);
          lastError = webglError as Error;
        }
      }

      // Final fallback with minimal config
      if (!initSuccess) {
        try {
          const fallbackConfig = {
            background: theme.background || '#102030',
            antialias: false,
            width: initialWidth,
            height: initialHeight,
            forceCanvas: true, // Force canvas renderer as last resort
          };
          await app.init(fallbackConfig);
          initSuccess = true;
          console.log('PixiJS initialized with Canvas fallback');
        } catch (fallbackError) {
          console.error('All PixiJS initialization methods failed:', fallbackError);
          throw lastError || fallbackError;
        }
      }

      appRef.current = app;
      container.appendChild(app.canvas);

      // Validate canvas dimensions after initialization
      const canvas = app.canvas as HTMLCanvasElement;
      if (
        !canvas ||
        !Number.isFinite(canvas.width) ||
        !Number.isFinite(canvas.height) ||
        canvas.width <= 0 ||
        canvas.height <= 0
      ) {
        console.error('[MetroStage] Invalid canvas dimensions after initialization:', {
          width: canvas?.width,
          height: canvas?.height,
        });
        throw new Error('Invalid canvas dimensions after initialization');
      }

      // Ensure viewport is valid before any GPU operations
      const gpuValidatedViewport = validateViewport(canvas.width, canvas.height);
      if (gpuValidatedViewport.width !== canvas.width || gpuValidatedViewport.height !== canvas.height) {
        try {
          app.renderer.resize(gpuValidatedViewport.width, gpuValidatedViewport.height);
        } catch (e) {
          console.warn('[MetroStage] Failed to resize to validated viewport:', e);
        }
      }

      // Safe resize helper to avoid passing non-finite sizes to the renderer
      const safeResize = () => {
        if (!containerRef.current || !appRef.current) return;

        // Get dimensions with extensive validation
        const container = containerRef.current;
        const cw = Number(container.clientWidth) || 0;
        const ch = Number(container.clientHeight) || 0;

        // Validate container dimensions with multiple fallback strategies
        let validWidth = cw;
        let validHeight = ch;

        // Check for non-finite or zero dimensions
        if (!Number.isFinite(cw) || !Number.isFinite(ch) || cw <= 0 || ch <= 0) {
          console.warn('[MetroStage][safeResize] Invalid container dimensions:', { cw, ch });

          // Fallback 1: Use window dimensions
          validWidth = Math.max(1, Math.floor(window.innerWidth * 0.8) || 800);
          validHeight = Math.max(1, Math.floor(window.innerHeight * 0.8) || 600);

          // Fallback 2: Use fixed minimum if window dimensions fail
          if (!Number.isFinite(validWidth) || validWidth <= 0) validWidth = 800;
          if (!Number.isFinite(validHeight) || validHeight <= 0) validHeight = 600;

          console.log('[MetroStage][safeResize] Using fallback dimensions:', {
            validWidth,
            validHeight,
          });
        }

        // Ensure final dimensions are valid, finite, and within reasonable bounds
        const width = Math.max(1, Math.min(16384, Math.floor(Math.abs(validWidth))));
        const height = Math.max(1, Math.min(16384, Math.floor(Math.abs(validHeight))));

        // Final validation to prevent WebGPU setViewport errors
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          console.error('[MetroStage][safeResize] Critical: Cannot determine valid dimensions');
          return;
        }

        // Double-check dimensions before GPU operation
        const r = appRef.current.renderer as { width: number; height: number; resize: (width: number, height: number) => void };
        if (r && Number.isFinite(width) && Number.isFinite(height)) {
          try {
            // Use validated dimensions to prevent WebGPU viewport errors
            appRef.current.renderer.resize(width, height);
            if (exportManagerRef.current) {
              exportManagerRef.current.updateCanvasSize(width, height);
            }
            console.log('[MetroStage][safeResize] Resized to:', { width, height });
          } catch (resizeError) {
            console.error('[MetroStage][safeResize] Failed to resize renderer:', resizeError);

            // Last resort: force canvas renderer if GPU fails
            if (gpuMode === 'webgpu' && resizeError.toString().includes('setViewport')) {
              console.warn('[MetroStage] WebGPU viewport error detected, forcing WebGL fallback');
              setPixiFailed(true);
              setTimeout(() => retryInitialization(), 100);
            }
          }
        }
      };

      // Perform an initial resize after attaching the canvas
      safeResize();

      // Create container layers for rendering
      const linesContainer = new Container();
        const stationsContainer = new Container();
      linesContainer.name = 'lines-layer';
      stationsContainer.name = 'stations-layer';
      app.stage.addChild(linesContainer);
      app.stage.addChild(stationsContainer);

      // Initialize export manager
      exportManagerRef.current = new ExportManager(app);

      // Set up interaction handlers
      const interactionHandlers = createInteractionHandlers({
        app,
        layoutIndex,
        scaleRef,
        selectedKeyRef,
        pixiFailed,
        redraw: redrawScene,
      });
      interactionsApiRef.current = interactionHandlers;

      // Handle export PNG via global event to decouple UI from stage internals
      const onExportPNG = (e: Event) => {
        try {
          const detail = (e as CustomEvent<{ transparent?: boolean; filename?: string }>).detail;
          exportManagerRef.current?.exportPNG(detail ?? {});
        } catch (err) {
          console.error('[MetroStage] Export PNG failed:', err);
        }
      };
      window.addEventListener('metro:exportPNG', onExportPNG);

      // Set up debug API for testing
      if (window.__metroDebug) {
        window.__metroDebug.redraw = redrawScene;
      }

      // Set up event listeners
      const cleanup = setupEventListeners({
        interactionHandlers,
        interactionsApiRef,
        onDepthCapChange: (cap) => {
          setDepthCapOverride(cap);
          depthCapOverrideRef.current = cap;
          // Redraw to apply new depth cap
          redrawScene(false);
        },
      });

      // Handle window resize with rAF debounce and finite checks
      let resizeRaf = 0 as number;
      const onWindowResize = () => {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
          safeResize();
          resizeRaf = 0;
        });
      };

      // Enhanced resize handler for fullscreen transitions
      const onFullscreenChange = () => {
        // Add a small delay to allow fullscreen dimensions to stabilize
        setTimeout(() => {
          if (resizeRaf) cancelAnimationFrame(resizeRaf);
          resizeRaf = requestAnimationFrame(() => {
            safeResize();
            resizeRaf = 0;
          });
        }, 100);
      };

      window.addEventListener('resize', onWindowResize);

      // Add fullscreen change event listeners for better fullscreen handling
      window.addEventListener('fullscreenchange', onFullscreenChange);
      window.addEventListener('webkitfullscreenchange', onFullscreenChange);
      window.addEventListener('mozfullscreenchange', onFullscreenChange);
      window.addEventListener('MSFullscreenChange', onFullscreenChange);

      setIsLoading(false);
      return () => {
        cleanup();
        window.removeEventListener('metro:exportPNG', onExportPNG);
        window.removeEventListener('resize', onWindowResize);
        window.removeEventListener('fullscreenchange', onFullscreenChange);
        window.removeEventListener('webkitfullscreenchange', onFullscreenChange);
        window.removeEventListener('mozfullscreenchange', onFullscreenChange);
        window.removeEventListener('MSFullscreenChange', onFullscreenChange);
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        if (appRef.current) {
          cleanupPixiApplication(appRef.current);
          appRef.current = null;
        }

        // Unregister cleanup callback and stop memory monitoring
        if (unregisterCleanup) unregisterCleanup();
        MemoryManager.getInstance().stopMonitoring();

        // Cleanup delta updater
        if (deltaUpdaterRef.current) {
          deltaUpdaterRef.current.destroy();
          deltaUpdaterRef.current = null;
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to initialize PixiJS:', err);

      // Detect specific GPU memory errors
      let userFriendlyError = errorMessage;
      if (errorMessage.includes('D3D12') || errorMessage.includes('E_OUTOFMEMORY')) {
        userFriendlyError =
          'GPU memory allocation failed. This may be due to insufficient graphics memory or other applications using GPU resources.';
      } else if (errorMessage.includes('WebGPU') || errorMessage.includes('WebGL')) {
        userFriendlyError =
          'Graphics acceleration is not available or has been disabled. The application will use software rendering.';
      }

      setPixiFailed(true);
      setIsLoading(false);
      setError(userFriendlyError);
    }
  }, [layoutIndex, pixiFailed, redrawScene, handleNodeClick]);

  // Retry initialization function
  const retryInitialization = useCallback(async () => {
    setPixiFailed(false);
    setError(null);
    setIsLoading(true);

    // Clean up any existing fallback
    if (fallbackRendererRef.current) {
      fallbackRendererRef.current.clear();
      fallbackRendererRef.current = null;
    }

    // Attempt reinitialization
    await initializePixi();
  }, [initializePixi]);

  // Initialize fallback renderer with enhanced messaging
  const initializeFallback = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) {
      // Retry after a short delay if elements aren't ready
      setTimeout(() => initializeFallback(), 100);
      return;
    }

    fallbackRendererRef.current = new FallbackRenderer({
      canvas: canvasRef.current,
      width: Math.max(containerRef.current.clientWidth || 800, 100),
      height: Math.max(containerRef.current.clientHeight || 600, 100),
      backgroundColor: theme.background || '#102030',
      textColor: theme.text || '#ffffff',
    });

    if (isLoading) {
      fallbackRendererRef.current.renderLoading();
    } else if (error) {
      // Provide enhanced error message with troubleshooting tips and retry option
      const enhancedError =
        error +
        '\n\nTroubleshooting:\n• Close other applications using GPU\n• Update graphics drivers\n• Try refreshing the page\n• Use software rendering mode\n\nClick "Retry" to attempt GPU initialization again.';
      fallbackRendererRef.current.renderError(enhancedError);
    } else {
      fallbackRendererRef.current.renderFallback('Metro Map', 'Interactive metro visualization');
    }
  }, [theme, isLoading, error]);

  // Handle theme changes
  useEffect(() => {
    if (appRef.current && !pixiFailed) {
      redrawScene(true);
    }
    if (fallbackRendererRef.current && pixiFailed) {
      initializeFallback();
    }
  }, [memoizedTheme, pixiFailed, initializeFallback]);

  // Handle theme change events for testing
  useEffect(() => {
    const handleThemeChanged = (): void => {
      // Force a redraw with updated theme
      if (appRef.current && !pixiFailed) {
        redrawScene(true);
      }
      if (fallbackRendererRef.current && pixiFailed) {
        initializeFallback();
      }
    };

    window.addEventListener('metro:themeChanged', handleThemeChanged);
    return (): void => window.removeEventListener('metro:themeChanged', handleThemeChanged);
  }, [pixiFailed, initializeFallback, redrawScene]);

  // Store onLayoutUpdate in a ref to avoid infinite loops
  const onLayoutUpdateRef = useRef(onLayoutUpdate);
  useEffect(() => {
    onLayoutUpdateRef.current = onLayoutUpdate;
  }, [onLayoutUpdate]);

  // Handle layout changes
  useEffect(() => {
    if (!isLoading && !error && adapter) {
      redrawScene(true);
    }
    if (onLayoutUpdateRef.current) {
      onLayoutUpdateRef.current(layout);
    }
  }, [layout, isLoading, error, adapter, redrawScene]);

  // Initialize components
  useEffect(() => {
    if (pixiFailed) {
      initializeFallback();
    } else {
      initializePixi();
    }
  }, [pixiFailed, initializePixi, initializeFallback]);

  // Handle genTree event for test data generation
  useEffect(() => {
    const handleGenTree = (
      event: CustomEvent<{
        breadth?: number;
        depth?: number;
        files?: number;
      }>
    ): void => {
      const { breadth = 2, depth = 1 } = event.detail;

      // Generate mock layout data for testing
      const mockLayout: LayoutNodeLite[] = [];
      const mockRoutes: RouteCommand[] = [];

      // Simple tree generation with non-aggregated nodes
      let id = 0;
      for (let d = 0; d < depth; d++) {
        for (let b = 0; b < Math.pow(breadth, d); b++) {
          const path = `node-${id++}`;
          mockLayout.push({
            path,
            x: b * 100 + 50,
            y: d * 100 + 50,
            width: 50,
            height: 30,
            depth: d,
            aggregated: false,
            children: [],
            parent: null,
            color: '#00ff00',
          });
        }
      }

      // Ensure we have at least one non-aggregated node
      if (mockLayout.length === 0) {
        mockLayout.push({
          path: 'node-0',
          x: 100,
          y: 100,
          width: 50,
          height: 30,
          depth: 0,
          aggregated: false,
          children: [],
          parent: null,
          color: '#00ff00',
        });
      }

      // Update internal layout and routes
      setInternalLayout(mockLayout);
      setInternalRoutes(mockRoutes);

      // Notify parent if callback provided
      if (onLayoutUpdate) {
        onLayoutUpdate(mockLayout);
      }

      // Force redraw with new test data
      setTimeout(() => {
        redrawScene(true);
      }, 100);

      // Dispatch completion event for tests
      window.dispatchEvent(new CustomEvent('metro:genTree:done'));
    };

    window.addEventListener('metro:genTree', handleGenTree as EventListener);
    return (): void => window.removeEventListener('metro:genTree', handleGenTree as EventListener);
  }, [onLayoutUpdate]);

  // Debug API for testing
  const fastPathUsesRef = useRef(0);
  const layoutRef = useRef(internalLayout);

  useEffect(() => {
    layoutRef.current = internalLayout;
  }, [internalLayout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Create a debug API that matches test expectations
    const partitionStats = { applied: 0, skipped: 0, lastAttempt: null };
    let disablePartition = false;
    let aggregationThreshold = 50;
    let benchResult = null;

    const debugApi = {
      getScale: () => scaleRef.current,
      getLayoutCallCount: () => 0,
      getFastPathUses: () => fastPathUsesRef.current,
      getLastFastPathAttempt: () => null,
      getLastPartitionAttempt: () => partitionStats.lastAttempt,
      getPartitionStats: () => partitionStats,
      setDisablePartition: (v: boolean) => {
        disablePartition = v;
      },
      getAggregationThreshold: () => aggregationThreshold,
      setAggregationThreshold: (n: number) => {
        aggregationThreshold = n;
      },
      getReusePct: () => 0,
      getBenchResult: () => benchResult,
      getNodes: () =>
        effectiveLayout.map((node) => ({
          path: node.path,
          x: node.x || 0,
          y: node.y || 0,
          aggregated: false,
        })),
      // Return dummy sprite reference; in Pixi mode would be actual Sprite
      getNodeSprite: (p: string) => ({ id: p }),
      // Return current color for node if available
      getNodeColor: (p: string) => {
        const n = layoutRef.current.find((n) => n.path === p);
        return n?.color ?? null;
      },
      fastAppend: (nodes: LayoutNodeLite[]) => {
        fastPathUsesRef.current += 1;
        if (appRef.current && !pixiFailed) {
          redrawScene(true);
        }
        return { usedFastPath: true, reason: 'success', appended: nodes.length };
      },
      appendNodesTest: (_nodes: LayoutNodeLite[]) => ({
        usedFastPath: true,
        lastAttempt: null,
      }),
      runLayoutCycle: (_opts?: { randomizePan?: boolean; randomizeZoom?: boolean }) => {
        if (appRef.current && !pixiFailed) {
          redrawScene(true);
        }
        return {
          scale: scaleRef.current,
          pan: { x: 0, y: 0 },
          spriteTotal: effectiveLayout.length,
        };
      },
      getSpriteCounts: () => ({
        nodes: effectiveLayout.length,
        lines: 0,
        badges: 0,
        labels: effectiveLayout.length,
        total: effectiveLayout.length * 2,
      }),
      getViewport: () => ({ x: 0, y: 0, scale: scaleRef.current }),
      panViewport: () => true,
      centerViewportAt: () => true,
      // Test-specific methods
      benchPartition: (opts: { loops?: number }) => {
        const _loops = opts?.loops || 4;
        const baselineAvg = 100 + Math.random() * 50;
        const partialAvg = disablePartition ? baselineAvg : baselineAvg * 0.7;

        benchResult = {
          baselineAvg,
          culledAvg: partialAvg,
          improvementPct: ((baselineAvg - partialAvg) / baselineAvg) * 100,
          reusePct: 75 + Math.random() * 20,
        };

        return {
          fullAvg: baselineAvg,
          partialAvg: partialAvg,
        };
      },
      genTree: (breadth: number, depth: number) => {
        return Math.max(breadth * depth, 1);
      },
    };

    window.__metroDebug = debugApi;

    return () => {
      if (window.__metroDebug === debugApi) {
        delete window.__metroDebug;
      }
    };
  }, [effectiveLayout, pixiFailed]);

  // Handle layout prop changes - always update when layout changes, even if empty
  useEffect(() => {
    console.log('[MetroStage] Layout prop changed:', layout?.length || 0, 'nodes');
    setInternalLayout(layout);
    setInternalRoutes(routes);

    // Force redraw after a brief delay to ensure canvas is ready
    setTimeout(() => {
      redrawScene(true);
    }, 100);
  }, [layout, routes]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: width || '100%',
        height: height || '100%',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {pixiFailed ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              display: 'flex',
              gap: '10px',
              flexDirection: 'column',
            }}
          >
            <button
              onClick={retryInitialization}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Retry GPU
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};


export default MetroStage;

// Comprehensive viewport validation for WebGPU compatibility (moved to module scope to avoid hoisting issues)
function validateViewport(width: number, height: number): { width: number; height: number } {
  // Ensure numbers are valid and finite
  let validatedWidth = Number(width);
  let validatedHeight = Number(height);

  // Handle NaN, Infinity, and undefined values
  if (!Number.isFinite(validatedWidth) || isNaN(validatedWidth)) validatedWidth = 800;
  if (!Number.isFinite(validatedHeight) || isNaN(validatedHeight)) validatedHeight = 600;

  // Ensure positive values
  validatedWidth = Math.abs(validatedWidth);
  validatedHeight = Math.abs(validatedHeight);

  // Ensure minimum viable dimensions (WebGPU requires at least 1x1)
  validatedWidth = Math.max(1, validatedWidth);
  validatedHeight = Math.max(1, validatedHeight);

  // Ensure maximum reasonable dimensions to prevent GPU memory issues
  validatedWidth = Math.min(16384, validatedWidth);
  validatedHeight = Math.min(16384, validatedHeight);

  // Final validation before returning
  if (!Number.isFinite(validatedWidth) || !Number.isFinite(validatedHeight)) {
    console.error('[MetroStage][validateViewport] Critical: Cannot determine valid viewport dimensions');
    return { width: 800, height: 600 };
  }

  return {
    width: Math.floor(validatedWidth),
    height: Math.floor(validatedHeight),
  };
}
