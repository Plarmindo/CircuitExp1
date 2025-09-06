/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      // Existing
      onFolderData: (callback: (event: Electron.IpcRendererEvent, data: unknown) => void) => void;
      // File operations
      openPath: (path: string) => Promise<boolean>;
      renamePath: (
        oldPath: string,
        newName: string
      ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
      deletePath: (path: string) => Promise<{ success: boolean; error?: string }>;
      toggleFavorite: (path: string, setFav: boolean) => Promise<{ success: boolean }>;
      showProperties: (path: string) => Promise<boolean>;

      // Favorites
      favoritesList?: () => Promise<string[]>;
      favoritesAdd?: (path: string) => Promise<{ success: boolean }>;
      favoritesRemove?: (path: string) => Promise<{ success: boolean }>;

      // Recent scans
      recentList?: () => Promise<string[]>;
      recentClear?: () => Promise<{ success: boolean }>;

      // Settings
      settingsGet?: () => Promise<Record<string, unknown>>;
      settingsUpdate?: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>;

      // Scan controls
      startScan?: (
        root: string,
        options?: Record<string, unknown>
      ) => Promise<{ success: boolean; scanId?: string; error?: string }>;
      selectAndScanFolder?: () => Promise<unknown>;
      cancelScan?: (scanId: string) => Promise<{ success: boolean; error?: string }>;
      getScanState?: (
        scanId: string
      ) => Promise<{ success: boolean; state?: unknown; error?: string }>;

      // Scan events (callbacks)
      onScanProgress?: (cb: (p: unknown) => void) => () => void;
      onScanPartial?: (cb: (b: unknown) => void) => () => void;
      onScanDone?: (cb: (d: unknown) => void) => () => void;
      onScanStarted?: (cb: (s: { scanId: string; rootPath: string }) => void) => () => void;

      // Window state helpers
      windowGetBounds?: () => Promise<{ x: number; y: number; width: number; height: number }>;
      windowMaximize?: () => Promise<void>;
      windowUnmaximize?: () => Promise<void>;
      windowIsMaximized?: () => Promise<boolean>;

      // Logging helpers
      logsRecent?: (limit?: number) => Promise<unknown>;
      rendererLog?: (
        level: 'debug' | 'info' | 'warn' | 'error',
        msg: string,
        detail?: unknown,
        component?: string
      ) => void;
    };
  }
}
