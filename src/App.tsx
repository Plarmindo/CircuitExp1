import { useState, useEffect } from 'react';
import './App.css';
import { MetroStage } from './visualization/metro-stage';
import { MetroStageSample } from './visualization/metro-stage-sample';
import { MetroUI } from './components/MetroUI';

declare global {
  interface Window { electronAPI: ElectronBridge; }
}

type ElectronBridge = {
  startScan: (root: string, options?: Record<string, unknown>) => Promise<{ success: boolean; scanId?: string; error?: string }>;
  selectAndScanFolder?: () => Promise<{ success: boolean; scanId?: string; cancelled?: boolean; error?: string }>;
  cancelScan: (scanId: string) => Promise<{ success: boolean; error?: string }>;
  getScanState: (scanId: string) => Promise<{ success: boolean; state?: { scanId: string; rootPath: string; options: Record<string, unknown>; startedAt: number; dirsProcessed: number; filesProcessed: number; errors: number; cancelled: boolean; done: boolean; truncated: boolean; queueLength: number }; error?: string }>;
  onScanProgress: (cb: (p: ScanProgressPayload) => void) => () => void;
  onScanPartial: (cb: (b: ScanPartialPayload) => void) => () => void;
  onScanDone: (cb: (d: ScanDonePayload) => void) => () => void;
};

interface BaseNode { path: string; name: string; depth: number; kind: 'file' | 'dir'; error?: string; size?: number; mtimeMs?: number; }
interface ScanProgressPayload { scanId: string; dirsProcessed: number; filesProcessed: number; queueLengthRemaining: number; elapsedMs: number; approxCompletion: number | null; }
interface ScanPartialPayload { scanId: string; nodes: BaseNode[]; truncated?: boolean; }
interface ScanDonePayload { scanId: string; status: string; cancelled: boolean; }

const colors: { [key: string]: string } = {
  folder: '#29b6f6',
  file: '#ffd54f',
  future: '#888',
  bookmark: '#ffd54f',
  fav: '#e53935',
};

function App() {
  const [scanId, setScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgressPayload | null>(null);
  const [receivedNodes, setReceivedNodes] = useState<number>(0);
  const [done, setDone] = useState<ScanDonePayload | null>(null);
  const [nodes, setNodes] = useState<BaseNode[]>([]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const offProgress = window.electronAPI.onScanProgress((p) => setProgress(p));
    const offPartial = window.electronAPI.onScanPartial((b) => {
      setReceivedNodes(prev => prev + b.nodes.length);
      // Previously limited to first 50 nodes for early prototype; now append all to enable full visualization & lines.
      setNodes(prev => prev.concat(b.nodes));
    });
    const offDone = window.electronAPI.onScanDone((d) => setDone(d));
    return () => {
      offProgress();
      offPartial();
      offDone();
    };
  }, []);

  useEffect(() => { if (progress && !scanId) setScanId(progress.scanId); }, [progress, scanId]);

  // Render the new rich MetroUI, passing scan state
  return (
    <MetroUI
      scanId={scanId}
      progress={progress}
      nodes={nodes}
      receivedNodes={receivedNodes}
      done={done}
    />
  );
}

export default App;
