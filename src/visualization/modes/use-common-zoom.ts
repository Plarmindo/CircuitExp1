/**
 * Common zoom handlers hook for all visualization modes
 * Provides standardized zoom functionality across all modes
 */

import { useCallback, useEffect, useState } from 'react';
import { useZoom } from '../../contexts/ZoomContext';

export interface UseCommonZoomReturn {
  // Zoom state
  scale: number;
  isWindowZoomMode: boolean;
  
  // Zoom handlers
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetView: () => void;
  handleToggleWindowZoom: () => void;
  
  // State setters (for internal use)
  setIsWindowZoomMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
}

/**
 * Hook that provides common zoom functionality for all visualization modes
 * 
 * @returns Object containing zoom state and handlers
 * 
 * @example
 * const { scale, isWindowZoomMode, handleZoomIn, handleZoomOut, handleResetView, handleToggleWindowZoom } = useCommonZoom();
 */
export function useCommonZoom(): UseCommonZoomReturn {
  const { scale, zoomIn, zoomOut, reset, zoomToFit, zoomToArea } = useZoom();
  const [isWindowZoomMode, setIsWindowZoomMode] = useState(false);

  const handleZoomIn = useCallback(() => {
    zoomIn();
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
  }, [zoomOut]);

  const handleResetView = useCallback(() => {
    reset();
    zoomToFit(); // CAD-style fit-to-view
  }, [reset, zoomToFit]);
  
  const handleToggleWindowZoom = useCallback(() => {
    setIsWindowZoomMode(prev => !prev);
  }, []);
  
  // Listen for window zoom area selection from stage
  useEffect(() => {
    const handleAreaSelected = (e: Event) => {
      const event = e as CustomEvent<{ x1: number; y1: number; x2: number; y2: number }>;
      if (event.detail) {
        const { x1, y1, x2, y2 } = event.detail;
        zoomToArea(x1, y1, x2, y2);
        setIsWindowZoomMode(false); // Turn off window zoom mode after selection
      }
    };
    
    window.addEventListener('metro:areaSelected', handleAreaSelected);
    return () => window.removeEventListener('metro:areaSelected', handleAreaSelected);
  }, [zoomToArea]);

  return {
    scale,
    isWindowZoomMode,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleToggleWindowZoom,
    setIsWindowZoomMode,
  };
}
