// Unified Navigation API for renderer: wraps favorites, recent scans, and scanning actions/events
// Centralizes Electron bridge access with safe fallbacks for plain web preview

import { favoritesClient } from '../favorites/favorites-client';
import { listRecent as _listRecent, clearRecent as _clearRecent } from '../recent-scans-client';

// Electron bridge typing
interface ElectronScanAPI {
  selectAndScanFolder?: () => Promise<unknown>;
  startScan?: (root: string) => Promise<unknown>;
  cancelScan?: (id: string) => Promise<unknown>;
  onScanError?: (cb: (e: Error) => void) => () => void;
}

function electronAPI(): ElectronScanAPI {
  return (typeof window !== 'undefined' ? ((window as unknown as { electronAPI?: ElectronScanAPI }).electronAPI ?? {}) : {}) as ElectronScanAPI;
}

// Favorites wrappers
export async function listFavorites(): Promise<string[]> {
  try {
    return await favoritesClient.list();
  } catch {
    return [];
  }
}

export async function addFavorite(path: string): Promise<string[]> {
  return favoritesClient.add(path);
}

export async function removeFavorite(path: string): Promise<string[]> {
  return favoritesClient.remove(path);
}

// Recent scans wrappers
export const listRecent = _listRecent;
export const clearRecent = _clearRecent;

// Scanning actions
export async function selectAndScanFolder(): Promise<unknown> {
  const api = electronAPI();
  if (!api.selectAndScanFolder) {
    console.warn('selectAndScanFolder not available in this environment.');
    return Promise.resolve();
  }
  return api.selectAndScanFolder();
}

export async function startScan(root: string): Promise<unknown> {
  const api = electronAPI();
  if (!api.startScan) {
    console.warn('startScan not available in this environment.');
    return Promise.resolve();
  }
  return api.startScan(root);
}

export async function cancelScan(id: string): Promise<unknown> {
  const api = electronAPI();
  if (!api.cancelScan) {
    console.warn('cancelScan not available in this environment.');
    return Promise.resolve();
  }
  return api.cancelScan(id);
}

// Events
export function onScanError(cb: (e: Error) => void): () => void {
  const api = electronAPI();
  if (api.onScanError) return api.onScanError(cb);
  return () => {};
}

export const UnifiedNavigation = {
  favorites: { list: listFavorites, add: addFavorite, remove: removeFavorite },
  recent: { list: listRecent, clear: clearRecent },
  scan: { selectAndScanFolder, start: startScan, cancel: cancelScan },
  events: { onScanError },
};
