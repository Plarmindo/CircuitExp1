import type { InteractionHandlers } from './interaction-handlers';

export interface WindowMetroAPI {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  exportPNG: () => void;
}

export interface EventListenerConfig {
  interactionHandlers: InteractionHandlers;
  interactionsApiRef: React.MutableRefObject<{
    zoomIn?: () => void;
    zoomOut?: () => void;
    [key: string]: unknown;
  } | null>;
}

/**
 * Sets up global event listeners for metro stage interactions
 */
export function setupEventListeners(config: EventListenerConfig): () => void {
  const { interactionHandlers, interactionsApiRef } = config;

  // Zoom in handler
  const onZoomIn = (): void => {
    if (interactionsApiRef.current?.zoomIn) {
      interactionsApiRef.current.zoomIn();
    }
  };

  // Zoom out handler
  const onZoomOut = (): void => {
    if (interactionsApiRef.current?.zoomOut) {
      interactionsApiRef.current.zoomOut();
    }
  };

  // Fit to view handler
  const onFit = (): void => {
    interactionHandlers.handleFitToView();
  };

  // Export PNG handler
  const onExport = (): void => {
    interactionHandlers.handleExportPNG();
  };

  // Global event listeners
  const addGlobalListeners = (): void => {
    if (typeof window !== 'undefined') {
      window.addEventListener('metro:zoomIn', onZoomIn);
      window.addEventListener('metro:zoomOut', onZoomOut);
      window.addEventListener('metro:fit', onFit);
      window.addEventListener('metro:exportPNG', onExport);
    }
  };

  const removeGlobalListeners = (): void => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('metro:zoomIn', onZoomIn);
      window.removeEventListener('metro:zoomOut', onZoomOut);
      window.removeEventListener('metro:fit', onFit);
      window.removeEventListener('metro:exportPNG', onExport);
    }
  };

  // Set up global references for external access
  if (typeof window !== 'undefined') {
    (window as Window & { metro?: WindowMetroAPI }).metro = {
      zoomIn: onZoomIn,
      zoomOut: onZoomOut,
      fit: onFit,
      exportPNG: onExport,
    };
  }

  addGlobalListeners();

  // Return cleanup function
  return (): void => {
    removeGlobalListeners();
    if (typeof window !== 'undefined') {
      delete (window as { metro?: WindowMetroAPI } & Window).metro;
    }
  };
}

/**
 * Dispatches a global event for external communication
 */
export function dispatchMetroEvent(eventName: string, detail?: unknown): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}