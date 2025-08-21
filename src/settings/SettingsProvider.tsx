import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UserSettings } from './user-settings-client';
import { getUserSettings, updateUserSettings, onUserSettingsLoaded, onUserSettingsUpdated } from './user-settings-client';

interface SettingsContextType {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();

    // Subscribe to settings updates
    const unsubscribeLoaded = onUserSettingsLoaded(setSettings);
    const unsubscribeUpdated = onUserSettingsUpdated(setSettings);

    return () => {
      unsubscribeLoaded();
      unsubscribeUpdated();
    };
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await getUserSettings();
      if (result.success && result.settings) {
        setSettings(result.settings);
        setError(null);
      } else {
        setError(result.error || 'Failed to load settings');
        // Set default settings if loading fails
        setSettings({
          version: 1,
          theme: 'light',
          defaultScan: {
            maxEntries: 1000,
            aggregationThreshold: 10,
          },
          pii: {
            enabled: true,
            redactionEnabled: true,
            confidenceThreshold: 0.8,
            customPatterns: [],
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (patch: Partial<UserSettings>) => {
    try {
      const result = await updateUserSettings(patch);
      if (result.success && result.settings) {
        setSettings(result.settings);
        setError(null);
      } else {
        setError(result.error || 'Failed to update settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, error, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};