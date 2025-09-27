import type { Application } from 'pixi.js';

export interface InteractionInitParams {
  app: Application;
  scaleRef: { current: number };
  draggingRef: { current: boolean };
  lastPointerRef: { current: { x: number; y: number } | null };
  container: HTMLDivElement | null;
  redraw: (applyPending?: boolean, opts?: { skipLayout?: boolean }) => void;
  emitHover: (path: string | null) => void;
  handleSelect: (path: string) => void;
}

export interface InteractionAPI {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: (bounds: { minX: number; minY: number; maxX: number; maxY: number } | null) => void;
  dispose: () => void;
}

export function initInteractions(p: InteractionInitParams): InteractionAPI {
  const { app, scaleRef, draggingRef, lastPointerRef, redraw } = p;
  const minZoom = 0.3;
  const maxZoom = 3.0;

  const applyTransform = () => {
    const stage = app.stage;
    const scale = scaleRef.current;

    // Ensure scale is finite and positive before applying
    if (!Number.isFinite(scale) || scale <= 0) {
      scaleRef.current = 1.0; // Reset to safe default
      stage.scale.set(1.0);
    } else {
      stage.scale.set(scale);
    }

    // Ensure stage position is finite
    if (!Number.isFinite(stage.x) || !Number.isFinite(stage.y)) {
      stage.x = 0;
      stage.y = 0;
    }

    // Ensure renderer dimensions are finite before rendering
    const canvas = app.renderer.view as HTMLCanvasElement;
    if (
      canvas &&
      Number.isFinite(canvas.width) &&
      Number.isFinite(canvas.height) &&
      canvas.width > 0 &&
      canvas.height > 0
    ) {
      app.renderer.render(stage);
    }
  };

  const zoomByFactorAt = (factor: number, centerX: number, centerY: number) => {
    if (!app.canvas) return;
    const canvasEl = app.canvas as HTMLCanvasElement;
    const rect = canvasEl.getBoundingClientRect();
    const stage = app.stage;
    const currentScale = scaleRef.current;

    // Ensure all values are finite before calculations
    if (!Number.isFinite(currentScale) || currentScale <= 0) return;
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return;
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return;

    const worldX = (centerX - rect.left - stage.x) / currentScale;
    const worldY = (centerY - rect.top - stage.y) / currentScale;

    // Ensure world coordinates are finite
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;

    const newScale = Math.min(maxZoom, Math.max(minZoom, currentScale * factor));
    if (!Number.isFinite(newScale) || newScale <= 0) return;

    scaleRef.current = newScale;
    applyTransform();

    const newX = centerX - rect.left - worldX * newScale;
    const newY = centerY - rect.top - worldY * newScale;

    // Ensure new coordinates are finite
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;

    stage.x = newX;
    stage.y = newY;
    redraw(false);
  };

  const zoomIn = () => {
    if (!app.canvas) return;
    const canvas = app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    zoomByFactorAt(1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };
  const zoomOut = () => {
    if (!app.canvas) return;
    const canvas = app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    zoomByFactorAt(1 / 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const handleWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoomByFactorAt(factor, e.clientX, e.clientY);
  };
  const handlePointerDown = (e: PointerEvent) => {
    draggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: PointerEvent) => {
    if (!draggingRef.current || !lastPointerRef.current) return;

    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;

    // Ensure delta values are finite
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    // Ensure current stage position is finite before adding delta
    if (!Number.isFinite(app.stage.x) || !Number.isFinite(app.stage.y)) {
      app.stage.x = 0;
      app.stage.y = 0;
    }

    const newX = app.stage.x + dx;
    const newY = app.stage.y + dy;

    // Ensure new positions are finite
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;

    app.stage.x = newX;
    app.stage.y = newY;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    redraw(false);
  };
  const handlePointerUp = (e: PointerEvent) => {
    draggingRef.current = false;
    lastPointerRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const canvasEl = app.canvas as HTMLCanvasElement;
  canvasEl.addEventListener('wheel', handleWheel, { passive: false });
  canvasEl.addEventListener('pointerdown', handlePointerDown);
  canvasEl.addEventListener('pointermove', handlePointerMove);
  canvasEl.addEventListener('pointerup', handlePointerUp);

  const fitToView = (bounds: { minX: number; minY: number; maxX: number; maxY: number } | null) => {
    if (!bounds || !app.canvas) return;

    // Validate bounds values are finite
    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.minY) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.maxY)
    )
      return;

    const canvas = app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();

    // Validate canvas dimensions are finite
    if (
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height) ||
      rect.width <= 0 ||
      rect.height <= 0
    )
      return;

    const margin = 40;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;

    // Prevent division by zero or negative dimensions
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;

    const sx = (rect.width - margin) / w;
    const sy = (rect.height - margin) / h;

    // Ensure scale calculations are finite
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;

    const newScale = Math.min(Math.max(0.2, Math.min(sx, sy)), 2.5);
    if (!Number.isFinite(newScale) || newScale <= 0) return;

    scaleRef.current = newScale;
    applyTransform();

    const centerX = bounds.minX + w / 2;
    const centerY = bounds.minY + h / 2;

    // Ensure center calculations are finite
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return;

    const newX = rect.width / 2 - centerX * newScale;
    const newY = rect.height / 2 - centerY * newScale;

    // Ensure final coordinates are finite
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;

    app.stage.x = newX;
    app.stage.y = newY;
    redraw(false);
  };

  const dispose = () => {
    canvasEl.removeEventListener('wheel', handleWheel);
    canvasEl.removeEventListener('pointerdown', handlePointerDown);
    canvasEl.removeEventListener('pointermove', handlePointerMove);
    canvasEl.removeEventListener('pointerup', handlePointerUp);
  };

  return { zoomIn, zoomOut, fitToView, dispose };
}
