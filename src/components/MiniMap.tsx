import React, { useEffect, useRef, useState } from 'react';

// Minimap interativo com clique e arraste para navegar
export const MiniMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 200, h: 120 });
  const draggingView = useRef(false);
  const dragResize = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const bboxRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);

  // Desenho contínuo
  useEffect(() => {
    let frame: number;
    const draw = () => {
      const dbg = (window as unknown as { __metroDebug?: Record<string, unknown> })
        .__metroDebug as any;
      const canvas = canvasRef.current;
      if (!canvas) {
        frame = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        frame = requestAnimationFrame(draw);
        return;
      }
      canvas.width = size.w * devicePixelRatio;
      canvas.height = size.h * devicePixelRatio;
      canvas.style.width = size.w + 'px';
      canvas.style.height = size.h + 'px';
      ctx.scale(devicePixelRatio, devicePixelRatio);
      ctx.clearRect(0, 0, size.w, size.h);
      const nodes = dbg?.getNodes ? dbg.getNodes() : [];
      if (!nodes || !nodes.length) {
        ctx.fillStyle = '#555';
        ctx.font = '10px sans-serif';
        ctx.fillText('No data', 6, 14);
        frame = requestAnimationFrame(draw);
        return;
      }
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const n of nodes) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
      }
      if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        frame = requestAnimationFrame(draw);
        return;
      }
      bboxRef.current = { minX, minY, maxX, maxY };
      const spanX = maxX - minX || 1;
      const spanY = maxY - minY || 1;
      const pad = 4;
      for (const n of nodes) {
        const nx = (n.x - minX) / spanX;
        const ny = (n.y - minY) / spanY;
        const sz = n.aggregated ? 3 : 2;
        ctx.fillStyle = n.aggregated ? '#f59e0b' : '#60a5fa';
        ctx.fillRect(
          pad + nx * (size.w - pad * 2) - sz / 2,
          pad + ny * (size.h - pad * 2) - sz / 2,
          sz,
          sz
        );
      }
      // viewport retângulo
      try {
        const vp = dbg?.getViewport?.();
        if (vp && bboxRef.current) {
          const scaleFactorX = (size.w - pad * 2) / spanX;
          const scaleFactorY = (size.h - pad * 2) / spanY;
          const viewW = (window.innerWidth / vp.scale) * scaleFactorX;
          const viewH = (window.innerHeight / vp.scale) * scaleFactorY;
          const worldCenterX = -(vp.x - window.innerWidth / 2) / vp.scale;
          const worldCenterY = -(vp.y - window.innerHeight / 2) / vp.scale;
          const nx = (worldCenterX - minX) / spanX;
          const ny = (worldCenterY - minY) / spanY;
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            pad + nx * (size.w - pad * 2) - viewW / 2,
            pad + ny * (size.h - pad * 2) - viewH / 2,
            viewW,
            viewH
          );
        }
      } catch {
        /* ignore viewport drawing errors */
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  const centerAt = (clientX: number, clientY: number) => {
    const dbg = (window as unknown as { __metroDebug?: Record<string, unknown> })
      .__metroDebug as any;
    if (!dbg?.centerViewportAt || !bboxRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const { minX, minY, maxX, maxY } = bboxRef.current;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const pad = 4;
    const nx = (clientX - rect.left - pad) / (rect.width - pad * 2);
    const ny = (clientY - rect.top - pad) / (rect.height - pad * 2);
    const worldX = minX + nx * spanX;
    const worldY = minY + ny * spanY;
    dbg.centerViewportAt(worldX, worldY);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.dataset.resizer === '1') {
      dragResize.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    draggingView.current = true;
    centerAt(e.clientX, e.clientY);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragResize.current && lastPointer.current) {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setSize((s) => ({ w: Math.max(120, s.w + dx), h: Math.max(80, s.h + dy) }));
      return;
    }
    if (!draggingView.current) return;
    centerAt(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    draggingView.current = false;
    dragResize.current = false;
    lastPointer.current = null;
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: size.w, height: size.h }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: dragResize.current ? 'nwse-resize' : 'pointer',
          borderRadius: 4,
        }}
      />
      <div
        data-resizer="1"
        style={{
          position: 'absolute',
          width: 14,
          height: 14,
          right: 2,
          bottom: 2,
          background: 'rgba(255,255,255,0.35)',
          border: '1px solid rgba(0,0,0,0.4)',
          borderRadius: 3,
          cursor: 'nwse-resize',
        }}
        title="Redimensionar"
      />
    </div>
  );
};

export default MiniMap;
