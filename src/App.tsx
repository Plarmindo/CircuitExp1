import { useState, useEffect } from 'react';
import './App.css';
import { MetroUI } from './components/MetroUI';


// ElectronBridge type removed (using global window.electronAPI shape from vite-env.d.ts)

interface BaseNode { path: string; name: string; depth: number; kind: 'file' | 'dir'; error?: string; size?: number; mtimeMs?: number; }
interface ScanProgressPayload { scanId: string; dirsProcessed: number; filesProcessed: number; queueLengthRemaining: number; elapsedMs: number; approxCompletion: number | null; }
interface ScanPartialPayload { scanId: string; nodes: BaseNode[]; truncated?: boolean; }
interface ScanDonePayload { scanId: string; status: string; cancelled: boolean; }

// removed unused colors constant

function App() {
  const [scanId, setScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgressPayload | null>(null);
  const [receivedNodes, setReceivedNodes] = useState<number>(0);
  const [done, setDone] = useState<ScanDonePayload | null>(null);
  const [nodes, setNodes] = useState<BaseNode[]>([]);
  const [rootPath, setRootPath] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;
    const api = window.electronAPI as unknown as {
      onScanStarted?: (cb: (s: { scanId: string; rootPath: string }) => void) => () => void;
      onScanProgress?: (cb: (p: ScanProgressPayload) => void) => () => void;
      onScanPartial?: (cb: (b: ScanPartialPayload) => void) => () => void;
      onScanDone?: (cb: (d: ScanDonePayload) => void) => () => void;
    } | undefined;
    const offStarted = api?.onScanStarted ? api.onScanStarted(({ scanId: newId, rootPath }) => {
      // Reset state for new scan
      setScanId(newId);
      setRootPath(rootPath);
      setProgress(null);
      setReceivedNodes(0);
      setDone(null);
      setNodes([]);
    }) : () => {};
  const offProgress = api?.onScanProgress ? api.onScanProgress((p) => {
      // Ignore progress events from previous scans after a new one started
      setProgress(prev => (p.scanId === scanId || !scanId ? p : prev));
      if (!scanId) setScanId(p.scanId);
  }) : () => {};
  const offPartial = api?.onScanPartial ? api.onScanPartial((b) => {
      setNodes(prev => (b.scanId === scanId || !scanId ? prev.concat(b.nodes) : prev));
      if (b.scanId === scanId || !scanId) setReceivedNodes(prev => prev + b.nodes.length);
  }) : () => {};
  const offDone = api?.onScanDone ? api.onScanDone((d) => {
      if (d.scanId === scanId) setDone(d);
  }) : () => {};
    return () => {
      offProgress();
      offPartial();
      offDone();
      offStarted();
    };
  }, [scanId]);

  useEffect(() => { if (progress && !scanId) setScanId(progress.scanId); }, [progress, scanId]);

  // Render the new rich MetroUI, passing scan state
  return (
    <MetroUI
      scanId={scanId}
      progress={progress ? { ...progress, approxCompletion: progress.approxCompletion === null ? undefined : progress.approxCompletion } : null}
      nodes={nodes}
      receivedNodes={receivedNodes}
      done={done}
      rootPath={rootPath}
    />
  );
}

export default App;
