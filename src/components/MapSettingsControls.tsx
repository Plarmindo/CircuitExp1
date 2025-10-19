/**
 * MapSettingsControls - Always-visible settings panel for map visualization
 * Controls for lines, text, and nodes configuration
 * Inspired by Google Maps demo configuration panel
 * Now draggable with position persistence
 */

import React, { useState, useEffect } from 'react';
import { DraggablePanel } from './DraggablePanel';
import './styles/MapSettingsControls.css';

export interface LineSettings {
  width: number;
  style: 'straight' | 'curved' | 'orthogonal';
  smoothing: number;
  color: string;
  visible: boolean;
}

export interface TextSettings {
  size: number;
  font: string;
  weight: 'normal' | 'bold';
  visible: boolean;
  color: string;
}

export interface NodeSettings {
  size: number;
  shape: 'circle' | 'square' | 'diamond';
  borderWidth: number;
  visible: boolean;
  color: string;
}

export interface MapSettingsState {
  line: LineSettings;
  text: TextSettings;
  node: NodeSettings;
  showGrid: boolean;
  showMinimap: boolean;
}

export interface MapSettingsControlsProps {
  initialSettings?: Partial<MapSettingsState>;
  onChange?: (settings: MapSettingsState) => void;
  onReset?: () => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
}

const DEFAULT_SETTINGS: MapSettingsState = {
  line: {
    width: 4,
    style: 'curved',
    smoothing: 0.5,
    color: '#ffb300',
    visible: true,
  },
  text: {
    size: 12,
    font: 'Arial, sans-serif',
    weight: 'normal',
    visible: true,
    color: '#ffffff',
  },
  node: {
    size: 8,
    shape: 'circle',
    borderWidth: 2,
    visible: true,
    color: '#45b7d1',
  },
  showGrid: false,
  showMinimap: true,
};

export const MapSettingsControls: React.FC<MapSettingsControlsProps> = ({
  initialSettings,
  onChange,
  onReset,
  position: _position = 'bottom-left',
  compact: _compact = false,
}) => {
  const [settings, setSettings] = useState<MapSettingsState>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  // Emit initial settings on mount
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('metro:settingsChange', { detail: settings }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Emit settings changes as events
    onChange?.(settings);
    window.dispatchEvent(new CustomEvent('metro:settingsChange', { detail: settings }));
  }, [settings, onChange]);

  const handleLineWidthChange = (value: number) => {
    setSettings(prev => ({
      ...prev,
      line: { ...prev.line, width: value },
    }));
  };

  const handleLineStyleChange = (style: 'straight' | 'curved' | 'orthogonal') => {
    setSettings(prev => ({
      ...prev,
      line: { ...prev.line, style },
    }));
  };

  const handleLineSmoothingChange = (value: number) => {
    setSettings(prev => ({
      ...prev,
      line: { ...prev.line, smoothing: value },
    }));
  };

  const handleLineVisibilityToggle = () => {
    setSettings(prev => ({
      ...prev,
      line: { ...prev.line, visible: !prev.line.visible },
    }));
  };

  const handleLineColorChange = (color: string) => {
    setSettings(prev => ({
      ...prev,
      line: { ...prev.line, color },
    }));
  };

  const handleTextSizeChange = (value: number) => {
    setSettings(prev => ({
      ...prev,
      text: { ...prev.text, size: value },
    }));
  };

  const handleTextWeightChange = (weight: 'normal' | 'bold') => {
    setSettings(prev => ({
      ...prev,
      text: { ...prev.text, weight },
    }));
  };

  const handleTextVisibilityToggle = () => {
    setSettings(prev => ({
      ...prev,
      text: { ...prev.text, visible: !prev.text.visible },
    }));
  };

  const handleTextColorChange = (color: string) => {
    setSettings(prev => ({
      ...prev,
      text: { ...prev.text, color },
    }));
  };

  const handleNodeSizeChange = (value: number) => {
    setSettings(prev => ({
      ...prev,
      node: { ...prev.node, size: value },
    }));
  };

  const handleNodeShapeChange = (shape: 'circle' | 'square' | 'diamond') => {
    setSettings(prev => ({
      ...prev,
      node: { ...prev.node, shape },
    }));
  };

  const handleNodeBorderWidthChange = (value: number) => {
    setSettings(prev => ({
      ...prev,
      node: { ...prev.node, borderWidth: value },
    }));
  };

  const handleNodeVisibilityToggle = () => {
    setSettings(prev => ({
      ...prev,
      node: { ...prev.node, visible: !prev.node.visible },
    }));
  };

  const handleNodeColorChange = (color: string) => {
    setSettings(prev => ({
      ...prev,
      node: { ...prev.node, color },
    }));
  };

  const handleGridToggle = () => {
    setSettings(prev => ({
      ...prev,
      showGrid: !prev.showGrid,
    }));
  };

  const handleMinimapToggle = () => {
    setSettings(prev => ({
      ...prev,
      showMinimap: !prev.showMinimap,
    }));
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    onReset?.();
    window.dispatchEvent(new CustomEvent('metro:settingsReset'));
  };

  return (
    <DraggablePanel
      id="map-settings"
      title="Map Settings"
      defaultPosition={{ x: 20, y: Math.max(80, window.innerHeight - 450) }}
      defaultSize={{ width: 320, height: 420 }}
      collapsible={true}
      resizable={false}
      className="map-settings-panel"
    >
      <div className="map-settings-body">
          {/* Line Settings */}
          <div className="settings-section">
            <div className="section-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#29b6f6">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
              </svg>
              <span>Lines</span>
              <div className="toggle-switch" onClick={handleLineVisibilityToggle}>
                <input type="checkbox" checked={settings.line.visible} readOnly />
                <span className="slider"></span>
              </div>
            </div>

            <div className="control-row">
              <label>Width</label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={settings.line.width}
                onChange={(e) => handleLineWidthChange(Number(e.target.value))}
                title={`Line width: ${settings.line.width}px`}
              />
              <span className="value">{settings.line.width}px</span>
            </div>

            <div className="control-row">
              <label>Style</label>
              <div className="button-group">
                <button
                  className={settings.line.style === 'straight' ? 'active' : ''}
                  onClick={() => handleLineStyleChange('straight')}
                  title="Straight lines"
                >
                  Straight
                </button>
                <button
                  className={settings.line.style === 'curved' ? 'active' : ''}
                  onClick={() => handleLineStyleChange('curved')}
                  title="Curved lines"
                >
                  Curved
                </button>
                <button
                  className={settings.line.style === 'orthogonal' ? 'active' : ''}
                  onClick={() => handleLineStyleChange('orthogonal')}
                  title="Orthogonal (right-angle) lines"
                >
                  Orthogonal
                </button>
              </div>
            </div>

            <div className="control-row">
              <label>Smoothing</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.line.smoothing}
                onChange={(e) => handleLineSmoothingChange(Number(e.target.value))}
                title={`Line smoothing: ${(settings.line.smoothing * 100).toFixed(0)}%`}
              />
              <span className="value">{(settings.line.smoothing * 100).toFixed(0)}%</span>
            </div>

            <div className="control-row">
              <label>Color</label>
              <input
                type="color"
                value={settings.line.color}
                onChange={(e) => handleLineColorChange(e.target.value)}
                title="Line color"
              />
            </div>
          </div>

          {/* Text Settings */}
          <div className="settings-section">
            <div className="section-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#29b6f6">
                <path d="M5 4v3h5.5v12h3V7H19V4z"/>
              </svg>
              <span>Text</span>
              <div className="toggle-switch" onClick={handleTextVisibilityToggle}>
                <input type="checkbox" checked={settings.text.visible} readOnly />
                <span className="slider"></span>
              </div>
            </div>

            <div className="control-row">
              <label>Size</label>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={settings.text.size}
                onChange={(e) => handleTextSizeChange(Number(e.target.value))}
                disabled={!settings.text.visible}
                title={`Text size: ${settings.text.size}px`}
              />
              <span className="value">{settings.text.size}px</span>
            </div>

            <div className="control-row">
              <label>Weight</label>
              <div className="button-group">
                <button
                  className={settings.text.weight === 'normal' ? 'active' : ''}
                  onClick={() => handleTextWeightChange('normal')}
                  disabled={!settings.text.visible}
                  title="Normal text weight"
                >
                  Normal
                </button>
                <button
                  className={settings.text.weight === 'bold' ? 'active' : ''}
                  onClick={() => handleTextWeightChange('bold')}
                  disabled={!settings.text.visible}
                  title="Bold text weight"
                >
                  Bold
                </button>
              </div>
            </div>

            <div className="control-row">
              <label>Color</label>
              <input
                type="color"
                value={settings.text.color}
                onChange={(e) => handleTextColorChange(e.target.value)}
                disabled={!settings.text.visible}
                title="Text color"
              />
            </div>
          </div>

          {/* Node Settings */}
          <div className="settings-section">
            <div className="section-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#29b6f6">
                <circle cx="12" cy="12" r="8"/>
              </svg>
              <span>Nodes</span>
              <div className="toggle-switch" onClick={handleNodeVisibilityToggle}>
                <input type="checkbox" checked={settings.node.visible} readOnly />
                <span className="slider"></span>
              </div>
            </div>

            <div className="control-row">
              <label>Size</label>
              <input
                type="range"
                min="4"
                max="20"
                step="1"
                value={settings.node.size}
                onChange={(e) => handleNodeSizeChange(Number(e.target.value))}
                disabled={!settings.node.visible}
                title={`Node size: ${settings.node.size}px`}
              />
              <span className="value">{settings.node.size}px</span>
            </div>

            <div className="control-row">
              <label>Shape</label>
              <div className="button-group">
                <button
                  className={settings.node.shape === 'circle' ? 'active' : ''}
                  onClick={() => handleNodeShapeChange('circle')}
                  disabled={!settings.node.visible}
                  title="Circle nodes"
                >
                  ●
                </button>
                <button
                  className={settings.node.shape === 'square' ? 'active' : ''}
                  onClick={() => handleNodeShapeChange('square')}
                  disabled={!settings.node.visible}
                  title="Square nodes"
                >
                  ■
                </button>
                <button
                  className={settings.node.shape === 'diamond' ? 'active' : ''}
                  onClick={() => handleNodeShapeChange('diamond')}
                  disabled={!settings.node.visible}
                  title="Diamond nodes"
                >
                  ◆
                </button>
              </div>
            </div>

            <div className="control-row">
              <label>Border</label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={settings.node.borderWidth}
                onChange={(e) => handleNodeBorderWidthChange(Number(e.target.value))}
                disabled={!settings.node.visible}
                title={`Node border: ${settings.node.borderWidth}px`}
              />
              <span className="value">{settings.node.borderWidth}px</span>
            </div>

            <div className="control-row">
              <label>Color</label>
              <input
                type="color"
                value={settings.node.color}
                onChange={(e) => handleNodeColorChange(e.target.value)}
                disabled={!settings.node.visible}
                title="Node color"
              />
            </div>
          </div>

          {/* Display Options */}
          <div className="settings-section">
            <div className="section-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#29b6f6">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              <span>Display</span>
            </div>

            <div className="control-row">
              <label>Grid</label>
              <div className="toggle-switch" onClick={handleGridToggle}>
                <input type="checkbox" checked={settings.showGrid} readOnly />
                <span className="slider"></span>
              </div>
            </div>

            <div className="control-row">
              <label>Minimap</label>
              <div className="toggle-switch" onClick={handleMinimapToggle}>
                <input type="checkbox" checked={settings.showMinimap} readOnly />
                <span className="slider"></span>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="settings-footer">
            <button className="reset-button" onClick={handleReset} title="Reset to default settings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
              Reset to Default
            </button>
          </div>
        </div>
      </DraggablePanel>
  );
};
