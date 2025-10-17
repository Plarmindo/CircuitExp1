/**
 * Common interface for all visualization modes
 * This ensures consistency across GoogleMapMode, SemanticZoomMode, SplitViewMode, and DrawerExplorerMode
 */

import type { LayoutNodeLite, RouteCommand, ThemeConfig } from '../stage/types';

/**
 * Standard props that all visualization modes should accept
 */
export interface CommonModeProps {
  /** Node layout data */
  layout?: LayoutNodeLite[];
  
  /** Route/edge commands for rendering lines */
  routes?: RouteCommand[];
  
  /** Callback when a node is clicked */
  onNodeClick?: (path: string) => void;
  
  /** Callback when a node is hovered (null when hover ends) */
  onNodeHover?: (path: string | null) => void;
  
  /** Callback when layout is updated/recalculated */
  onLayoutUpdate?: (layout: LayoutNodeLite[]) => void;
  
  /** Theme configuration for colors and styling */
  theme?: ThemeConfig;
  
  /** Enable debug mode with additional logging/overlays */
  debug?: boolean;
}

/**
 * Standard zoom handlers that all modes should implement
 */
export interface CommonZoomHandlers {
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetView: () => void;
  handleToggleWindowZoom: () => void;
}

/**
 * Standard window zoom setup that all modes should use
 */
export interface CommonWindowZoomState {
  isWindowZoomMode: boolean;
  setIsWindowZoomMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
}
