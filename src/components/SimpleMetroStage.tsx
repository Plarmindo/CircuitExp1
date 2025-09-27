/**
 * Simple Metro Stage Component
 * A minimal implementation focused on displaying three folders with connecting lines
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application } from 'pixi.js';
import { SimpleMetroRenderer } from '../visualization/simple-metro-renderer';
import { generateThreeFolderMock, generateExtendedMock } from '../visualization/mock-data-generator';
import type { LayoutNodeLite as _LayoutNodeLite, RouteCommand } from '../visualization/stage/types';

export interface SimpleMetroStageProps {
  width?: number;
  height?: number;
  extended?: boolean; // Whether to show the extended version with shared folder
  theme?: {
    background?: string;
    text?: string;
    folder?: string;
    file?: string;
    line?: string;
    selectedOutline?: string;
    hoveredOutline?: string;
  };
  onNodeClick?: (path: string) => void;
  onNodeHover?: (path: string | null) => void;
}

export const SimpleMetroStage: React.FC<SimpleMetroStageProps> = ({
  width = 800,
  height = 400,
  extended = false,
  theme = {},
  onNodeClick,
  onNodeHover,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const rendererRef = useRef<SimpleMetroRenderer | null>(null);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default theme
  const defaultTheme = {
    background: '#1a1a2e',
    text: '#ffffff',
    folder: '#4CAF50',
    file: '#2196F3',
    line: '#95a5a6',
    selectedOutline: '#FF6B35',
    hoveredOutline: '#4ECDC4',
    ...theme,
  };

  // Generate mock data
  const mockData = extended ? generateExtendedMock() : generateThreeFolderMock();

  // Initialize PixiJS application
  const initializePixi = useCallback(async () => {
    if (!containerRef.current || appRef.current) return;

    try {
      const app = new Application();

      await app.init({
        width,
        height,
        backgroundColor: defaultTheme.background,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      // Add canvas to container
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // Initialize renderer
      const renderer = new SimpleMetroRenderer(app);
      rendererRef.current = renderer;

      // Set up interaction handlers
      setupInteractions();

      // Initial render
      renderer.render(mockData.layout, mockData.routes, {
        selectedPath,
        hoveredPath,
        theme: defaultTheme,
      });

      setIsInitialized(true);
      setError(null);

    } catch (err) {
      console.error('Failed to initialize PixiJS:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize graphics');
    }
  }, [width, height, defaultTheme, mockData, selectedPath, hoveredPath]);

  // Set up mouse interactions
  const setupInteractions = useCallback(() => {
    if (!appRef.current || !rendererRef.current) return;

    const app = appRef.current;
    const renderer = rendererRef.current;

    // Handle clicks and hovers
    mockData.layout.forEach((node) => {
      const graphics = renderer.getNodeGraphics(node.path);
      if (!graphics) return;

      // Click handler
      graphics.on('pointerdown', () => {
        const newSelected = selectedPath === node.path ? null : node.path;
        setSelectedPath(newSelected);

        if (onNodeClick) {
          onNodeClick(node.path);
        }

        // Re-render with new selection
        renderer.render(mockData.layout, mockData.routes, {
          selectedPath: newSelected,
          hoveredPath,
          theme: defaultTheme,
        });
      });

      // Hover handlers
      graphics.on('pointerover', () => {
        setHoveredPath(node.path);

        if (onNodeHover) {
          onNodeHover(node.path);
        }

        // Re-render with hover state
        renderer.render(mockData.layout, mockData.routes, {
          selectedPath,
          hoveredPath: node.path,
          theme: defaultTheme,
        });
      });

      graphics.on('pointerout', () => {
        setHoveredPath(null);

        if (onNodeHover) {
          onNodeHover(null);
        }

        // Re-render without hover state
        renderer.render(mockData.layout, mockData.routes, {
          selectedPath,
          hoveredPath: null,
          theme: defaultTheme,
        });
      });
    });

    // Add zoom and pan functionality
    let isDragging = false;
    let lastPointerPosition = { x: 0, y: 0 };

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    app.stage.on('pointerdown', (event) => {
      if (event.target === app.stage) {
        isDragging = true;
        lastPointerPosition = { x: event.globalX, y: event.globalY };
        app.stage.cursor = 'grabbing';
      }
    });

    app.stage.on('pointermove', (event) => {
      if (isDragging) {
        const deltaX = event.globalX - lastPointerPosition.x;
        const deltaY = event.globalY - lastPointerPosition.y;

        app.stage.x += deltaX;
        app.stage.y += deltaY;

        lastPointerPosition = { x: event.globalX, y: event.globalY };
      }
    });

    app.stage.on('pointerup', () => {
      isDragging = false;
      app.stage.cursor = 'default';
    });

    app.stage.on('pointerupoutside', () => {
      isDragging = false;
      app.stage.cursor = 'default';
    });

    // Zoom with mouse wheel
    app.stage.on('wheel', (event) => {
      event.preventDefault();

      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = app.stage.scale.x * scaleFactor;

      // Limit zoom range
      if (newScale >= 0.1 && newScale <= 3) {
        app.stage.scale.set(newScale);
      }
    });

  }, [mockData, selectedPath, hoveredPath, defaultTheme, onNodeClick, onNodeHover]);

  // Handle window resize
  const handleResize = useCallback(() => {
    if (!appRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const newWidth = container.clientWidth || width;
    const newHeight = container.clientHeight || height;

    appRef.current.renderer.resize(newWidth, newHeight);
  }, [width, height]);

  // Initialize on mount
  useEffect(() => {
    initializePixi();

    // Handle resize
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);

      // Cleanup
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [initializePixi, handleResize]);

  // Re-render when props change
  useEffect(() => {
    if (isInitialized && rendererRef.current) {
      rendererRef.current.render(mockData.layout, mockData.routes, {
        selectedPath,
        hoveredPath,
        theme: defaultTheme,
      });
    }
  }, [isInitialized, mockData, selectedPath, hoveredPath, defaultTheme]);

  if (error) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: defaultTheme.background,
          color: defaultTheme.text,
          border: '1px solid #ccc',
          borderRadius: '4px',
        }}
      >
        <div>
          <h3>Graphics Error</h3>
          <p>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsInitialized(false);
              initializePixi();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: defaultTheme.folder,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        border: '1px solid #ccc',
        borderRadius: '4px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {!isInitialized && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: defaultTheme.text,
            fontSize: '14px',
          }}
        >
          Initializing Metro Map...
        </div>
      )}
    </div>
  );
};

export default SimpleMetroStage;
