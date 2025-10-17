import React, { useState, useMemo } from 'react';
import { type MetroNode, type FileMeta } from './CanvasMetroMap';
import './styles/MetroLineDemo.css';

// Demo helpers: deterministic file generation per-station and lightweight explorers

type FileViewMode = 'icons' | 'details';

function hashString(input: string): number {
  let h = 2166136261; // FNV-1a 32-bit
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXT_SET = ['txt', 'md', 'csv', 'json', 'png', 'jpg', 'gif', 'pdf', 'docx', 'xlsx', 'pptx', 'ts', 'tsx', 'js', 'css'];
const ICON_FOR: Record<string, string> = {
  folder: '📁',
  txt: '📄',
  md: '📝',
  csv: '🧾',
  json: '🧩',
  png: '🖼️',
  jpg: '🖼️',
  gif: '🖼️',
  pdf: '📕',
  docx: '📘',
  xlsx: '📗',
  pptx: '📙',
  ts: '🧑‍💻',
  tsx: '🧑‍💻',
  js: '🧑‍💻',
  css: '🎨',
  default: '📦',
};

function randomName(rnd: () => number, ext?: string, isDir?: boolean) {
  const nouns = ['report', 'invoice', 'design', 'photo', 'song', 'backup', 'plan', 'notes', 'draft', 'summary', 'meeting', 'market', 'budget', 'spec'];
  const idx = Math.floor(rnd() * nouns.length);
  const base = `${nouns[idx]}-${Math.floor(rnd() * 9999)}`;
  return isDir ? base : `${base}.${ext ?? 'txt'}`;
}

function generateStationFiles(station: MetroNode, total = 200): FileMeta[] {
  const seed = hashString(`${station.path || station.name}-${station.lineName || ''}-${total}`);
  const rnd = mulberry32(seed);
  const dirsCount = Math.max(3, Math.floor(total * 0.15));
  const filesCount = total - dirsCount;
  const files: FileMeta[] = [];
  for (let i = 0; i < dirsCount; i++) {
    files.push({
      name: randomName(rnd, undefined, true),
      kind: 'dir',
      ext: '',
      size: 0,
      modified: new Date(Date.now() - Math.floor(rnd() * 1000 * 3600 * 24 * 365)).toISOString(),
      path: `${station.path || ''}`,
    } as unknown as FileMeta);
  }
  for (let i = 0; i < filesCount; i++) {
    const ext = EXT_SET[Math.floor(rnd() * EXT_SET.length)];
    files.push({
      name: randomName(rnd, ext),
      kind: 'file',
      ext,
      size: Math.floor(rnd() * 5_000_000) + 512,
      modified: new Date(Date.now() - Math.floor(rnd() * 1000 * 3600 * 24 * 365)).toISOString(),
      path: `${station.path || ''}`,
    } as unknown as FileMeta);
  }
  // Simple sort: folders first, then by name
  files.sort((a: unknown, b: unknown) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });
  return files;
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

const StationExplorer: React.FC<{ files: FileMeta[]; mode: FileViewMode; title: string }>
  = ({ files, mode, title }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e5e5', background: '#fafafa' }}>
        <strong>{title}</strong>
        <span style={{ marginLeft: 8, color: '#777', fontSize: 12 }}>{files.length} items</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: mode === 'icons' ? 14 : 0 }}>
        {mode === 'icons' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {files.map((f: unknown, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8, borderRadius: 6, border: '1px solid #eee', background: '#fff' }}>
                <div style={{ fontSize: 28 }}>{f.kind === 'dir' ? ICON_FOR.folder : (ICON_FOR[f.ext] || ICON_FOR.default)}</div>
                <div style={{ fontSize: 12, textAlign: 'center', wordBreak: 'break-word' }}>{f.name}</div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e5e5' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e5e5' }}>Type</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #e5e5e5' }}>Size</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e5e5' }}>Modified</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f: unknown, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ marginRight: 8 }}>{f.kind === 'dir' ? ICON_FOR.folder : (ICON_FOR[f.ext] || ICON_FOR.default)}</span>
                    {f.name}
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{f.kind === 'dir' ? 'Folder' : (f.ext?.toUpperCase() || 'File')}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{f.kind === 'dir' ? '' : formatSize(f.size)}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{String(f.modified).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export function MetroLineDemo() {
  const [selectedNode, setSelectedNode] = useState<MetroNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MetroNode | null>(null);
  const [rootPath, setRootPath] = useState('/root');

  // Line-mode specific controls
  const [lineName, setLineName] = useState('Central Line');
  const [lineColor, setLineColor] = useState('#DC241F');
  const [lineStations, setLineStations] = useState(12);
  const [lineAngleDeg, setLineAngleDeg] = useState(0);
  const [stationSpacing, setStationSpacing] = useState(80);
  // File chip controls and state
  const [showFiles, setShowFiles] = useState(true);
  const [maxFilesPerStation, setMaxFilesPerStation] = useState(6);
  const [hoveredFile, setHoveredFile] = useState<FileMeta | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileMeta | null>(null);

  // New: Demo modes & file explorer view
  const [demoMode, setDemoMode] = useState<'drawer' | 'semantic' | 'split'>('drawer');
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>('icons');
  const [zoomLevel, setZoomLevel] = useState(40); // semantic zoom demo only
  const [platformOpen, setPlatformOpen] = useState(false); // semantic drill-in overlay

  const stationFiles = useMemo<FileMeta[]>(() => (selectedNode ? generateStationFiles(selectedNode, 240) : []), [selectedNode]);

  const handleNodeClick = (node: MetroNode) => {
    setSelectedNode(node);
    if (demoMode === 'semantic' && zoomLevel >= 70) {
      setPlatformOpen(true);
    }
  };

  const handleNodeHover = (node: MetroNode | null) => {
    setHoveredNode(node);
  };

  // File chip events
  const handleFileHover = (file: FileMeta | null, station: MetroNode | null) => {
    setHoveredFile(file);
    if (station) setHoveredNode(station);
  };

  const handleFileClick = (file: FileMeta, station: MetroNode) => {
    setSelectedFile(file);
    setSelectedNode(station);
    if (demoMode === 'semantic' && zoomLevel >= 70) setPlatformOpen(true);
  };

  const resetSelection = () => {
    setSelectedNode(null);
    setHoveredNode(null);
    setHoveredFile(null);
    setSelectedFile(null);
    setPlatformOpen(false);
  };

  const sampleRootPaths = ['/root', '/Users/john', '/home/user', 'C:/Projects'];

  return (
    <div className="metro-line-demo">
      <div className="demo-header">
        <h1 className="demo-title">Metro Line Demo</h1>
        <p className="demo-description">
          Experiment with different metro line configurations and see how they render.
        </p>
      </div>

      <div className="demo-controls">
        <div className="control-group">
          <label className="control-label">
            Number of Stations
            <input
              type="number"
              className="control-input"
              value={numStations}
              onChange={(e) => setNumStations(parseInt(e.target.value, 10))}
              min={2}
              max={20}
            />
          </label>
        </div>

        <div className="control-group">
          <label className="control-label">
            Line Color
            <input
              type="color"
              className="control-input"
              value={lineColor}
              onChange={(e) => setLineColor(e.target.value)}
            />
          </label>
        </div>

        <div className="control-group">
          <label className="control-label">
            Station Size
            <input
              type="range"
              className="control-input"
              value={stationSize}
              onChange={(e) => setStationSize(parseInt(e.target.value, 10))}
              min={4}
              max={20}
            />
          </label>
        </div>

        <button
          className="demo-button"
          onClick={regenerateLine}
          disabled={isGenerating}
          title="Generate a new random metro line"
          aria-label="Regenerate line"
        >
          {isGenerating ? 'Generating...' : 'Regenerate Line'}
        </button>
      </div>

      <div className="demo-canvas" ref={canvasContainerRef}>
        <canvas ref={canvasRef} />
      </div>

      <div className="demo-info">
        <h2 className="info-title">Line Information</h2>
        <ul className="info-list">
          <li className="info-item">
            <span className="info-label">Total Length:</span>
            <span className="info-value">{totalLength.toFixed(2)}px</span>
          </li>
          <li className="info-item">
            <span className="info-label">Average Station Distance:</span>
            <span className="info-value">
              {(totalLength / (numStations - 1)).toFixed(2)}px
            </span>
          </li>
          <li className="info-item">
            <span className="info-label">Render Time:</span>
            <span className="info-value">{lastRenderTime}ms</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default MetroLineDemo;