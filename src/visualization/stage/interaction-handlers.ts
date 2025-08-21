import type { Application, Renderer } from 'pixi.js';

import { computeBounds } from './bounds-calculator';

export interface InteractionHandlers {
  handleFitToView: () => void;
  handleSelect: (path: string) => void;
  handleExportPNG: () => void;
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

  const handleFitToView = (): void => {
    const bounds = computeBounds(layoutIndex);
    if (!bounds) return;

    const renderer = app.renderer as Renderer;
    const pad = 40;
    const worldW = bounds.maxX - bounds.minX + pad * 2;
    const worldH = bounds.maxY - bounds.minY + pad * 2;

    if (!renderer || typeof (renderer as unknown as { width?: number }).width !== 'number') {
      return; // jsdom fallback guard
    }

    const viewW = (renderer as unknown as { width: number }).width;
    const viewH = (renderer as unknown as { height: number }).height ?? 0;

    if (worldW <= 0 || worldH <= 0 || viewW <= 0 || viewH <= 0) return;

    const scale = Math.min(viewW / worldW, viewH / worldH) * 0.95;
    const minZoom = 0.3;
    const maxZoom = 3.0;
    const newScale = Math.min(maxZoom, Math.max(minZoom, scale));

    scaleRef.current = newScale;
    if (!pixiFailed) app.stage.scale.set(newScale);

    const worldCenterX = (bounds.minX + bounds.maxX) / 2;
    const worldCenterY = (bounds.minY + bounds.maxY) / 2;

    app.stage.x = viewW / 2 - worldCenterX * newScale;
    app.stage.y = viewH / 2 - worldCenterY * newScale;
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
  };
}