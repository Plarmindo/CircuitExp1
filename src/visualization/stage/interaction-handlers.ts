import type { Application, Renderer } from 'pixi.js';

import { computeBounds } from './bounds-calculator';

export interface InteractionHandlers {
  handleFitToView: () => void;
  handleSelect: (path: string) => void;
  handleExportPNG: () => void;
  handleCenterAt: (worldX: number, worldY: number) => void;
  handleZoomToArea: (screenX1: number, screenY1: number, screenX2: number, screenY2: number) => void;
  // Added explicit zoom controls so global event listeners can invoke them
  zoomIn: () => void;
  zoomOut: () => void;
}

export interface InteractionHandlerConfig {
  app: Application;
  layoutIndex: Map<string, { x: number; y: number }>;
  scaleRef: React.MutableRefObject<number>;
  selectedKeyRef: React.MutableRefObject<string | null>;
  pixiFailed: boolean;
  redraw: (force?: boolean) => void;
}

/**
 * Creates interaction handlers for the metro stage
 */
export function createInteractionHandlers(config: InteractionHandlerConfig): InteractionHandlers {
  const { app, layoutIndex, scaleRef, selectedKeyRef, pixiFailed, redraw } = config;

  const getCanvas = (): HTMLCanvasElement | undefined => {
    // Prefer standard PIXI renderer.view when available, fallback to app.view/canvas
    const rendererView = (app.renderer as any)?.view as HTMLCanvasElement | undefined;
    const appView = (app as any)?.view as HTMLCanvasElement | undefined;
    const appCanvas = (app as any)?.canvas as HTMLCanvasElement | undefined;
    return rendererView || appView || appCanvas;
  };

  const handleFitToView = (): void => {
    const bounds = computeBounds(layoutIndex);
    if (!bounds) return;

    const renderer = app.renderer as Renderer;
    const pad = 40;
    const worldW = bounds.maxX - bounds.minX + pad * 2;
    const worldH = bounds.maxY - bounds.minY + pad * 2;

    // Abort if any dimension is non-finite to prevent invalid viewport calculations
    if (!Number.isFinite(worldW) || !Number.isFinite(worldH)) return;

    if (!renderer || typeof (renderer as unknown as { width?: number }).width !== 'number') {
      return; // jsdom fallback guard
    }

    const viewW = (renderer as unknown as { width: number }).width;
    const viewH = (renderer as unknown as { height: number }).height ?? 0;

    if (worldW <= 0 || worldH <= 0 || viewW <= 0 || viewH <= 0) return;

    const scale = Math.min(viewW / worldW, viewH / worldH) * 0.95;
    // Guard against non-finite scale values
    if (!Number.isFinite(scale)) return;
    const minZoom = 0.3;
    const maxZoom = 3.0;
    const newScale = Math.min(maxZoom, Math.max(minZoom, scale));

    scaleRef.current = newScale;
    if (!pixiFailed) app.stage.scale.set(newScale);

    const worldCenterX = (bounds.minX + bounds.maxX) / 2;
    const worldCenterY = (bounds.minY + bounds.maxY) / 2;

    // Ensure calculated positions are finite before applying
    if (!Number.isFinite(worldCenterX) || !Number.isFinite(worldCenterY)) return;

    app.stage.x = viewW / 2 - worldCenterX * newScale;
    app.stage.y = viewH / 2 - worldCenterY * newScale;
  };

  // Zoom helpers mirrored from interactions.ts so keyboard shortcuts can work
  const zoomByFactorAt = (factor: number, centerX: number, centerY: number) => {
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const stage = app.stage;
    const currentScale = scaleRef.current;

    if (!Number.isFinite(currentScale) || currentScale <= 0) return;
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return;
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return;

    const worldX = (centerX - rect.left - stage.x) / currentScale;
    const worldY = (centerY - rect.top - stage.y) / currentScale;
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;

    const minZoom = 0.3;
    const maxZoom = 3.0;
    const newScale = Math.min(maxZoom, Math.max(minZoom, currentScale * factor));
    if (!Number.isFinite(newScale) || newScale <= 0) return;

    scaleRef.current = newScale;
    if (!pixiFailed) stage.scale.set(newScale);

    const newX = centerX - rect.left - worldX * newScale;
    const newY = centerY - rect.top - worldY * newScale;
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;

    stage.x = newX;
    stage.y = newY;
    redraw(false);
  };

  const zoomIn = (): void => {
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    zoomByFactorAt(1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const zoomOut = (): void => {
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    zoomByFactorAt(1 / 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const handleSelect = (path: string): void => {
    // Toggle selection logic
    selectedKeyRef.current = path === selectedKeyRef.current ? null : path;

    window.dispatchEvent(
      new CustomEvent('metro:select', {
        detail: selectedKeyRef.current ? { path: selectedKeyRef.current, type: 'node' } : null,
      })
    );

    redraw(false);
  };

  const handleExportPNG = (): void => {
    // This will be handled by the ExportManager
    window.dispatchEvent(new CustomEvent('metro:exportPNG'));
  };

  const handleCenterAt = (worldX: number, worldY: number): void => {
    const renderer = app.renderer as Renderer;
    if (!renderer || typeof (renderer as unknown as { width?: number }).width !== 'number') {
      return; // jsdom fallback guard
    }

    const viewW = (renderer as unknown as { width: number }).width;
    const viewH = (renderer as unknown as { height: number }).height ?? 0;

    if (viewW <= 0 || viewH <= 0) return;
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;

    const currentScale = scaleRef.current;
    if (!Number.isFinite(currentScale) || currentScale <= 0) return;

    // Center the viewport at the given world position
    app.stage.x = viewW / 2 - worldX * currentScale;
    app.stage.y = viewH / 2 - worldY * currentScale;

    redraw(false);
  };

  const handleZoomToArea = (screenX1: number, screenY1: number, screenX2: number, screenY2: number): void => {
    const canvas = getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const renderer = app.renderer as Renderer;
    if (!renderer) return;

    // Calculate rectangle dimensions
    const width = Math.abs(screenX2 - screenX1);
    const height = Math.abs(screenY2 - screenY1);

    // Only zoom if rectangle is large enough (not just a click)
    if (width < 10 || height < 10) return;

    // Calculate center of selection in screen coordinates
    const centerScreenX = (screenX1 + screenX2) / 2;
    const centerScreenY = (screenY1 + screenY2) / 2;

    // Convert to world coordinates
    const stage = app.stage;
    const currentScale = scaleRef.current;
    const worldX = (centerScreenX - rect.left - stage.x) / currentScale;
    const worldY = (centerScreenY - rect.top - stage.y) / currentScale;

    // Calculate scale to fit rectangle (with 90% padding)
    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    const targetScale = Math.min(scaleX, scaleY) * 0.9 * currentScale;

    // Clamp scale to reasonable bounds
    const newScale = Math.max(0.1, Math.min(10, targetScale));
    scaleRef.current = newScale;
    stage.scale.set(newScale);

    // Center on the selected area
    stage.x = rect.width / 2 - worldX * newScale;
    stage.y = rect.height / 2 - worldY * newScale;

    redraw(false);
  };

  return {
    handleFitToView,
    handleSelect,
    handleExportPNG,
    handleCenterAt,
    handleZoomToArea,
    zoomIn,
    zoomOut,
  };
}
