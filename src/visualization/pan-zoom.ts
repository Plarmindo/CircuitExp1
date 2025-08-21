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
    const worldX = (centerX - rect.left - stage.x) / currentScale;
    const worldY = (centerY - rect.top - stage.y) / currentScale;
    const newScale = Math.min(maxZoom, Math.max(minZoom, currentScale * factor));
    scaleRef.current = newScale;
    applyTransform();
    stage.x = centerX - rect.left - worldX * newScale;
    stage.y = centerY - rect.top - worldY * newScale;
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
    const worldX = (cursorX - stage.x) / currentScale;
    const worldY = (cursorY - stage.y) / currentScale;
    const zoomIn = e.deltaY < 0;
    const factor = zoomIn ? 1.1 : 0.9;
    const newScale = Math.min(maxZoom, Math.max(minZoom, currentScale * factor));
    scaleRef.current = newScale;
    applyTransform();
    stage.x = cursorX - worldX * newScale;
    stage.y = cursorY - worldY * newScale;
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
    app.stage.x += dx;
    app.stage.y += dy;
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
    for (const [, v] of idx) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
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
    scaleRef.current = newScale;
    applyTransform();
    const worldCenterX = (b.minX + b.maxX) / 2;
    const worldCenterY = (b.minY + b.maxY) / 2;
    app.stage.x = viewW / 2 - worldCenterX * newScale;
    app.stage.y = viewH / 2 - worldCenterY * newScale;
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
