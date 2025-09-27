export interface UserSettings {
  version: number;
  theme: 'light' | 'dark';
  defaultScan: {
    maxEntries: number;
    aggregationThreshold: number;
  };
  pii: {
    enabled: boolean;
    redactionEnabled: boolean;
    confidenceThreshold: number;
    customPatterns: string[];
  };
  // Visualization preferences and feature flags
  visualization?: {
    // Persisted default visualization mode; string union to avoid cross-package import cycles
    defaultMode?: 'drawer' | 'zoom' | 'split';
    // Explicitly enabled modes; if omitted, all registered modes are considered enabled unless gated by env
    enabledModes?: Array<'drawer' | 'zoom' | 'split'>;
    // Arbitrary feature flags merged with env variables
    featureFlags?: Record<string, boolean>;
  };
}

interface ElectronAPISettings {
  settingsGet?: () => Promise<{ success: boolean; settings?: UserSettings; error?: string }>;
  settingsUpdate?: (
    patch: Partial<UserSettings>
  ) => Promise<{ success: boolean; settings?: UserSettings; error?: string }>;
  onSettingsLoaded?: (cb: (s: UserSettings) => void) => () => void;
  onSettingsUpdated?: (cb: (s: UserSettings) => void) => () => void;
}
const w = (typeof window !== 'undefined' ? window : {}) as unknown as { electronAPI?: ElectronAPISettings };

export async function getUserSettings(): Promise<{
  success: boolean;
  settings?: UserSettings;
  error?: string;
}> {
  if (!w.electronAPI?.settingsGet) return { success: false, error: 'settingsGet not exposed' };
  return w.electronAPI.settingsGet();
}

export async function updateUserSettings(
  patch: Partial<UserSettings>
): Promise<{ success: boolean; settings?: UserSettings; error?: string }> {
  if (!w.electronAPI?.settingsUpdate)
    return { success: false, error: 'settingsUpdate not exposed' };
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
