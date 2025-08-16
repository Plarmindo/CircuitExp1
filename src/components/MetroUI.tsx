import React, { useState, useEffect, useRef } from 'react';
import { MetroStage } from '../visualization/metro-stage';
import { setTheme } from '../visualization/style-tokens';
import './MetroUI.css';

interface MetroUIProps {
  scanId: string | null;
  progress: any;
  nodes: any[];
  receivedNodes: number;
  done: any;
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

  // Theme switcher
  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(newTheme);
    setTheme(newTheme);
  // Notify stage for dynamic restyle without full layout recompute
  window.dispatchEvent(new CustomEvent('metro:themeChanged', { detail: { theme: newTheme } }));
  };

  // Scan controls
  const handleSelectFolderAndScan = async () => {
    try {
      if ((window as any).electronAPI?.selectAndScanFolder) {
        const res = await (window as any).electronAPI.selectAndScanFolder();
        console.log('Folder selection result', res);
      }
    } catch (err) {
      console.error('selectAndScanFolder failed', err);
    }
  };

  const handleCancelScan = async () => {
    try {
      if (scanId && (window as any).electronAPI?.cancelScan) {
        const res = await (window as any).electronAPI.cancelScan(scanId);
        console.log('Cancel scan result', res);
      }
    } catch (err) {
      console.error('cancelScan failed', err);
    }
  };

  const handleStartScanDev = async () => {
    try {
      if ((window as any).electronAPI?.startScan) {
        await (window as any).electronAPI.startScan('C:/');
      }
    } catch (err) {
      console.error('startScan dev failed', err);
    }
  };

  // Listen to metro events
  useEffect(() => {
    const handleHover = (e: any) => {
      if (e.detail) {
        setHoveredNode({
          path: e.detail.path,
          type: e.detail.type,
          name: e.detail.path.split('/').pop() || e.detail.path,
        });
      } else {
        setHoveredNode(null);
      }
    };

    const handleSelect = (e: any) => {
      if (e.detail) {
        setSelectedNode({
          path: e.detail.path,
          type: e.detail.type,
          name: e.detail.path.split('/').pop() || e.detail.path,
        });
      } else {
        setSelectedNode(null);
      }
    };

    window.addEventListener('metro:hover', handleHover);
    window.addEventListener('metro:select', handleSelect);

    return () => {
      window.removeEventListener('metro:hover', handleHover);
      window.removeEventListener('metro:select', handleSelect);
    };
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
        memoryUsage: (globalThis.performance as any)?.memory?.usedJSHeapSize || 0,
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

  const theme = currentTheme;

  return (
    <div className={`metro-ui ${theme}`}>
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
                        <div className="node-name">{node.name}</div>
                        <div className="node-path">{node.path}</div>
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
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="metro-main">
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
    </div>
  );
};