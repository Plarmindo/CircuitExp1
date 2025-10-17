import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MiniMap } from './MiniMap';
import { DraggableWindow } from './DraggableWindow';
import { ScanProgressBar } from './ScanProgressBar';
import { useScanProgress } from '../hooks/useScanProgress';
import { setTheme } from '../visualization/style-tokens';
import {
  getUserSettings,
  onUserSettingsLoaded,
  onUserSettingsUpdated,
  updateUserSettings,
} from '../settings/user-settings-client';
import type { UserSettings } from '../settings/user-settings-client';
import './MetroUI.css';
import { UnifiedNavigation } from '../navigation/unified-navigation';
import { errorReporter } from '../services/error-reporter';
import { auditLogger } from '../services/audit-logger';

import { PIIDetector, defaultPIIConfig } from '../services/pii-detector';
import { RateLimiter, defaultRateLimitConfig } from '../services/rate-limiter';
import { createGraphAdapter } from '../visualization/graph-adapter';
import { layoutHierarchicalV2 } from '../visualization/layout-v2';
import { ModeProvider, useMode } from '../visualization/modes/ModeProvider';
import { ModeRegistry, VisualizationMode } from '../visualization/modes/mode-registry';
import type { ModeComponentProps } from '../visualization/modes/mode-registry';
import { SettingsProvider } from '../settings/SettingsProvider';
import type {
  GoogleMapSettings,
  GraphDirection,
  LabelMode,
  LineStyle,
} from '../visualization/stage/metro-map-zoom';

interface ScanProgress {
  dirsProcessed: number;
  filesProcessed: number;
  approxCompletion?: number;
}
interface NodeEntry {
  path: string;
  name: string;
  kind: 'dir' | 'file';
  size?: number;
}
interface ScanDone {
  cancelled?: boolean;
}
interface MetroUIProps {
  scanId: string | null;
  progress: ScanProgress | null;
  nodes: NodeEntry[];
  receivedNodes: number;
  done: ScanDone | null;
  rootPath?: string | null;
}

interface PerformanceMetrics {
  fps: number;
  nodeCount: number;
  lastLayoutMs: number;
  lastBatchMs: number;
  memoryUsage: number;
}

interface SelectedNodeInfo {
  path: string;
  type: 'node' | 'aggregated';
  name: string;
  size?: number;
  children?: number;
}

const DEFAULT_MAP_SETTINGS: GoogleMapSettings = Object.freeze({
  nodeSizeMm: 4,
  textSizeMm: 2,
  lineWidthMm: 1,
  lineStyle: 'straight' as LineStyle,
  showLabels: true,
  labelMode: 'always' as LabelMode,
  graphDirection: 'vertical' as GraphDirection,
});

const LINE_STYLE_OPTIONS: ReadonlyArray<{ value: LineStyle; label: string }> = [
  { value: 'straight', label: 'Straight' },
  { value: 'curved', label: 'Curved' },
  { value: 'stepped', label: 'Stepped' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'bezier', label: 'Bezier' },
];

const LABEL_MODE_OPTIONS: ReadonlyArray<{ value: LabelMode; label: string }> = [
  { value: 'always', label: 'Always' },
  { value: 'hover', label: 'On Hover' },
  { value: 'zoomed', label: 'When Zoomed In' },
];

const GRAPH_DIRECTION_OPTIONS: ReadonlyArray<{ value: GraphDirection; label: string }> = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
];

const clampValue = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const ModeRenderer: React.FC<{
  theme: unknown;
  layout: unknown[];
  routes: unknown[];
  onNodeClick?: (p: string) => void;
  onNodeHover?: (p: string | null) => void;
  onLayoutUpdate?: (l: unknown[]) => void;
  onViewportChange?: (viewport: { centerX: number; centerY: number; scale: number; viewportWidth: number; viewportHeight: number }) => void;
  debug?: boolean;
  modeProps?: Partial<ModeComponentProps>;
}> = ({ theme, layout, routes, onNodeClick, onNodeHover, onLayoutUpdate, onViewportChange, debug, modeProps }) => {
  const { selected } = useMode();
  const [Comp, setComp] = React.useState<React.ComponentType<ModeComponentProps> | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    
    (async () => {
      try {
        console.log('[ModeRenderer] Loading mode:', selected);
        const mod = await ModeRegistry.load(selected);
        if (!cancelled) {
          console.log('[ModeRenderer] Mode loaded successfully:', selected);
          setComp(() => mod);
          setIsLoading(false);
        }
      } catch (e) {
        console.error('[ModeRenderer] Failed to load mode', selected, e);
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load visualization mode');
          setIsLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary, #666)' }}>
        Loading visualization mode...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-error, #d32f2f)', padding: 20 }}>
        <div style={{ fontSize: 24, marginBottom: 10 }}>⚠️</div>
        <div>Failed to load visualization mode: {selected}</div>
        <div style={{ fontSize: 12, marginTop: 5 }}>{loadError}</div>
      </div>
    );
  }

  if (!Comp) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary, #666)' }}>
        No visualization component available
      </div>
    );
  }

  console.log('[ModeRenderer] Rendering with layout count:', Array.isArray(layout) ? layout.length : 0);
  
  return (
    <Comp
      theme={theme}
      layout={layout}
      routes={routes}
      onNodeClick={onNodeClick}
      onNodeHover={onNodeHover}
      onLayoutUpdate={onLayoutUpdate}
      onViewportChange={onViewportChange}
      debug={debug}
      {...(modeProps || {})}
    />
  );
};

export const MetroUIInner: React.FC<MetroUIProps> = ({
  scanId,
  progress,
  nodes: externalNodes,
  receivedNodes,
  done,
  rootPath,
}) => {
  // Access mode context for switcher
  const { selected: selectedMode, setMode, definitions } = useMode();
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  
  // Use the new scan progress hook for ScanProgressBar
  const scanProgressState = useScanProgress();
  
  // Local nodes state that can be overridden by synthetic tree generation
  const [syntheticNodes, setSyntheticNodes] = useState<NodeEntry[] | null>(null);
  // Use synthetic nodes if available, otherwise use external nodes
  const nodes = syntheticNodes || externalNodes;
  const [mapSettings, setMapSettings] = useState<GoogleMapSettings>(() => ({ ...DEFAULT_MAP_SETTINGS }));
  const [showPerformance, setShowPerformance] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showLodHud, setShowLodHud] = useState(true);
  const [viewportBounds, setViewportBounds] = useState<{ centerX: number; centerY: number; scale: number; viewportWidth: number; viewportHeight: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SelectedNodeInfo | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    path: string;
  } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const [_piiDetector] = useState(() => new PIIDetector(defaultPIIConfig));
  const [_rateLimiter] = useState(() => new RateLimiter(defaultRateLimitConfig));
  // Override manual de profundidade (controle de LOD manual). null = automático via zoom.
  const [depthOverride, setDepthOverride] = useState<number | null>(null);
  // Banner dev inicial quando não há scan ativo (auxilia percepção de core pronto)
  const [showDevIdleHint, setShowDevIdleHint] = useState(false);
  // Auto-load sample data when no scan is active
  const [autoLoadedSample, setAutoLoadedSample] = useState(false);
  // NOTE: avoid naming this state variable 'performance' to prevent shadowing the
  // global performance API (was causing runtime errors calling performance.now()).
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    nodeCount: 0,
    lastLayoutMs: 0,
    lastBatchMs: 0,
    memoryUsage: 0,
  });
  const isGoogleMapMode = selectedMode === VisualizationMode.GoogleMap;

  const updateMapSettings = useCallback((patch: Partial<GoogleMapSettings>) => {
    setMapSettings((prev) => ({ ...prev, ...patch }));
  }, []);
  // LOD HUD state (escala, depthCap efetivo, nós renderizados vs total)
  const [lodStats, setLodStats] = useState<{
    scale: number;
    depthCap: number | null;
    rendered: number;
    total: number;
    culled: number;
  } | null>(null);

  const fpsCounterRef = useRef<number[]>([]);

  // Function to load sample data manually
  const handleLoadSampleData = useCallback(() => {
    if (!autoLoadedSample) {
      window.dispatchEvent(
        new CustomEvent('metro:genTree', { detail: { breadth: 4, depth: 3, files: 3 } })
      );
      setAutoLoadedSample(true);
    }
  }, [autoLoadedSample]);

  // Auto-load sample data when component mounts and no data is available
  useEffect(() => {
    if (!autoLoadedSample && (!nodes || nodes.length === 0) && !scanId && !progress) {
      const timer = setTimeout(() => {
        handleLoadSampleData();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [handleLoadSampleData, nodes, scanId, progress, autoLoadedSample]);

  // Listen for synthetic tree generation event
  useEffect(() => {
    const handleGenTree = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const { breadth = 3, depth = 3, files = 2 } = detail;
      
      console.log('[MetroUI] Generating synthetic tree:', { breadth, depth, files });
      
      // Generate synthetic nodes
      const synthetic: NodeEntry[] = [];
      let nodeId = 0;
      
      // Generate a tree structure
      const generateTree = (parentPath: string, currentDepth: number) => {
        if (currentDepth >= depth) return;
        
        // Add directories
        for (let i = 0; i < breadth; i++) {
          const dirPath = `${parentPath}/dir-${nodeId++}`;
          synthetic.push({
            path: dirPath,
            name: `dir-${i}`,
            kind: 'dir',
            size: 0
          });
          
          // Add files in this directory
          for (let f = 0; f < files; f++) {
            const filePath = `${dirPath}/file-${f}.txt`;
            synthetic.push({
              path: filePath,
              name: `file-${f}.txt`,
              kind: 'file',
              size: Math.floor(Math.random() * 10000) + 1000
            });
          }
          
          // Recursively generate subdirectories
          generateTree(dirPath, currentDepth + 1);
        }
      };
      
      // Start from root
      synthetic.push({
        path: '/root',
        name: 'root',
        kind: 'dir',
        size: 0
      });
      generateTree('/root', 0);
      
      console.log('[MetroUI] Generated', synthetic.length, 'synthetic nodes');
      setSyntheticNodes(synthetic);
    };
    
    window.addEventListener('metro:genTree', handleGenTree);
    return () => window.removeEventListener('metro:genTree', handleGenTree);
  }, []);

  // Clear synthetic nodes when external scan starts
  useEffect(() => {
    if (scanId || (externalNodes && externalNodes.length > 0)) {
      setSyntheticNodes(null);
    }
  }, [scanId, externalNodes]);

  // Memoized layout generation from nodes
  const { layoutNodes, routes } = useMemo(() => {
    console.log('[MetroUI] Generating layout from nodes:', nodes?.length || 0);
    
    if (!nodes || nodes.length === 0) {
      console.log('[MetroUI] No nodes to layout');
      return { layoutNodes: [], routes: [] };
    }

    try {
      const adapter = createGraphAdapter();

      // Convert NodeEntry to ScanNode format
      const scanNodes = nodes.map((node) => ({
        path: node.path,
        name: node.name,
        kind: node.kind,
        depth: node.path.split(/[/\\]/).length - 1,
        ...(node.size && { sizeBytes: node.size }),
      }));

      adapter.applyDelta(scanNodes);

      // Generate layout using hierarchical layout
      const layoutResult = layoutHierarchicalV2(adapter, {
        horizontalSpacing: 140,
        verticalSpacing: 90,
        aggregationThreshold: 200,
        expandedAggregations: new Set(),
      });

      // Extract routes from the layout
      const layoutRoutes = layoutResult.nodes.map((node) => node.path);

      console.log('[MetroUI] Layout generated:', layoutResult.nodes.length, 'nodes');
      
      return {
        layoutNodes: layoutResult.nodes,
        routes: layoutRoutes,
      };
    } catch (error) {
      console.error('[MetroUI] Error generating layout:', error);
      return { layoutNodes: [], routes: [] };
    }
  }, [nodes]);

  const modeSpecificProps = useMemo<Partial<ModeComponentProps> | undefined>(() => {
    if (!isGoogleMapMode) {
      return undefined;
    }
    return { mapSettings, showMinimap };
  }, [isGoogleMapMode, mapSettings, showMinimap]);

  // Ensure focus-visible outline for stage container even when external CSS isn't loaded (e.g., JSDOM tests)
  useEffect(() => {
    const styleId = 'metroui-focus-visible-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `.stage-container:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 4px; }`;
      document.head.appendChild(style);
    }
  }, []);

  // Live region ref for announcements (A11Y)
  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  // Stage container ref for keyboard navigation
  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  // DEBUG: Log container dimensions
  useEffect(() => {
    if (stageContainerRef.current) {
      const rect = stageContainerRef.current.getBoundingClientRect();
      console.log('[DEBUG] Stage container dimensions:', {
        width: rect.width,
        height: rect.height,
        offsetWidth: stageContainerRef.current.offsetWidth,
        offsetHeight: stageContainerRef.current.offsetHeight,
        clientWidth: stageContainerRef.current.clientWidth,
        clientHeight: stageContainerRef.current.clientHeight,
        scrollHeight: stageContainerRef.current.scrollHeight
      });
      
      // Also log parent dimensions
      const parent = stageContainerRef.current.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        console.log('[DEBUG] Parent (.metro-main) dimensions:', {
          width: parentRect.width,
          height: parentRect.height,
          className: parent.className
        });
      }
    }
  }, []);

  // Handle node click events from the visualization
  const handleNodeClick = useCallback(
    (nodePath: string) => {
      const node = nodes.find((n) => n.path === nodePath);
      if (node) {
        setSelectedNode({
          path: node.path,
          type: 'node',
          name: node.name,
          size: node.size,
        });
      }
    },
    [nodes]
  );

  // Handle node hover events from the visualization
  const handleNodeHover = useCallback(
    (nodePath: string | null) => {
      if (nodePath === null) {
        setHoveredNode(null);
        return;
      }

      const node = nodes.find((n) => n.path === nodePath);
      if (node) {
        setHoveredNode({
          path: node.path,
          type: 'node',
          name: node.name,
          size: node.size,
        });
      }
    },
    [nodes]
  );

  // Handle node double-click events from the visualization
  const _handleNodeDoubleClick = useCallback(
    (nodePath: string) => {
      if (!nodePath) {
        return;
      }
      const node = nodes.find((n) => n.path === nodePath);
      if (node) {
        // For now, treat a double-click similar to a single click (selection) and
        // emit an auxiliary event so other components can react if needed.
        setSelectedNode({
          path: node.path,
          type: 'node',
          name: node.name,
          size: node.size,
        });
        window.dispatchEvent(
          new CustomEvent('metro:nodeDoubleClick', { detail: { path: node.path } })
        );
      }
    },
    [nodes]
  );

  // Handle node context-menu (right-click) events from the visualization
  const _handleNodeContextMenu = useCallback((nodePath: string, x: number, y: number) => {
    if (!nodePath) return;
    setCtxMenu({ visible: true, x, y, path: nodePath });
  }, []);

  // Handle clicks on the background of the visualization (deselect any selection)
  const _handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setCtxMenu(null);
    window.dispatchEvent(new Event('metro:backgroundClick'));
  }, []);

  // Handle context-menu on the background (could show a generic menu)
  const _handleBackgroundContextMenu = useCallback((x: number, y: number) => {
    // For now, just close any existing context menu; future: open generic menu
    setCtxMenu(null);
    window.dispatchEvent(new CustomEvent('metro:backgroundContextMenu', { detail: { x, y } }));
  }, []);

  // Handle layout update events from the visualization
  const handleLayoutUpdate = useCallback((layoutInfo: unknown) => {
    if (layoutInfo && layoutInfo.stats) {
      setLodStats(layoutInfo.stats);
    }
  }, []);

  // CORE-3: load persisted user settings (theme, defaults) and react to updates from main process
  useEffect(() => {
    let cancelled = false;
    // Initial fetch (in case events already fired before subscription)
    getUserSettings()
      .then((res) => {
        if (!cancelled && res.success && res.settings) {
          setSettings(res.settings);
          if (res.settings.theme !== currentTheme) {
            setCurrentTheme(res.settings.theme);
            setTheme(res.settings.theme);
          }
        }
      })
      .catch(() => {
        /* ignore */
      });
    const offLoaded = onUserSettingsLoaded((s) => {
      setSettings(s);
      if (s.theme !== currentTheme) {
        setCurrentTheme(s.theme);
        setTheme(s.theme);
      }
    });
    const offUpdated = onUserSettingsUpdated((s) => {
      setSettings(s);
      if (s.theme !== currentTheme) {
        setCurrentTheme(s.theme);
        setTheme(s.theme);
        // Notify visualization for dynamic restyle
        window.dispatchEvent(new CustomEvent('metro:themeChanged', { detail: { theme: s.theme } }));
      }
    });

    // Listen for scan errors from the main process and internal bus
    const offScanError = (() => {
      const handler = (error: unknown) => {
        if (error.scanId === scanId || !scanId) {
          const _errorInfo = errorReporter.reportError(
            new Error(error.userMessage || error.error),
            'scan-operation'
          );
        }
      };

      const offElectron = (
        (window as unknown as {
          electronAPI?: { onScanError?: (cb: (e: unknown) => void) => () => void };
        })?.electronAPI?.onScanError?.(handler)
      ) || (() => {});

      const offBus = UnifiedNavigation.events.onScanError(handler);

      return () => {
        try {
          offElectron();
        } catch (error) {
          // Ignore cleanup errors
          console.warn('Failed to cleanup electron listener:', error);
        }
        try {
          offBus();
        } catch (error) {
          // Ignore cleanup errors
          console.warn('Failed to cleanup bus listener:', error);
        }
      };
    })();

    return () => {
      cancelled = true;
      offLoaded();
      offUpdated();
      offScanError();
    };
  }, [scanId, currentTheme]);

  // Theme switcher
  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(newTheme);
    setTheme(newTheme);
    // Notify stage for dynamic restyle without full layout recompute
    window.dispatchEvent(new CustomEvent('metro:themeChanged', { detail: { theme: newTheme } }));
    // Persist
    updateUserSettings({ theme: newTheme });
  };

  // Scan controls
  const handleSelectFolderAndScan = async () => {
    try {
      const w = window as unknown as {
        electronAPI?: { selectAndScanFolder?: () => Promise<unknown> };
      };
      if (w.electronAPI?.selectAndScanFolder) {
        auditLogger.logFileAccess('folder-selection-initiated', 'user-requested-scan');
        const res = await UnifiedNavigation.scan.selectAndScanFolder();
        console.log('Folder selection result', res);
        const folderName =
          typeof res === 'object' && res !== null && 'folder' in res &&
          typeof (res as { folder?: unknown }).folder === 'string'
            ? (res as { folder: string }).folder
            : 'unknown';
        auditLogger.logSystemEvent('folder-selection-completed', 'scan-started', {
          folder: folderName,
        });
      }
    } catch (error) {
      console.error('selectAndScanFolder failed', error);
      auditLogger.logSecurityViolation(
        'folder-selection-failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      const _errorInfo = errorReporter.reportError(
        error instanceof Error ? error : new Error('Failed to select folder'),
        'folder-selection'
      );
    }
  };

  const handleCancelScan = useCallback(async () => {
    try {
      if (scanId) {
        await UnifiedNavigation.scan.cancel(scanId);
      }
    } catch (error) {
      console.error('cancelScan failed', error);
      const _errorInfo = errorReporter.reportError(
        error instanceof Error ? error : new Error('Failed to cancel scan'),
        'scan-cancel'
      );
    }
  }, [scanId]);

  const handleStartScanDev = useCallback(async () => {
    try {
      await UnifiedNavigation.scan.start('C:/');
    } catch (error) {
      console.error('startScan dev failed', error);
      const _errorInfo = errorReporter.reportError(
        error instanceof Error ? error : new Error('Failed to start scan'),
        'scan-start'
      );
    }
  }, []);

  // Listen to metro events
  useEffect(() => {
    const handleHover = (e: Event) => {
      const d = (e as CustomEvent).detail as
        | { path?: string; type?: 'node' | 'aggregated' }
        | undefined;
      if (d?.path && d.type) {
        setHoveredNode({ path: d.path, type: d.type, name: d.path.split('/').pop() || d.path });
      } else {
        setHoveredNode(null);
      }
    };

    const handleSelect = (e: Event) => {
      const d = (e as CustomEvent).detail as
        | { path?: string; type?: 'node' | 'aggregated' }
        | undefined;
      if (d?.path && d.type) {
        setSelectedNode({ path: d.path, type: d.type, name: d.path.split('/').pop() || d.path });
      } else {
        setSelectedNode(null);
      }
    };

    window.addEventListener('metro:hover', handleHover);
    window.addEventListener('metro:select', handleSelect);
    const handleCtx = (e: Event) => {
      const d = (e as CustomEvent).detail as { path: string; x: number; y: number } | null;
      if (!d?.path) return;
      setCtxMenu({ visible: true, x: d.x, y: d.y, path: d.path });
    };
    window.addEventListener('metro:contextMenu', handleCtx);
    const dismiss = () => {
      if (ctxMenu) setCtxMenu(null);
    };
    window.addEventListener('click', dismiss);

    return () => {
      window.removeEventListener('metro:hover', handleHover);
      window.removeEventListener('metro:select', handleSelect);
      window.removeEventListener('metro:contextMenu', handleCtx);
      window.removeEventListener('click', dismiss);
    };
  }, [ctxMenu]);

  // Escape closes context menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Performance monitoring (disabled in test mode to avoid jsdom teardown races)
  const nodeCount = nodes?.length ?? 0;

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return; // skip in vitest to prevent stray timers after unmount
    if (typeof globalThis === 'undefined' || !globalThis.performance) return;
    const interval = setInterval(() => {
      try {
        const now = globalThis.performance.now();
        fpsCounterRef.current.push(now);
        fpsCounterRef.current = fpsCounterRef.current.filter((time) => now - time < 1000);
        setPerfMetrics((prev) => ({
          ...prev,
          fps: fpsCounterRef.current.length,
          nodeCount,
          memoryUsage:
            (globalThis.performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
              ?.usedJSHeapSize || 0,
        }));
      } catch {
        /* ignore during teardown */
      }
    }, 100);
    return () => clearInterval(interval);
  }, [nodeCount]);

  // Control actions
  const handleZoomIn = useCallback(() => {
    // Dispatch global control event consumed by MetroStage
    window.dispatchEvent(new Event('metro:zoomIn'));
  }, []);

  const handleZoomOut = useCallback(() => {
    // Dispatch global control event consumed by MetroStage
    window.dispatchEvent(new Event('metro:zoomOut'));
  }, []);

  const handleFitToView = useCallback(() => {
    // Dispatch global control event consumed by MetroStage
    window.dispatchEvent(new Event('metro:fit'));
  }, []);

  const handleExportPNG = () => {
    // Dispatch global control event consumed by MetroStage
    window.dispatchEvent(new Event('metro:exportPNG'));
  };

  // Handler for minimap clicks to pan viewport
  const handleMinimapViewportChange = useCallback((worldX: number, worldY: number) => {
    // Dispatch event to center view at clicked world position
    window.dispatchEvent(new CustomEvent('metro:centerAt', { detail: { x: worldX, y: worldY } }));
  }, []);

  // Keyboard navigation for stage container
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent default behavior for arrow keys to avoid page scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
    
    switch (e.key) {
      case 'ArrowUp':
        window.dispatchEvent(new Event('metro:panUp'));
        break;
      case 'ArrowDown':
        window.dispatchEvent(new Event('metro:panDown'));
        break;
      case 'ArrowLeft':
        window.dispatchEvent(new Event('metro:panLeft'));
        break;
      case 'ArrowRight':
        window.dispatchEvent(new Event('metro:panRight'));
        break;
      case '+':
      case '=':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleZoomIn();
        }
        break;
      case '-':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleZoomOut();
        }
        break;
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleFitToView();
        }
        break;
      case 'Escape':
        setSelectedNode(null);
        setCtxMenu(null);
        break;
    }
  }, [handleZoomIn, handleZoomOut, handleFitToView]);
  
  // Handle focus events for stage container
  const handleFocus = useCallback(() => {
    // Announce to screen readers that the visualization is focused
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = 'Visualization area focused. Use arrow keys to navigate, plus and minus to zoom, and zero to fit to view.';
    }
    // Dispatch focus event for other components to react
    window.dispatchEvent(new Event('metro:stageFocus'));
  }, []);
  
  // Handle blur events for stage container
  const handleBlur = useCallback(() => {
    // Clear any hover states when focus is lost
    setHoveredNode(null);
    // Dispatch blur event for other components to react
    window.dispatchEvent(new Event('metro:stageBlur'));
  }, []);

  const filteredNodes =
    nodes?.filter(
      (node) =>
        searchQuery === '' ||
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.path.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // Favorites load on mount
  useEffect(() => {
    (async () => {
      try {
        setLoadingFavs(true);
        const list = await UnifiedNavigation.favorites.list();
        setFavorites(list);
      } finally {
        setLoadingFavs(false);
      }
    })();
  }, []);
  // Recent scans load
  useEffect(() => {
    (async () => {
      try {
        setLoadingRecent(true);
        const r = await UnifiedNavigation.recent.list();
        if (r.success) setRecent(r.recent);
      } finally {
        setLoadingRecent(false);
      }
    })();
  }, [scanId]);

  // Settings load + subscriptions
  useEffect(() => {
    let unsubLoaded: (() => void) | null = null;
    let unsubUpdated: (() => void) | null = null;
    (async () => {
      const res = await getUserSettings();
      if (res.success && res.settings) {
        setSettings(res.settings);
        setCurrentTheme(res.settings.theme);
        setTheme(res.settings.theme);
      }
    })();
    unsubLoaded = onUserSettingsLoaded((s) => {
      setSettings(s);
      setCurrentTheme(s.theme);
      setTheme(s.theme);
    });
    unsubUpdated = onUserSettingsUpdated((s) => {
      setSettings(s);
      setCurrentTheme(s.theme);
      setTheme(s.theme);
    });
    return () => {
      if (unsubLoaded) unsubLoaded();
      if (unsubUpdated) unsubUpdated();
    };
  }, []);

  const isFavorite = (p: string) => favorites.includes(p);
  const toggleFavorite = async () => {
    if (!selectedNode) return;
    try {
      if (isFavorite(selectedNode.path)) {
        auditLogger.logSystemEvent('favorites-management', 'favorite-removed', {
          path: selectedNode.path,
        });
        const list = await UnifiedNavigation.favorites.remove(selectedNode.path);
        setFavorites(list);
      } else {
        auditLogger.logSystemEvent('favorites-management', 'favorite-added', {
          path: selectedNode.path,
        });
        const list = await UnifiedNavigation.favorites.add(selectedNode.path);
        setFavorites(list);
      }
    } catch (e) {
      console.error('favorite toggle failed', e);
      auditLogger.logSecurityViolation(
        'favorites-management-failed',
        e instanceof Error ? e.message : 'Unknown error'
      );
    }
  };

  const renderHighlighted = useCallback(
    (text: string) => {
      if (!searchQuery) return text;
      const lower = text.toLowerCase();
      const q = searchQuery.toLowerCase();
      const i = lower.indexOf(q);
      if (i === -1) return text;
      return (
        <>
          {text.slice(0, i)}
          <mark>{text.slice(i, i + q.length)}</mark>
          {text.slice(i + q.length)}
        </>
      );
    },
    [searchQuery]
  );

  // Announce selection changes
  useEffect(() => {
    if (selectedNode && liveRegionRef.current) {
      liveRegionRef.current.textContent = `Selected ${selectedNode.type} ${selectedNode.name}`;
    }
  }, [selectedNode]);

  // Dev hint: após 2s sem scan e sem nós recebidos mostrar banner para acionar scan rápido ou árvore sintética
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (scanId || progress || receivedNodes > 0) {
      setShowDevIdleHint(false);
      return;
    }
    const t = setTimeout(() => {
      if (!scanId && !progress && receivedNodes === 0) setShowDevIdleHint(true);
    }, 2000);
    return () => clearTimeout(t);
  }, [scanId, progress, receivedNodes]);

  // LOD Stats listener (HUD)
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (
        e as CustomEvent<{
          scale: number;
          depthCap: number | null;
          rendered: number;
          total: number;
          culled: number;
        }>
      ).detail;
      if (!d) return;
      setLodStats(d);
    };
    window.addEventListener('metro:lodStats', handler);
    return () => window.removeEventListener('metro:lodStats', handler);
  }, []);

  // Propagar override de profundidade para MetroStage
  useEffect(() => {
    if (depthOverride != null) {
      window.dispatchEvent(
        new CustomEvent('metro:setDepthCapOverride', { detail: { depthCap: depthOverride } })
      );
    } else {
      window.dispatchEvent(new Event('metro:clearDepthCapOverride'));
    }
  }, [depthOverride]);

  const theme = currentTheme;

  // Fallback: if running WITHOUT electron bridge (e.g. plain web preview), stream prop nodes to MetroStage
  useEffect(() => {
    if ((window as unknown as { electronAPI?: unknown }).electronAPI) return; // real Electron will deliver via scan partial IPC
    if (!nodes || nodes.length === 0) return;
    try {
      interface MinimalNode {
        path: string;
        name?: string;
        kind?: 'file' | 'dir';
        depth?: number;
        sizeBytes?: number;
      }
      const src: MinimalNode[] = nodes as unknown as MinimalNode[];
      const chunkSize = 400;
      for (let i = 0; i < src.length; i += chunkSize) {
        const slice = src.slice(i, i + chunkSize).map((n) => {
          const name = n.name || n.path.split(/[/\\]/).pop() || n.path;
          return {
            path: n.path,
            name,
            kind: n.kind || 'dir',
            depth: n.depth ?? 0,
            sizeBytes: n.sizeBytes,
          };
        });
        window.dispatchEvent(new CustomEvent('metro:appendNodes', { detail: { nodes: slice } }));
      }
    } catch {
      /* ignore */
    }
  }, [nodes]);

  return (
    <div className={`metro-ui ${theme}`}>
      <a href="#mainContent" className="skip-link">
        Skip to main content
      </a>
      <header className="metro-header">
        <div className="header-left">
          <h1>🚇 Metro Map Visualizer</h1>
          <div className="scan-status" aria-live="polite" aria-atomic="true">
            {done ? (
              <div className={`status-indicator ${done.cancelled ? 'cancelled' : 'completed'}`}>
                <span>{done.cancelled ? '⚠️ Cancelled' : '✅ Complete'}</span>
              </div>
            ) : scanProgressState.scanId ? (
              <ScanProgressBar
                scanId={scanProgressState.scanId}
                progress={scanProgressState.progress}
                processedNodes={scanProgressState.processedNodes}
                totalNodes={scanProgressState.totalNodes}
                elapsedTime={scanProgressState.elapsedTime}
                onCancel={handleCancelScan}
                className="scan-progress-bar"
              />
            ) : progress ? (
              <div className="status-indicator scanning">
                <div className="spinner" aria-hidden="true"></div>
                <span>
                  Scanning…{' '}
                  {progress.approxCompletion != null
                    ? Math.round(progress.approxCompletion * 100) + '%'
                    : `${progress.dirsProcessed + progress.filesProcessed} items`}
                </span>
              </div>
            ) : (
              <div className="status-indicator idle">
                <span>⏸️ Ready</span>
              </div>
            )}
            {rootPath && (
              <div className="current-root" title={rootPath}>
                📂 {rootPath}
              </div>
            )}
          </div>
        </div>
        <div className="header-controls">
          <button
            className="control-btn"
            onClick={handleSelectFolderAndScan}
            title="Select Folder & Scan"
            aria-label="Select Folder and Start Scan"
          >
            📁
          </button>
          <button
            className="control-btn"
            onClick={handleStartScanDev}
            title="Start Scan C:/ (dev)"
            aria-label="Start Development Scan"
          >
            🛠️
          </button>
          <button
            className="control-btn"
            onClick={handleCancelScan}
            title="Cancel Scan"
            aria-label="Cancel Ongoing Scan"
          >
            🛑
          </button>
          <button
            className="control-btn"
            onClick={toggleTheme}
            title="Toggle Theme"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            className="control-btn"
            onClick={() => setShowPerformance(!showPerformance)}
            title="Performance"
            aria-label="Toggle Performance Overlay"
          >
            📊
          </button>
          <button
            className="control-btn"
            onClick={() => setShowPerformance(true)}
            title="Performance Dashboard"
            aria-label="Open Performance Dashboard"
          >
            📈
          </button>
          <button
            className="control-btn"
            onClick={() => setShowMinimap(!showMinimap)}
            title="Minimap"
            aria-label="Toggle Minimap"
          >
            🗺️
          </button>
          <button
            className="control-btn"
            onClick={() => setShowLodHud(!showLodHud)}
            title="LOD Stats"
            aria-label="Toggle LOD Stats"
          >
            📊
          </button>
          {import.meta.env.DEV && (
            <button
              className="control-btn"
              title="Generate synthetic test tree"
              aria-label="Generate Synthetic Test Tree"
              onClick={() => {
                try {
                  window.dispatchEvent(
                    new CustomEvent('metro:genTree', { detail: { breadth: 3, depth: 3, files: 2 } })
                  );
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              🌱
            </button>
          )}
        </div>
        {import.meta.env.DEV && (
          <div className="toolbar-section" style={{ gap: 4 }}>
            <button
              className="tool-btn"
              title="Debug: log adapter nodes"
              onClick={() => {
                try {
                  const dbg: unknown = (window as unknown as { __metroDebug?: unknown }).__metroDebug;
                  if (dbg?.getNodes) {
                    const nodes = dbg.getNodes();
                    console.log('[Debug] getNodes count=', nodes.length, nodes.slice(0, 5));
                    alert('Debug nodes count: ' + nodes.length);
                  } else {
                    alert('Debug API not ready');
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              🧪N
            </button>
            <button
              className="tool-btn"
              title="Debug: force redraw"
              onClick={() => {
                try {
                  // Force a theme change event to trigger redraw skipLayout
                  window.dispatchEvent(new CustomEvent('metro:themeChanged'));
                } catch {
                  /* ignore */
                }
              }}
              aria-label="Force redraw"
            >
              🔄
            </button>
          </div>
        )}
      </header>

      <div className={`metro-body ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sidebar */}
        <aside className={`metro-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <button
              className="collapse-btn"
              onClick={() => {
                const newCollapsed = !sidebarCollapsed;
                setSidebarCollapsed(newCollapsed);
                window.dispatchEvent(
                  new CustomEvent(newCollapsed ? 'panel:minimized' : 'panel:maximized')
                );
              }}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? '▶️' : '◀️'}
            </button>
            {!sidebarCollapsed && <h3>Project Explorer</h3>}
          </div>

          {!sidebarCollapsed && (
            <>
              {/* Search */}
              <div className="search-section">
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                <div className="search-results">
                  {searchQuery && (
                    <div className="results-header">
                      {filteredNodes?.length || 0} results for &quot;{searchQuery}&quot;
                    </div>
                  )}
                  {searchQuery &&
                    (filteredNodes || []).slice(0, 20).map((node, i) => (
                      <div
                        key={i}
                        className="search-result-item"
                        role="button"
                        tabIndex={0}
                        aria-label={`Search result ${node.name}`}
                      >
                        <span className={`node-icon ${node.kind}`}>
                          {node.kind === 'dir' ? '📁' : '📄'}
                        </span>
                        <div className="node-info">
                          <div className="node-name">{renderHighlighted(node.name)}</div>
                          <div className="node-path">{renderHighlighted(node.path)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Selected Node Info */}
              {selectedNode && (
                <div className="selected-section">
                  <h4>Selected Node</h4>
                  <div className="node-details">
                    <div className="detail-row">
                      <span className="label">Type:</span>
                      <span className="value">{selectedNode.type}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Name:</span>
                      <span className="value">{selectedNode.name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Path:</span>
                      <span className="value path">{selectedNode.path}</span>
                    </div>
                    {selectedNode.type === 'aggregated' && (
                      <div className="detail-row">
                        <span className="label">Children:</span>
                        <span className="value">{selectedNode.children || 'N/A'}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">Favorite:</span>
                      <button
                        type="button"
                        aria-pressed={isFavorite(selectedNode.path)}
                        className="fav-toggle-btn"
                        onClick={toggleFavorite}
                        title="Toggle Favorite"
                        aria-label={
                          isFavorite(selectedNode.path) ? 'Remove favorite' : 'Add favorite'
                        }
                      >
                        {isFavorite(selectedNode.path) ? '★ Remove' : '☆ Add'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Statistics */}
              <div className="stats-section">
                <h4>Statistics</h4>
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="stat-value">{nodes?.length || 0}</div>
                    <div className="stat-label">Total Nodes</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{receivedNodes}</div>
                    <div className="stat-label">Received</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{progress?.dirsProcessed || 0}</div>
                    <div className="stat-label">Directories</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{progress?.filesProcessed || 0}</div>
                    <div className="stat-label">Files</div>
                  </div>
                  {settings?.defaultScan && (
                    <div
                      className="stat-item"
                      title="Current aggregation threshold (persisted setting)"
                    >
                      <div className="stat-value">{settings.defaultScan.aggregationThreshold}</div>
                      <div className="stat-label">Agg Threshold</div>
                    </div>
                  )}
                </div>
              </div>
              {/* Favorites List */}
              <div className="favorites-section">
                <h4>Favorites {loadingFavs && <span style={{ fontSize: 10 }}>loading...</span>}</h4>
                {favorites.length === 0 && !loadingFavs && (
                  <div className="empty-hint">No favorites yet</div>
                )}
                <ul className="favorites-list">
                  {favorites.map((f) => (
                    <li key={f} className="fav-item">
                      <button
                        type="button"
                        aria-label={`Jump to favorite ${f}`}
                        className="fav-jump"
                        onClick={async () => {
                          try {
                            const lowerFav = f.toLowerCase();
                            const lowerRoot = (rootPath || '').toLowerCase();
                            const sameTree =
                              rootPath &&
                              (lowerFav === lowerRoot ||
                                lowerFav.startsWith(lowerRoot + '/') ||
                                lowerFav.startsWith(lowerRoot + '\\'));
                            if (sameTree) {
                              window.dispatchEvent(
                                new CustomEvent('metro:select', {
                                  detail: { path: f, type: 'node' },
                                })
                              );
                              window.dispatchEvent(
                                new CustomEvent('metro:centerOnPath', { detail: { path: f } })
                              );
                            } else {
                              await UnifiedNavigation.scan.start(f);
                            }
                          } catch (e) {
                            console.error('favorite jump failed', e);
                          }
                        }}
                        title={f}
                      >
                        {f.split(/[/\\]/).pop()}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove favorite ${f}`}
                        className="fav-remove"
                        onClick={async () => {
                          const list = await UnifiedNavigation.favorites.remove(f);
                          setFavorites(list);
                        }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Recent Scans */}
              <div className="recent-section" style={{ marginTop: 12 }}>
                <h4>
                  Recent Scans {loadingRecent && <span style={{ fontSize: 10 }}>loading...</span>}
                </h4>
                {recent.length === 0 && !loadingRecent && (
                  <div className="empty-hint">No recent scans</div>
                )}
                <ul className="recent-list">
                  {recent.map((r) => (
                    <li key={r} className="recent-item">
                      <button
                        type="button"
                        aria-label={`Restart recent scan ${r}`}
                        className="recent-jump"
                        onClick={async () => {
                          try {
                            await UnifiedNavigation.scan.start(r);
                          } catch (e) {
                            console.error('recent rescan failed', e);
                          }
                        }}
                        title={r}
                      >
                        {r.length > 28 ? '…' + r.slice(-27) : r}
                      </button>
                    </li>
                  ))}
                </ul>
                {recent.length > 0 && (
                  <button
                    type="button"
                    style={{ marginTop: 4, fontSize: 11 }}
                    aria-label="Clear recent scans"
                    onClick={async () => {
                      try {
                        auditLogger.logSystemEvent(
                          'recent-scans-management',
                          'recent-scans-cleared',
                          { count: recent.length }
                        );
                        const res = await UnifiedNavigation.recent.clear();
                        if (res.success) setRecent([]);
                      } catch (error) {
                        console.error('clearRecent failed', error);
                        auditLogger.logSecurityViolation(
                          'recent-scans-management-failed',
                          error instanceof Error ? error.message : 'Unknown error'
                        );
                        const _errorInfo = errorReporter.reportError(
                          error instanceof Error
                            ? error
                            : new Error('Failed to clear recent scans'),
                          'recent-scans-management'
                        );
                      }
                    }}
                  >
                    Clear Recent
                  </button>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="metro-main" id="mainContent" role="main" aria-label="Visualization Stage">
          {/* Toolbar */}
          <div className="metro-toolbar" data-testid="metro-toolbar">
            {/* Mode Switcher */}
            <div className="toolbar-section mode-switcher">
              <div>Mode</div>
              <div
                role="group"
                aria-label="Visualization Mode"
                className="mode-buttons"
              >
                {definitions.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setMode(d.id)}
                    className={`mode-btn ${selectedMode === d.id ? 'active' : ''}`}
                    aria-pressed={selectedMode === d.id}
                    title={d.label}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Zoom controls removed - now handled by MapControls component in visualization modes */}
            <div className="toolbar-section">
              <button
                type="button"
                className="tool-btn"
                onClick={handleExportPNG}
                title="Export PNG"
                aria-label="Export PNG"
              >
                📸
              </button>
            </div>
            {isGoogleMapMode && (
              <div
                className="toolbar-section"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  alignItems: 'center',
                  maxWidth: 'min(780px, 100%)',
                }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                  Node (mm)
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      step={0.25}
                      value={mapSettings.nodeSizeMm}
                      onChange={(e) => {
                        const next = Number.parseFloat(e.target.value);
                        if (Number.isFinite(next)) {
                          updateMapSettings({ nodeSizeMm: clampValue(next, 1, 12) });
                        }
                      }}
                      aria-label="Node size in millimeters"
                      style={{ width: 120 }}
                    />
                    <input
                      type="number"
                      min={1}
                      max={12}
                      step={0.1}
                      value={mapSettings.nodeSizeMm}
                      onChange={(e) => {
                        const next = Number.parseFloat(e.target.value);
                        if (Number.isFinite(next)) {
                          updateMapSettings({ nodeSizeMm: clampValue(next, 1, 12) });
                        }
                      }}
                      aria-label="Node size value"
                      style={{ width: 56 }}
                    />
                  </div>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                  Text (mm)
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="range"
                      min={0.5}
                      max={8}
                      step={0.1}
                      value={mapSettings.textSizeMm}
                      onChange={(e) => {
                        const next = Number.parseFloat(e.target.value);
                        if (Number.isFinite(next)) {
                          updateMapSettings({ textSizeMm: clampValue(next, 0.5, 8) });
                        }
                      }}
                      aria-label="Label text size in millimeters"
                      style={{ width: 120 }}
                    />
                    <input
                      type="number"
                      min={0.5}
                      max={8}
                      step={0.1}
                      value={mapSettings.textSizeMm}
                      onChange={(e) => {
                        const next = Number.parseFloat(e.target.value);
                        if (Number.isFinite(next)) {
                          updateMapSettings({ textSizeMm: clampValue(next, 0.5, 8) });
                        }
                      }}
                      aria-label="Label text size value"
                      style={{ width: 56 }}
                    />
                  </div>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                  Line (mm)
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="range"
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={mapSettings.lineWidthMm}
                      onChange={(e) => {
                        const next = Number.parseFloat(e.target.value);
                        if (Number.isFinite(next)) {
                          updateMapSettings({ lineWidthMm: clampValue(next, 0.25, 4) });
                        }
                      }}
                      aria-label="Line width in millimeters"
                      style={{ width: 120 }}
                    />
                    <input
                      type="number"
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={mapSettings.lineWidthMm}
                      onChange={(e) => {
                        const next = Number.parseFloat(e.target.value);
                        if (Number.isFinite(next)) {
                          updateMapSettings({ lineWidthMm: clampValue(next, 0.25, 4) });
                        }
                      }}
                      aria-label="Line width value"
                      style={{ width: 56 }}
                    />
                  </div>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                  Line style
                  <select
                    value={mapSettings.lineStyle}
                    onChange={(e) =>
                      updateMapSettings({ lineStyle: e.target.value as LineStyle })
                    }
                    aria-label="Line style"
                    className="settings-input"
                  >
                    {LINE_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                  Labels
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={mapSettings.showLabels}
                      onChange={(e) =>
                        updateMapSettings({ showLabels: e.target.checked })
                      }
                      aria-label="Toggle label visibility"
                    />
                    <select
                      value={mapSettings.labelMode}
                      onChange={(e) =>
                        updateMapSettings({ labelMode: e.target.value as LabelMode })
                      }
                      aria-label="Label display mode"
                      className="settings-input"
                      disabled={!mapSettings.showLabels}
                    >
                      {LABEL_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                  Orientation
                  <div style={{ display: 'flex', gap: 6 }}>
                    {GRAPH_DIRECTION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`tool-btn ${
                          mapSettings.graphDirection === option.value ? 'active' : ''
                        }`}
                        aria-pressed={mapSettings.graphDirection === option.value}
                        onClick={() => updateMapSettings({ graphDirection: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => setMapSettings({ ...DEFAULT_MAP_SETTINGS })}
                  aria-label="Reset map appearance to defaults"
                >
                  Reset
                </button>
              </div>
            )}
            {import.meta.env.DEV && (
              <div className="toolbar-section">
                <label className="mode-switcher">
                  Depth Cap
                  <input
                    type="number"
                    min={1}
                    placeholder="auto"
                    value={depthOverride ?? ''}
                    className="depth-cap-input"
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === '') {
                        setDepthOverride(null);
                        return;
                      }
                      const n = parseInt(v, 10);
                      if (!Number.isNaN(n) && n > 0) setDepthOverride(n);
                    }}
                  />
                </label>
                {depthOverride != null && (
                  <button
                    type="button"
                    className="tool-btn"
                    title="Reset depth cap override"
                    onClick={() => setDepthOverride(null)}
                  >
                    ♻️
                  </button>
                )}
              </div>
            )}
            {settings?.defaultScan && (
              <div className="toolbar-section">
                <label className="mode-switcher">
                  Agg Thresh
                  <input
                    type="number"
                    value={settings.defaultScan.aggregationThreshold}
                    min={1}
                    className="settings-input"
                    onChange={async (e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && v > 0) {
                        const next = {
                          ...settings,
                          defaultScan: { ...settings.defaultScan, aggregationThreshold: v },
                        } as UserSettings;
                        setSettings(next);
                        window.dispatchEvent(
                          new CustomEvent('metro:aggregationThresholdChanged', {
                            detail: { aggregationThreshold: v },
                          })
                        );
                        await updateUserSettings({ defaultScan: next.defaultScan });
                      }
                    }}
                  />
                </label>
              </div>
            )}
            {settings?.defaultScan && (
              <div className="toolbar-section">
                <label className="mode-switcher">
                  Max Entries
                  <input
                    type="number"
                    value={settings.defaultScan.maxEntries}
                    min={0}
                    className="settings-input"
                    onChange={async (e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && v >= 0) {
                        const next = {
                          ...settings,
                          defaultScan: { ...settings.defaultScan, maxEntries: v },
                        } as UserSettings;
                        setSettings(next);
                        await updateUserSettings({ defaultScan: next.defaultScan });
                      }
                    }}
                  />
                </label>
              </div>
            )}
            {hoveredNode && (
              <div className="hover-info">
                <span className={`node-icon ${hoveredNode.type}`}>
                  {hoveredNode.type === 'aggregated' ? '📦' : '📄'}
                </span>
                <span>{hoveredNode.name}</span>
              </div>
            )}
          </div>

          {/* Stage Container */}
          <div
            ref={stageContainerRef}
            className="stage-container"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            <ModeRenderer
              theme={currentTheme}
              layout={layoutNodes}
              routes={routes}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onLayoutUpdate={handleLayoutUpdate}
              onViewportChange={setViewportBounds}
              debug={import.meta.env.DEV}
              modeProps={modeSpecificProps}
            />
          </div>

          {/* Context Menu */}
          {ctxMenu && (
            <div
              style={{
                position: 'absolute',
                top: ctxMenu.y,
                left: ctxMenu.x,
                zIndex: 1000,
              }}
            >
              {/* Context menu content */}
            </div>
          )}

          {/* Minimap */}
          {showMinimap && !isGoogleMapMode && (
            <DraggableWindow
              title="Minimap"
              id="minimap"
              defaultPosition={{ x: 20, y: window.innerHeight - 250 }}
              onClose={() => setShowMinimap(false)}
              className="minimap-window"
            >
              <div style={{ width: '200px', height: '150px' }}>
                <MiniMap 
                  layout={layoutNodes}
                  viewportBounds={viewportBounds || undefined}
                  onViewportChange={handleMinimapViewportChange}
                />
              </div>
            </DraggableWindow>
          )}

          {/* Development Idle Hint */}
          {showDevIdleHint && (
            <div className="dev-hint">
              <span>Nenhum scan ativo. Iniciar?</span>
              <button
                type="button"
                className="tool-btn"
                onClick={handleStartScanDev}
              >
                Scan C:/
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('metro:genTree', { detail: { breadth: 3, depth: 3, files: 2 } })
                  );
                  setShowDevIdleHint(false);
                }}
              >
                Árvore Sintética
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => setShowDevIdleHint(false)}
              >
                Fechar
              </button>
            </div>
          )}

          {/* LOD HUD */}
          {lodStats && showLodHud && (
            <DraggableWindow
              title="LOD"
              id="lod-hud"
              defaultPosition={{ x: window.innerWidth - 240, y: 100 }}
              onClose={() => setShowLodHud(false)}
              className="lod-window"
            >
              <div style={{ fontSize: 11, lineHeight: 1.35, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div>Scale: {lodStats.scale.toFixed(2)}</div>
                <div>Depth Cap: {lodStats.depthCap == null ? '∞' : lodStats.depthCap}</div>
                <div>
                  Rendered: {lodStats.rendered}/{lodStats.total} ({lodStats.culled} culled)
                </div>
                {depthOverride != null && <div style={{ color: '#f5d90a' }}>Override ativo</div>}
              </div>
            </DraggableWindow>
          )}
        </main>
      </div>

      {/* Performance Overlay */}
      {showPerformance && (
        <DraggableWindow
          title="Performance Metrics"
          id="performance"
          defaultPosition={{ x: window.innerWidth - 240, y: 20 }}
          onClose={() => setShowPerformance(false)}
          className="performance-window"
        >
          <div className="perf-content">
            <div className="perf-item">
              <span className="perf-label">FPS:</span>
              <span
                className={`perf-value ${perfMetrics.fps < 30 ? 'warning' : perfMetrics.fps < 50 ? 'caution' : 'good'}`}
              >
                {perfMetrics.fps}
              </span>
            </div>
            <div className="perf-item">
              <span className="perf-label">Nodes:</span>
              <span className="perf-value">{perfMetrics.nodeCount.toLocaleString()}</span>
            </div>
            <div className="perf-item">
              <span className="perf-label">Memory:</span>
              <span className="perf-value">
                {(perfMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
              </span>
            </div>
            <div className="perf-item">
              <span className="perf-label">Layout:</span>
              <span className="perf-value">{perfMetrics.lastLayoutMs.toFixed(1)}ms</span>
            </div>
          </div>
        </DraggableWindow>
      )}

      {/* Context Menu */}
      {ctxMenu?.visible && (
        <div
          className="context-menu"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
          }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              if (favorites.includes(ctxMenu.path)) {
                const newFavs = favorites.filter((f) => f !== ctxMenu.path);
                setFavorites(newFavs);
                saveFavorites(newFavs);
              } else {
                const newFavs = [...favorites, ctxMenu.path];
                setFavorites(newFavs);
                saveFavorites(newFavs);
              }
              setCtxMenu(null);
            }}
          >
            {favorites.includes(ctxMenu.path) ? '★ Remove Favorite' : '☆ Add Favorite'}
          </button>
        </div>
      )}
      <div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  );
};

export const MetroUI: React.FC<MetroUIProps> = (props) => (
  <SettingsProvider>
    <ModeProvider>
      <MetroUIInner {...props} />
    </ModeProvider>
  </SettingsProvider>
);

export default MetroUI;

