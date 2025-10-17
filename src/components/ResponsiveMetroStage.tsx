import React, { useRef, useEffect, useState } from 'react';
import './styles/ResponsiveMetroStage.css';
import { MetroStageSVG as MetroStage } from '../visualization/stage/metro-stage-svg';
import type { LayoutNodeLite, RouteCommand, ThemeConfig } from '../visualization/stage/types';

type ResponsiveMetroStageProps = {
  // Direct MetroStage props
  layout?: LayoutNodeLite[];
  routes?: RouteCommand[];
  onNodeClick?: (path: string) => void;
  onNodeHover?: (path: string | null) => void;
  onLayoutUpdate?: (layout: LayoutNodeLite[]) => void;
  theme?: ThemeConfig;
  debug?: boolean;
  lineWidthMm?: number;

  // Container props
  width?: number;
  height?: number;
  children?: React.ReactNode;
  onResize?: (width: number, height: number) => void;
  controls?: React.ReactNode;
};

export const ResponsiveMetroStage: React.FC<ResponsiveMetroStageProps> = ({
  layout,
  routes,
  onNodeClick,
  onNodeHover,
  onLayoutUpdate,
  theme,
  debug,
  lineWidthMm,
  width,
  height,
  children,
  onResize,
  controls
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: width || 0, height: height || 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
        onResize?.(clientWidth, clientHeight);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [onResize]);

  useEffect(() => {
    if (width !== undefined && height !== undefined) {
      setDimensions({ width, height });
    }
  }, [width, height]);

  return (
    <div className="responsive-stage" ref={containerRef}>
      <div className="stage-content">
        {children || (
          <MetroStage
            layout={layout}
            routes={routes}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onLayoutUpdate={onLayoutUpdate}
            theme={theme}
            debug={debug}
            lineWidthMm={lineWidthMm}
            width={dimensions.width}
            height={dimensions.height}
          />
        )}
      </div>
      {controls && (
        <div className="stage-controls">
          {controls}
        </div>
      )}
    </div>
  );
};

export default ResponsiveMetroStage;
