import React, { useEffect, useState } from 'react';
import { listRecent, clearRecent } from '../recent-scans-client';
import { DraggablePanel } from './DraggablePanel';
import './RecentScansPanel.css';

interface RecentScan {
  path: string;
  timestamp?: number;
  nodeCount?: number;
}

interface RecentScansPanelProps {
  onScan: (path: string) => void;
  className?: string;
}

/**
 * Recent Scans Quick Access Panel
 * RICE Score: 48.0 (Reach: 10, Impact: 3, Confidence: 0.8, Effort: 0.5 weeks)
 * 
 * Displays the 10 most recent scans with one-click re-scan capability.
 * Persists across sessions using electron-store via recent-scans-store.cjs
 */
export const RecentScansPanel: React.FC<RecentScansPanelProps> = ({ onScan }) => {
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecentScans();
  }, []);

  const loadRecentScans = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listRecent();
      if (result.success) {
        // Convert string array to RecentScan objects
        const scans: RecentScan[] = result.recent.map((path) => ({
          path,
          timestamp: Date.now(), // In real implementation, would come from store
        }));
        setRecentScans(scans);
      } else {
        setError(result.error || 'Failed to load recent scans');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading recent scans');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all recent scans history?')) {
      return;
    }
    
    try {
      const result = await clearRecent();
      if (result.success) {
        setRecentScans([]);
      } else {
        setError(result.error || 'Failed to clear history');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error clearing history');
    }
  };

  const handleRescan = (path: string) => {
    onScan(path);
  };

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const getShortPath = (path: string, maxLength: number = 50): string => {
    if (path.length <= maxLength) return path;
    
    // Try to show the end of the path (most specific part)
    const parts = path.split(/[\\/]/);
    if (parts.length <= 2) return path;
    
    // Keep first part and last 2 parts
    return `${parts[0]}/.../${parts.slice(-2).join('/')}`;
  };

  if (isLoading) {
    return (
      <DraggablePanel
        id="recent-scans"
        title="Recent Scans"
        defaultPosition={{ x: 360, y: 80 }}
        defaultSize={{ width: 380, height: 280 }}
        collapsible={true}
        resizable={false}
        className="recent-scans-panel"
      >
        <div className="recent-scans-loading">Loading recent scans...</div>
      </DraggablePanel>
    );
  }

  if (error) {
    return (
      <DraggablePanel
        id="recent-scans"
        title="Recent Scans"
        defaultPosition={{ x: 360, y: 80 }}
        defaultSize={{ width: 380, height: 280 }}
        collapsible={true}
        resizable={false}
        className="recent-scans-panel"
      >
        <div className="recent-scans-error">
          <span>⚠️ {error}</span>
          <button onClick={loadRecentScans} className="retry-button">Retry</button>
        </div>
      </DraggablePanel>
    );
  }

  return (
    <DraggablePanel
      id="recent-scans"
      title={`Recent Scans (${recentScans.length})`}
      defaultPosition={{ x: 360, y: 80 }}
      defaultSize={{ width: 380, height: 400 }}
      collapsible={true}
      resizable={false}
      className="recent-scans-panel"
    >
      <div className="recent-scans-actions-bar">
        {recentScans.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="clear-button"
            title="Clear history"
            aria-label="Clear all recent scans"
          >
            🗑️ Clear History
          </button>
        )}
      </div>

      <div className="recent-scans-list">
          {recentScans.length === 0 ? (
            <div className="recent-scans-empty">
              <p>No recent scans yet</p>
              <p className="hint">Scanned directories will appear here</p>
            </div>
          ) : (
            <ul className="recent-scans-items">
              {recentScans.slice(0, 10).map((scan, index) => (
                <li key={`${scan.path}-${index}`} className="recent-scan-item">
                  <button
                    onClick={() => handleRescan(scan.path)}
                    className="recent-scan-button"
                    title={`Re-scan: ${scan.path}`}
                  >
                    <div className="scan-info">
                      <div className="scan-path" title={scan.path}>
                        📁 {getShortPath(scan.path)}
                      </div>
                      <div className="scan-metadata">
                        {scan.timestamp && (
                          <span className="scan-time">
                            {formatTimestamp(scan.timestamp)}
                          </span>
                        )}
                        {scan.nodeCount && (
                          <span className="scan-nodes">
                            {scan.nodeCount.toLocaleString()} nodes
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="scan-action">
                      <span className="rescan-icon" aria-label="Re-scan">↻</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DraggablePanel>
  );
};
