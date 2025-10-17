import { ComponentType } from 'react';
import type { LayoutNodeLite, RouteCommand } from '../stage/types';

// Visualization mode identifiers
export enum VisualizationMode {
  Drawer = 'drawer',
  SemanticZoom = 'zoom',
  SplitView = 'split',
  GoogleMap = 'map',
}

// Optional capability flags to describe each mode's UI affordances
export type ModeCapability =
  | 'drawer'
  | 'semantic-zoom'
  | 'split-view'
  | 'favorites'
  | 'recents'
  | 'minimap'
  | 'overlays';

export interface ModeComponentProps {
  layout?: LayoutNodeLite[];
  routes?: RouteCommand[];
  onNodeClick?: (path: string) => void;
  onNodeHover?: (path: string | null) => void;
  onLayoutUpdate?: (layout: LayoutNodeLite[]) => void;
  theme?: Record<string, unknown>;
  debug?: boolean;
  /**
   * Allow modes to accept additional configuration without forcing every consumer
   * to re-declare props. This keeps backward compatibility for existing modes
   * while enabling richer map controls.
   */
  [extra: string]: unknown;
}

export interface ModeDefinition {
  id: VisualizationMode;
  label: string;
  description?: string;
  capabilities: ModeCapability[];
  // Lazy loader for the mode shell component that composes the shared map engine
  // The component must accept ModeComponentProps and render UI around the engine
  load: () => Promise<{ default: ComponentType<ModeComponentProps> }>;
}

class ModeRegistryImpl {
  private registry = new Map<VisualizationMode, ModeDefinition>();
  private initialized = false;

  register(def: ModeDefinition): void {
    if (this.registry.has(def.id)) {
      // Silently ignore duplicate identical registrations; replace if label/capabilities differ
      const existing = this.registry.get(def.id)!;
      const same =
        existing.label === def.label &&
        existing.description === def.description &&
        JSON.stringify(existing.capabilities) === JSON.stringify(def.capabilities);
      if (same) return;
    }
    this.registry.set(def.id, def);
  }

  get(id: VisualizationMode): ModeDefinition | undefined {
    return this.registry.get(id);
  }

  list(): ModeDefinition[] {
    return Array.from(this.registry.values());
  }

  async load(id: VisualizationMode): Promise<ComponentType<ModeComponentProps>> {
    const def = this.registry.get(id);
    if (!def) {
      throw new Error(`Visualization mode not registered: ${id}`);
    }
    const mod = await def.load();
    return mod.default;
  }

  // Preload likely mode shells (e.g., for hover tooltips or fast switching)
  // Safe to call multiple times; dynamic import caching will handle duplicates
  async preload(ids: VisualizationMode[]): Promise<void> {
    await Promise.allSettled(ids.map((id) => this.registry.get(id)?.load()));
  }

  ensureDefaults(): void {
    if (this.initialized) return;

    // Register Drawer Explorer
    this.register({
      id: VisualizationMode.Drawer,
      label: 'Drawer Explorer',
      description: 'Right-side drawer bound to selection; minimal layout shift.',
      capabilities: ['drawer', 'favorites', 'recents', 'minimap'],
      load: () => import('./DrawerExplorerMode'),
    });

    // Register Semantic Zoom + Drill-in
    this.register({
      id: VisualizationMode.SemanticZoom,
      label: 'Semantic Zoom',
      description: 'Thresholded layers with progressive disclosure and overlays.',
      capabilities: ['semantic-zoom', 'overlays', 'favorites', 'recents', 'minimap'],
      load: () => import('./SemanticZoomMode'),
    });

    // Register Split View
    this.register({
      id: VisualizationMode.SplitView,
      label: 'Split View',
      description: 'Persistent file browser beside the map; synchronized selection.',
      capabilities: ['split-view', 'favorites', 'recents', 'minimap'],
      load: () => import('./SplitViewMode'),
    });

    // Register Google Map Style
    this.register({
      id: VisualizationMode.GoogleMap,
      label: 'Google Map',
      description: 'Google Maps-style zoom with constant 4mm nodes and 2mm text. LOD based on zoom level.',
      capabilities: ['semantic-zoom', 'minimap'],
      load: () => import('./GoogleMapMode'),
    });

    this.initialized = true;
  }
}

export const ModeRegistry = new ModeRegistryImpl();

// Initialize default modes on first import to make the registry ready for consumers
ModeRegistry.ensureDefaults();

// Resolve default mode from a provided env bag; exported for unit testing
export function resolveDefaultModeFromEnv(env: Record<string, unknown> | undefined | null): VisualizationMode | null {
  try {
    const raw = (env?.VITE_VIZ_DEFAULT_MODE ?? env?.VITE_DEFAULT_MODE ?? env?.VIZ_DEFAULT_MODE ?? env?.DEFAULT_MODE ?? '').toString().trim().toLowerCase();
    switch (raw) {
      case VisualizationMode.Drawer:
        return VisualizationMode.Drawer;
      case VisualizationMode.SemanticZoom:
      case 'semantic-zoom':
        return VisualizationMode.SemanticZoom;
      case VisualizationMode.SplitView:
      case 'split-view':
      case 'splitview':
        return VisualizationMode.SplitView;
      case VisualizationMode.GoogleMap:
      case 'google-map':
      case 'googlemap':
      case 'map':
        return VisualizationMode.GoogleMap;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Helper: choose a conservative default mode (Split View recommended for discoverability)
export function getDefaultVisualizationMode(): VisualizationMode {
  const envBag =
    (import.meta as unknown as { env?: Record<string, unknown> })?.env ??
    (typeof process !== 'undefined'
      ? (process as unknown as { env?: Record<string, unknown> }).env
      : undefined);
  const envDefault = resolveDefaultModeFromEnv(envBag ?? undefined);
  if (envDefault) return envDefault;
  return VisualizationMode.SplitView;
}
