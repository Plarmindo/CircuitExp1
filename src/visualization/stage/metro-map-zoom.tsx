/**
 * MetroMapZoom - Google Maps-style visualization with advanced controls.
 *
 * This component ports the standalone demo behaviour into the production
 * React/TypeScript codebase. Nodes and labels are rendered at constant physical
 * sizes regardless of zoom level, multiple line styles are supported, an
 * optional minimap visualises the viewport, and window-zoom as well as
 * focus/isolation interactions are available.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LayoutNodeLite, RouteCommand } from './types';

export type LineStyle = 'straight' | 'curved' | 'stepped' | 'rounded' | 'bezier';
export type LabelMode = 'always' | 'hover' | 'zoomed';
export type GraphDirection = 'vertical' | 'horizontal';

export interface GoogleMapSettings {
  nodeSizeMm: number;
  textSizeMm: number;
  lineWidthMm: number;
  lineStyle: LineStyle;
  showLabels: boolean;
  labelMode: LabelMode;
  graphDirection: GraphDirection;
}

interface MetroMapZoomProps {
  layout?: LayoutNodeLite[];
  routes?: RouteCommand[];
  onNodeClick?: (path: string) => void;
  onNodeHover?: (path: string | null) => void;
  onLayoutUpdate?: (layout: LayoutNodeLite[]) => void;
  theme?: Record<string, unknown>;
  debug?: boolean;
  mapSettings?: Partial<GoogleMapSettings>;
  showMinimap?: boolean;
}

const DEFAULT_SETTINGS: GoogleMapSettings = {
  nodeSizeMm: 4,
  textSizeMm: 2,
  lineWidthMm: 1,
  lineStyle: 'straight',
  showLabels: true,
  labelMode: 'always',
  graphDirection: 'vertical',
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
const ZOOM_INCREMENT = 0.5;
const LABEL_ZOOM_THRESHOLD = 7;
const MM_PER_INCH = 25.4;
const DEFAULT_DPI = 96;

interface Point {
  x: number;
  y: number;
}

interface ViewState {
  zoom: number;
  centerX: number;
  centerY: number;
  isDragging: boolean;
}

interface WindowZoomRect {
  start: Point;
  end: Point;
}

interface MinimapTransform {
  scale: number;
  minX: number;
  minY: number;
  offsetX: number;
  offsetY: number;
}

interface RenderNode extends LayoutNodeLite {
  label: string;
  parentPath: string | null;
  isDirectory: boolean;
}

const INITIAL_VIEW: ViewState = {
  zoom: 5,
  centerX: 0,
  centerY: 0,
  isDragging: false,
};

const DEPTH_COLORS = ['#ffb300', '#29b6f6', '#66bb6a', '#ab47bc', '#ef5350', '#26a69a'];

const LINE_DRAWERS: Record<
  LineStyle,
  (ctx: CanvasRenderingContext2D, from: Point, to: Point) => void
> = {
  straight: (ctx, from, to) => {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  },
  curved: (ctx, from, to) => {
    const midX = (from.x + to.x) / 2;
    const control = {
      x: midX,
      y: Math.min(from.y, to.y) - Math.abs(from.x - to.x) * 0.2,
    };
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
    ctx.stroke();
  },
  stepped: (ctx, from, to) => {
    const midX = (from.x + to.x) / 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(midX, from.y);
    ctx.lineTo(midX, to.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  },
  rounded: (ctx, from, to) => {
    const midX = (from.x + to.x) / 2;
    const radius = Math.min(40, Math.abs(from.y - to.y) * 0.4 + 12);
    const direction = Math.sign(to.y - from.y) || 1;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(midX - radius, from.y);
    ctx.quadraticCurveTo(midX, from.y, midX, from.y + radius * direction);
    ctx.lineTo(midX, to.y - radius * direction);
    ctx.quadraticCurveTo(midX, to.y, midX + radius, to.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  },
  bezier: (ctx, from, to) => {
    const ctrlOffset = Math.abs(from.y - to.y) * 0.6 + 40;
    const cp1 = { x: from.x, y: from.y - ctrlOffset };
    const cp2 = { x: to.x, y: to.y - ctrlOffset };
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y);
    ctx.stroke();
  },
};

const depthColor = (depth: number): string => {
  if (depth < 0) return '#888888';
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
};

const normalisePath = (path: string): string => {
  if (!path) return '';
  if (path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
};

const computeParentPath = (path: string): string | null => {
  const normalised = normalisePath(path);
  if (!normalised || normalised === '/') return null;
  const idx = normalised.lastIndexOf('/');
  if (idx <= 0) return '/';
  return normalised.slice(0, idx);
};

const isDescendant = (child: string, ancestor: string): boolean => {
  const normAncestor = normalisePath(ancestor);
  const normChild = normalisePath(child);
  if (!normAncestor) return false;
  if (normAncestor === '/') return normChild.startsWith('/') || normChild.length === 0;
  return normChild === normAncestor || normChild.startsWith(`${normAncestor}/`);
};

const mmToPixels = (mm: number, dpi: number): number => (mm * dpi) / MM_PER_INCH;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const MetroMapZoom: React.FC<MetroMapZoomProps> = ({
  layout = [],
  routes = [],
  onNodeClick,
  onNodeHover,
  onLayoutUpdate,
  debug = false,
  mapSettings,
  showMinimap = true,
}) => {
  const settings = useMemo<GoogleMapSettings>(
    () => ({ ...DEFAULT_SETTINGS, ...mapSettings }),
    [mapSettings]
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapTransformRef = useRef<MinimapTransform | null>(null);
  const isMinimapDragging = useRef(false);
  const pointerDownRef = useRef<{ point: Point; shift: boolean } | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [dpi, setDpi] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_DPI;
    return (window.devicePixelRatio || 1) * DEFAULT_DPI;
  });
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [isolatedPath, setIsolatedPath] = useState<string | null>(null);
  const [windowZoomActive, setWindowZoomActive] = useState(false);
  const [windowZoomRect, setWindowZoomRect] = useState<WindowZoomRect | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateDpi = () => setDpi((window.devicePixelRatio || 1) * DEFAULT_DPI);
    updateDpi();
    window.addEventListener('resize', updateDpi);
    return () => window.removeEventListener('resize', updateDpi);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const box = Array.isArray(entry.contentBoxSize)
            ? entry.contentBoxSize[0]
            : entry.contentBoxSize;
          setDimensions({ width: box.inlineSize, height: box.blockSize });
        } else {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Listen to MapSettings changes and update local settings
  const [dynamicSettings, setDynamicSettings] = useState(settings);

  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const event = e as CustomEvent;
      const mapSettings = event.detail;
      if (mapSettings) {
        // Convert MapSettings to GoogleMapSettings format
        setDynamicSettings(prev => ({
          ...prev,
          lineWidthMm: mapSettings.line?.width ? mapSettings.line.width / 4 : prev.lineWidthMm, // Convert px to mm (approximate)
          lineStyle: mapSettings.line?.style === 'orthogonal' ? 'stepped' :
                    mapSettings.line?.style === 'curved' ? 'curved' : 'straight',
          showLabels: mapSettings.text?.visible !== false,
          labelMode: mapSettings.text?.visible !== false ? 'always' : 'hover',
        }));
      }
    };

    const handleSettingsReset = () => {
      setDynamicSettings(settings);
    };

    window.addEventListener('metro:settingsChange', handleSettingsChange);
    window.addEventListener('metro:settingsReset', handleSettingsReset);

    return () => {
      window.removeEventListener('metro:settingsChange', handleSettingsChange);
      window.removeEventListener('metro:settingsReset', handleSettingsReset);
    };
  }, [settings]);

  const renderNodes = useMemo<RenderNode[]>(() => {
    if (!layout || layout.length === 0) return [];

    const nodes: RenderNode[] = layout.map((node) => {
      const labelSegments = normalisePath(node.path).split('/').filter(Boolean);
      const label = labelSegments.length > 0 ? labelSegments[labelSegments.length - 1] : 'root';
      const parentPath = computeParentPath(node.path);
      const isDirectory = Boolean(node.aggregated) || node.depth < (routes.length > 0 ? 1 : 2);
      const orientedX = dynamicSettings.graphDirection === 'horizontal' ? node.y : node.x;
      const orientedY = dynamicSettings.graphDirection === 'horizontal' ? node.x : node.y;

      return {
        ...node,
        x: orientedX,
        y: orientedY,
        label,
        parentPath,
        isDirectory,
      };
    });

    nodes.sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));
    return nodes;
  }, [layout, routes.length, dynamicSettings.graphDirection]);

  useEffect(() => {
    if (onLayoutUpdate && layout) {
      onLayoutUpdate(layout);
    }
  }, [layout, onLayoutUpdate]);

  const nodeLookup = useMemo(() => {
    const map = new Map<string, RenderNode>();
    renderNodes.forEach((node) => map.set(node.path, node));
    return map;
  }, [renderNodes]);

  const bounds = useMemo(() => {
    if (renderNodes.length === 0) {
      return { minX: -500, maxX: 500, minY: -400, maxY: 400 };
    }
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of renderNodes) {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    }
    return { minX, maxX, minY, maxY };
  }, [renderNodes]);

  const layoutSignatureRef = useRef<string>('');
  useEffect(() => {
    const signature = `${renderNodes.length}:${renderNodes[0]?.path ?? 'none'}:${dynamicSettings.graphDirection}`;
    if (!renderNodes.length || signature === layoutSignatureRef.current) return;
    layoutSignatureRef.current = signature;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    setViewState((prev) => ({ ...prev, centerX, centerY }));
  }, [renderNodes, bounds, dynamicSettings.graphDirection]);

  const mmToPx = useCallback((mm: number) => mmToPixels(mm, dpi), [dpi]);

  const nodeRadiusPx = useMemo(
    () => mmToPx(dynamicSettings.nodeSizeMm) / 2,
    [mmToPx, dynamicSettings.nodeSizeMm]
  );
  const textSizePx = useMemo(() => mmToPx(dynamicSettings.textSizeMm), [mmToPx, dynamicSettings.textSizeMm]);
  const lineWidthPx = useMemo(
    () => Math.max(1, mmToPx(dynamicSettings.lineWidthMm)),
    [mmToPx, dynamicSettings.lineWidthMm]
  );

  const worldToScreen = useCallback(
    (x: number, y: number): Point => {
      const scale = Math.pow(2, viewState.zoom - 5);
      const screenX = (x - viewState.centerX) * scale + dimensions.width / 2;
      const screenY = (y - viewState.centerY) * scale + dimensions.height / 2;
      return { x: screenX, y: screenY };
    },
    [viewState.centerX, viewState.centerY, viewState.zoom, dimensions.width, dimensions.height]
  );

  const screenToWorld = useCallback(
    (x: number, y: number): Point => {
      const scale = Math.pow(2, viewState.zoom - 5);
      const worldX = (x - dimensions.width / 2) / scale + viewState.centerX;
      const worldY = (y - dimensions.height / 2) / scale + viewState.centerY;
      return { x: worldX, y: worldY };
    },
    [viewState.centerX, viewState.centerY, viewState.zoom, dimensions.width, dimensions.height]
  );

  const visibleNodePaths = useMemo(() => {
    if (renderNodes.length === 0) return [] as string[];
    const result = new Set<string>();
    const maxDepth = Math.floor(viewState.zoom / 2);

    const allowNode = (node: RenderNode): boolean => {
      if (isolatedPath && !isDescendant(node.path, isolatedPath)) return false;
      if (node.depth <= maxDepth) return true;
      if (!node.isDirectory && viewState.zoom >= LABEL_ZOOM_THRESHOLD) return true;
      return false;
    };

    const addAncestors = (path: string) => {
      let current = computeParentPath(path);
      while (current) {
        if (result.has(current)) break;
        const parentNode = nodeLookup.get(current);
        if (!parentNode) break;
        result.add(parentNode.path);
        current = parentNode.parentPath;
      }
    };

    renderNodes.forEach((node) => {
      if (allowNode(node)) {
        result.add(node.path);
        addAncestors(node.path);
      }
    });

    if (focusedPath) {
      result.add(focusedPath);
      addAncestors(focusedPath);
    }
    if (isolatedPath) {
      result.add(isolatedPath);
      addAncestors(isolatedPath);
    }

    return Array.from(result);
  }, [renderNodes, nodeLookup, viewState.zoom, isolatedPath, focusedPath]);

  const visibleNodes = useMemo(() => {
    return visibleNodePaths
      .map((path) => nodeLookup.get(path))
      .filter((node): node is RenderNode => Boolean(node))
      .sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));
  }, [nodeLookup, visibleNodePaths]);

  const visiblePathSet = useMemo(() => new Set(visibleNodePaths), [visibleNodePaths]);

  const focussedNode = focusedPath ? nodeLookup.get(focusedPath) ?? null : null;
  const isolatedNode = isolatedPath ? nodeLookup.get(isolatedPath) ?? null : null;

  const findNodeAtPosition = useCallback(
    (screenX: number, screenY: number): RenderNode | null => {
      const radius = nodeRadiusPx;
      for (let i = visibleNodes.length - 1; i >= 0; i -= 1) {
        const node = visibleNodes[i];
        const pos = worldToScreen(node.x, node.y);
        const dist = Math.hypot(pos.x - screenX, pos.y - screenY);
        if (dist <= radius + 2) {
          return node;
        }
      }
      return null;
    },
    [visibleNodes, worldToScreen, nodeRadiusPx]
  );

  const renderScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, dimensions.width * pixelRatio);
    canvas.height = Math.max(1, dimensions.height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    ctx.fillStyle = '#1e1e28';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    if (visibleNodes.length === 0) {
      ctx.fillStyle = '#666666';
      ctx.font = '16px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data to display', dimensions.width / 2, dimensions.height / 2);
      return;
    }

    const lineDrawer = LINE_DRAWERS[dynamicSettings.lineStyle];
    ctx.lineWidth = lineWidthPx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    visibleNodes.forEach((node) => {
      if (!node.parentPath) return;
      const parent = nodeLookup.get(node.parentPath);
      if (!parent) return;
      const from = worldToScreen(parent.x, parent.y);
      const to = worldToScreen(node.x, node.y);
      const parentVisible = visiblePathSet.has(parent.path);

      ctx.save();
      if (!parentVisible) {
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#888888';
      } else {
        ctx.globalAlpha = 0.75;
        ctx.setLineDash([]);
        ctx.strokeStyle = depthColor(node.depth);
      }
      lineDrawer(ctx, from, to);
      ctx.restore();
    });

    visibleNodes.forEach((node) => {
      const pos = worldToScreen(node.x, node.y);
      if (
        pos.x < -100 ||
        pos.x > dimensions.width + 100 ||
        pos.y < -100 ||
        pos.y > dimensions.height + 100
      ) {
        return;
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadiusPx, 0, Math.PI * 2);

      let fill = node.isDirectory ? '#29b6f6' : '#66bb6a';
      if (node.aggregated) fill = '#ffb300';
      if (isolatedPath && isDescendant(node.path, isolatedPath)) fill = '#66bb6a';
      if (node.path === focusedPath) fill = '#29b6f6';
      if (node.path === isolatedPath) fill = '#66bb6a';
      if (node.path === hoveredPath) fill = '#ffd54f';

      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      const shouldShowLabel =
        dynamicSettings.showLabels &&
        (dynamicSettings.labelMode === 'always' ||
          (dynamicSettings.labelMode === 'hover' &&
            (node.path === hoveredPath ||
              node.path === focusedPath ||
              node.path === isolatedPath)) ||
          (dynamicSettings.labelMode === 'zoomed' && viewState.zoom >= LABEL_ZOOM_THRESHOLD));

      if (shouldShowLabel) {
        ctx.fillStyle = '#ffd54f';
        ctx.font = `${textSizePx}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, pos.x, pos.y + nodeRadiusPx + 4);
      }
    });

    if (windowZoomRect) {
      const startX = Math.min(windowZoomRect.start.x, windowZoomRect.end.x);
      const startY = Math.min(windowZoomRect.start.y, windowZoomRect.end.y);
      const width = Math.abs(windowZoomRect.end.x - windowZoomRect.start.x);
      const height = Math.abs(windowZoomRect.end.y - windowZoomRect.start.y);
      ctx.save();
      ctx.strokeStyle = '#66bb6a';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(startX, startY, width, height);
      ctx.fillStyle = 'rgba(102, 187, 106, 0.25)';
      ctx.fillRect(startX, startY, width, height);
      ctx.restore();
    }

    if (debug) {
      ctx.fillStyle = '#ffb300';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Zoom: ${viewState.zoom.toFixed(2)}`, 10, 20);
      ctx.fillText(`Nodes: ${visibleNodes.length} / ${renderNodes.length}`, 10, 40);
      ctx.fillText(`Center: (${viewState.centerX.toFixed(1)}, ${viewState.centerY.toFixed(1)})`, 10, 60);
      ctx.fillText(`Node radius: ${nodeRadiusPx.toFixed(1)}px`, 10, 80);
      ctx.fillText(`Line width: ${lineWidthPx.toFixed(1)}px`, 10, 100);
    }
  }, [
    dimensions.height,
    dimensions.width,
    debug,
    focusedPath,
    hoveredPath,
    isolatedPath,
    lineWidthPx,
    nodeLookup,
    nodeRadiusPx,
    renderNodes.length,
    dynamicSettings.labelMode,
    dynamicSettings.lineStyle,
    dynamicSettings.showLabels,
    textSizePx,
    viewState.centerX,
    viewState.centerY,
    viewState.zoom,
    visibleNodes,
    visiblePathSet,
    windowZoomRect,
    worldToScreen,
  ]);

  const renderMinimap = useCallback(() => {
    if (!showMinimap) return;
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = canvas.clientWidth || 220;
    const height = canvas.clientHeight || 160;

    canvas.width = Math.max(1, width * pixelRatio);
    canvas.height = Math.max(1, height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1e1e28';
    ctx.fillRect(0, 0, width, height);

    if (renderNodes.length === 0) {
      minimapTransformRef.current = null;
      return;
    }

    const padding = 40;
    const minX = bounds.minX - padding;
    const maxX = bounds.maxX + padding;
    const minY = bounds.minY - padding;
    const maxY = bounds.maxY + padding;
    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;
    const scale = Math.min(width / worldWidth, height / worldHeight) * 0.9;
    const offsetX = (width - worldWidth * scale) / 2;
    const offsetY = (height - worldHeight * scale) / 2;

    minimapTransformRef.current = { scale, minX, minY, offsetX, offsetY };

    const project = (x: number, y: number): Point => ({
      x: (x - minX) * scale + offsetX,
      y: (y - minY) * scale + offsetY,
    });

    renderNodes.forEach((node) => {
      const pos = project(node.x, node.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = node.isDirectory ? '#29b6f688' : '#66bb6a88';
      ctx.fill();
    });

    const scaleFactor = Math.pow(2, viewState.zoom - 5);
    const halfWidthWorld = dimensions.width / 2 / scaleFactor;
    const halfHeightWorld = dimensions.height / 2 / scaleFactor;

    const topLeft = project(viewState.centerX - halfWidthWorld, viewState.centerY - halfHeightWorld);
    const bottomRight = project(viewState.centerX + halfWidthWorld, viewState.centerY + halfHeightWorld);

    ctx.strokeStyle = '#ffb300';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    );
    ctx.fillStyle = 'rgba(255, 179, 0, 0.2)';
    ctx.fillRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    );
  }, [
    bounds.maxX,
    bounds.maxY,
    bounds.minX,
    bounds.minY,
    dimensions.height,
    dimensions.width,
    renderNodes,
    showMinimap,
    viewState.centerX,
    viewState.centerY,
    viewState.zoom,
  ]);

  useEffect(() => {
    renderScene();
  }, [renderScene]);

  useEffect(() => {
    renderMinimap();
  }, [renderMinimap]);

  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      pointerDownRef.current = { point, shift: event.shiftKey };

      if (windowZoomActive) {
        setWindowZoomRect({ start: point, end: point });
        return;
      }

      setViewState((prev) => ({ ...prev, isDragging: true }));
    },
    [windowZoomActive]
  );

  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (windowZoomActive && windowZoomRect) {
        setWindowZoomRect((prev) => (prev ? { ...prev, end: { x, y } } : prev));
        return;
      }

      if (viewState.isDragging && pointerDownRef.current) {
        const prevPoint = pointerDownRef.current.point;
        const dx = x - prevPoint.x;
        const dy = y - prevPoint.y;
        const scale = Math.pow(2, viewState.zoom - 5);
        setViewState((prev) => ({
          ...prev,
          centerX: prev.centerX - dx / scale,
          centerY: prev.centerY - dy / scale,
        }));
        pointerDownRef.current = { ...pointerDownRef.current, point: { x, y } };
        return;
      }

      const node = findNodeAtPosition(x, y);
      if (node) {
        if (hoveredPath !== node.path) {
          setHoveredPath(node.path);
          onNodeHover?.(node.path);
        }
      } else if (hoveredPath) {
        setHoveredPath(null);
        onNodeHover?.(null);
      }
    },
    [findNodeAtPosition, hoveredPath, onNodeHover, viewState.isDragging, viewState.zoom, windowZoomActive, windowZoomRect]
  );

  const resetDraggingState = useCallback(() => {
    setViewState((prev) => ({ ...prev, isDragging: false }));
    pointerDownRef.current = null;
  }, []);

  const handleCanvasMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) {
        resetDraggingState();
        setWindowZoomRect(null);
        return;
      }
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (windowZoomActive && windowZoomRect) {
        const startWorld = screenToWorld(windowZoomRect.start.x, windowZoomRect.start.y);
        const endWorld = screenToWorld(windowZoomRect.end.x, windowZoomRect.end.y);
        const minX = Math.min(startWorld.x, endWorld.x);
        const maxX = Math.max(startWorld.x, endWorld.x);
        const minY = Math.min(startWorld.y, endWorld.y);
        const maxY = Math.max(startWorld.y, endWorld.y);
        const worldWidth = Math.max(10, maxX - minX);
        const worldHeight = Math.max(10, maxY - minY);
        const scaleX = dimensions.width / worldWidth;
        const scaleY = dimensions.height / worldHeight;
        const targetScale = Math.min(scaleX, scaleY) * 0.9;
        const newZoom = clamp(Math.log2(targetScale) + 5, MIN_ZOOM, MAX_ZOOM);
        setViewState((prev) => ({
          ...prev,
          zoom: newZoom,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
        }));
        setWindowZoomRect(null);
        return;
      }

      if (!viewState.isDragging && pointerDownRef.current) {
        const node = findNodeAtPosition(x, y);
        if (node) {
          if (pointerDownRef.current.shift) {
            setIsolatedPath((prev) => (prev === node.path ? null : node.path));
          } else {
            setFocusedPath((prev) => (prev === node.path ? null : node.path));
            onNodeClick?.(node.path);
          }
        }
      }

      resetDraggingState();
      setWindowZoomRect(null);
    },
    [
      dimensions.height,
      dimensions.width,
      findNodeAtPosition,
      onNodeClick,
      resetDraggingState,
      screenToWorld,
      viewState.isDragging,
      windowZoomActive,
      windowZoomRect,
    ]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    if (hoveredPath) {
      setHoveredPath(null);
      onNodeHover?.(null);
    }
    resetDraggingState();
    setWindowZoomRect(null);
  }, [hoveredPath, onNodeHover, resetDraggingState]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const worldBefore = screenToWorld(pointer.x, pointer.y);

      const delta = event.deltaY > 0 ? -ZOOM_INCREMENT : ZOOM_INCREMENT;
      const nextZoom = clamp(viewState.zoom + delta, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === viewState.zoom) return;

      setViewState((prev) => {
        const factor = Math.pow(2, prev.zoom - nextZoom);
        const worldAfter = screenToWorld(pointer.x, pointer.y);
        return {
          ...prev,
          zoom: nextZoom,
          centerX: worldBefore.x + (prev.centerX - worldAfter.x) * factor,
          centerY: worldBefore.y + (prev.centerY - worldAfter.y) * factor,
        };
      });
    },
    [screenToWorld, viewState.zoom]
  );

  const zoomIn = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      zoom: clamp(prev.zoom + ZOOM_INCREMENT, MIN_ZOOM, MAX_ZOOM),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      zoom: clamp(prev.zoom - ZOOM_INCREMENT, MIN_ZOOM, MAX_ZOOM),
    }));
  }, []);

  const resetView = useCallback(() => {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    setViewState({ ...INITIAL_VIEW, centerX, centerY });
    setFocusedPath(null);
    setIsolatedPath(null);
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY]);

  const toggleWindowZoom = useCallback(() => {
    setWindowZoomActive((prev) => !prev);
    setWindowZoomRect(null);
    resetDraggingState();
  }, [resetDraggingState]);

  const minimapToWorld = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>): Point | null => {
      const rect = minimapCanvasRef.current?.getBoundingClientRect();
      const transform = minimapTransformRef.current;
      if (!rect || !transform) return null;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return {
        x: (x - transform.offsetX) / transform.scale + transform.minX,
        y: (y - transform.offsetY) / transform.scale + transform.minY,
      };
    },
    []
  );

  const handleMinimapMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const world = minimapToWorld(event);
      if (!world) return;
      isMinimapDragging.current = true;
      if (minimapCanvasRef.current) {
        minimapCanvasRef.current.style.cursor = 'grabbing';
      }
      setViewState((prev) => ({ ...prev, centerX: world.x, centerY: world.y }));
    },
    [minimapToWorld]
  );

  const handleMinimapMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isMinimapDragging.current) return;
      const world = minimapToWorld(event);
      if (!world) return;
      setViewState((prev) => ({ ...prev, centerX: world.x, centerY: world.y }));
    },
    [minimapToWorld]
  );

  const stopMinimapDrag = useCallback(() => {
    if (!isMinimapDragging.current) return;
    isMinimapDragging.current = false;
    if (minimapCanvasRef.current) {
      minimapCanvasRef.current.style.cursor = 'grab';
    }
  }, []);

  const focusLabel = isolatedNode
    ? `${isolatedNode.label} (Isolated)`
    : focussedNode
    ? focussedNode.label
    : 'All (Root)';

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#1e1e28',
        borderRadius: 12,
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseLeave}
        onWheel={handleWheel}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: windowZoomActive
            ? 'crosshair'
            : viewState.isDragging
            ? 'grabbing'
            : 'grab',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          gap: 8,
          background: 'rgba(30, 30, 40, 0.95)',
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid rgba(255, 179, 0, 0.3)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom In (+)"
          style={{
            background: '#ffb300',
            color: '#181818',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            width: 36,
            height: 36,
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom Out (-)"
          style={{
            background: '#ffb300',
            color: '#181818',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            width: 36,
            height: 36,
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          title="Reset View"
          style={{
            background: '#29b6f6',
            color: '#181818',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            width: 36,
            height: 36,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          ⊡
        </button>
        <button
          type="button"
          onClick={toggleWindowZoom}
          title="Window Zoom"
          style={{
            background: windowZoomActive ? '#66bb6a' : '#232526',
            color: windowZoomActive ? '#101820' : '#ffd54f',
            border: windowZoomActive
              ? '1px solid #66bb6a'
              : '1px solid rgba(255,179,0,0.4)',
            borderRadius: 6,
            cursor: 'pointer',
            width: 36,
            height: 36,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          ⬚
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(30, 30, 40, 0.95)',
          padding: '16px 18px',
          borderRadius: 10,
          border: '1px solid rgba(255, 179, 0, 0.3)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          color: '#ffd54f',
          fontSize: 13,
          minWidth: 220,
        }}
        aria-live="polite"
      >
        <div style={{ fontWeight: 600, color: '#ffb300', marginBottom: 8 }}>Map Status</div>
        <div>Nodes: {visibleNodes.length} / {renderNodes.length}</div>
        <div>Zoom: {viewState.zoom.toFixed(1)}</div>
        <div>Focus: {focusLabel}</div>
        <div>Line Style: {dynamicSettings.lineStyle}</div>
        <div>
          Labels:{' '}
          {dynamicSettings.showLabels
            ? dynamicSettings.labelMode === 'hover'
              ? 'Hover'
              : dynamicSettings.labelMode === 'zoomed'
              ? 'Zoomed'
              : 'Always'
            : 'Hidden'}
        </div>
        <div>Direction: {dynamicSettings.graphDirection === 'horizontal' ? 'Horizontal' : 'Vertical'}</div>
        {(focusedPath || isolatedPath) && (
          <button
            type="button"
            onClick={() => {
              setFocusedPath(null);
              setIsolatedPath(null);
            }}
            style={{
              marginTop: 10,
              background: '#ffb300',
              color: '#101820',
              border: 'none',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear Focus
          </button>
        )}
      </div>

      {showMinimap && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            width: 220,
            height: 160,
            background: 'rgba(30, 30, 40, 0.95)',
            border: '1px solid rgba(255, 179, 0, 0.3)',
            borderRadius: 10,
            padding: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ color: '#ffd54f', fontSize: 12, marginBottom: 6 }}>Minimap</div>
          <canvas
            ref={minimapCanvasRef}
            width={200}
            height={130}
            onMouseDown={handleMinimapMouseDown}
            onMouseMove={handleMinimapMouseMove}
            onMouseUp={stopMinimapDrag}
            onMouseLeave={stopMinimapDrag}
            style={{
              width: '100%',
              height: '130px',
              borderRadius: 6,
              background: '#1e1e28',
              cursor: 'grab',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default MetroMapZoom;
