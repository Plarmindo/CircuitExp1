/**
 * Metro Prototype Demo Page
 *
 * This component demonstrates the London Metro Map style prototype
 * with interactive controls and information display.
 */

import React, { useState } from 'react';
import './styles/MetroPrototypeDemo.css';
import CanvasMetroMap, { type MetroNode } from './CanvasMetroMap';

export const MetroPrototypeDemo: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<MetroNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MetroNode | null>(null);
  const [rootPath, setRootPath] = useState('/root');

  const handleNodeClick = (node: MetroNode) => {
    setSelectedNode(node);
    console.log('Node clicked:', node);
  };

  const handleNodeHover = (node: MetroNode | null) => {
    setHoveredNode(node);
  };

  const resetSelection = () => {
    setSelectedNode(null);
    setHoveredNode(null);
  };

  const sampleRootPaths = [
    '/root',
    '/Users/john',
    '/home/user',
    '/C:/Users/Admin',
  ];

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1a1a2e',
        color: 'white',
        padding: '15px 20px',
        borderBottom: '3px solid #DC241F',
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          🚇 London Metro Map Style Prototype
        </h1>
        <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
          Interactive folder visualization inspired by the London Underground map
        </p>
      </div>

      {/* Controls */}
      <div style={{
        backgroundColor: 'white',
        padding: '15px 20px',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Root Path:</label>
          <select
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            style={{
              padding: '5px 10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            {sampleRootPaths.map((path) => (
              <option key={path} value={path}>{path}</option>
            ))}
          </select>
        </div>

        <button
          onClick={resetSelection}
          style={{
            padding: '8px 16px',
            backgroundColor: '#DC241F',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Reset Selection
        </button>

        <div style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
          Click stations to select • Hover for details
        </div>
      </div>

      {/* Info Panel */}
      <div style={{
        backgroundColor: '#f9f9f9',
        padding: '15px 20px',
        borderBottom: '1px solid #ddd',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
      }}>
        <div>
          <strong style={{ color: '#DC241F' }}>Selected Station:</strong>
          <div style={{ marginTop: '5px', fontSize: '14px' }}>
            {selectedNode ? (
              <>
                <div><strong>Name:</strong> {selectedNode.name}</div>
                <div><strong>Type:</strong> {selectedNode.type}</div>
                <div><strong>Path:</strong> {selectedNode.path}</div>
                <div><strong>Line Color:</strong>
                  <span style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '12px',
                    backgroundColor: selectedNode.lineColor,
                    marginLeft: '5px',
                    border: '1px solid #000',
                  }}></span>
                </div>
              </>
            ) : (
              <span style={{ color: '#999' }}>None</span>
            )}
          </div>
        </div>

        <div>
          <strong style={{ color: '#0019A8' }}>Hovered Station:</strong>
          <div style={{ marginTop: '5px', fontSize: '14px' }}>
            {hoveredNode ? (
              <>
                <div><strong>Name:</strong> {hoveredNode.name}</div>
                <div><strong>Type:</strong> {hoveredNode.type}</div>
                <div><strong>Path:</strong> {hoveredNode.path}</div>
              </>
            ) : (
              <span style={{ color: '#999' }}>None</span>
            )}
          </div>
        </div>

        <div>
          <strong style={{ color: '#007229' }}>Map Features:</strong>
          <div style={{ marginTop: '5px', fontSize: '14px' }}>
            <div>• Central station (main folder)</div>
            <div>• 5 colored lines (subfolder types)</div>
            <div>• Interactive stations</div>
            <div>• London Underground styling</div>
          </div>
        </div>
      </div>

      {/* Main Visualization */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        minHeight: 'calc(100vh - 200px)',
      }}>
        <CanvasMetroMap
          width={1000}
          height={600}
          rootPath={rootPath}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          // Test independent view center configuration
          // View center is offset from the default canvas center
          viewCenterX={400}  // Offset left from default (500)
          viewCenterY={250}  // Offset up from default (300)
          // Root element positioned independently from view center
          rootElementX={600} // Root element positioned right of view center
          rootElementY={350} // Root element positioned below view center
        />
      </div>

      {/* Footer */}
      <div style={{
        backgroundColor: '#1a1a2e',
        color: 'white',
        padding: '10px 20px',
        textAlign: 'center',
        fontSize: '12px',
      }}>
        <div>
          Prototype demonstrates folder structure visualization using London Underground map design principles
        </div>
        <div style={{ marginTop: '5px', opacity: 0.7 }}>
          Main folder acts as central interchange • Subfolders as stations • Files as terminal stations
        </div>
      </div>
    </div>
  );
};

export default MetroPrototypeDemo;

export function MetroPrototypeDemo() {
  const [selectedNode, setSelectedNode] = useState<MetroNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MetroNode | null>(null);
  const [rootPath, setRootPath] = useState('/root');

  const handleNodeClick = (node: MetroNode) => {
    setSelectedNode(node);
    console.log('Node clicked:', node);
  };

  const handleNodeHover = (node: MetroNode | null) => {
    setHoveredNode(node);
  };

  const resetSelection = () => {
    setSelectedNode(null);
    setHoveredNode(null);
  };

  const sampleRootPaths = [
    '/root',
    '/Users/john',
    '/home/user',
    '/C:/Users/Admin',
  ];

  return (
    <div className="metro-prototype">
      <div className="prototype-header">
        <h1 className="header-title">🚦 Metro Line Sequence Demo</h1>
        <p className="header-subtitle">
          Single-line metro sequence with adjustable stations, spacing, angle, and color
        </p>
      </div>

      <div className="controls-section">
        <div className="control-group">
          <label className="control-label">Root Path</label>
          <select
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            className="control-select"
          >
            {sampleRootPaths.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Line Name</label>
          <input
            value={lineName}
            onChange={(e) => setLineName(e.target.value)}
            className="control-input"
          />
        </div>

        <div className="control-group">
          <label className="control-label">Line Color</label>
          <input
            type="color"
            value={lineColor}
            onChange={(e) => setLineColor(e.target.value)}
            className="control-input"
          />
        </div>

        <div className="stats-section">
          {/* Add stats content here */}
        </div>
      </div>

      <div className="info-section">
        <div className="info-grid">
          <div className="info-block">
            <div className="info-title selected">Selected Station</div>
            <div className="info-content">
              {selectedNode ? (
                <>
                  <div>Name: {selectedNode.name}</div>
                  <div>Type: {selectedNode.type}</div>
                  <div>Path: {selectedNode.path}</div>
                </>
              ) : (
                <span className="info-empty">None</span>
              )}
            </div>
          </div>

          <div className="info-block">
            <div className="info-title hovered">Hovered Station</div>
            <div className="info-content">
              {hoveredNode ? (
                <>
                  <div>Name: {hoveredNode.name}</div>
                  <div>Type: {hoveredNode.type}</div>
                  <div>Path: {hoveredNode.path}</div>
                </>
              ) : (
                <span className="info-empty">None</span>
              )}
            </div>
          </div>

          <div className="info-block">
            <div className="info-title features">Map Features</div>
            <div className="info-content">
              <div>• {lineStations} stations</div>
              <div>• Angle: {lineAngleDeg}°</div>
              <div>• Color: {lineColor}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="visualization-section">
        {/* Add visualization content here */}
      </div>

      <div className="footer-section">
        <div>Metro Line Sequence Demo</div>
        <div className="footer-note">
          Click stations to select, hover for info, adjust controls to modify the line
        </div>
      </div>
    </div>
  );
}
