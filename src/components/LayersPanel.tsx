/**
 * LayersPanel - Google Maps-style layers control panel
 * Allows toggling visibility of different visualization layers
 */

import React from 'react';
import './styles/LayersPanel.css';

export interface Layer {
  id: string;
  name: string;
  description: string;
  visible: boolean;
  icon: string;
}

export interface LayersPanelProps {
  layers: Layer[];
  onToggleLayer: (layerId: string) => void;
  onClose?: () => void;
  className?: string;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  onToggleLayer,
  onClose,
  className = '',
}) => {
  return (
    <div className={`layers-panel ${className}`}>
      <div className="layers-panel-header">
        <h3>Layers</h3>
        {onClose && (
          <button
            className="layers-panel-close"
            onClick={onClose}
            title="Close layers panel"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <div className="layers-panel-content">
        {layers.map((layer) => (
          <div key={layer.id} className="layer-item">
            <label className="layer-label">
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => onToggleLayer(layer.id)}
                aria-label={`Toggle ${layer.name}`}
              />
              <span className="layer-icon">{layer.icon}</span>
              <div className="layer-info">
                <span className="layer-name">{layer.name}</span>
                <span className="layer-description">{layer.description}</span>
              </div>
            </label>
          </div>
        ))}
      </div>

      <div className="layers-panel-footer">
        <button
          className="layers-panel-btn"
          onClick={() => layers.forEach(layer => layer.visible && onToggleLayer(layer.id))}
          title="Hide all layers"
        >
          Hide All
        </button>
        <button
          className="layers-panel-btn"
          onClick={() => layers.forEach(layer => !layer.visible && onToggleLayer(layer.id))}
          title="Show all layers"
        >
          Show All
        </button>
      </div>
    </div>
  );
};

// Default layer configurations for different visualization types
export const defaultLayers: Layer[] = [
  {
    id: 'nodes',
    name: 'Nodes',
    description: 'File and folder nodes',
    visible: true,
    icon: '📍',
  },
  {
    id: 'connections',
    name: 'Connections',
    description: 'Relationship lines between nodes',
    visible: true,
    icon: '🔗',
  },
  {
    id: 'labels',
    name: 'Labels',
    description: 'Node name labels',
    visible: true,
    icon: '🏷️',
  },
  {
    id: 'minimap',
    name: 'Minimap',
    description: 'Overview minimap',
    visible: true,
    icon: '🗺️',
  },
  {
    id: 'grid',
    name: 'Grid',
    description: 'Background grid lines',
    visible: false,
    icon: '⊞',
  },
  {
    id: 'metrics',
    name: 'Metrics',
    description: 'Performance metrics overlay',
    visible: false,
    icon: '📊',
  },
  {
    id: 'heatmap',
    name: 'Heatmap',
    description: 'File size or complexity heatmap',
    visible: false,
    icon: '🔥',
  },
  {
    id: 'clusters',
    name: 'Clusters',
    description: 'Group related nodes',
    visible: false,
    icon: '⚡',
  },
];
