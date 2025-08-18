// Renderer helper for CORE-1 favorites feature
// Provides simple cached accessors for favorites list.
export interface FavoritesAPI {
  list(): Promise<string[]>;
  add(path: string): Promise<string[]>;
  remove(path: string): Promise<string[]>;
}

interface ElectronAPIExpose {
  favoritesList?: () => Promise<{ success: boolean; favorites: string[] }>;
  favoritesAdd?: (p: string) => Promise<{ success: boolean; favorites: string[]; error?: string }>;
  favoritesRemove?: (p: string) => Promise<{ success: boolean; favorites: string[]; error?: string }>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: ElectronAPIExpose = (window as any).electronAPI || {};

let cache: string[] | null = null;

export const favoritesClient: FavoritesAPI = {
  async list() {
    if (!api?.favoritesList) return [];
    const res = await api.favoritesList();
    if (res?.success) { cache = res.favorites; return [...cache]; }
    return [];
  },
  async add(p: string) {
    const res = await api.favoritesAdd(p);
    if (res?.success) { cache = res.favorites; return [...cache]; }
    throw new Error(res?.error || 'add failed');
  },
  async remove(p: string) {
    const res = await api.favoritesRemove(p);
    if (res?.success) { cache = res.favorites; return [...cache]; }
    throw new Error(res?.error || 'remove failed');
  }
};
