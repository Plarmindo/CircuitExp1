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
  // Optional callback to propagate depth cap override into the stage
  onDepthCapChange?: (cap: number | null) => void;
}

/**
 * Sets up global event listeners for metro stage interactions
 */
export function setupEventListeners(config: EventListenerConfig): () => void {
  const { interactionHandlers, interactionsApiRef, onDepthCapChange } = config;

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

  // Export PNG handler: dispatch a global event that MetroStage listens to
  const onExport = (): void => {
    dispatchMetroEvent('metro:exportPNG');
  };

  // Depth cap override handlers
  const onSetDepthCapOverride = (e: Event): void => {
    const detail = (e as CustomEvent<{ depthCap?: number | null }>).detail;
    if (onDepthCapChange) onDepthCapChange(detail?.depthCap ?? null);
  };
  const onClearDepthCapOverride = (): void => {
    if (onDepthCapChange) onDepthCapChange(null);
  };

  // Global event listeners
  const addGlobalListeners = (): void => {
    if (typeof window !== 'undefined') {
      window.addEventListener('metro:zoomIn', onZoomIn);
      window.addEventListener('metro:zoomOut', onZoomOut);
      window.addEventListener('metro:fit', onFit);
      // Note: do NOT listen to 'metro:exportPNG' here to avoid recursive dispatch loops.
      window.addEventListener('metro:setDepthCapOverride', onSetDepthCapOverride as EventListener);
      window.addEventListener('metro:clearDepthCapOverride', onClearDepthCapOverride as EventListener);
    }
  };

  const removeGlobalListeners = (): void => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('metro:zoomIn', onZoomIn);
      window.removeEventListener('metro:zoomOut', onZoomOut);
      window.removeEventListener('metro:fit', onFit);
      // Note: matching addGlobalListeners, no 'metro:exportPNG' removal needed here.
      window.removeEventListener('metro:setDepthCapOverride', onSetDepthCapOverride as EventListener);
      window.removeEventListener('metro:clearDepthCapOverride', onClearDepthCapOverride as EventListener);
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
