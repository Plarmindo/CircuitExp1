import React, { useState, useMemo } from 'react';
import CanvasMetroMap, { type MetroNode, type FileMeta } from './CanvasMetroMap';

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

const MetroLineDemo: React.FC = () => {
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
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1a1a2e', color: 'white', padding: '15px 20px', borderBottom: '3px solid #0078D4' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>🚦 Metro Line Sequence Demo</h1>
        <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
          Single-line metro sequence with adjustable stations, spacing, angle, and color
        </p>
      </div>

      {/* Controls */}
      <div style={{ backgroundColor: 'white', padding: '12px 20px', borderBottom: '1px solid #ddd', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Root Path</label>
          <select value={rootPath} onChange={(e) => setRootPath(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, flex: 1 }}>
            {sampleRootPaths.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* New: Demo Mode selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Demo Mode</label>
          <select value={demoMode} onChange={(e)=>{ setDemoMode(e.target.value as any); setPlatformOpen(false); }} style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, flex: 1 }}>
            <option value="drawer">A — Station Drawer</option>
            <option value="semantic">B — Semantic Zoom + Drill‑in</option>
            <option value="split">C — Split View</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Line Name</label>
          <input value={lineName} onChange={(e) => setLineName(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, flex: 1 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Line Color</label>
          <input type="color" value={lineColor} onChange={(e) => setLineColor(e.target.value)} style={{ width: 44, height: 28, border: '1px solid #ccc', borderRadius: 4 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Stations</label>
          <input
            type="number"
            min={2}
            max={64}
            value={lineStations}
            onChange={(e) => setLineStations(Math.max(2, Math.min(64, Number(e.target.value) || 2)))}
            style={{ padding: '5px 8px', width: 80, border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Angle (°)</label>
          <input
            type="range"
            min={0}
            max={360}
            value={lineAngleDeg}
            onChange={(e) => setLineAngleDeg(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 36, textAlign: 'right' }}>{lineAngleDeg}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Spacing</label>
          <input
            type="range"
            min={40}
            max={150}
            value={stationSpacing}
            onChange={(e) => setStationSpacing(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 36, textAlign: 'right' }}>{stationSpacing}</span>
        </div>
        {/* New: file chip controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Show Files on Map</label>
          <input type="checkbox" checked={showFiles} onChange={(e)=>setShowFiles(e.target.checked)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: showFiles ? 1 : 0.6 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Max Chips</label>
          <input type="range" min={2} max={12} value={maxFilesPerStation} onChange={(e)=>setMaxFilesPerStation(Number(e.target.value))} style={{ flex: 1 }} disabled={!showFiles} />
          <span style={{ minWidth: 36, textAlign: 'right' }}>{maxFilesPerStation}</span>
        </div>

        {/* New: File view mode for explorers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 'bold', fontSize: 13 }}>Explorer View</label>
          <select value={fileViewMode} onChange={(e)=>setFileViewMode(e.target.value as FileViewMode)} style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, flex: 1 }}>
            <option value="icons">Large Icons</option>
            <option value="details">Details</option>
          </select>
        </div>

        {/* Semantic zoom demo control */}
        {(
          <div style={{ display: demoMode === 'semantic' ? 'flex' : 'none', alignItems: 'center', gap: 8 }}>
            <label style={{ fontWeight: 'bold', fontSize: 13 }}>Zoom</label>
            <input type="range" min={0} max={100} value={zoomLevel} onChange={(e)=>setZoomLevel(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ minWidth: 36, textAlign: 'right' }}>{zoomLevel}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={resetSelection} style={{ padding: '8px 12px', backgroundColor: '#0078D4', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Reset</button>
        </div>
      </div>

      {/* Info Panel */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '12px 20px', borderBottom: '1px solid #ddd', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div>
          <strong style={{ color: '#0078D4' }}>Selected Station</strong>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            {selectedNode ? (
              <>
                <div>
                  <strong>Name:</strong> {selectedNode.name}
                </div>
                <div>
                  <strong>Type:</strong> {selectedNode.type}
                </div>
                <div>
                  <strong>Path:</strong> {selectedNode.path}
                </div>
                <div>
                  <strong>Line:</strong> {selectedNode.lineName}
                </div>
              </>
            ) : (
              <span style={{ color: '#999' }}>None</span>
            )}
          </div>
        </div>

        <div>
          <strong style={{ color: '#C19C00' }}>Hovered Station</strong>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            {hoveredNode ? (
              <>
                <div>
                  <strong>Name:</strong> {hoveredNode.name}
                </div>
                <div>
                  <strong>Type:</strong> {hoveredNode.type}
                </div>
                <div>
                  <strong>Path:</strong> {hoveredNode.path}
                </div>
              </>
            ) : (
              <span style={{ color: '#999' }}>None</span>
            )}
          </div>
        </div>

        {/* New: File info */}
        <div>
          <strong style={{ color: '#2E7D32' }}>File Info</strong>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            <div>
              <strong>Hover:</strong>{' '}
              {hoveredFile ? `${hoveredFile.name} (${hoveredFile.kind})` : <span style={{ color: '#999' }}>None</span>}
            </div>
            <div>
              <strong>Selected:</strong>{' '}
              {selectedFile ? `${selectedFile.name} (${selectedFile.kind})` : <span style={{ color: '#999' }}>None</span>}
            </div>
          </div>
        </div>

        <div>
          <strong style={{ color: '#555' }}>Line Settings</strong>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            <div>• {lineStations} stations</div>
            <div>• Angle: {lineAngleDeg}°</div>
            <div>
              • Color: <span style={{ display: 'inline-block', width: 16, height: 10, background: lineColor, border: '1px solid #000', verticalAlign: 'middle' }} /> {lineColor}
            </div>
          </div>
        </div>
      </div>

      {/* Main Visualization */}
      {demoMode !== 'split' ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 'calc(100vh - 210px)', position: 'relative' }}>
          <CanvasMetroMap
            width={1000}
            height={600}
            rootPath={rootPath}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            mode="line"
            lineName={lineName}
            lineColor={lineColor}
            lineStations={lineStations}
            lineAngleDeg={lineAngleDeg}
            stationSpacing={stationSpacing}
            showFiles={demoMode === 'semantic' ? (showFiles && zoomLevel >= 45) : showFiles}
            maxFilesPerStation={maxFilesPerStation}
            onFileHover={handleFileHover}
            onFileClick={handleFileClick}
          />

          {/* Option A: Station Drawer */}
          {demoMode === 'drawer' && selectedNode && (
            <>
              <div onClick={()=>setSelectedNode(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
              <div style={{ position: 'absolute', top: 10, right: 10, width: 420, height: 580, background: '#fff', borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong>Station:</strong> {selectedNode.name}
                    <div style={{ color: '#777', fontSize: 12 }}>{selectedNode.path}</div>
                  </div>
                  <button onClick={()=>setSelectedNode(null)} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}>✖</button>
                </div>
                <StationExplorer files={stationFiles} mode={fileViewMode} title="Files" />
              </div>
            </>
          )}

          {/* Option B: Semantic Zoom Drill-in Overlay */}
          {demoMode === 'semantic' && platformOpen && selectedNode && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(250,250,250,0.95)', border: '2px solid #ddd', borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e5e5e5', background: '#fff' }}>
                <div>
                  <strong>Inside platform:</strong> {selectedNode.name}
                  <span style={{ marginLeft: 10, color: '#777' }}>Zoom {zoomLevel}</span>
                </div>
                <button onClick={()=>setPlatformOpen(false)} style={{ padding: '6px 10px', background: '#0078D4', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Exit</button>
              </div>
              <StationExplorer files={stationFiles} mode={fileViewMode} title={selectedNode.path || ''} />
            </div>
          )}
        </div>
      ) : (
        // Option C: Split View
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16, padding: 16, minHeight: 'calc(100vh - 210px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CanvasMetroMap
              width={1000}
              height={600}
              rootPath={rootPath}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              mode="line"
              lineName={lineName}
              lineColor={lineColor}
              lineStations={lineStations}
              lineAngleDeg={lineAngleDeg}
              stationSpacing={stationSpacing}
              showFiles={false}
              maxFilesPerStation={maxFilesPerStation}
              onFileHover={handleFileHover}
              onFileClick={handleFileClick}
            />
          </div>
          <div style={{ border: '1px solid #e5e5e5', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            {selectedNode ? (
              <StationExplorer files={stationFiles} mode={fileViewMode} title={selectedNode.path || ''} />
            ) : (
              <div style={{ padding: 16, color: '#777' }}>Select a station on the map to view its files here.</div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ backgroundColor: '#1a1a2e', color: 'white', padding: '10px 20px', textAlign: 'center', fontSize: 12 }}>
        <div>
          {demoMode === 'drawer' && 'Option A — Click a station to open a right-side drawer with a Windows-like explorer.'}
          {demoMode === 'semantic' && 'Option B — Use the Zoom slider. At high zoom, clicking a station enters the platform view overlay.'}
          {demoMode === 'split' && 'Option C — Split view. Map on the left, synchronized explorer on the right.'}
        </div>
      </div>
    </div>
  );
};

export default MetroLineDemo;