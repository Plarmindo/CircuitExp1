/**
 * ZoomContext - Centralized zoom management for all visualization modes
 * Provides consistent zoom behavior across the entire application
 */

import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';

export interface ZoomState {
  scale: number;
  minScale: number;
  maxScale: number;
  zoomStep: number;
  smoothZoom: boolean;
}

export interface ViewportState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoomContextValue {
  // Current state
  scale: number;
  viewport: ViewportState;
  
  // Zoom actions
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (scale: number, centerX?: number, centerY?: number) => void;
  zoomToFit: () => void;
  zoomToArea: (x1: number, y1: number, x2: number, y2: number) => void;
  
  // Pan actions
  panTo: (x: number, y: number) => void;
  panBy: (dx: number, dy: number) => void;
  
  // Settings
  setZoomSettings: (settings: Partial<ZoomState>) => void;
  getZoomSettings: () => ZoomState;
  
  // Reset
  reset: () => void;
}

const ZoomContext = createContext<ZoomContextValue | undefined>(undefined);

const DEFAULT_ZOOM_STATE: ZoomState = {
  scale: 1,
  minScale: 0.1,
  maxScale: 10,
  zoomStep: 0.2,
  smoothZoom: true,
};

const DEFAULT_VIEWPORT: ViewportState = {
  x: 0,
  y: 0,
  width: 800,
  height: 600,
};

export interface ZoomProviderProps {
  children: React.ReactNode;
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  onZoomChange?: (scale: number) => void;
  onViewportChange?: (viewport: ViewportState) => void;
}

export const ZoomProvider: React.FC<ZoomProviderProps> = ({
  children,
  initialScale = 1,
  minScale = 0.1,
  maxScale = 10,
  onZoomChange,
  onViewportChange,
}) => {
  const [zoomState, setZoomState] = useState<ZoomState>({
    ...DEFAULT_ZOOM_STATE,
    scale: initialScale,
    minScale,
    maxScale,
  });

  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);
  const animationRef = useRef<number | null>(null);

  // Notify external listeners
  useEffect(() => {
    onZoomChange?.(zoomState.scale);
  }, [zoomState.scale, onZoomChange]);

  useEffect(() => {
    onViewportChange?.(viewport);
  }, [viewport, onViewportChange]);

  const clampScale = useCallback((scale: number) => {
    return Math.max(zoomState.minScale, Math.min(zoomState.maxScale, scale));
  }, [zoomState.minScale, zoomState.maxScale]);

  const animateZoom = useCallback((
    targetScale: number,
    centerX?: number,
    centerY?: number
  ) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startScale = zoomState.scale;
    const endScale = clampScale(targetScale);
    const duration = 300; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const newScale = startScale + (endScale - startScale) * easeProgress;
      
      setZoomState(prev => ({ ...prev, scale: newScale }));

      // Adjust viewport to zoom around center point
      if (centerX !== undefined && centerY !== undefined) {
        const scaleDiff = newScale / startScale;
        setViewport(prev => ({
          ...prev,
          x: centerX - (centerX - prev.x) * scaleDiff,
          y: centerY - (centerY - prev.y) * scaleDiff,
        }));
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [zoomState.scale, clampScale]);

  const zoomIn = useCallback(() => {
    const newScale = clampScale(zoomState.scale + zoomState.zoomStep);
    
    if (zoomState.smoothZoom) {
      animateZoom(newScale, viewport.width / 2, viewport.height / 2);
    } else {
      setZoomState(prev => ({ ...prev, scale: newScale }));
    }

    // Emit global event for backward compatibility
    window.dispatchEvent(new CustomEvent('metro:zoomIn'));
  }, [zoomState, viewport, clampScale, animateZoom]);

  const zoomOut = useCallback(() => {
    const newScale = clampScale(zoomState.scale - zoomState.zoomStep);
    
    if (zoomState.smoothZoom) {
      animateZoom(newScale, viewport.width / 2, viewport.height / 2);
    } else {
      setZoomState(prev => ({ ...prev, scale: newScale }));
    }

    // Emit global event for backward compatibility
    window.dispatchEvent(new CustomEvent('metro:zoomOut'));
  }, [zoomState, viewport, clampScale, animateZoom]);

  const zoomTo = useCallback((scale: number, centerX?: number, centerY?: number) => {
    const newScale = clampScale(scale);
    
    if (zoomState.smoothZoom) {
      animateZoom(newScale, centerX, centerY);
    } else {
      setZoomState(prev => ({ ...prev, scale: newScale }));
      
      if (centerX !== undefined && centerY !== undefined) {
        const scaleDiff = newScale / zoomState.scale;
        setViewport(prev => ({
          ...prev,
          x: centerX - (centerX - prev.x) * scaleDiff,
          y: centerY - (centerY - prev.y) * scaleDiff,
        }));
      }
    }
  }, [zoomState, clampScale, animateZoom]);

  const zoomToFit = useCallback(() => {
    // Emit event for stages to calculate and fit all nodes
    window.dispatchEvent(new CustomEvent('metro:fitToView'));
  }, []);

  const zoomToArea = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    
    if (width < 10 || height < 10) return; // Ignore tiny selections

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    // Calculate scale to fit the selected area (with 90% padding)
    const scaleX = viewport.width / width;
    const scaleY = viewport.height / height;
    const targetScale = Math.min(scaleX, scaleY) * 0.9;

    zoomTo(targetScale, centerX, centerY);
  }, [viewport, zoomTo]);

  const panTo = useCallback((x: number, y: number) => {
    setViewport(prev => ({ ...prev, x, y }));
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const setZoomSettings = useCallback((settings: Partial<ZoomState>) => {
    setZoomState(prev => ({ ...prev, ...settings }));
  }, []);

  const getZoomSettings = useCallback(() => {
    return { ...zoomState };
  }, [zoomState]);

  const reset = useCallback(() => {
    setZoomState({
      ...DEFAULT_ZOOM_STATE,
      minScale: zoomState.minScale,
      maxScale: zoomState.maxScale,
    });
    setViewport(DEFAULT_VIEWPORT);
    window.dispatchEvent(new CustomEvent('metro:fitToView'));
  }, [zoomState.minScale, zoomState.maxScale]);

  // Listen to window resize to update viewport dimensions
  useEffect(() => {
    const updateViewportSize = () => {
      const container = document.querySelector('.visualization-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        setViewport(prev => ({
          ...prev,
          width: rect.width,
          height: rect.height,
        }));
      }
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const value: ZoomContextValue = {
    scale: zoomState.scale,
    viewport,
    zoomIn,
    zoomOut,
    zoomTo,
    zoomToFit,
    zoomToArea,
    panTo,
    panBy,
    setZoomSettings,
    getZoomSettings,
    reset,
  };

  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
};

// Custom hook to use zoom context
export const useZoom = (): ZoomContextValue => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
};

// Optional: Hook with fallback for backward compatibility
export const useZoomOptional = (): ZoomContextValue | null => {
  return useContext(ZoomContext);
};
