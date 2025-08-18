import * as PIXI from 'pixi.js';

export interface InteractionInitParams {
  app: PIXI.Application;
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
    const scale = scaleRef.current;
    app.stage.scale.set(scale);
  };

  const zoomByFactorAt = (factor: number, centerX: number, centerY: number) => {
    const canvasEl = app.canvas as HTMLCanvasElement;
    const rect = canvasEl.getBoundingClientRect();
    const stage = app.stage;
    const currentScale = scaleRef.current;
    const worldX = (centerX - rect.left - stage.x) / currentScale;
    const worldY = (centerY - rect.top - stage.y) / currentScale;
    const newScale = Math.min(maxZoom, Math.max(minZoom, currentScale * factor));
    scaleRef.current = newScale; applyTransform();
    stage.x = centerX - rect.left - worldX * newScale;
    stage.y = centerY - rect.top - worldY * newScale;
    redraw(false);
  };

  const zoomIn = () => {
    const canvas = app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    zoomByFactorAt(1.2, rect.left + rect.width/2, rect.top + rect.height/2);
  };
  const zoomOut = () => {
    const canvas = app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    zoomByFactorAt(1/1.2, rect.left + rect.width/2, rect.top + rect.height/2);
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
    app.stage.x += dx; app.stage.y += dy;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    redraw(false);
  };
  const handlePointerUp = (e: PointerEvent) => {
    draggingRef.current = false; lastPointerRef.current = null; (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const canvasEl = app.canvas as HTMLCanvasElement;
  canvasEl.addEventListener('wheel', handleWheel, { passive: false });
  canvasEl.addEventListener('pointerdown', handlePointerDown);
  canvasEl.addEventListener('pointermove', handlePointerMove);
  canvasEl.addEventListener('pointerup', handlePointerUp);

  const fitToView = (bounds: { minX: number; minY: number; maxX: number; maxY: number } | null) => {
    if (!bounds) return;
    const canvas = app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const margin = 40;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const sx = (rect.width - margin) / w;
    const sy = (rect.height - margin) / h;
    const newScale = Math.min(Math.max(0.2, Math.min(sx, sy)), 2.5);
    scaleRef.current = newScale; applyTransform();
    app.stage.x = rect.width/2 - (bounds.minX + w/2) * newScale;
    app.stage.y = rect.height/2 - (bounds.minY + h/2) * newScale;
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
