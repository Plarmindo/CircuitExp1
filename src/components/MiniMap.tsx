import React, { useEffect, useRef } from 'react';
import './styles/MiniMap.css';

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  isDirectory?: boolean;
  // ... other properties
}

interface ViewportBounds {
  centerX: number;
  centerY: number;
  viewportWidth: number;
  viewportHeight: number;
}

interface MiniMapProps {
  layout?: LayoutNode[];
  viewportBounds?: ViewportBounds;
  onViewportChange?: (worldX: number, worldY: number) => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  layout = [],
  viewportBounds,
  onViewportChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);

  // Render the minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || layout.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for high DPI
    const pixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * pixelRatio;
    canvas.height = rect.height * pixelRatio;
    ctx.scale(pixelRatio, pixelRatio);

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Calculate bounds of ALL nodes
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    layout.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    // Add padding
    const padding = 50;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;

    // Calculate scale to fit all nodes
    const scaleX = rect.width / worldWidth;
    const scaleY = rect.height / worldHeight;
    const minimapScale = Math.min(scaleX, scaleY) * 0.9;

    // Center offset
    const offsetX = (rect.width - worldWidth * minimapScale) / 2;
    const offsetY = (rect.height - worldHeight * minimapScale) / 2;

    // Transform world to minimap coordinates
    const worldToMinimap = (x: number, y: number) => ({
      x: (x - minX) * minimapScale + offsetX,
      y: (y - minY) * minimapScale + offsetY
    });

    // Draw ALL nodes (small dots)
    layout.forEach(node => {
      const pos = worldToMinimap(node.x, node.y);
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      
      if (node.isDirectory) {
        ctx.fillStyle = '#29b6f688';
      } else {
        ctx.fillStyle = '#66bb6a88';
      }
      ctx.fill();
    });

    // Draw viewport rectangle if we have viewport bounds
    if (viewportBounds) {
      const { centerX, centerY, viewportWidth, viewportHeight } = viewportBounds;
      
      const topLeft = worldToMinimap(centerX - viewportWidth, centerY - viewportHeight);
      const bottomRight = worldToMinimap(centerX + viewportWidth, centerY + viewportHeight);

      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
      );

      // Fill with semi-transparent color
      ctx.fillStyle = '#ffb30033';
      ctx.fillRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
      );
    }
  }, [layout, viewportBounds]);

  // Handle minimap interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || layout.length === 0 || !onViewportChange) return;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      updateViewport(e);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        updateViewport(e);
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      canvas.style.cursor = 'grab';
    };

    const updateViewport = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const minimapX = e.clientX - rect.left;
      const minimapY = e.clientY - rect.top;

      // Calculate bounds of ALL nodes (same as render)
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      layout.forEach(node => {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      });

      const padding = 50;
      minX -= padding;
      maxX += padding;
      minY -= padding;
      maxY += padding;

      const worldWidth = maxX - minX;
      const worldHeight = maxY - minY;

      const scaleX = rect.width / worldWidth;
      const scaleY = rect.height / worldHeight;
      const minimapScale = Math.min(scaleX, scaleY) * 0.9;

      const offsetX = (rect.width - worldWidth * minimapScale) / 2;
      const offsetY = (rect.height - worldHeight * minimapScale) / 2;

      // Convert minimap coordinates to world coordinates
      const worldX = (minimapX - offsetX) / minimapScale + minX;
      const worldY = (minimapY - offsetY) / minimapScale + minY;
      
      onViewportChange(worldX, worldY);
      canvas.style.cursor = 'grabbing';
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [layout, onViewportChange]);

  return (
    <canvas
      ref={canvasRef}
      className="minimap-canvas"
      style={{ 
        width: '100%', 
        height: '100%', 
        cursor: 'grab',
        backgroundColor: '#1a1a2e'
      }}
    />
  );
};

export default MiniMap;
