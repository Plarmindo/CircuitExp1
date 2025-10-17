/**
 * SettingsPanel - Advanced visualization configuration panel
 * Google Maps-style settings for rendering, performance, and appearance
 */

import React from 'react';
import './styles/SettingsPanel.css';

export interface SettingsPanelProps {
  // Rendering settings
  nodeSize?: number;
  onNodeSizeChange?: (size: number) => void;
  
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  
  lineWidth?: number;
  onLineWidthChange?: (width: number) => void;
  
  // Performance settings
  lodEnabled?: boolean;
  onLodEnabledChange?: (enabled: boolean) => void;
  
  maxVisibleNodes?: number;
  onMaxVisibleNodesChange?: (count: number) => void;
  
  animationSpeed?: number;
  onAnimationSpeedChange?: (speed: number) => void;
  
  // Appearance settings
  showGrid?: boolean;
  onShowGridChange?: (show: boolean) => void;
  
  showShadows?: boolean;
  onShowShadowsChange?: (show: boolean) => void;
  
  colorScheme?: 'default' | 'colorful' | 'monochrome' | 'pastel';
  onColorSchemeChange?: (scheme: string) => void;
  
  // Interaction settings
  smoothZoom?: boolean;
  onSmoothZoomChange?: (smooth: boolean) => void;
  
  inertiaEnabled?: boolean;
  onInertiaEnabledChange?: (enabled: boolean) => void;
  
  snapToGrid?: boolean;
  onSnapToGridChange?: (snap: boolean) => void;
  
  onClose?: () => void;
  onReset?: () => void;
  className?: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  nodeSize = 8,
  onNodeSizeChange,
  fontSize = 12,
  onFontSizeChange,
  lineWidth = 2,
  onLineWidthChange,
  
  lodEnabled = true,
  onLodEnabledChange,
  maxVisibleNodes = 5000,
  onMaxVisibleNodesChange,
  animationSpeed = 1,
  onAnimationSpeedChange,
  
  showGrid = false,
  onShowGridChange,
  showShadows = true,
  onShowShadowsChange,
  colorScheme = 'default',
  onColorSchemeChange,
  
  smoothZoom = true,
  onSmoothZoomChange,
  inertiaEnabled = true,
  onInertiaEnabledChange,
  snapToGrid = false,
  onSnapToGridChange,
  
  onClose,
  onReset,
  className = '',
}) => {
  return (
    <div className={`settings-panel ${className}`}>
      <div className="settings-panel-header">
        <h3>⚙️ Visualization Settings</h3>
        {onClose && (
          <button
            className="settings-panel-close"
            onClick={onClose}
            title="Close settings"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <div className="settings-panel-content">
        {/* Rendering Settings */}
        <section className="settings-section">
          <h4>🎨 Rendering</h4>
          
          {onNodeSizeChange && (
            <div className="setting-item">
              <label>
                Node Size
                <span className="setting-value">{nodeSize}px</span>
              </label>
              <input
                type="range"
                min="4"
                max="32"
                value={nodeSize}
                onChange={(e) => onNodeSizeChange(Number(e.target.value))}
              />
            </div>
          )}

          {onFontSizeChange && (
            <div className="setting-item">
              <label>
                Font Size
                <span className="setting-value">{fontSize}px</span>
              </label>
              <input
                type="range"
                min="8"
                max="24"
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
              />
            </div>
          )}

          {onLineWidthChange && (
            <div className="setting-item">
              <label>
                Line Width
                <span className="setting-value">{lineWidth}px</span>
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={lineWidth}
                onChange={(e) => onLineWidthChange(Number(e.target.value))}
              />
            </div>
          )}

          {onColorSchemeChange && (
            <div className="setting-item">
              <label>Color Scheme</label>
              <select
                value={colorScheme}
                onChange={(e) => onColorSchemeChange(e.target.value)}
              >
                <option value="default">Default</option>
                <option value="colorful">Colorful</option>
                <option value="monochrome">Monochrome</option>
                <option value="pastel">Pastel</option>
              </select>
            </div>
          )}
        </section>

        {/* Performance Settings */}
        <section className="settings-section">
          <h4>⚡ Performance</h4>
          
          {onLodEnabledChange && (
            <div className="setting-item checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={lodEnabled}
                  onChange={(e) => onLodEnabledChange(e.target.checked)}
                />
                Enable LOD (Level of Detail)
              </label>
            </div>
          )}

          {onMaxVisibleNodesChange && (
            <div className="setting-item">
              <label>
                Max Visible Nodes
                <span className="setting-value">{maxVisibleNodes}</span>
              </label>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={maxVisibleNodes}
                onChange={(e) => onMaxVisibleNodesChange(Number(e.target.value))}
              />
            </div>
          )}

          {onAnimationSpeedChange && (
            <div className="setting-item">
              <label>
                Animation Speed
                <span className="setting-value">{animationSpeed.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={animationSpeed}
                onChange={(e) => onAnimationSpeedChange(Number(e.target.value))}
              />
            </div>
          )}
        </section>

        {/* Appearance Settings */}
        <section className="settings-section">
          <h4>✨ Appearance</h4>
          
          {onShowGridChange && (
            <div className="setting-item checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => onShowGridChange(e.target.checked)}
                />
                Show Background Grid
              </label>
            </div>
          )}

          {onShowShadowsChange && (
            <div className="setting-item checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={showShadows}
                  onChange={(e) => onShowShadowsChange(e.target.checked)}
                />
                Enable Shadows
              </label>
            </div>
          )}
        </section>

        {/* Interaction Settings */}
        <section className="settings-section">
          <h4>🖱️ Interaction</h4>
          
          {onSmoothZoomChange && (
            <div className="setting-item checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={smoothZoom}
                  onChange={(e) => onSmoothZoomChange(e.target.checked)}
                />
                Smooth Zoom Animation
              </label>
            </div>
          )}

          {onInertiaEnabledChange && (
            <div className="setting-item checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={inertiaEnabled}
                  onChange={(e) => onInertiaEnabledChange(e.target.checked)}
                />
                Pan Inertia (Momentum)
              </label>
            </div>
          )}

          {onSnapToGridChange && (
            <div className="setting-item checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={(e) => onSnapToGridChange(e.target.checked)}
                />
                Snap to Grid
              </label>
            </div>
          )}
        </section>
      </div>

      <div className="settings-panel-footer">
        {onReset && (
          <button
            className="settings-panel-btn secondary"
            onClick={onReset}
            title="Reset to default settings"
          >
            Reset Defaults
          </button>
        )}
        {onClose && (
          <button
            className="settings-panel-btn primary"
            onClick={onClose}
            title="Apply and close"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
};
