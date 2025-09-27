// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ModeProvider } from '../../../src/visualization/modes/ModeProvider';
import { ModeRegistry, VisualizationMode } from '../../../src/visualization/modes/mode-registry';
import { SettingsProvider } from '../../../src/settings/SettingsProvider';

// ModeProvider exposes context via useMode(); for these tests we verify the available/selected logic indirectly
// by mounting a child component that reads the context
import { useMode } from '../../../src/visualization/modes/ModeProvider';

function Probe() {
  const { selected, available, definitions, setMode } = useMode();
  return (
    <div>
      <div data-testid="selected">{selected}</div>
      <div data-testid="available">{available.join(',')}</div>
      <button onClick={() => setMode(VisualizationMode.Drawer)}>set-drawer</button>
    </div>
  );
}

// Mock metricsService and auditLogger to avoid side-effects
vi.mock('../../../src/services/metrics-service', () => ({
  metricsService: { recordUsage: vi.fn() },
}));
vi.mock('../../../src/services/audit-logger', () => ({
  auditLogger: { logSystemEvent: vi.fn() },
}));

// Mock user-settings-client to provide stable defaults for SettingsProvider without importing the real module (which touches window)
vi.mock('../../../src/settings/user-settings-client', () => {
  return {
    getUserSettings: vi.fn(async () => ({ success: true, settings: {
      version: 1,
      theme: 'light',
      defaultScan: { maxEntries: 1000, aggregationThreshold: 10 },
      pii: { enabled: true, redactionEnabled: true, confidenceThreshold: 0.8, customPatterns: [] },
      visualization: { enabledModes: [VisualizationMode.Drawer, VisualizationMode.SplitView, VisualizationMode.SemanticZoom], defaultMode: VisualizationMode.SplitView },
    } })),
    updateUserSettings: vi.fn(async (patch) => ({ success: true, settings: {
      version: 1,
      theme: 'light',
      defaultScan: { maxEntries: 1000, aggregationThreshold: 10 },
      pii: { enabled: true, redactionEnabled: true, confidenceThreshold: 0.8, customPatterns: [] },
      visualization: { enabledModes: [VisualizationMode.Drawer, VisualizationMode.SplitView, VisualizationMode.SemanticZoom], defaultMode: (patch as any)?.visualization?.defaultMode ?? VisualizationMode.SplitView },
    } })),
    onUserSettingsLoaded: (cb: any) => () => {},
    onUserSettingsUpdated: (cb: any) => () => {},
  };
});

const originalEnv = (import.meta as any).env ? { ...(import.meta as any).env } : undefined;
const originalProc = {
  VITE_VIZ_ENABLED_MODES: process.env.VITE_VIZ_ENABLED_MODES,
  VIZ_ENABLED_MODES: process.env.VIZ_ENABLED_MODES,
  VITE_VIZ_DEFAULT_MODE: process.env.VITE_VIZ_DEFAULT_MODE,
  VITE_DEFAULT_MODE: process.env.VITE_DEFAULT_MODE,
  VIZ_DEFAULT_MODE: process.env.VIZ_DEFAULT_MODE,
  DEFAULT_MODE: process.env.DEFAULT_MODE,
};

function clearDefaultModeEnv() {
  delete (import.meta as any).env?.VITE_VIZ_DEFAULT_MODE;
  delete (import.meta as any).env?.VITE_DEFAULT_MODE;
  delete (import.meta as any).env?.VIZ_DEFAULT_MODE;
  delete (import.meta as any).env?.DEFAULT_MODE;
  delete process.env.VITE_VIZ_DEFAULT_MODE;
  delete process.env.VITE_DEFAULT_MODE;
  delete process.env.VIZ_DEFAULT_MODE;
  delete process.env.DEFAULT_MODE;
}

function restoreDefaultModeEnv() {
  const em: any = (import.meta as any).env ?? {};
  if (originalEnv?.VITE_VIZ_DEFAULT_MODE !== undefined) em.VITE_VIZ_DEFAULT_MODE = originalEnv.VITE_VIZ_DEFAULT_MODE; else delete em.VITE_VIZ_DEFAULT_MODE;
  if (originalEnv?.VITE_DEFAULT_MODE !== undefined) em.VITE_DEFAULT_MODE = originalEnv.VITE_DEFAULT_MODE; else delete em.VITE_DEFAULT_MODE;
  if (originalEnv?.VIZ_DEFAULT_MODE !== undefined) em.VIZ_DEFAULT_MODE = originalEnv.VIZ_DEFAULT_MODE; else delete em.VIZ_DEFAULT_MODE;
  if (originalEnv?.DEFAULT_MODE !== undefined) em.DEFAULT_MODE = originalEnv.DEFAULT_MODE; else delete em.DEFAULT_MODE;
  (import.meta as any).env = em;
  if (originalProc.VITE_VIZ_DEFAULT_MODE !== undefined) process.env.VITE_VIZ_DEFAULT_MODE = originalProc.VITE_VIZ_DEFAULT_MODE; else delete process.env.VITE_VIZ_DEFAULT_MODE;
  if (originalProc.VITE_DEFAULT_MODE !== undefined) process.env.VITE_DEFAULT_MODE = originalProc.VITE_DEFAULT_MODE; else delete process.env.VITE_DEFAULT_MODE;
  if (originalProc.VIZ_DEFAULT_MODE !== undefined) process.env.VIZ_DEFAULT_MODE = originalProc.VIZ_DEFAULT_MODE; else delete process.env.VIZ_DEFAULT_MODE;
  if (originalProc.DEFAULT_MODE !== undefined) process.env.DEFAULT_MODE = originalProc.DEFAULT_MODE; else delete process.env.DEFAULT_MODE;
}

function mountWithProviders() {
  return render(
    <SettingsProvider>
      <ModeProvider>
        <Probe />
      </ModeProvider>
    </SettingsProvider>
  );
}

describe('ModeProvider gating and selection', () => {
  beforeEach(() => {
    (import.meta as any).env = {};
    delete process.env.VITE_VIZ_ENABLED_MODES;
    delete process.env.VIZ_ENABLED_MODES;
    clearDefaultModeEnv();
    // Reset URL so prior tests' selection doesn't leak via ?mode= query
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
    ModeRegistry.ensureDefaults();
  });
  afterEach(() => {
    if (originalEnv) (import.meta as any).env = { ...originalEnv };
    else (import.meta as any).env = {};
    // restore process env
    if (originalProc.VITE_VIZ_ENABLED_MODES !== undefined) process.env.VITE_VIZ_ENABLED_MODES = originalProc.VITE_VIZ_ENABLED_MODES;
    else delete process.env.VITE_VIZ_ENABLED_MODES;
    if (originalProc.VIZ_ENABLED_MODES !== undefined) process.env.VIZ_ENABLED_MODES = originalProc.VIZ_ENABLED_MODES;
    else delete process.env.VIZ_ENABLED_MODES;
    restoreDefaultModeEnv();
    vi.clearAllMocks();
    cleanup();
  });

  it('uses env gating VITE_VIZ_ENABLED_MODES to restrict available modes', async () => {
    (import.meta as any).env = { VITE_VIZ_ENABLED_MODES: 'drawer,split' };
    process.env.VITE_VIZ_ENABLED_MODES = 'drawer,split';
    mountWithProviders();

    const available = screen.getByTestId('available');
    expect(available.textContent).toBe([VisualizationMode.Drawer, VisualizationMode.SplitView].join(','));
    const selected = screen.getByTestId('selected');
    // defaultMode from settings is split, which is allowed
    expect(selected.textContent).toBe(VisualizationMode.SplitView);
  });

  it('falls back to first available if settings default is not allowed by env', async () => {
    (import.meta as any).env = { VITE_VIZ_ENABLED_MODES: 'drawer,zoom' };
    process.env.VITE_VIZ_ENABLED_MODES = 'drawer,zoom';
    mountWithProviders();

    const available = screen.getByTestId('available');
    expect(available.textContent).toBe([VisualizationMode.Drawer, VisualizationMode.SemanticZoom].join(','));
    const selected = screen.getByTestId('selected');
    // settings default split is not in allowed list; fallback should be first available (drawer)
    expect(selected.textContent).toBe(VisualizationMode.Drawer);
  });

  it('setMode updates selection and persists via settings update', async () => {
    (import.meta as any).env = { VITE_VIZ_ENABLED_MODES: 'drawer,split,zoom' };
    process.env.VITE_VIZ_ENABLED_MODES = 'drawer,split,zoom';
    mountWithProviders();

    const selectedBefore = screen.getByTestId('selected');
    expect(selectedBefore.textContent).toBe(VisualizationMode.SplitView);

    const btn = screen.getByText('set-drawer');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByTestId('selected').textContent).toBe(VisualizationMode.Drawer);
    });

    const { metricsService } = await import('../../../src/services/metrics-service');
    const { auditLogger } = await import('../../../src/services/audit-logger');
    expect(metricsService.recordUsage).toHaveBeenCalled();
    expect(auditLogger.logSystemEvent).toHaveBeenCalled();
  });
});