import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MetroStage } from '../visualization/metro-stage';
import { setTheme } from '../visualization/style-tokens';
import { getUserSettings, onUserSettingsLoaded, onUserSettingsUpdated, updateUserSettings } from '../settings/user-settings-client';
import type { UserSettings } from '../settings/user-settings-client';
import './MetroUI.css';
import { favoritesClient } from '../favorites/favorites-client';
import { listRecent, clearRecent } from '../recent-scans-client';

interface ScanProgress { dirsProcessed: number; filesProcessed: number; approxCompletion?: number }
interface NodeEntry { path: string; name: string; kind: 'dir' | 'file'; size?: number }
interface ScanDone { cancelled?: boolean }
interface MetroUIProps {
  scanId: string | null;
  progress: ScanProgress | null;
  nodes: NodeEntry[];
  receivedNodes: number;
  done: ScanDone | null;
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

export const MetroUI: React.FC<MetroUIProps> = ({ scanId, progress, nodes, receivedNodes, done }) => {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [showPerformance, setShowPerformance] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SelectedNodeInfo | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; x: number; y: number; path: string } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  // NOTE: avoid naming this state variable 'performance' to prevent shadowing the
  // global performance API (was causing runtime errors calling performance.now()).
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    nodeCount: 0,
    lastLayoutMs: 0,
    lastBatchMs: 0,
    memoryUsage: 0,
  });
  
  const fpsCounterRef = useRef<number[]>([]);

  // Live region ref for announcements (A11Y)
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  // CORE-3: load persisted user settings (theme, defaults) and react to updates from main process
  useEffect(() => {
    let cancelled = false;
    // Initial fetch (in case events already fired before subscription)
    getUserSettings().then(res => {
      if (!cancelled && res.success && res.settings) {
        setSettings(res.settings);
        if (res.settings.theme !== currentTheme) {
          setCurrentTheme(res.settings.theme);
          setTheme(res.settings.theme);
        }
      }
    }).catch(() => {/* ignore */});
    const offLoaded = onUserSettingsLoaded(s => {
      setSettings(s);
      if (s.theme !== currentTheme) {
        setCurrentTheme(s.theme);
        setTheme(s.theme);
      }
    });
    const offUpdated = onUserSettingsUpdated(s => {
      setSettings(s);
      if (s.theme !== currentTheme) {
        setCurrentTheme(s.theme);
        setTheme(s.theme);
        // Notify visualization for dynamic restyle
        window.dispatchEvent(new CustomEvent('metro:themeChanged', { detail: { theme: s.theme } }));
      }
    });
    return () => { cancelled = true; offLoaded(); offUpdated(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const w = window as unknown as { electronAPI?: { selectAndScanFolder?: () => Promise<unknown> } };
      if (w.electronAPI?.selectAndScanFolder) {
        const res = await w.electronAPI.selectAndScanFolder();
        console.log('Folder selection result', res);
      }
    } catch (err) {
      console.error('selectAndScanFolder failed', err);
    }
  };

  const handleCancelScan = async () => {
    try {
      const w = window as unknown as { electronAPI?: { cancelScan?: (id: string) => Promise<unknown> } };
      if (scanId && w.electronAPI?.cancelScan) {
        const res = await w.electronAPI.cancelScan(scanId);
        console.log('Cancel scan result', res);
      }
    } catch (err) {
      console.error('cancelScan failed', err);
    }
  };

  const handleStartScanDev = async () => {
    try {
      const w = window as unknown as { electronAPI?: { startScan?: (root: string) => Promise<unknown> } };
      if (w.electronAPI?.startScan) {
        await w.electronAPI.startScan('C:/');
      }
    } catch (err) {
      console.error('startScan dev failed', err);
    }
  };

  // Listen to metro events
  useEffect(() => {
    const handleHover = (e: Event) => {
      const d = (e as CustomEvent).detail as { path?: string; type?: 'node' | 'aggregated' } | undefined;
      if (d?.path && d.type) {
        setHoveredNode({ path: d.path, type: d.type, name: d.path.split('/').pop() || d.path });
      } else {
        setHoveredNode(null);
      }
    };

    const handleSelect = (e: Event) => {
      const d = (e as CustomEvent).detail as { path?: string; type?: 'node' | 'aggregated' } | undefined;
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Performance monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      // Use the real performance API explicitly from globalThis to avoid shadowing.
      const now = globalThis.performance.now();
      fpsCounterRef.current.push(now);
      fpsCounterRef.current = fpsCounterRef.current.filter(time => now - time < 1000);

      setPerfMetrics(prev => ({
        ...prev,
        fps: fpsCounterRef.current.length,
        nodeCount: nodes.length,
  memoryUsage: (globalThis.performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0,
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [nodes.length]);

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

  const filteredNodes = nodes.filter(node => 
    searchQuery === '' || 
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Favorites load on mount
  useEffect(() => { (async () => { try { setLoadingFavs(true); const list = await favoritesClient.list(); setFavorites(list); } finally { setLoadingFavs(false); } })(); }, []);
  // Recent scans load
  useEffect(() => { (async () => { try { setLoadingRecent(true); const r = await listRecent(); if (r.success) setRecent(r.recent); } finally { setLoadingRecent(false); } })(); }, [scanId]);

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
    return () => { if (unsubLoaded) unsubLoaded(); if (unsubUpdated) unsubUpdated(); };
  }, []);

  const isFavorite = (p: string) => favorites.includes(p);
  const toggleFavorite = async () => {
    if (!selectedNode) return;
    try {
      if (isFavorite(selectedNode.path)) {
        const list = await favoritesClient.remove(selectedNode.path);
        setFavorites(list);
      } else {
        const list = await favoritesClient.add(selectedNode.path);
        setFavorites(list);
      }
    } catch (e) { console.error('favorite toggle failed', e); }
  };

  const renderHighlighted = useCallback((text: string) => {
    if (!searchQuery) return text;
    const lower = text.toLowerCase();
    const q = searchQuery.toLowerCase();
    const i = lower.indexOf(q);
    if (i === -1) return text;
    return <>{text.slice(0,i)}<mark>{text.slice(i,i+q.length)}</mark>{text.slice(i+q.length)}</>;
  }, [searchQuery]);

  // Announce selection changes
  useEffect(() => {
    if (selectedNode && liveRegionRef.current) {
      liveRegionRef.current.textContent = `Selected ${selectedNode.type} ${selectedNode.name}`;
    }
  }, [selectedNode]);

  const theme = currentTheme;

  return (
    <div className={`metro-ui ${theme}`}>
      <a href="#mainContent" className="sr-only" tabIndex={0}>Skip to visualization</a>
      {/* Header */}
      <header className="metro-header">
        <div className="header-left">
          <h1>🚇 Metro Map Visualizer</h1>
          <div className="scan-status">
            {progress ? (
              <div className="status-indicator scanning">
                <div className="spinner"></div>
                <span>
                  Scanning... {progress.approxCompletion != null
                    ? Math.round(progress.approxCompletion * 100) + '%'
                    : `${progress.dirsProcessed + progress.filesProcessed} items`}
                </span>
              </div>
            ) : done ? (
              <div className={`status-indicator ${done.cancelled ? 'cancelled' : 'completed'}`}>
                <span>{done.cancelled ? '⚠️ Cancelled' : '✅ Complete'}</span>
              </div>
            ) : (
              <div className="status-indicator idle">
                <span>⏸️ Ready</span>
              </div>
            )}
          </div>
        </div>
        <div className="header-controls">
          <button className="control-btn" onClick={handleSelectFolderAndScan} title="Select Folder & Scan">📁</button>
          <button className="control-btn" onClick={handleStartScanDev} title="Start Scan C:/ (dev)">🛠️</button>
          <button className="control-btn" onClick={handleCancelScan} title="Cancel Scan">🛑</button>
          <button className="control-btn" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="control-btn" onClick={() => setShowPerformance(!showPerformance)} title="Performance">
            📊
          </button>
          <button className="control-btn" onClick={() => setShowMinimap(!showMinimap)} title="Minimap">
            🗺️
          </button>
        </div>
      </header>

      <div className="metro-body">
        {/* Sidebar */}
        <aside className={`metro-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <button 
              className="collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
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
                      {filteredNodes.length} results for "{searchQuery}"
                    </div>
                  )}
                  {searchQuery && filteredNodes.slice(0, 20).map((node, i) => (
                    <div key={i} className="search-result-item">
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
                      <button className="fav-toggle-btn" onClick={toggleFavorite} title="Toggle Favorite">
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
                    <div className="stat-value">{nodes.length}</div>
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
                    <div className="stat-item" title="Current aggregation threshold (persisted setting)">
                      <div className="stat-value">{settings.defaultScan.aggregationThreshold}</div>
                      <div className="stat-label">Agg Threshold</div>
                    </div>
                  )}
                </div>
              </div>
              {/* Favorites List */}
              <div className="favorites-section">
                <h4>Favorites {loadingFavs && <span style={{fontSize:10}}>loading...</span>}</h4>
                {favorites.length === 0 && !loadingFavs && <div className="empty-hint">No favorites yet</div>}
                <ul className="favorites-list">
                  {favorites.map(f => (
                    <li key={f} className="fav-item">
                      <button className="fav-jump" onClick={() => {
                        window.dispatchEvent(new CustomEvent('metro:select', { detail: { path: f, type: 'node' } }));
                        window.dispatchEvent(new CustomEvent('metro:centerOnPath', { detail: { path: f } }));
                      }} title={f}>{f.split(/[/\\]/).pop()}</button>
                      <button className="fav-remove" onClick={async () => { const list = await favoritesClient.remove(f); setFavorites(list); }} title="Remove">✕</button>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Recent Scans */}
              <div className="recent-section" style={{marginTop:12}}>
                <h4>Recent Scans {loadingRecent && <span style={{fontSize:10}}>loading...</span>}</h4>
                {recent.length === 0 && !loadingRecent && <div className="empty-hint">No recent scans</div>}
                <ul className="recent-list">
                  {recent.map(r => (
                    <li key={r} className="recent-item">
                      <button className="recent-jump" onClick={async () => {
                        try {
                          const w = window as unknown as { electronAPI?: { startScan?: (root: string) => Promise<unknown> } };
                          if (w.electronAPI?.startScan) await w.electronAPI.startScan(r);
                        } catch (e) { console.error('recent rescan failed', e); }
                      }} title={r}>{r.length > 28 ? '…'+r.slice(-27) : r}</button>
                    </li>
                  ))}
                </ul>
                {recent.length > 0 && (
                  <button style={{marginTop:4,fontSize:11}} onClick={async () => { const res = await clearRecent(); if (res.success) setRecent([]); }}>Clear Recent</button>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="metro-main" id="mainContent" role="main" aria-label="Visualization Stage">
          {/* Toolbar */}
          <div className="metro-toolbar">
            <div className="toolbar-section">
              <button className="tool-btn" onClick={handleZoomIn} title="Zoom In">🔍➕</button>
              <button className="tool-btn" onClick={handleZoomOut} title="Zoom Out">🔍➖</button>
              <button className="tool-btn" onClick={handleFitToView} title="Fit to View">⏹️</button>
            </div>
            <div className="toolbar-section">
              <button className="tool-btn" onClick={handleExportPNG} title="Export PNG">📸</button>
            </div>
            {settings && (
              <div className="toolbar-section" style={{display:'flex',alignItems:'center',gap:6}}>
                <label style={{fontSize:10,display:'flex',flexDirection:'column',alignItems:'flex-start'}}>Agg Thresh
                  <input
                    type="number"
                    value={settings.defaultScan.aggregationThreshold}
                    min={1}
                    style={{width:60}}
                    onChange={async (e) => {
                      const v = parseInt(e.target.value,10);
                      if (!Number.isNaN(v) && v>0) {
                        const next = { ...settings, defaultScan: { ...settings.defaultScan, aggregationThreshold: v } } as UserSettings;
                        setSettings(next);
                        window.dispatchEvent(new CustomEvent('metro:aggregationThresholdChanged', { detail: { aggregationThreshold: v } }));
                        await updateUserSettings({ defaultScan: next.defaultScan });
                      }
                    }}
                  />
                </label>
                <label style={{fontSize:10,display:'flex',flexDirection:'column',alignItems:'flex-start'}}>Max Entries
                  <input
                    type="number"
                    value={settings.defaultScan.maxEntries}
                    min={0}
                    style={{width:60}}
                    onChange={async (e) => {
                      const v = parseInt(e.target.value,10);
                      if (!Number.isNaN(v) && v>=0) {
                        const next = { ...settings, defaultScan: { ...settings.defaultScan, maxEntries: v } } as UserSettings;
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
          <div className="stage-container">
            {(() => { console.log('[MetroUI] Rendering MetroStage (unconditional)'); return <MetroStage width={1200} height={700} />; })()}
          </div>

          {/* Minimap */}
          {showMinimap && (
            <div className="minimap">
              <div className="minimap-header">Minimap</div>
              <div className="minimap-content">
                <div className="minimap-viewport">
                  {/* TODO: Implement minimap */}
                  <div className="minimap-placeholder">🗺️</div>
                </div>
              </div>
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
              <span className={`perf-value ${perfMetrics.fps < 30 ? 'warning' : perfMetrics.fps < 50 ? 'caution' : 'good'}`}>
                {perfMetrics.fps}
              </span>
            </div>
            <div className="perf-item">
              <span className="perf-label">Nodes:</span>
              <span className="perf-value">{perfMetrics.nodeCount.toLocaleString()}</span>
            </div>
            <div className="perf-item">
              <span className="perf-label">Memory:</span>
              <span className="perf-value">{(perfMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</span>
            </div>
            <div className="perf-item">
              <span className="perf-label">Layout:</span>
              <span className="perf-value">{perfMetrics.lastLayoutMs.toFixed(1)}ms</span>
            </div>
          </div>
        </div>
      )}
      {ctxMenu?.visible && (
        <div className="metro-context-menu" style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, background: '#222', color: '#fff', padding: '6px 8px', fontSize: 12, borderRadius: 4, zIndex: 3000, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>{ctxMenu.path.split(/[/\\]/).pop()}</div>
          <button style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', color: '#fff', border: 'none', padding: '4px 0', cursor: 'pointer' }} onClick={async () => {
            try {
              if (favorites.includes(ctxMenu.path)) {
                const list = await favoritesClient.remove(ctxMenu.path); setFavorites(list);
              } else {
                const list = await favoritesClient.add(ctxMenu.path); setFavorites(list);
              }
            } catch (err) { console.error('ctx favorite toggle failed', err); }
            setCtxMenu(null);
          }}>{favorites.includes(ctxMenu.path) ? '★ Remove Favorite' : '☆ Add Favorite'}</button>
        </div>
      )}
      <div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  );
};