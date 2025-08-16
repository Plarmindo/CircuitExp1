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
    };
  }
}
