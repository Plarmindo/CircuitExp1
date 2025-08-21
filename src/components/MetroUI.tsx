import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MetroStage } from '../visualization/metro-stage';
import ResponsiveMetroStage from './ResponsiveMetroStage';
import { MiniMap } from './MiniMap';
import { setTheme } from '../visualization/style-tokens';
import {
  getUserSettings,
  onUserSettingsLoaded,
  onUserSettingsUpdated,
  updateUserSettings,
} from '../settings/user-settings-client';
import type { UserSettings } from '../settings/user-settings-client';
import './MetroUI.css';
import { favoritesClient } from '../favorites/favorites-client';
import { listRecent, clearRecent } from '../recent-scans-client';
import { errorReporter } from '../services/error-reporter';
import { auditLogger } from '../services/audit-logger';

import { PIIDetector, defaultPIIConfig } from '../services/pii-detector';
import { RateLimiter, defaultRateLimitConfig } from '../services/rate-limiter';

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

export const MetroUI: React.FC<MetroUIProps> = ({
  scanId,
  progress,
  nodes,
  receivedNodes,
  done,
  rootPath,
}) => {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [showPerformance, setShowPerformance] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
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

  const [piiDetector] = useState(() => new PIIDetector(defaultPIIConfig));
  const [rateLimiter] = useState(() => new RateLimiter(defaultRateLimitConfig));
  // Override manual de profundidade (controle de LOD manual). null = automático via zoom.
  const [depthOverride, setDepthOverride] = useState<number | null>(null);
  // Banner dev inicial quando não há scan ativo (auxilia percepção de core pronto)
  const [showDevIdleHint, setShowDevIdleHint] = useState(false);
  // NOTE: avoid naming this state variable 'performance' to prevent shadowing the
  // global performance API (was causing runtime errors calling performance.now()).
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    nodeCount: 0,
    lastLayoutMs: 0,
    lastBatchMs: 0,
    memoryUsage: 0,
  });
  // LOD HUD state (escala, depthCap efetivo, nós renderizados vs total)
  const [lodStats, setLodStats] = useState<{
    scale: number;
    depthCap: number | null;
    rendered: number;
    total: number;
    culled: number;
  } | null>(null);

  const fpsCounterRef = useRef<number[]>([]);

  // Ensure focus-visible outline for stage container even when external CSS isn’t loaded (e.g., JSDOM tests)
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

    // Listen for scan errors from the main process
    const offScanError =
      (
        window as unknown as {
          electronAPI?: { onScanError?: (cb: (e: any) => void) => () => void };
        }
      )?.electronAPI?.onScanError?.((error) => {
        if (error.scanId === scanId || !scanId) {
          const errorInfo = errorReporter.reportError(
            new Error(error.userMessage || error.error),
            'scan-operation'
          );
        }
      }) || (() => {});

    return () => {
      cancelled = true;
      offLoaded();
      offUpdated();
      offScanError();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

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
        const res = await w.electronAPI.selectAndScanFolder();
        console.log('Folder selection result', res);
        auditLogger.logSystemEvent('folder-selection-completed', 'scan-started', {
          folder: res && typeof res === 'object' && 'folder' in res ? res.folder : 'unknown',
        });
      }
    } catch (error) {
      console.error('selectAndScanFolder failed', error);
      auditLogger.logSecurityViolation(
        'folder-selection-failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      const errorInfo = errorReporter.reportError(
        error instanceof Error ? error : new Error('Failed to select folder'),
        'folder-selection'
      );
    }
  };

  const handleCancelScan = useCallback(async () => {
    try {
      const w = window as unknown as {
        electronAPI?: { cancelScan?: (id: string) => Promise<unknown> };
      };
      if (scanId && w.electronAPI?.cancelScan) {
        await w.electronAPI.cancelScan(scanId);
      }
    } catch (error) {
      console.error('cancelScan failed', error);
      const errorInfo = errorReporter.reportError(
        error instanceof Error ? error : new Error('Failed to cancel scan'),
        'scan-cancel'
      );
    }
  }, [scanId]);

  const handleStartScanDev = useCallback(async () => {
    try {
      const w = window as unknown as {
        electronAPI?: { startScan?: (root: string) => Promise<unknown> };
      };
      if (w.electronAPI?.startScan) {
        await w.electronAPI.startScan('C:/');
      }
    } catch (error) {
      console.error('startScan dev failed', error);
      const errorInfo = errorReporter.reportError(
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
          nodeCount: nodes?.length || 0,
          memoryUsage:
            (globalThis.performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
              ?.usedJSHeapSize || 0,
        }));
      } catch {
        /* ignore during teardown */
      }
    }, 100);
    return () => clearInterval(interval);
  }, [nodes?.length || 0]);

  // Control actions
  const handleZoomIn = () => {
    // Dispatch global control event consumed by MetroStage
    window.dispatchEvent(new Event('metro:zoomIn'));
  };

  const handleZoomOut = () => {
    // Dispatch global control event consumed by MetroStage
    window.dispatchEvent(new Event('metro:zoomOut'));
  };

  const handleFitToView = () => {
    // Dispatch global control event consumed by MetroStage
    window.dispatchEvent(new Event('metro:fit'));
  };

  const handleExportPNG = () => {
    // Dispatch global control event consumed by MetroStage
    window.dispatchEvent(new Event('metro:exportPNG'));
  };

  const filteredNodes = nodes?.filter(
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
        const list = await favoritesClient.list();
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
        const r = await listRecent();
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
        const list = await favoritesClient.remove(selectedNode.path);
        setFavorites(list);
      } else {
        auditLogger.logSystemEvent('favorites-management', 'favorite-added', {
          path: selectedNode.path,
        });
        const list = await favoritesClient.add(selectedNode.path);
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
      <a
        href="#mainContent"
        className="skip-link sr-only"
        style={{
          position: 'absolute',
          left: -9999,
          top: 0,
          background: '#111',
          color: '#fff',
          padding: '8px 12px',
          zIndex: 5000,
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '8px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px';
        }}
      >
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
              <div
                className="current-root"
                title={rootPath}
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  maxWidth: 360,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const dbg: any = (window as unknown as { __metroDebug?: unknown }).__metroDebug;
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
                      {(filteredNodes?.length || 0)} results for "{searchQuery}"
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
                  {settings && (
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
                              const w = window as unknown as {
                                electronAPI?: { startScan?: (root: string) => Promise<unknown> };
                              };
                              if (w.electronAPI?.startScan) await w.electronAPI.startScan(f);
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
                          const list = await favoritesClient.remove(f);
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
                            const w = window as unknown as {
                              electronAPI?: { startScan?: (root: string) => Promise<unknown> };
                            };
                            if (w.electronAPI?.startScan) await w.electronAPI.startScan(r);
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
                        const res = await clearRecent();
                        if (res.success) setRecent([]);
                      } catch (error) {
                        console.error('clearRecent failed', error);
                        auditLogger.logSecurityViolation(
                          'recent-scans-management-failed',
                          error instanceof Error ? error.message : 'Unknown error'
                        );
                        const errorInfo = errorReporter.reportError(
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
          <div className="metro-toolbar">
            <div className="toolbar-section" role="toolbar" aria-label="Visualization tools">
              <button
                type="button"
                className="tool-btn"
                onClick={handleZoomIn}
                title="Zoom In"
                aria-label="Zoom in"
              >
                🔍➕
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={handleZoomOut}
                title="Zoom Out"
                aria-label="Zoom out"
              >
                🔍➖
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={handleFitToView}
                title="Fit to View"
                aria-label="Fit to view"
              >
                ⏹️
              </button>
            </div>
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
            {import.meta.env.DEV && (
              <div
                className="toolbar-section"
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <label
                  style={{
                    fontSize: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                  title="Override manual da profundidade máxima visível (LOD). Deixe vazio para automático."
                >
                  Depth Cap
                  <input
                    type="number"
                    min={1}
                    placeholder="auto"
                    value={depthOverride ?? ''}
                    style={{ width: 54 }}
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
            {settings && (
              <div
                className="toolbar-section"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <label
                  style={{
                    fontSize: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  Agg Thresh
                  <input
                    type="number"
                    value={settings.defaultScan.aggregationThreshold}
                    min={1}
                    style={{ width: 60 }}
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
                <label
                  style={{
                    fontSize: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  Max Entries
                  <input
                    type="number"
                    value={settings.defaultScan.maxEntries}
                    min={0}
                    style={{ width: 60 }}
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
            className="stage-container"
            tabIndex={0}
            role="group"
            aria-label="Visualization Stage (focus to enable keyboard navigation)"
            style={{ width: '100%', height: '100%', position: 'relative' }}
          >
            <ResponsiveMetroStage />
          </div>

          {/* Minimap */}
          {showMinimap && (
            <div className="minimap">
              <div className="minimap-header">Minimap</div>
              <div className="minimap-content">
                <div className="minimap-viewport">
                  <MiniMap />
                </div>
              </div>
            </div>
          )}
          {import.meta.env.DEV && showDevIdleHint && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                padding: '8px 12px',
                background: 'rgba(30,30,30,0.85)',
                color: '#fff',
                borderRadius: 6,
                fontSize: 12,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <span>Nenhum scan ativo. Iniciar?</span>
              <button
                type="button"
                className="tool-btn"
                style={{ fontSize: 11 }}
                onClick={handleStartScanDev}
              >
                Scan C:/
              </button>
              <button
                type="button"
                className="tool-btn"
                style={{ fontSize: 11 }}
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
                style={{ fontSize: 11 }}
                onClick={() => setShowDevIdleHint(false)}
              >
                Fechar
              </button>
            </div>
          )}
          {/* LOD HUD */}
          {lodStats && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(20,20,30,0.55)',
                backdropFilter: 'blur(2px)',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 11,
                lineHeight: 1.35,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              aria-label="Level of Detail Status"
              role="status"
            >
              <div style={{ fontWeight: 600 }}>LOD</div>
              <div>Scale: {lodStats.scale.toFixed(2)}</div>
              <div>Depth Cap: {lodStats.depthCap == null ? '∞' : lodStats.depthCap}</div>
              <div>
                Rendered: {lodStats.rendered}/{lodStats.total} ({lodStats.culled} culled)
              </div>
              {depthOverride != null && <div style={{ color: '#f5d90a' }}>Override ativo</div>}
            </div>
          )}
        </main>
      </div>

      {/* Performance Overlay */}
      {showPerformance && (
        <div className="performance-overlay">
          <div className="perf-header">Performance Metrics</div>
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
        </div>
      )}
      

      {ctxMenu?.visible && (
        <div
          className="metro-context-menu"
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: '#222',
            color: '#fff',
            padding: '6px 8px',
            fontSize: 12,
            borderRadius: 4,
            zIndex: 3000,
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ marginBottom: 6, fontWeight: 600 }}>
            {ctxMenu.path.split(/[/\\]/).pop()}
          </div>
          <button
            type="button"
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'transparent',
              color: '#fff',
              border: 'none',
              padding: '4px 0',
              cursor: 'pointer',
            }}
            aria-label={favorites.includes(ctxMenu.path) ? 'Remove favorite' : 'Add favorite'}
            onClick={async () => {
              try {
                if (favorites.includes(ctxMenu.path)) {
                  const list = await favoritesClient.remove(ctxMenu.path);
                  setFavorites(list);
                } else {
                  const list = await favoritesClient.add(ctxMenu.path);
                  setFavorites(list);
                }
              } catch (err) {
                console.error('ctx favorite toggle failed', err);
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