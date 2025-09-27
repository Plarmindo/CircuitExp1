import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

export type MetroNode = {
  id: string;
  name: string;
  type: 'main' | 'subfolder' | 'file';
  path: string;
  x: number;
  y: number;
  lineColor: string;
  lineName: string;
  size: number;
};

// New: lightweight file metadata for chips
export type FileMeta = {
  name: string;
  size: number; // bytes
  ext: string;
  modifiedMs: number;
  kind: 'code' | 'doc' | 'image' | 'audio' | 'video' | 'archive' | 'binary' | 'other';
};

export interface CanvasMetroMapProps {
  width?: number;
  height?: number;
  rootPath?: string;
  onNodeClick?: (node: MetroNode) => void;
  onNodeHover?: (node: MetroNode | null) => void;
  viewCenterX?: number;
  viewCenterY?: number;
  rootElementX?: number;
  rootElementY?: number;
  // New optional controls for a single-line sequence mode
  mode?: 'full' | 'line';
  lineStations?: number;
  lineName?: string;
  lineColor?: string;
  lineAngleDeg?: number; // 0 = horizontal →, 90 = down
  stationSpacing?: number;
  // New: file rendering options
  showFiles?: boolean;
  maxFilesPerStation?: number;
  filesByPath?: Record<string, FileMeta[]>;
  onFileClick?: (file: FileMeta, station: MetroNode) => void;
  onFileHover?: (file: FileMeta | null, station: MetroNode | null) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const CanvasMetroMap: React.FC<CanvasMetroMapProps> = ({
  width = 1000,
  height = 600,
  rootPath = '/root',
  onNodeClick,
  onNodeHover,
  viewCenterX,
  viewCenterY,
  rootElementX,
  rootElementY,
  // New props with defaults
  mode = 'full',
  lineStations = 12,
  lineName = 'Line',
  lineColor = '#DC241F',
  lineAngleDeg = 0,
  stationSpacing = 80,
  // Files defaults
  showFiles = true,
  maxFilesPerStation = 6,
  filesByPath,
  onFileClick,
  onFileHover,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // World/view state
  const [zoom, setZoom] = useState(1.5);
  const [viewportCenter, setViewportCenter] = useState<{ x: number; y: number }>(() => ({
    x: viewCenterX ?? width / 2,
    y: viewCenterY ?? height / 2,
  }));

  const [hovered, setHovered] = useState<MetroNode | null>(null);
  const [selected, setSelected] = useState<MetroNode | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  // New: hovered file chip tracking
  const [hoveredFile, setHoveredFile] = useState<{ file: FileMeta; station: MetroNode } | null>(null);
  const chipsRef = useRef<{ x: number; y: number; r: number; file: FileMeta; station: MetroNode }[]>([]);

  // Data generation: supports 'full' (multi-line) or 'line' (single sequence)
  const { nodes, lines } = useMemo(() => {
    const cx = rootElementX ?? width / 2;
    const cy = rootElementY ?? height / 2;

    if (mode === 'line') {
      const outNodes: MetroNode[] = [];
      const points: { x: number; y: number }[] = [];

      const angle = (lineAngleDeg * Math.PI) / 180;
      const total = Math.max(2, Math.floor(lineStations));
      const half = (total - 1) / 2;

      for (let i = 0; i < total; i++) {
        const t = i - half;
        const x = cx + Math.cos(angle) * (t * stationSpacing);
        const y = cy + Math.sin(angle) * (t * stationSpacing);
        const node: MetroNode = {
          id: `${lineName.toLowerCase()}-${i}`,
          name: `${lineName} ${i + 1}`,
          type: i < total - 1 ? 'subfolder' : 'file',
          path: `${rootPath}/${lineName}/${lineName}-${i + 1}`,
          x,
          y,
          lineColor: lineColor,
          lineName: lineName,
          size: i === Math.floor(half) ? 12 : 10,
        };
        outNodes.push(node);
        points.push({ x, y });
      }

      return {
        nodes: outNodes,
        lines: [{ color: lineColor, points }],
      };
    }

    // Default: multi-line compact full map
    const lineDefs = [
      { name: 'Central', color: '#DC241F', dir: 0, stations: 10 },
      { name: 'Piccadilly', color: '#0019A8', dir: 60, stations: 9 },
      { name: 'District', color: '#007229', dir: 120, stations: 8 },
      { name: 'Circle', color: '#FFD329', dir: 200, stations: 9 },
      { name: 'Metropolitan', color: '#9B0058', dir: 300, stations: 8 },
    ];

    const outNodes: MetroNode[] = [];
    const outLines: { color: string; points: { x: number; y: number }[] }[] = [];

    // Main hub
    outNodes.push({
      id: 'main-0',
      name: 'Main Hub',
      type: 'main',
      path: `${rootPath}/Main`,
      x: cx,
      y: cy,
      lineColor: '#333',
      lineName: 'Hub',
      size: 14,
    });

    for (const def of lineDefs) {
      const angle = (def.dir * Math.PI) / 180;
      const pts: { x: number; y: number }[] = [{ x: cx, y: cy }];
      for (let i = 1; i <= def.stations; i++) {
        const dist = 70 + i * 45;
        const sway = (i % 2 ? -1 : 1) * i * 0.07;
        const x = cx + Math.cos(angle + sway) * dist;
        const y = cy + Math.sin(angle + sway) * dist;
        const node: MetroNode = {
          id: `${def.name.toLowerCase()}-${i}`,
          name: `${def.name} ${i}`,
          type: i < def.stations - 1 ? 'subfolder' : 'file',
          path: `${rootPath}/${def.name}/${def.name}-${i}`,
          x,
          y,
          lineColor: def.color,
          lineName: def.name,
          size: i < 4 ? 12 : i < 7 ? 10 : 8,
        };
        outNodes.push(node);
        pts.push({ x, y });
      }
      outLines.push({ color: def.color, points: pts });
    }

    return { nodes: outNodes, lines: outLines };
  }, [
    width,
    height,
    rootPath,
    rootElementX,
    rootElementY,
    mode,
    lineStations,
    lineName,
    lineColor,
    lineAngleDeg,
    stationSpacing,
  ]);

  // Debug hooks for MiniMap and devtools
  useEffect(() => {
    const g = (window as unknown as { __metroDebug?: unknown }).__metroDebug ?? {};
    g.getNodes = () => nodes;
    g.centerViewportAt = (x: number, y: number) => setViewportCenter({ x, y });
    (window as unknown as { __metroDebug?: unknown }).__metroDebug = g;
  }, [nodes]);

  // Listen to programmatic center requests by path
  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        const ce = ev as CustomEvent<{ path?: string }>;
        const path = ce?.detail?.path;
        if (!path) return;
        const target = nodes.find((n) => n.path.toLowerCase() === path.toLowerCase());
        if (target) {
          setSelected(target);
          setViewportCenter({ x: target.x, y: target.y });
        }
      } catch (e) {
        console.error('metro:centerOnPath handler error', e);
      }
    };
    window.addEventListener('metro:centerOnPath', handler as EventListener);
    return () => window.removeEventListener('metro:centerOnPath', handler as EventListener);
  }, [nodes]);

  const dpr = Math.max(1, Math.min(3, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));

  const worldToScreen = useCallback(
    (wx: number, wy: number, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return {
        x: (wx - viewportCenter.x) * zoom + cx,
        y: (wy - viewportCenter.y) * zoom + cy,
      };
    },
    [viewportCenter.x, viewportCenter.y, zoom]
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return {
        x: (sx - cx) / zoom + viewportCenter.x,
        y: (sy - cy) / zoom + viewportCenter.y,
      };
    },
    [viewportCenter.x, viewportCenter.y, zoom]
  );

  // Resize canvas to DPR
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = width, h = height;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }, [width, height, dpr]);

  useEffect(() => { resizeCanvas(); }, [resizeCanvas]);

  // Deterministic file generation for demo when filesByPath not provided
  const filePalette: Record<FileMeta['kind'], string> = {
    code: '#3FA7D6',
    doc: '#5C6BC0',
    image: '#E57373',
    audio: '#4DB6AC',
    video: '#9575CD',
    archive: '#FBC02D',
    binary: '#90A4AE',
    other: '#BDBDBD',
  };

  const extToKind = (ext: string): FileMeta['kind'] => {
    const e = ext.toLowerCase();
    if (['ts', 'tsx', 'js', 'jsx', 'cs', 'java', 'py', 'rb', 'go', 'cpp', 'c', 'json'].includes(e)) return 'code';
    if (['md', 'txt', 'doc', 'docx', 'pdf'].includes(e)) return 'doc';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(e)) return 'image';
    if (['mp3', 'wav', 'flac'].includes(e)) return 'audio';
    if (['mp4', 'mov', 'mkv', 'webm'].includes(e)) return 'video';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive';
    if (['exe', 'dll', 'bin'].includes(e)) return 'binary';
    return 'other';
  };

  const pseudoRand = (seed: number) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  };

  const getFilesForNode = useCallback((n: MetroNode): FileMeta[] => {
    const provided = filesByPath?.[n.path];
    if (provided) return provided;
    // Generate deterministic set from id
    const base = Array.from(n.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const rnd = pseudoRand(base);
    const count = 2 + Math.floor(rnd() * 12);
    const exts = ['ts', 'json', 'png', 'md', 'mp4', 'zip', 'cs', 'pdf'];
    const files: FileMeta[] = [];
    for (let i = 0; i < count; i++) {
      const ext = exts[Math.floor(rnd() * exts.length)];
      const size = Math.floor(1e3 + rnd() * 5e6);
      const modifiedMs = Date.now() - Math.floor(rnd() * 365 * 24 * 3600 * 1000);
      const kind = extToKind(ext);
      files.push({ name: `${n.name.replace(/\s+/g, '_')}_${i + 1}.${ext}`, size, ext, modifiedMs, kind });
    }
    return files;
  }, [filesByPath]);

  // Draw
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // reset chips hit region cache
    chipsRef.current = [];

    // Background
    ctx.fillStyle = '#0f1930';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Grid (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < rect.width; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, rect.height); ctx.stroke();
    }
    for (let gy = 0; gy < rect.height; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(rect.width, gy); ctx.stroke();
    }

    // Lines
    for (const ln of lines) {
      ctx.strokeStyle = ln.color;
      ctx.lineWidth = Math.max(2, 3 * zoom);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ln.points.forEach((p, i) => {
        const s = worldToScreen(p.x, p.y, canvas);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
    }

    // Nodes
    for (const n of nodes) {
      const s = worldToScreen(n.x, n.y, canvas);
      const r = n.size * Math.max(0.7, Math.min(2.2, zoom));
      ctx.beginPath();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = n.lineColor;
      ctx.lineWidth = n.type === 'main' ? 3 : 2;
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (selected && selected.id === n.id) {
        ctx.beginPath();
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        ctx.arc(s.x, s.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (zoom >= 1.2) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.round(11 * Math.max(1, zoom))}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.name, s.x + r + 6, s.y);
      }

      // Files visualization: badge + side-platform chips
      if (showFiles) {
        const files = getFilesForNode(n);
        if (files.length > 0) {
          // Badge (file count)
          const bx = s.x + r * 0.7; const by = s.y - r * 0.9; const br = Math.max(7, Math.min(11, 7 * Math.max(1, zoom)));
          ctx.beginPath();
          ctx.fillStyle = '#FFD54F';
          ctx.strokeStyle = '#222';
          ctx.lineWidth = 1;
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#222';
          ctx.font = `${Math.round(8 * Math.max(1, zoom))}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(files.length), bx, by + 0.5);

          // LOD for chips
          const shouldShowChips = zoom >= 1.25 || (selected && selected.id === n.id) || (hovered && hovered.id === n.id);
          if (shouldShowChips) {
            // Platform direction: use normal to line direction in line mode, else upward
            const theta = mode === 'line' ? (lineAngleDeg * Math.PI) / 180 : -Math.PI / 2;
            const nx = -Math.sin(theta), ny = Math.cos(theta); // normal
            const chipR = clamp(4 * Math.max(0.9, Math.min(1.4, zoom)), 4, 7);
            const gap = 6 + chipR * 0.5;
            const max = Math.min(maxFilesPerStation, files.length);
            for (let i = 0; i < max; i++) {
              const f = files[i];
              const off = r + 10 + i * (chipR * 2 + gap);
              const cx2 = s.x + nx * off;
              const cy2 = s.y + ny * off;
              ctx.beginPath();
              ctx.fillStyle = filePalette[f.kind] || '#BDBDBD';
              ctx.strokeStyle = '#111';
              ctx.lineWidth = 1;
              ctx.arc(cx2, cy2, chipR, 0, Math.PI * 2);
              ctx.fill(); ctx.stroke();
              // cache hit area for hover/click
              chipsRef.current.push({ x: cx2, y: cy2, r: chipR + 2, file: f, station: n });
            }
            if (files.length > maxFilesPerStation) {
              const more = files.length - maxFilesPerStation;
              const off = r + 10 + max * (chipR * 2 + gap);
              const cx3 = s.x + nx * off; const cy3 = s.y + ny * off;
              ctx.beginPath(); ctx.fillStyle = '#ECEFF1'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.arc(cx3, cy3, chipR + 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
              ctx.fillStyle = '#111'; ctx.font = `${Math.round(8 * Math.max(1, zoom))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(`+${more}`, cx3, cy3 + 0.5);
            }
          }
        }
      }
    }

    // Center crosshair (debug)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rect.width / 2 - 8, rect.height / 2);
    ctx.lineTo(rect.width / 2 + 8, rect.height / 2);
    ctx.moveTo(rect.width / 2, rect.height / 2 - 8);
    ctx.lineTo(rect.width / 2, rect.height / 2 + 8);
    ctx.stroke();

    ctx.restore();
  }, [dpr, lines, nodes, selected, worldToScreen, zoom, showFiles, getFilesForNode, hovered, mode, lineAngleDeg, maxFilesPerStation, filePalette]);

  useEffect(() => { render(); }, [render, viewportCenter, zoom, hovered, selected, width, height]);

  // Hover detection and cursor updates
  const updateHover = useCallback((mx: number, my: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const world = screenToWorld(mx, my, canvas);

    // First, check chips hit
    let chipHit: { file: FileMeta; station: MetroNode } | null = null;
    for (const c of chipsRef.current) {
      const dx = c.x - mx; const dy = c.y - my;
      if (dx * dx + dy * dy <= c.r * c.r) { chipHit = { file: c.file, station: c.station }; break; }
    }
    if (chipHit) {
      setHoveredFile(chipHit);
      onFileHover?.(chipHit.file, chipHit.station);
      if (canvas) canvas.style.cursor = 'pointer';
      return;
    } else if (hoveredFile) {
      setHoveredFile(null);
      onFileHover?.(null, null);
    }

    const hit = (() => {
      let best: { n: MetroNode; d: number } | null = null;
      for (const n of nodes) {
        const dx = n.x - world.x, dy = n.y - world.y;
        const r = (n.size + 6) / zoom;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r * r) {
          const d = Math.sqrt(d2);
          if (!best || d < best.d) best = { n, d };
        }
      }
      return best?.n || null;
    })();
    setHovered(hit);
    onNodeHover?.(hit);
    if (canvas) {
      canvas.style.cursor = hit ? 'pointer' : isPanning ? 'grabbing' : 'grab';
    }
  }, [nodes, onNodeHover, screenToWorld, zoom, isPanning, hoveredFile, onFileHover]);

  // Pointer handlers
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 1) return; // left or middle
    setIsPanning(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    const canvas = canvasRef.current; if (canvas) canvas.style.cursor = 'grabbing';
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasPanning = isPanning;
    setIsPanning(false);
    const canvas = canvasRef.current; if (canvas) canvas.style.cursor = hovered ? 'pointer' : 'grab';
    // If it was a click (small movement), select and center
    if (!lastMouseRef.current) return;
    const dx = Math.abs(e.clientX - lastMouseRef.current.x);
    const dy = Math.abs(e.clientY - lastMouseRef.current.y);
    const moved = dx + dy > 4;
    lastMouseRef.current = null;
    if (!moved && !wasPanning) {
      const cvs = canvasRef.current; if (!cvs) return;
      const rect = cvs.getBoundingClientRect();
      const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

      // Prioritize chip click
      for (const c of chipsRef.current) {
        const ddx = c.x - mx; const ddy = c.y - my;
        if (ddx * ddx + ddy * ddy <= c.r * c.r) {
          onFileClick?.(c.file, c.station);
          return;
        }
      }

      const world = screenToWorld(mx, my, cvs);
      let best: { n: MetroNode; d: number } | null = null;
      for (const n of nodes) {
        const dist = Math.hypot(n.x - world.x, n.y - world.y);
        if (dist <= (n.size + 8) / zoom) {
          if (!best || dist < best.d) best = { n, d: dist };
        }
      }
      if (best) {
        setSelected(best.n);
        setViewportCenter({ x: best.n.x, y: best.n.y });
        onNodeClick?.(best.n);
      }
    }
  }, [hovered, isPanning, nodes, onNodeClick, screenToWorld, zoom, onFileClick]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isPanning && lastMouseRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      setViewportCenter(c => ({ x: c.x - dx / zoom, y: c.y - dy / zoom }));
      return;
    }

    updateHover(mx, my);
  }, [isPanning, updateHover, zoom]);

  const onMouseLeave = useCallback(() => {
    const canvas = canvasRef.current; if (canvas) canvas.style.cursor = 'default';
    setHovered(null);
    if (hoveredFile) { setHoveredFile(null); onFileHover?.(null, null); }
  }, [hoveredFile, onFileHover]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const dz = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => clamp(z * dz, 0.3, 4));
  }, []);

  // Sync viewport center if props provided
  useEffect(() => {
    if (typeof viewCenterX === 'number' && typeof viewCenterY === 'number') {
      setViewportCenter({ x: viewCenterX, y: viewCenterY });
    }
  }, [viewCenterX, viewCenterY]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
        style={{ width, height, display: 'block', background: 'transparent', borderRadius: 8, boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset' }}
      />

      {/* HUD */}
      <div
        style={{ position: 'absolute', top: 8, right: 10, color: '#fff', fontSize: 12, background: 'rgba(0,0,0,0.35)', padding: '6px 8px', borderRadius: 6 }}
      >
        Zoom: {zoom.toFixed(2)} | Center: {Math.round(viewportCenter.x)},{Math.round(viewportCenter.y)}
      </div>
    </div>
  );
};

export default CanvasMetroMap;
