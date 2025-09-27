import type { Application, Renderer } from 'pixi.js';

import { computeBounds } from './bounds-calculator';

export interface InteractionHandlers {
  handleFitToView: () => void;
  handleSelect: (path: string) => void;
  handleExportPNG: () => void;
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

  return {
    handleFitToView,
    handleSelect,
    handleExportPNG,
    zoomIn,
    zoomOut,
  };
}
