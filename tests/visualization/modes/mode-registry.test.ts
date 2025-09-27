import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveDefaultModeFromEnv, getDefaultVisualizationMode, VisualizationMode } from '../../../src/visualization/modes/mode-registry';

const originalEnvObj = typeof process !== 'undefined' ? { ...process.env } : {} as any;

describe('mode-registry: resolveDefaultModeFromEnv', () => {
  it('maps variants to expected VisualizationMode or null', () => {
    expect(resolveDefaultModeFromEnv({ VITE_VIZ_DEFAULT_MODE: 'drawer' })).toBe(VisualizationMode.Drawer);
    expect(resolveDefaultModeFromEnv({ VITE_VIZ_DEFAULT_MODE: 'zoom' })).toBe(VisualizationMode.SemanticZoom);
    expect(resolveDefaultModeFromEnv({ VITE_VIZ_DEFAULT_MODE: 'semantic-zoom' })).toBe(VisualizationMode.SemanticZoom);
    expect(resolveDefaultModeFromEnv({ VITE_VIZ_DEFAULT_MODE: 'split' })).toBe(VisualizationMode.SplitView);
    expect(resolveDefaultModeFromEnv({ VITE_VIZ_DEFAULT_MODE: 'split-view' })).toBe(VisualizationMode.SplitView);
    expect(resolveDefaultModeFromEnv({ VITE_VIZ_DEFAULT_MODE: 'splitview' })).toBe(VisualizationMode.SplitView);
    expect(resolveDefaultModeFromEnv({ VIZ_DEFAULT_MODE: 'drawer' })).toBe(VisualizationMode.Drawer);
    expect(resolveDefaultModeFromEnv({ DEFAULT_MODE: 'zoom' })).toBe(VisualizationMode.SemanticZoom);
    expect(resolveDefaultModeFromEnv({})).toBeNull();
    expect(resolveDefaultModeFromEnv(undefined)).toBeNull();
    expect(resolveDefaultModeFromEnv({ VITE_VIZ_DEFAULT_MODE: 'unknown' })).toBeNull();
  });
});

describe('mode-registry: getDefaultVisualizationMode', () => {
  beforeEach(() => {
    // Reset environment before each test
    if (typeof process !== 'undefined') {
      process.env = { ...originalEnvObj } as any;
    }
  });
  afterEach(() => {
    if (typeof process !== 'undefined') {
      process.env = { ...originalEnvObj } as any;
    }
  });

  it('returns env default when provided and valid', () => {
    if (typeof process !== 'undefined') process.env.VITE_VIZ_DEFAULT_MODE = 'drawer';
    expect(getDefaultVisualizationMode()).toBe(VisualizationMode.Drawer);

    if (typeof process !== 'undefined') process.env.VITE_VIZ_DEFAULT_MODE = 'zoom';
    expect(getDefaultVisualizationMode()).toBe(VisualizationMode.SemanticZoom);
  });

  it('falls back to SplitView when no valid env default present', () => {
    if (typeof process !== 'undefined') process.env.VITE_VIZ_DEFAULT_MODE = 'invalid-mode';
    expect(getDefaultVisualizationMode()).toBe(VisualizationMode.SplitView);

    if (typeof process !== 'undefined') delete process.env.VITE_VIZ_DEFAULT_MODE;
    expect(getDefaultVisualizationMode()).toBe(VisualizationMode.SplitView);
  });
});