import React, { useState, useEffect } from 'react';
import './App.css';
import { MetroUI } from './components/MetroUI';
import { SettingsProvider } from './settings/SettingsProvider';
import { ErrorHandler } from './components/ErrorHandler';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { errorReporter } from './services/error-reporter';
import { auditLogger } from './services/audit-logger';

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
  const [scanNodes, setScanNodes] = useState<NodeEntry[]>([]);
  const [receivedNodes, setReceivedNodes] = useState<number>(0);
  const [scanDone, setScanDone] = useState<ScanDone | null>(null);
  const [rootPath, setRootPath] = useState<string | null>(null);

  const resetScanState = () => {
    setScanId(null);
    setScanProgress(null);
    setScanNodes([]);
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
        setScanNodes(prev => [...prev, ...newNodes]);
        setReceivedNodes(prev => prev + newNodes.length);
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

  const toggleMonitoring = () => {
    const newState = !showMonitoring;
    setShowMonitoring(newState);

    auditLogger.logSystemEvent('application', 'toggle_monitoring', {
      enabled: newState,
    });
  };

  return (
    <SettingsProvider>
      <div className="App">
        <div className="app-header">
          <button
            onClick={toggleMonitoring}
            className="monitoring-toggle"
            title={showMonitoring ? 'Hide Monitoring Dashboard' : 'Show Monitoring Dashboard'}
          >
            {showMonitoring ? '📊' : '📈'}
          </button>
        </div>

        {showMonitoring ? <MonitoringDashboard /> : (
          <MetroUI
            scanId={scanId}
            progress={scanProgress}
            nodes={scanNodes}
            receivedNodes={receivedNodes}
            done={scanDone}
            rootPath={rootPath}
          />
        )}

        <ErrorHandler errors={errors} onDismiss={handleErrorDismiss} />
      </div>
    </SettingsProvider>
  );
}

export default App;
