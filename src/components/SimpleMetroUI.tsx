/**
 * Simple Metro UI Component
 * A minimal UI wrapper for the three-folder prototype
 */

import React, { useState, useCallback } from 'react';
import SimpleMetroStage from './SimpleMetroStage';
import './MetroUI.css';

export interface SimpleMetroUIProps {
  width?: number;
  height?: number;
}

export const SimpleMetroUI: React.FC<SimpleMetroUIProps> = ({
  width = 800,
  height = 600,
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showExtended, setShowExtended] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Theme configurations
  const themes = {
    light: {
      background: '#f5f5f5',
      text: '#333333',
      folder: '#4CAF50',
      file: '#2196F3',
      line: '#666666',
      selectedOutline: '#FF6B35',
      hoveredOutline: '#4ECDC4',
    },
    dark: {
      background: '#1a1a2e',
      text: '#ffffff',
      folder: '#4CAF50',
      file: '#2196F3',
      line: '#95a5a6',
      selectedOutline: '#FF6B35',
      hoveredOutline: '#4ECDC4',
    },
  };

  const handleNodeClick = useCallback((path: string) => {
    console.log('Node clicked:', path);
    setSelectedNode(path);
  }, []);

  const handleNodeHover = useCallback((path: string | null) => {
    console.log('Node hovered:', path);
    setHoveredNode(path);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const toggleExtended = () => {
    setShowExtended(!showExtended);
  };

  const resetView = () => {
    setSelectedNode(null);
    setHoveredNode(null);
  };

  return (
    <div className="metro-ui" style={{ backgroundColor: themes[theme].background }}>
      {/* Header Controls */}
      <div className="metro-header" style={{
        padding: '10px 20px',
        borderBottom: `1px solid ${theme === 'light' ? '#ddd' : '#444'}`,
        backgroundColor: theme === 'light' ? '#fff' : '#2d2d44',
        color: themes[theme].text,
      }}>
        <h2 style={{ margin: '0 0 10px 0', color: themes[theme].text }}>
          Metro Map Prototype - Three Folders
        </h2>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={toggleTheme}
            style={{
              padding: '6px 12px',
              backgroundColor: themes[theme].folder,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>

          <button
            onClick={toggleExtended}
            style={{
              padding: '6px 12px',
              backgroundColor: themes[theme].file,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {showExtended ? 'Simple View' : 'Extended View'}
          </button>

          <button
            onClick={resetView}
            style={{
              padding: '6px 12px',
              backgroundColor: themes[theme].line,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reset Selection
          </button>
        </div>
      </div>

      {/* Info Panel */}
      <div style={{
        padding: '10px 20px',
        backgroundColor: theme === 'light' ? '#f9f9f9' : '#252542',
        color: themes[theme].text,
        fontSize: '14px',
        borderBottom: `1px solid ${theme === 'light' ? '#ddd' : '#444'}`,
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <span>
            <strong>Selected:</strong> {selectedNode || 'None'}
          </span>
          <span>
            <strong>Hovered:</strong> {hoveredNode || 'None'}
          </span>
          <span>
            <strong>View:</strong> {showExtended ? 'Extended (with Shared folder)' : 'Simple (3 folders)'}
          </span>
        </div>
      </div>

      {/* Main Visualization */}
      <div style={{
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: height,
      }}>
        <SimpleMetroStage
          width={width}
          height={height - 120} // Account for header and info panel
          extended={showExtended}
          theme={themes[theme]}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
        />
      </div>

      {/* Instructions */}
      <div style={{
        padding: '20px',
        backgroundColor: theme === 'light' ? '#f0f0f0' : '#1e1e3a',
        color: themes[theme].text,
        fontSize: '14px',
        borderTop: `1px solid ${theme === 'light' ? '#ddd' : '#444'}`,
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Instructions:</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>Click</strong> on folders or files to select them</li>
          <li><strong>Hover</strong> over nodes to see hover effects</li>
          <li><strong>Drag</strong> the background to pan around</li>
          <li><strong>Scroll</strong> to zoom in and out</li>
          <li><strong>Toggle views</strong> to see simple vs extended layout</li>
          <li><strong>Switch themes</strong> to see light vs dark mode</li>
        </ul>

        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: theme === 'light' ? '#e8f5e8' : '#2d4a2d', borderRadius: '4px' }}>
          <strong>Prototype Features:</strong>
          <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
            <li>✅ Three mock folders (Documents, Projects, Images)</li>
            <li>✅ Each folder contains one file</li>
            <li>✅ Curved connecting lines between folders (metro lines)</li>
            <li>✅ Straight lines connecting folders to their files</li>
            <li>✅ Interactive selection and hover states</li>
            <li>✅ Pan and zoom functionality</li>
            <li>✅ Light/dark theme support</li>
            <li>✅ Extended view with shared folder</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SimpleMetroUI;
