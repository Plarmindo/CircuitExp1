import React, { useState, useEffect } from 'react';
import './App.css';
import { MetroUIInner } from './components/MetroUI';
import { SettingsProvider } from './settings/SettingsProvider';
import { ErrorHandler } from './components/ErrorHandler';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { RecentScansPanel } from './components/RecentScansPanel';
import { useProgressiveScanLoading } from './hooks/useProgressiveLoading';
import { errorReporter } from './services/error-reporter';
import { auditLogger } from './services/audit-logger';
import { ModeProvider } from './visualization/modes/ModeProvider';
import { ZoomProvider } from './contexts/ZoomContext';

interface ErrorInfo {
  id: string;
  message: string;
  stack?: string;
  timestamp: Date;
  type: 'global' | 'unhandled-promise';
}

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

function App() {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanDone, setScanDone] = useState<ScanDone | null>(null);
  const [rootPath, setRootPath] = useState<string | null>(null);
  
  // Use progressive loading for smooth rendering of large datasets
  const { renderedNodes, state: _progressiveState, progress: _progressiveProgress } = useProgressiveScanLoading<NodeEntry>({
    batchSize: 100, // Render 100 nodes per batch
    batchDelay: 16, // ~60fps
  });
  
  // Track total received nodes for metrics
  const [receivedNodes, setReceivedNodes] = useState<number>(0);

  // Remove demo mode forcing; production UI is always active
  const resetScanState = () => {
    setScanId(null);
    setScanProgress(null);
    setReceivedNodes(0);
    setScanDone(null);
    setRootPath(null);
  };

  useEffect(() => {
    // Global error handler
    const handleError = (event: ErrorEvent) => {
      const errorInfo = errorReporter.reportError(event.error, 'global');
      setErrors((prev) => [...prev, errorInfo]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      const errorInfo = errorReporter.reportError(error, 'unhandled-promise');
      setErrors((prev) => [...prev, errorInfo]);
    };

    // Scan event handlers
    const handleScanProgress = (event: CustomEvent) => {
      const { scanId: id, dirsProcessed, filesProcessed, approxCompletion } = event.detail;
      // If it's a new scan (different scanId), reset state
      if (id !== scanId) {
        resetScanState();
      }
      setScanId(id);
      setScanProgress({ dirsProcessed, filesProcessed, approxCompletion });
    };

    const handleScanPartial = (event: CustomEvent) => {
      const { scanId: id, nodes: newNodes } = event.detail;
      if (id === scanId || !scanId) {
        // Progressive loading hook automatically handles scan:partial events
        // Just track the count for metrics
        setReceivedNodes((prev) => prev + newNodes.length);
      }
    };

    const handleScanDone = (event: CustomEvent) => {
      const { scanId: id, rootPath: path, cancelled } = event.detail;
      if (id === scanId || !scanId) {
        setScanDone({ cancelled });
        setRootPath(path);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('scan:progress', handleScanProgress as EventListener);
    window.addEventListener('scan:partial', handleScanPartial as EventListener);
    window.addEventListener('scan:done', handleScanDone as EventListener);

    // Audit log app startup
    auditLogger.logSystemEvent('application', 'startup', {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
    });

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('scan:progress', handleScanProgress as EventListener);
      window.removeEventListener('scan:partial', handleScanPartial as EventListener);
      window.removeEventListener('scan:done', handleScanDone as EventListener);
    };
  }, [scanId]);

  const handleErrorDismiss = (errorId: string) => {
    setErrors((prev) => prev.filter((error) => error.id !== errorId));
  };

  const handleScanFromRecent = async (path: string) => {
    try {
      // Use UnifiedNavigation to start scan
      const { UnifiedNavigation } = await import('./navigation/unified-navigation');
      await UnifiedNavigation.scan.start(path);
      
      auditLogger.logSystemEvent('application', 'scan_from_recent', {
        path,
      });
    } catch (error) {
      console.error('Failed to start scan from recent:', error);
      const errorInfo = errorReporter.reportError(
        error instanceof Error ? error : new Error('Failed to start scan'),
        'scan-start'
      );
      setErrors((prev) => [...prev, errorInfo]);
    }
  };

  const toggleMonitoring = () => {
    const newState = !showMonitoring;
    setShowMonitoring(newState);

    auditLogger.logSystemEvent('application', 'toggle_monitoring', {
      enabled: newState,
    });
  };

  return (
    <SettingsProvider>
      <ZoomProvider>
        <div className="App">
          <div className="app-header">
            {/* Production build: only Monitoring toggle remains */}
            <button
              onClick={toggleMonitoring}
              className="monitoring-toggle"
              title={showMonitoring ? 'Hide Monitoring Dashboard' : 'Show Monitoring Dashboard'}
            >
              {showMonitoring ? '📊' : '📈'}
            </button>
          </div>

          {/* Recent Scans Panel - positioned in left sidebar */}
          {!showMonitoring && (
            <div className="app-sidebar">
              <RecentScansPanel onScan={handleScanFromRecent} />
            </div>
          )}

          {showMonitoring ? (
            <MonitoringDashboard />
          ) : (
            <ModeProvider>
              <ErrorBoundary>
                <MetroUIInner
                  scanId={scanId}
                  progress={scanProgress}
                  nodes={renderedNodes}
                  receivedNodes={receivedNodes}
                  done={scanDone}
                  rootPath={rootPath}
                />
              </ErrorBoundary>
            </ModeProvider>
          )}

          <ErrorHandler errors={errors} onDismiss={handleErrorDismiss} />
        </div>
      </ZoomProvider>
    </SettingsProvider>
  );
}

export default App;
