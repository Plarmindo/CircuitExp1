import { Application, Renderer } from 'pixi.js';

export interface PanZoomContext {
  appRef: React.MutableRefObject<Application | null>;
  scaleRef: React.MutableRefObject<number>;
  layoutIndexRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  redraw: (applyPending?: boolean) => void;
}

export interface PanZoomAPI {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  destroy: () => void;
}

/**
 * Sets up pan & zoom handlers (wheel + drag + programmatic zoom/fit) and returns an API for external triggers.
 * All side-effects (event listeners) are cleaned up on destroy().
 */
export function setupPanZoom(canvasContainer: HTMLElement | null, ctx: PanZoomContext): PanZoomAPI {
  const { appRef, scaleRef, layoutIndexRef, redraw } = ctx;
  const app = appRef.current;
  if (!app || !canvasContainer) {
    return { zoomIn: () => {}, zoomOut: () => {}, fitToView: () => {}, destroy: () => {} };
  }

  const minZoom = 0.3;
  const maxZoom = 3.0;
  let dragging = false;
  let lastPointer: { x: number; y: number } | null = null;

  const applyTransform = () => {
    if (!appRef.current) return;
    appRef.current.stage.scale.set(scaleRef.current);
  };

  const zoomByFactorAt = (factor: number, centerX: number, centerY: number) => {
    const canvasEl = app.canvas as HTMLCanvasElement;
    const rect = canvasEl.getBoundingClientRect();
    const stage = app.stage;
    const currentScale = scaleRef.current;

    // Ensure all inputs are finite
    if (!Number.isFinite(factor) || !Number.isFinite(centerX) || !Number.isFinite(centerY)) return;
    if (!Number.isFinite(currentScale) || currentScale <= 0) return;
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return;

    const worldX = (centerX - rect.left - stage.x) / currentScale;
    const worldY = (centerY - rect.top - stage.y) / currentScale;
    const newScale = Math.min(maxZoom, Math.max(minZoom, currentScale * factor));

    // Ensure scale calculation is finite
    if (!Number.isFinite(newScale) || newScale <= 0) return;

    scaleRef.current = newScale;
    applyTransform();

    const newX = centerX - rect.left - worldX * newScale;
    const newY = centerY - rect.top - worldY * newScale;

    // Ensure final coordinates are finite
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;

    stage.x = newX;
    stage.y = newY;
    redraw(false); // update culling/badges
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const canvasEl = app.canvas as HTMLCanvasElement;
    const rect = canvasEl.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const stage = app.stage;
    const currentScale = scaleRef.current;

    // Ensure all inputs are finite
    if (!Number.isFinite(cursorX) || !Number.isFinite(cursorY)) return;
    if (!Number.isFinite(currentScale) || currentScale <= 0) return;

    const worldX = (cursorX - stage.x) / currentScale;
    const worldY = (cursorY - stage.y) / currentScale;
    const zoomIn = e.deltaY < 0;
    const factor = zoomIn ? 1.1 : 0.9;
    const newScale = Math.min(maxZoom, Math.max(minZoom, currentScale * factor));

    // Ensure scale calculation is finite
    if (!Number.isFinite(newScale) || newScale <= 0) return;

    scaleRef.current = newScale;
    applyTransform();

    const newX = cursorX - worldX * newScale;
    const newY = cursorY - worldY * newScale;

    // Ensure final coordinates are finite
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;

    stage.x = newX;
    stage.y = newY;
    redraw(false);
  };

  const handlePointerDown = (e: PointerEvent) => {
    dragging = true;
    lastPointer = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: PointerEvent) => {
    if (!dragging || !lastPointer) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;

    // Ensure delta values are finite
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    const newX = app.stage.x + dx;
    const newY = app.stage.y + dy;

    // Ensure new positions are finite
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;

    app.stage.x = newX;
    app.stage.y = newY;
    lastPointer = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e: PointerEvent) => {
    dragging = false;
    lastPointer = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const computeBounds = () => {
    const idx = layoutIndexRef.current;
    if (!idx || idx.size === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    let hasValidCoordinates = false;
    for (const [, v] of idx) {
      if (Number.isFinite(v.x) && Number.isFinite(v.y)) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
        hasValidCoordinates = true;
      }
    }
    if (
      !hasValidCoordinates ||
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return null;
    }
    return { minX, minY, maxX, maxY };
  };

  const fitToView = () => {
    const b = computeBounds();
    if (!b) return;
    const renderer = app.renderer as Renderer;
    const pad = 40;
    const worldW = b.maxX - b.minX + pad * 2;
    const worldH = b.maxY - b.minY + pad * 2;
    const viewW = renderer.width;
    const viewH = renderer.height;
    if (worldW <= 0 || worldH <= 0 || viewW <= 0 || viewH <= 0) return;
    const scale = Math.min(viewW / worldW, viewH / worldH) * 0.95;
    const newScale = Math.min(maxZoom, Math.max(minZoom, scale));

    // Ensure scale is finite and positive
    if (!Number.isFinite(newScale) || newScale <= 0) return;

    scaleRef.current = newScale;
    applyTransform();

    const worldCenterX = (b.minX + b.maxX) / 2;
    const worldCenterY = (b.minY + b.maxY) / 2;

    // Ensure center calculations are finite
    if (!Number.isFinite(worldCenterX) || !Number.isFinite(worldCenterY)) return;

    const newX = viewW / 2 - worldCenterX * newScale;
    const newY = viewH / 2 - worldCenterY * newScale;

    // Ensure final viewport coordinates are finite
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;

    app.stage.x = newX;
    app.stage.y = newY;
  };

  // Attach listeners
  const canvasEl = app.canvas as HTMLCanvasElement;
  canvasEl.addEventListener('wheel', handleWheel, { passive: false });
  canvasEl.addEventListener('pointerdown', handlePointerDown);
  canvasEl.addEventListener('pointermove', handlePointerMove);
  canvasEl.addEventListener('pointerup', handlePointerUp);
  canvasEl.addEventListener('pointerleave', handlePointerUp);

  const zoomIn = () => {
    const rect = canvasEl.getBoundingClientRect();
    zoomByFactorAt(1.1, rect.left + canvasEl.width / 2, rect.top + canvasEl.height / 2);
  };
  const zoomOut = () => {
    const rect = canvasEl.getBoundingClientRect();
    zoomByFactorAt(0.9, rect.left + canvasEl.width / 2, rect.top + canvasEl.height / 2);
  };

  const destroy = () => {
    canvasEl.removeEventListener('wheel', handleWheel);
    canvasEl.removeEventListener('pointerdown', handlePointerDown);
    canvasEl.removeEventListener('pointermove', handlePointerMove);
    canvasEl.removeEventListener('pointerup', handlePointerUp);
    canvasEl.removeEventListener('pointerleave', handlePointerUp);
  };

  // Initial transform
  scaleRef.current = 1;
  applyTransform();
  app.stage.x = 0;
  app.stage.y = 0;

  return { zoomIn, zoomOut, fitToView, destroy };
}
