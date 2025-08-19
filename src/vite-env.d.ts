/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      onFolderData: (callback: (event: any, data: any) => void) => void;
      selectAndScanFolder: () => Promise<any>;
      openPath: (path: string) => Promise<boolean>;
      renamePath: (oldPath: string, newName: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
      deletePath: (path: string) => Promise<{ success: boolean; error?: string }>;
      toggleFavorite: (path: string, setFav: boolean) => Promise<{ success: boolean }>;
      showProperties: (path: string) => Promise<boolean>;
  startScan?: (root: string, options?: Record<string, unknown>) => Promise<{ success: boolean; scanId?: string; error?: string }>;
  cancelScan?: (scanId: string) => Promise<{ success: boolean; error?: string }>;
  getScanState?: (scanId: string) => Promise<{ success: boolean; state?: any; error?: string }>;
  onScanProgress?: (cb: (p: any) => void) => () => void;
  onScanPartial?: (cb: (b: any) => void) => () => void;
  onScanDone?: (cb: (d: any) => void) => () => void;
  onScanStarted?: (cb: (s: { scanId: string; rootPath: string }) => void) => () => void;
    };
  }
}
