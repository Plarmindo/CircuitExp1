// Renderer helper for CORE-2 recent scans feature.
// Provides thin wrappers around preload-exposed IPC functions.

export interface RecentScansListResult {
  success: boolean;
  recent: string[];
  max?: number;
  error?: string;
}

interface ElectronAPIRecent {
  recentList?: () => Promise<RecentScansListResult>;
  recentClear?: () => Promise<RecentScansListResult>;
  startScan?: (
    root: string,
    options?: Record<string, unknown>
  ) => Promise<{ success: boolean; scanId?: string; error?: string }>;
  selectAndScanFolder?: () => Promise<{
    success: boolean;
    scanId?: string;
    cancelled?: boolean;
    error?: string;
  }>;
  cancelScan?: (scanId: string) => Promise<{ success: boolean; error?: string }>;
  getScanState?: (
    scanId: string
  ) => Promise<{ success: boolean; state?: { scanId: string; rootPath: string }; error?: string }>;
  onScanProgress?: (cb: (p: { scanId: string }) => void) => () => void;
  onScanPartial?: (cb: (b: { scanId: string; nodes: unknown[] }) => void) => () => void;
  onScanDone?: (cb: (d: { scanId: string; cancelled: boolean }) => void) => () => void;
  onScanStarted?: (cb: (s: { scanId: string; rootPath: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPIRecent;
  }
}

export async function listRecent(): Promise<RecentScansListResult> {
  if (!window.electronAPI?.recentList)
    return { success: false, recent: [], error: 'recentList not available' };
  return window.electronAPI.recentList();
}

export async function clearRecent(): Promise<RecentScansListResult> {
  if (!window.electronAPI?.recentClear)
    return { success: false, recent: [], error: 'recentClear not available' };
  return window.electronAPI.recentClear();
}
