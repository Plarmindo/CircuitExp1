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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPIRecent;
  }
}

export async function listRecent(): Promise<RecentScansListResult> {
  if (!window.electronAPI?.recentList) return { success: false, recent: [], error: 'recentList not available' };
  return window.electronAPI.recentList();
}

export async function clearRecent(): Promise<RecentScansListResult> {
  if (!window.electronAPI?.recentClear) return { success: false, recent: [], error: 'recentClear not available' };
  return window.electronAPI.recentClear();
}
