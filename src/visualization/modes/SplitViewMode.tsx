import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResponsiveMetroStage from '../../components/ResponsiveMetroStage';
import type { LayoutNodeLite, RouteCommand } from '../stage/types';

export interface SplitViewModeProps {
  layout?: LayoutNodeLite[];
  routes?: RouteCommand[];
  onNodeClick?: (path: string) => void;
  onNodeHover?: (path: string | null) => void;
  onLayoutUpdate?: (layout: LayoutNodeLite[]) => void;
  theme?: any;
  debug?: boolean;
}

// Lightweight sync via global events; both stages listen to metro:centerOnPath
const SplitViewMode: React.FC<SplitViewModeProps> = (props) => {
  const [split, setSplit] = useState<number>(50); // percentage width for left pane
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [_selected, _setSelected] = useState<string | null>(null);
  const [_hovered, _setHovered] = useState<string | null>(null);

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
  }), [split]);

  const rightStyle: React.CSSProperties = useMemo(() => ({
    minWidth: 0,
    width: `${100 - split}%`,
  }), [split]);

  const barStyle: React.CSSProperties = {
    cursor: 'col-resize',
    width: 6,
    background: 'linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.15), rgba(0,0,0,0.05))',
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={leftStyle}>
        <ResponsiveMetroStage
          {...props}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
        />
      </div>
      <div role="separator" aria-orientation="vertical" tabIndex={0} style={barStyle} onMouseDown={onMouseDown} />
      <div style={rightStyle}>
        <ResponsiveMetroStage
          {...props}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
        />
      </div>
    </div>
  );
};

export default SplitViewMode;
