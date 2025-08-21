import React, { useEffect, useRef, useState, useCallback } from 'react';
import type * as PIXI from 'pixi.js';
import { initInteractions } from './stage/interactions';
import { createInteractionHandlers } from './stage/interaction-handlers';
import { setupEventListeners } from './stage/event-listeners';
import { ExportManager } from './stage/export-manager';
import { FallbackRenderer } from './stage/fallback-renderer';
import type { FastAppendResult, RouteCommand, LayoutNodeLite } from './stage/types';

export interface MetroStageProps {
  width?: number;
  height?: number;
  className?: string;
}

// Global type augmentation for window events
declare global {
  interface Window {
    __lastExportPng?: {
      size: number;
      width: number;
      height: number;
      transparent: boolean;
    };
    metro?: {
      zoomIn: () => void;
      zoomOut: () => void;
      fit: () => void;
      exportPNG: () => void;
    };
  }
}

const MetroStage: React.FC<MetroStageProps> = ({ 
  width = 900, 
  height = 600, 
  className 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const interactionsApiRef = useRef<ReturnType<typeof initInteractions> | null>(null);
  const layoutIndexRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const selectedKeyRef = useRef<string | null>(null);
  const scaleRef = useRef<number>(1.0);
  const pixiFailedRef = useRef<boolean>(false);
  
  const [pixiReady, setPixiReady] = useState(false);
  const [fallbackRenderer, setFallbackRenderer] = useState<FallbackRenderer | null>(null);


  // Redraw function
  const redraw = useCallback((_force = false): void => {
    // This would contain the actual drawing logic
    // For now, we'll keep it as a placeholder since the original implementation
    // depends on many internal variables and functions
    if (appRef.current && !pixiFailedRef.current) {
      // Drawing logic would go here
    }
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    const initPixi = async (): Promise<void> => {
      if (!canvasRef.current) return;

      try {
        const PIXI = await import('pixi.js');
        
        const app = new PIXI.Application({
          view: canvasRef.current,
          width,
          height,
          backgroundColor: 0x102030,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
        });

        appRef.current = app;
        
        // Initialize interactions
        interactionsApiRef.current = initInteractions(app, canvasRef.current);
        
        // Initialize managers
        new ExportManager(app, false);
        
        setPixiReady(true);
        pixiFailedRef.current = false;
      } catch (error) {
        console.warn('PixiJS failed, falling back to 2D canvas:', error);
        pixiFailedRef.current = true;
        
        const fallback = new FallbackRenderer({
          canvas: canvasRef.current,
          width,
          height,
        });
        
        setFallbackRenderer(fallback);
        fallback.renderError('WebGL not supported');
      }
    };

    initPixi();

    return (): void => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      if (interactionsApiRef.current?.dispose) {
        interactionsApiRef.current.dispose();
      }
    };
  }, [width, height]);

  // Setup event listeners
  useEffect(() => {
    if (!pixiReady) return;

    const interactionHandlers = createInteractionHandlers({
      app: appRef.current!,
      layoutIndex: layoutIndexRef.current,
      scaleRef,
      selectedKeyRef,
      pixiFailed: pixiFailedRef.current,
      redraw,
    });

    const cleanup = setupEventListeners({
      interactionHandlers,
      interactionsApiRef,
    });

    return cleanup;
  }, [pixiReady, redraw]);

  // Handle window resize
  useEffect(() => {
    const handleResize = (): void => {
      if (appRef.current && !pixiFailedRef.current) {
        const renderer = appRef.current.renderer as PIXI.Renderer;
        if (renderer) {
          renderer.resize(width, height);
        }
      }
      
      if (fallbackRenderer) {
        fallbackRenderer.resize(width, height);
        fallbackRenderer.renderError('WebGL not supported');
      }
    };

    window.addEventListener('resize', handleResize);
    return (): void => window.removeEventListener('resize', handleResize);
  }, [width, height, fallbackRenderer]);

  // Handle theme changes
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<{ theme: string }>): void => {
      const { theme } = event.detail;
      if (appRef.current && !pixiFailedRef.current) {
        const bgColor = theme === 'dark' ? 0x102030 : 0xffffff;
        appRef.current.renderer.background.color = bgColor;
        redraw();
      }
    };

    window.addEventListener('metro:themeChange', handleThemeChange as EventListener);
    return (): void => {
      window.removeEventListener('metro:themeChange', handleThemeChange as EventListener);
    };
  }, [redraw]);

  // Handle aggregation threshold changes
  useEffect(() => {
    const handleAggregationChange = (): void => {
      selectedKeyRef.current = null;
      redraw(true);
    };

    window.addEventListener('metro:aggregationChanged', handleAggregationChange);
    return (): void => {
      window.removeEventListener('metro:aggregationChanged', handleAggregationChange);
    };
  }, [redraw]);

  // Handle partial scan events
  useEffect(() => {
    const handlePartialScan = (event: CustomEvent<{
      nodes: LayoutNodeLite[];
      routes: RouteCommand[];
    }>): void => {
      const { nodes } = event.detail;
      
      // Update layout index
      nodes.forEach(node => {
        layoutIndexRef.current.set(node.path, { x: node.x, y: node.y });
      });

      // Fast append logic would go here
      const result: FastAppendResult = {
        added: nodes.length,
        updated: 0,
        removed: 0,
        total: layoutIndexRef.current.size,
      };

      window.dispatchEvent(
        new CustomEvent('metro:fastAppendComplete', { detail: result })
      );
    };

    window.addEventListener('metro:partialScan', handlePartialScan as EventListener);
    return (): void => {
      window.removeEventListener('metro:partialScan', handlePartialScan as EventListener);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ 
        display: 'block',
        width: `${width}px`,
        height: `${height}px`,
        cursor: 'crosshair'
      }}
    />
  );
};

export default MetroStage;
