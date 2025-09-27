import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ModeRegistry, VisualizationMode, getDefaultVisualizationMode } from './mode-registry';
import type { ModeDefinition } from './mode-registry';
import { useSettings } from '../../settings/SettingsProvider';
import { metricsService } from '../../services/metrics-service';
import { auditLogger } from '../../services/audit-logger';

interface ModeContextType {
  selected: VisualizationMode;
  setMode: (mode: VisualizationMode) => void;
  available: VisualizationMode[];
  definitions: ModeDefinition[];
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, updateSettings } = useSettings();

  // Ensure defaults are registered
  ModeRegistry.ensureDefaults();

  const allDefs = useMemo<ModeDefinition[]>(() => ModeRegistry.list(), []);

  // Env feature gating: comma-separated enabled modes e.g., 'split,drawer'
  const envEnabledList = useMemo(() => {
    try {
      const viteEnv = (import.meta as any)?.env;
      const nodeEnv = typeof process !== 'undefined' ? (process as any).env : undefined;
      const raw = (viteEnv?.VITE_VIZ_ENABLED_MODES ?? viteEnv?.VIZ_ENABLED_MODES) ?? (nodeEnv?.VITE_VIZ_ENABLED_MODES ?? nodeEnv?.VIZ_ENABLED_MODES);
      if (!raw) return null;
      return String(raw)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) as Array<VisualizationMode | string>;
    } catch {
      return null;
    }
  }, []);

  // Gate modes by env and user settings if provided
  const available = useMemo<VisualizationMode[]>(() => {
    let ids = allDefs.map((d) => d.id);

    // Apply env gating first if present
    if (envEnabledList && envEnabledList.length > 0) {
      const allowed = new Set(envEnabledList as string[]);
      ids = ids.filter((id) => allowed.has(id));
    }

    // Then apply user settings gating if provided
    const enabled = settings?.visualization?.enabledModes;
    if (enabled && enabled.length > 0) {
      const set = new Set(enabled);
      ids = ids.filter((id) => set.has(id));
    }

    return ids;
  }, [settings?.visualization?.enabledModes, allDefs, envEnabledList]);

  const validMode = useCallback(
    (m: string | null | undefined): m is VisualizationMode =>
      !!m && (available as string[]).includes(m),
    [available]
  );

  const initialMode = useMemo<VisualizationMode>(() => {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get('mode');
      if (validMode(q)) return q;
    } catch (error) {
      // Ignore URL parsing errors
      console.warn('Failed to parse URL mode parameter:', error);
    }
    const fromSettings = settings?.visualization?.defaultMode;
    if (validMode(fromSettings)) return fromSettings as VisualizationMode;
    return getDefaultVisualizationMode();
  }, [settings?.visualization?.defaultMode, validMode]);

  const [selected, setSelected] = useState<VisualizationMode>(initialMode);
  const prevRef = useRef<VisualizationMode>(initialMode);

  // Keep selected in sync if availability changes and current is not allowed
  useEffect(() => {
    if (!available.includes(selected)) {
      const defaultMode = getDefaultVisualizationMode();
      const fallback = available.includes(defaultMode) ? defaultMode : available[0];
      if (fallback) setSelected(fallback);
    }
  }, [available, selected]);

  // Preload available modes for quick switch
  useEffect(() => {
    ModeRegistry.preload(available).catch(() => {});
  }, [available]);

  // Reflect selection to URL without navigation
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', selected);
      window.history.replaceState({}, '', url.toString());
    } catch (error) {
      // Ignore URL update errors
      console.warn('Failed to update URL with mode parameter:', error);
    }
  }, [selected]);

  const setMode = useCallback(
    (mode: VisualizationMode) => {
      if (mode === selected) return;
      const from = prevRef.current;
      setSelected(mode);
      prevRef.current = mode;

      // Telemetry and audit
      metricsService.recordUsage('visualization_mode_switch', { from, to: mode });
      auditLogger.logSystemEvent('visualization', 'mode_switch', { from, to: mode });

      // Persist user preference
      const currentViz = settings?.visualization ?? {};
      updateSettings({ visualization: { ...currentViz, defaultMode: mode } as any }).catch(() => {});
    },
    [selected, settings?.visualization, updateSettings]
  );

  const value = useMemo<ModeContextType>(
    () => ({ selected, setMode, available, definitions: allDefs.filter((d) => available.includes(d.id)) }),
    [selected, setMode, available, allDefs]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};

export function useMode(): ModeContextType {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within a ModeProvider');
  return ctx;
}
