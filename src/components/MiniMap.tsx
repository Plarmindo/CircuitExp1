import React, { useEffect, useRef } from 'react';

// Lightweight minimap that samples layout points from window.__metroDebug.getNodes()
// and draws tiny rectangles scaled into a 200x120 canvas.
export const MiniMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let frame: number;
    const draw = () => {
  const dbg = (window as unknown as { __metroDebug?: { getNodes?: () => Array<{ x: number; y: number; aggregated?: boolean }> } }).__metroDebug;
      const canvas = canvasRef.current;
      if (!canvas) { frame = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { frame = requestAnimationFrame(draw); return; }
      const w = canvas.width; const h = canvas.height;
      ctx.clearRect(0,0,w,h);
  const nodes = dbg?.getNodes ? dbg.getNodes() : [];
      if (!nodes.length) {
        ctx.fillStyle = '#555';
        ctx.font = '10px sans-serif';
        ctx.fillText('No data', 6, 14);
        frame = requestAnimationFrame(draw);
        return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        if (typeof n.x === 'number' && typeof n.y === 'number') {
          if (n.x < minX) minX = n.x;
          if (n.y < minY) minY = n.y;
          if (n.x > maxX) maxX = n.x;
          if (n.y > maxY) maxY = n.y;
        }
      }
      if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) { frame = requestAnimationFrame(draw); return; }
      const spanX = maxX - minX || 1; const spanY = maxY - minY || 1;
      const pad = 4;
      for (const n of nodes) {
        const nx = (n.x - minX) / spanX; const ny = (n.y - minY) / spanY;
        const size = n.aggregated ? 3 : 2;
        ctx.fillStyle = n.aggregated ? '#f59e0b' : '#60a5fa';
        ctx.fillRect(pad + nx * (w - pad*2) - size/2, pad + ny * (h - pad*2) - size/2, size, size);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} width={200} height={120} style={{ width: '100%', height: '100%' }} />;
};

export default MiniMap;
