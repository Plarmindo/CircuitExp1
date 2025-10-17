/**
 * DraggablePanel - Reusable draggable panel component with position persistence
 * Allows panels to be dragged around the screen and saves their position to localStorage
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './styles/DraggablePanel.css';

export interface DraggablePanelProps {
  id: string; // Unique ID for localStorage
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  collapsible?: boolean;
  resizable?: boolean;
  className?: string;
  onClose?: () => void;
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

const DEFAULT_POSITION: Position = { x: 20, y: 20 };
const DEFAULT_SIZE: Size = { width: 320, height: 400 };

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  id,
  title,
  children,
  defaultPosition = DEFAULT_POSITION,
  defaultSize = DEFAULT_SIZE,
  collapsible = true,
  resizable = false,
  className = '',
  onClose,
}) => {
  // Load initial position from localStorage or use default
  const getInitialPosition = (): Position => {
    try {
      const savedState = localStorage.getItem(`draggable-panel-${id}`);
      if (savedState) {
        const { position: savedPos } = JSON.parse(savedState);
        if (savedPos) return savedPos;
      }
    } catch (e) {
      console.error('[DraggablePanel] Failed to load saved position:', e);
    }
    return defaultPosition;
  };

  // Load initial size from localStorage or use default
  const getInitialSize = (): Size => {
    try {
      const savedState = localStorage.getItem(`draggable-panel-${id}`);
      if (savedState) {
        const { size: savedSize } = JSON.parse(savedState);
        if (savedSize) return savedSize;
      }
    } catch (e) {
      console.error('[DraggablePanel] Failed to load saved size:', e);
    }
    return defaultSize;
  };

  // Load initial collapsed state from localStorage
  const getInitialCollapsed = (): boolean => {
    try {
      const savedState = localStorage.getItem(`draggable-panel-${id}`);
      if (savedState) {
        const { collapsed: savedCollapsed } = JSON.parse(savedState);
        if (savedCollapsed !== undefined) return savedCollapsed;
      }
    } catch (e) {
      console.error('[DraggablePanel] Failed to load collapsed state:', e);
    }
    return false;
  };

  const [position, setPosition] = useState<Position>(getInitialPosition);
  const [size, setSize] = useState<Size>(getInitialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  
  const panelRef = useRef<HTMLDivElement>(null);

  // Save position, size, and collapsed state to localStorage
  const saveState = useCallback(() => {
    const state = {
      position,
      size,
      collapsed,
    };
    localStorage.setItem(`draggable-panel-${id}`, JSON.stringify(state));
  }, [id, position, size, collapsed]);

  // Save state whenever it changes
  useEffect(() => {
    saveState();
  }, [saveState]);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.panel-header')) {
      e.preventDefault();
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        setIsDragging(true);
      }
    }
  }, []);

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep panel within viewport bounds
      const maxX = window.innerWidth - (size.width || 320);
      const maxY = window.innerHeight - 50; // Keep header visible

      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, size.width]);

  // Handle resize start
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  // Handle resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        const newWidth = Math.max(200, e.clientX - rect.left);
        const newHeight = Math.max(150, e.clientY - rect.top);
        
        setSize({
          width: Math.min(newWidth, window.innerWidth - position.x),
          height: Math.min(newHeight, window.innerHeight - position.y),
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, position]);

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${size.width}px`,
    height: collapsed ? 'auto' : `${size.height}px`,
    zIndex: isDragging ? 10000 : 1000,
    cursor: isDragging ? 'grabbing' : 'default',
  };

  return (
    <div
      ref={panelRef}
      className={`draggable-panel ${className} ${collapsed ? 'collapsed' : ''} ${isDragging ? 'dragging' : ''}`}
      style={panelStyle}
    >
      <div
        className="panel-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: 'grab' }}
      >
        <span className="panel-title">{title}</span>
        <div className="panel-controls">
          {collapsible && (
            <button
              className="panel-control-btn"
              onClick={toggleCollapse}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '▼' : '▲'}
            </button>
          )}
          {onClose && (
            <button
              className="panel-control-btn"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="panel-content">
            {children}
          </div>

          {resizable && (
            <div
              className="panel-resize-handle"
              onMouseDown={handleResizeMouseDown}
              title="Drag to resize"
            />
          )}
        </>
      )}
    </div>
  );
};

export default DraggablePanel;
