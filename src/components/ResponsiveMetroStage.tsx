import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import type { LayoutNodeLite, RouteCommand } from '../visualization/stage/types';

// Dynamic import of MetroStage enables code splitting
const LazyMetroStage = lazy(() => import('../visualization/stage'));

interface ResponsiveMetroStageProps {
  layout?: LayoutNodeLite[];
  routes?: RouteCommand[];
  onNodeClick?: (path: string) => void;
  onNodeHover?: (path: string | null) => void;
  onLayoutUpdate?: (layout: LayoutNodeLite[]) => void;
  theme?: any;
  debug?: boolean;
}

const ResponsiveMetroStage: React.FC<ResponsiveMetroStageProps> = ({
  layout = [],
  routes = [],
  onNodeClick,
  onNodeHover,
  onLayoutUpdate,
  theme,
  debug = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    // Initial dimensions
    updateDimensions();

    // Use ResizeObserver for more accurate dimension tracking
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      resizeObserver.observe(containerRef.current);
    }

    // Handle resize events
    const handleResize = () => {
      updateDimensions();
    };

    // Listen to panel events for immediate resize
    const handlePanelChange = () => {
      // Small delay to allow CSS transitions to complete
      setTimeout(updateDimensions, 150);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('panel:minimized', handlePanelChange);
    window.addEventListener('panel:maximized', handlePanelChange);

    // Also listen for window state changes
    window.addEventListener('maximize', handleResize);
    window.addEventListener('unmaximize', handleResize);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('panel:minimized', handlePanelChange);
      window.removeEventListener('panel:maximized', handlePanelChange);
      window.removeEventListener('maximize', handleResize);
      window.removeEventListener('unmaximize', handleResize);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Suspense fallback={null}>
        <LazyMetroStage
          width={dimensions.width}
          height={dimensions.height}
          layout={layout}
          routes={routes}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          onLayoutUpdate={onLayoutUpdate}
          theme={theme}
          debug={debug}
        />
      </Suspense>
    </div>
  );
};

export default ResponsiveMetroStage;

// Remove trailing LazyMetroStage declaration
