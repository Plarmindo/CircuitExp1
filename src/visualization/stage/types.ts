// Stage modularization: shared types & interfaces extracted from monolithic metro-stage.tsx
import type { LayoutPointV2 } from '../layout-v2';
import type { Application } from 'pixi.js';
import * as PIXI from 'pixi.js';

export interface FastAppendResult {
  usedFastPath: boolean;
  reason: string;
  appended?: number;
}

export interface MetroDebugApi {
  getScale: () => number;
  getNodes: () => { path: string; x: number; y: number; aggregated?: boolean }[];
  pickFirstNonAggregated: () => { path: string; clientX: number; clientY: number } | null;
  getPan?: () => { x: number; y: number };
  getReusePct?: () => number;
  getBenchResult?: () => {
    baselineAvg: number;
    culledAvg: number;
    improvementPct: number;
    reusePct: number;
  } | null;
  getLayoutCallCount?: () => number;
  getFastPathUses?: () => number;
  getLastFastPathAttempt?: () => { stage: string; ctx?: Record<string, unknown> } | null;
  appendNodesTest?: (
    nodes: Array<{ path: string; name: string; kind: 'file' | 'dir'; depth: number }>
  ) => {
    usedFastPath: boolean;
    lastAttempt: { stage: string; ctx?: Record<string, unknown> } | null;
  };
  fastAppend?: (parentPath: string, count: number) => FastAppendResult;
  exportDataUrl?: (transparent?: boolean) => {
    dataUrl: string;
    width: number;
    height: number;
    size: number;
    transparent: boolean;
  } | null;
}

export interface RouteCommand {
  type: string;
  [k: string]: unknown;
}

export type LayoutNodeLite = Pick<LayoutPointV2, 'path' | 'x' | 'y' | 'depth'> & {
  aggregated?: boolean;
  aggregatedChildrenPaths?: string[];
  aggregatedExpanded?: boolean;
};

export interface InteractionState {
  scale: number;
  panX: number;
  panY: number;
  isDragging: boolean;
  lastPointer: { x: number; y: number } | null;
}

export interface RenderOptions {
  skipLayout?: boolean;
  forceRedraw?: boolean;
}

export interface ExportOptions {
  transparent?: boolean;
  filename?: string;
}

export interface ThemeConfig {
  background: number;
  directory: number;
  file: number;
  aggregated: number;
  selected: number;
  line: number;
  lineAgg: number;
  text: number;
}

export interface StationRadius {
  directory: number;
  file: number;
  aggregated: number;
}

export interface StyleTokens {
  palette: ThemeConfig;
  stationRadius: StationRadius;
  lineThickness: number;
  fontSize: {
    badge: number;
    label: number;
  };
}

export interface LayoutResult {
  nodes: LayoutPointV2[];
  index: Map<string, LayoutPointV2>;
  durationMs: number;
  bbox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  pendingConsumed?: boolean;
  usedFastPath?: boolean;
}

export interface AggregationToggleResult {
  expandedAfter: boolean;
  newSelection: string | null;
}

export interface NodeInfo {
  path: string;
  x: number;
  y: number;
  depth: number;
  kind: 'file' | 'dir';
  sizeBytes?: number;
  aggregated?: boolean;
  name: string;
}

export interface CullingStats {
  totalNodes: number;
  renderedNodes: number;
  culledNodes: number;
  reusePercentage: number;
  lastCulledCount: number;
}

export interface BenchmarkResult {
  baselineAvg: number;
  culledAvg: number;
  improvementPct: number;
  reusePct: number;
}

export interface DebugOverlayData {
  fpsTimes: number[];
  layoutSize: number;
  lastCulled: number;
  spriteNodes: number;
  spriteLines: number;
  reusePct: number;
  lastLayoutMs: number;
  lastBatchMs: number;
  avgCost?: number;
  benchResult?: BenchmarkResult;
}

export interface ExportManagerConfig {
  app: Application;
  enableTransparent: boolean;
}

export interface FallbackRendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface InteractionState {
  scale: number;
  panX: number;
  panY: number;
  isDragging: boolean;
  lastPointer: { x: number; y: number } | null;
}

export interface InteractionHandlers {
  wheel?: (e: WheelEvent) => void;
  pointerdown?: (e: PointerEvent) => void;
  pointermove?: (e: PointerEvent) => void;
  pointerup?: (e: PointerEvent) => void;
  themeChanged?: () => void;
}

export interface EventListenerConfig {
  interactionHandlers: InteractionHandlers;
  interactionsApiRef: React.MutableRefObject<{
    zoomIn?: () => void;
    zoomOut?: () => void;
    [key: string]: unknown;
  } | null>;
}

export interface InteractionHandlerDeps {
  app: Application;
  layoutIndex: Map<string, { x: number; y: number }>;
  scaleRef: React.MutableRefObject<number>;
  selectedKeyRef: React.MutableRefObject<string | null>;
  pixiFailed: boolean;
  redraw: (force?: boolean) => void;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RenderSceneConfig {
  app: Application;
  pixiFailed: boolean;
  layoutNodes: LayoutPointV2[];
  adapter: {
    getNodeColor: (key: string) => number;
    getNodeText: (key: string) => string;
    getNodeSize: (key: string) => number;
    getNodeKind: (key: string) => 'file' | 'dir';
  };
  nodeIndex: Map<string, LayoutPointV2>;
  style: StyleTokens;
  scaleRef: React.MutableRefObject<number>;
  disableCullingRef: React.MutableRefObject<boolean>;
  hoveredKeyRef: React.MutableRefObject<string | null>;
  selectedKeyRef: React.MutableRefObject<string | null>;
  nodeColorRef: React.MutableRefObject<Map<string, number>>;
  spriteNodes: React.MutableRefObject<Map<string, PIXI.Sprite>>;
  spriteLines: React.MutableRefObject<Map<string, PIXI.Graphics>>;
  spriteBadges: React.MutableRefObject<Map<string, PIXI.Text>>;
  spriteLabels: React.MutableRefObject<Map<string, PIXI.Text>>;
  reuseStatsRef: React.MutableRefObject<{ totalAllocated: number; reusedPct: number }>;
  lastCulledCountRef: React.MutableRefObject<number>;
  onNodeSpriteCreate?: (sprite: PIXI.Sprite, key: string) => void;
}
