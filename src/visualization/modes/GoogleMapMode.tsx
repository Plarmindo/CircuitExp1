/**
 * GoogleMapMode - Visualization mode using Google Maps-style zoom
 * with constant physical node and text sizes
 */

import React from 'react';
import MetroMapZoom, { type GoogleMapSettings } from '../stage/metro-map-zoom';
import { MapControls } from '../../components/MapControls';
import { MapSettingsControls } from '../../components/MapSettingsControls';
import { useCommonZoom } from './use-common-zoom';
import type { CommonModeProps } from './common-mode-interface';

export interface GoogleMapModeProps extends CommonModeProps {
  /** Google Maps-specific settings */
  mapSettings?: GoogleMapSettings;
  /** Show minimap overlay */
  showMinimap?: boolean;
}

const GoogleMapMode: React.FC<GoogleMapModeProps> = (props) => {
  // Use common zoom hook (standardized across all modes)
  const { scale, isWindowZoomMode, handleZoomIn, handleZoomOut, handleResetView, handleToggleWindowZoom } = useCommonZoom();

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with instructions */}
      <div
        style={{
          background: 'rgba(30, 30, 40, 0.95)',
          padding: '12px 20px',
          borderBottom: '1px solid #ffb30044',
          color: '#ffd54f',
          fontSize: '14px',
        }}
      >
        <strong style={{ color: '#ffb300' }}>Google Maps-style Visualization</strong>
        {' • '}
        <span style={{ fontSize: '12px' }}>
          Nodes: 4mm • Text: 2mm • Drag to pan • Scroll to zoom • Click to select
        </span>
      </div>

      {/* Main map area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MetroMapZoom
          layout={props.layout}
          routes={props.routes}
          onNodeClick={props.onNodeClick}
          onNodeHover={props.onNodeHover}
          onLayoutUpdate={props.onLayoutUpdate}
          theme={props.theme}
          debug={props.debug}
          mapSettings={props.mapSettings}
          showMinimap={props.showMinimap}
        />
        
        {/* Map Controls - centralized zoom with CAD functions */}
        <MapControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onToggleWindowZoom={handleToggleWindowZoom}
          zoomLevel={scale}
          isWindowZoomActive={isWindowZoomMode}
        />
        
        {/* Map Settings Controls - always visible */}
        <MapSettingsControls
          position="bottom-left"
          compact={false}
        />
      </div>
    </div>
  );
};

export default GoogleMapMode;

