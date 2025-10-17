/**
 * Enhanced London Metro Map Style Prototype
 *
 * This component visualizes folder structures as a London Underground map
 * with zoom controls and dynamic detail levels like Google Maps.
 * Features 10+ stations per line with geographic diversity.
 */

import React, { useState } from 'react';

export interface MetroNode {
  id: string;
  name: string;
  type: 'main' | 'subfolder' | 'file';
  path: string;
  x: number;
  y: number;
  lineColor: string;
  lineName: string;
  size: number;
  visible: boolean;
  detailLevel: number; // 1=overview, 2=medium, 3=detailed
  opacity?: number; // For smooth transitions
}

export interface MetroLine {
  id: string;
  name: string;
  color: string;
  points: { x: number; y: number }[];
}

// Props interface for future component implementation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface LondonMetroPrototypeProps {
  width?: number;
  height?: number;
  rootPath?: string;
  onNodeClick?: (node: MetroNode) => void;
  onNodeHover?: (node: MetroNode | null) => void;
}

import React, { useState } from 'react';
import './styles/LondonMetroPrototype.css';
import CanvasMetroMap, { type MetroNode } from './CanvasMetroMap';

export const LondonMetroPrototype: React.FC = () => {
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
    <div className="london-metro">
      <div className="metro-header">
        <h1>🚇 London Metro Map Style Prototype</h1>
        <p>Interactive folder visualization inspired by the London Underground map</p>
      </div>

      <div className="controls-panel">
        <div className="control-group">
          <label>Root Path:</label>
          <select
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
          >
            {sampleRootPaths.map((path) => (
              <option key={path} value={path}>{path}</option>
            ))}
          </select>
        </div>

        <button
          onClick={resetSelection}
          className="reset-button"
          title="Clear current selection"
          aria-label="Reset selection"
        >
          Reset Selection
        </button>

        <div className="control-hint">
          Click stations to select • Hover for details
        </div>
      </div>

      <div className="info-panel">
        <div className="info-section selected">
          <strong>Selected Station:</strong>
          <div className="info-content">
            {selectedNode ? (
              <>
                <div><strong>Name:</strong> {selectedNode.name}</div>
                <div><strong>Type:</strong> {selectedNode.type}</div>
                <div><strong>Path:</strong> {selectedNode.path}</div>
                <div className="line-color">
                  <strong>Line Color:</strong>
                  <span className="color-box" style={{ backgroundColor: selectedNode.lineColor }}></span>
                </div>
              </>
            ) : (
              <span className="empty-state">None</span>
            )}
          </div>
        </div>

        <div className="info-section hovered">
          <strong>Hovered Station:</strong>
          <div className="info-content">
            {hoveredNode ? (
              <>
                <div><strong>Name:</strong> {hoveredNode.name}</div>
                <div><strong>Type:</strong> {hoveredNode.type}</div>
                <div><strong>Path:</strong> {hoveredNode.path}</div>
              </>
            ) : (
              <span className="empty-state">None</span>
            )}
          </div>
        </div>

        <div className="info-section features">
          <strong>Map Features:</strong>
          <div className="info-content">
            <div>• Central station (main folder)</div>
            <div>• 5 colored lines (subfolder types)</div>
            <div>• Interactive stations</div>
            <div>• London Underground styling</div>
          </div>
        </div>
      </div>

      <div className="canvas-container">
        <CanvasMetroMap
          width={1000}
          height={600}
          rootPath={rootPath}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          viewCenterX={400}
          viewCenterY={250}
          rootElementX={600}
          rootElementY={350}
        />
      </div>

      <div className="metro-footer">
        <div>
          Prototype demonstrates folder structure visualization using London Underground map design principles
        </div>
        <div className="footer-note">
          Main folder acts as central interchange • Subfolders as stations • Files as terminal stations
        </div>
      </div>
    </div>
  );
};

export default LondonMetroPrototype;
