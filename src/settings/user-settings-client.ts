export interface UserSettings {
  version: number;
  theme: 'light' | 'dark';
  defaultScan: {
    maxEntries: number;
    aggregationThreshold: number;
  };
}

interface ElectronAPISettings {
  settingsGet?: () => Promise<{ success: boolean; settings?: UserSettings; error?: string }>;
  settingsUpdate?: (patch: Partial<UserSettings>) => Promise<{ success: boolean; settings?: UserSettings; error?: string }>;
  onSettingsLoaded?: (cb: (s: UserSettings) => void) => () => void;
  onSettingsUpdated?: (cb: (s: UserSettings) => void) => () => void;
}
const w = window as unknown as { electronAPI?: ElectronAPISettings };

export async function getUserSettings(): Promise<{ success: boolean; settings?: UserSettings; error?: string }> {
  if (!w.electronAPI?.settingsGet) return { success: false, error: 'settingsGet not exposed' };
  return w.electronAPI.settingsGet();
}

export async function updateUserSettings(patch: Partial<UserSettings>): Promise<{ success: boolean; settings?: UserSettings; error?: string }> {
  if (!w.electronAPI?.settingsUpdate) return { success: false, error: 'settingsUpdate not exposed' };
  return w.electronAPI.settingsUpdate(patch);
}

export function onUserSettingsLoaded(cb: (settings: UserSettings) => void) {
  if (!w.electronAPI?.onSettingsLoaded) return () => {};
  return w.electronAPI.onSettingsLoaded(cb);
}

export function onUserSettingsUpdated(cb: (settings: UserSettings) => void) {
  if (!w.electronAPI?.onSettingsUpdated) return () => {};
  return w.electronAPI.onSettingsUpdated(cb);
}
