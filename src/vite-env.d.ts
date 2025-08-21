/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      onFolderData: (callback: (event: Electron.IpcRendererEvent, data: unknown) => void) => void;
      selectAndScanFolder: () => Promise<unknown>;
      openPath: (path: string) => Promise<boolean>;
      renamePath: (
        oldPath: string,
        newName: string
      ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
      deletePath: (path: string) => Promise<{ success: boolean; error?: string }>;
      toggleFavorite: (path: string, setFav: boolean) => Promise<{ success: boolean }>;
      showProperties: (path: string) => Promise<boolean>;
      startScan?: (
        root: string,
        options?: Record<string, unknown>
      ) => Promise<{ success: boolean; scanId?: string; error?: string }>;
      cancelScan?: (scanId: string) => Promise<{ success: boolean; error?: string }>;
      getScanState?: (scanId: string) => Promise<{ success: boolean; state?: unknown; error?: string }>;
      onScanProgress?: (cb: (p: unknown) => void) => () => void;
      onScanPartial?: (cb: (b: unknown) => void) => () => void;
      onScanDone?: (cb: (d: unknown) => void) => () => void;
      onScanStarted?: (cb: (s: { scanId: string; rootPath: string }) => void) => () => void;
    };
  }
}
