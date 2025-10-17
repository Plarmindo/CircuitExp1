import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResponsiveMetroStage from '../../components/ResponsiveMetroStage';
import { MapControls } from '../../components/MapControls';
import { MapSettingsControls } from '../../components/MapSettingsControls';
import { useCommonZoom } from './use-common-zoom';
import type { CommonModeProps } from './common-mode-interface';

// SplitViewMode uses standard CommonModeProps
export type SplitViewModeProps = CommonModeProps;

// Lightweight sync via global events; both stages listen to metro:centerOnPath
const SplitViewMode: React.FC<SplitViewModeProps> = (props) => {
  // Use common zoom hook (standardized across all modes)
  const { scale, isWindowZoomMode, handleZoomIn, handleZoomOut, handleResetView, handleToggleWindowZoom } = useCommonZoom();

  const [split, setSplit] = useState<number>(50); // percentage width for left pane
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [_selected, setSelected] = useState<string | null>(null);
  const [_hovered, setHovered] = useState<string | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(20, Math.min(80, pct));
    setSplit(clamped);
    // Inform stages about resize so they can adjust canvas
    window.dispatchEvent(new CustomEvent('metro:panelResize'));
  }, [dragging]);

  const onMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, onMouseMove, onMouseUp]);

  const handleNodeClick = useCallback((p: string) => {
    setSelected(p);
    props.onNodeClick?.(p);
    // broadcast to both views to align center
    window.dispatchEvent(new CustomEvent('metro:centerOnPath', { detail: { path: p } }));
  }, [props]);

  const handleNodeHover = useCallback((p: string | null) => {
    setHovered(p);
    props.onNodeHover?.(p);
  }, [props]);

  const leftStyle: React.CSSProperties = useMemo(() => ({
    minWidth: 0,
    width: `${split}%`,
    height: '100%',
  }), [split]);

  const rightStyle: React.CSSProperties = useMemo(() => ({
    minWidth: 0,
    width: `${100 - split}%`,
    height: '100%',
  }), [split]);

  const barStyle: React.CSSProperties = {
    cursor: 'col-resize',
    width: 6,
    background: 'linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.15), rgba(0,0,0,0.05))',
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
      {/* Single shared MapControls for both panes - centralized zoom with CAD functions */}
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onToggleWindowZoom={handleToggleWindowZoom}
        zoomLevel={scale}
        isWindowZoomActive={isWindowZoomMode}
      />

      {/* Map Settings Controls - always visible */}
      <MapSettingsControls
        position="bottom-left"
        compact={false}
      />

      <div style={leftStyle}>
        <ResponsiveMetroStage
          {...props}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          lineWidthMm={1}
        />
      </div>
      <div role="separator" aria-orientation="vertical" tabIndex={0} style={barStyle} onMouseDown={onMouseDown} />
      <div style={rightStyle}>
        <ResponsiveMetroStage
          {...props}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          lineWidthMm={1}
        />
      </div>
    </div>
  );
};

export default SplitViewMode;
