import React, { useEffect, useRef, useState } from 'react';
import './styles/DraggableWindow.css';

interface DraggableWindowProps {
  title: string;
  id: string; // Unique identifier for saving position
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  onClose?: () => void;
  className?: string;
}

interface Position {
  x: number;
  y: number;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  title,
  id,
  children,
  defaultPosition = { x: 20, y: 20 },
  onClose,
  className = '',
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>(() => {
    // Load saved position from localStorage
    const saved = localStorage.getItem(`window-position-${id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultPosition;
      }
    }
    return defaultPosition;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Save position when it changes
  useEffect(() => {
    localStorage.setItem(`window-position-${id}`, JSON.stringify(position));
  }, [position, id]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if clicking on the header (not close button or content)
    if ((e.target as HTMLElement).closest('.draggable-window-close')) {
      return;
    }
    if ((e.target as HTMLElement).closest('.draggable-window-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Keep window within viewport bounds
      const windowEl = windowRef.current;
      if (windowEl) {
        const rect = windowEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        setPosition({
          x: Math.max(0, Math.min(maxX, newX)),
          y: Math.max(0, Math.min(maxY, newY)),
        });
      }
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
  }, [isDragging, dragStart]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      ref={windowRef}
      className={`draggable-window ${className} ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
      }}
    >
      <div
        className="draggable-window-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        title="Drag to move window"
      >
        <span className="draggable-window-title">{title}</span>
        <button
          className="draggable-window-close"
          onClick={handleClose}
          title="Close"
          aria-label="Close window"
        >
          ×
        </button>
      </div>
      <div className="draggable-window-content">
        {children}
      </div>
    </div>
  );
};

export default DraggableWindow;
