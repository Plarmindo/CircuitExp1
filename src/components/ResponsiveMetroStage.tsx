import React, { useState, useEffect, useRef } from 'react';
import MetroStage from '../visualization/metro-stage';
interface ResponsiveMetroStageProps {}

const ResponsiveMetroStage: React.FC<ResponsiveMetroStageProps> = () => {
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
      <MetroStage width={dimensions.width} height={dimensions.height} />
    </div>
  );
};

export default ResponsiveMetroStage;