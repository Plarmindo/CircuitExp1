/**
 * MapControls - Comprehensive Google Maps-style controls for canvas visualizations
 * Features: zoom, pan, layers, measure, fullscreen, rotate, search, themes, and more
 */

import React, { useState } from 'react';
import './styles/MapControls.css';

export interface MapControlsProps {
  // Core zoom controls
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  onToggleWindowZoom?: () => void;
  zoomLevel?: number;
  isWindowZoomActive?: boolean;
  
  // Advanced features
  onToggleFullscreen?: () => void;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
  onToggleMeasure?: () => void;
  onToggleLayers?: () => void;
  onToggleSearch?: () => void;
  onToggleStreetView?: () => void;
  onToggleTheme?: () => void;
  onMyLocation?: () => void;
  onShare?: () => void;
  onPrint?: () => void;
  
  // State indicators
  isFullscreen?: boolean;
  isMeasureActive?: boolean;
  isLayersPanelOpen?: boolean;
  isSearchOpen?: boolean;
  currentTheme?: 'light' | 'dark' | 'satellite';
  rotation?: number; // in degrees
  
  // Testing/Dev
  onGenerateMore?: () => void;
  showGenerateMore?: boolean;
  
  className?: string;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleWindowZoom,
  zoomLevel,
  isWindowZoomActive = false,
  
  onToggleFullscreen,
  onRotateLeft,
  onRotateRight,
  onToggleMeasure,
  onToggleLayers,
  onToggleSearch,
  onToggleStreetView,
  onToggleTheme,
  onMyLocation,
  onShare,
  onPrint,
  
  isFullscreen = false,
  isMeasureActive = false,
  isLayersPanelOpen = false,
  isSearchOpen = false,
  currentTheme = 'dark',
  rotation = 0,
  
  onGenerateMore,
  showGenerateMore = false,
  
  className = '',
}) => {
  const [showMoreTools, setShowMoreTools] = useState(false);

  return (
    <div className={`map-controls ${className}`}>
      {/* Primary Controls - Always Visible */}
      <div className="map-controls-group primary">
        {/* Zoom In */}
        {onZoomIn && (
          <button
            className="map-control-btn"
            onClick={onZoomIn}
            title="Zoom In (+ key)"
            aria-label="Zoom in"
          >
            🔍+
          </button>
        )}

        {/* Zoom Out */}
        {onZoomOut && (
          <button
            className="map-control-btn"
            onClick={onZoomOut}
            title="Zoom Out (- key)"
            aria-label="Zoom out"
          >
            🔍−
          </button>
        )}

        {/* Zoom Level Display */}
        {zoomLevel !== undefined && (
          <div 
            className="map-control-indicator" 
            title={`Current zoom: ${zoomLevel.toFixed(1)}x`}
          >
            {zoomLevel.toFixed(1)}x
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="map-controls-group">
        {/* Window Zoom Toggle */}
        {onToggleWindowZoom && (
          <button
            className={`map-control-btn ${isWindowZoomActive ? 'active' : ''}`}
            onClick={onToggleWindowZoom}
            title="Window Zoom (Shift+Drag to select area)"
            aria-label="Toggle window zoom mode"
          >
            📐
          </button>
        )}

        {/* Reset View */}
        {onResetView && (
          <button
            className="map-control-btn"
            onClick={onResetView}
            title="Reset View (Fit all nodes, R key)"
            aria-label="Reset view to show all nodes"
          >
            ⟲
          </button>
        )}

        {/* My Location / Center on Selection */}
        {onMyLocation && (
          <button
            className="map-control-btn"
            onClick={onMyLocation}
            title="Center on Selected Node"
            aria-label="Center map on selected node"
          >
            🎯
          </button>
        )}
      </div>

      {/* Rotation Controls */}
      {(onRotateLeft || onRotateRight) && (
        <div className="map-controls-group">
          {onRotateLeft && (
            <button
              className="map-control-btn"
              onClick={onRotateLeft}
              title="Rotate Left (Q key)"
              aria-label="Rotate map counter-clockwise"
            >
              ↶
            </button>
          )}
          
          {rotation !== undefined && rotation !== 0 && (
            <div 
              className="map-control-indicator small" 
              title={`Rotation: ${rotation}°`}
            >
              {rotation}°
            </div>
          )}
          
          {onRotateRight && (
            <button
              className="map-control-btn"
              onClick={onRotateRight}
              title="Rotate Right (E key)"
              aria-label="Rotate map clockwise"
            >
              ↷
            </button>
          )}
        </div>
      )}

      {/* View Mode Controls */}
      <div className="map-controls-group">
        {/* Theme Toggle (Map/Satellite/Dark) */}
        {onToggleTheme && (
          <button
            className={`map-control-btn ${currentTheme === 'satellite' ? 'active' : ''}`}
            onClick={onToggleTheme}
            title={`Switch Theme (Current: ${currentTheme})`}
            aria-label="Toggle between map themes"
          >
            {currentTheme === 'light' && '☀️'}
            {currentTheme === 'dark' && '🌙'}
            {currentTheme === 'satellite' && '🛰️'}
          </button>
        )}

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <button
            className={`map-control-btn ${isFullscreen ? 'active' : ''}`}
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Enter Fullscreen (F11)'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⛶' : '⛶'}
          </button>
        )}
      </div>

      {/* Tools Group */}
      <div className="map-controls-group">
        {/* Layers Panel Toggle */}
        {onToggleLayers && (
          <button
            className={`map-control-btn ${isLayersPanelOpen ? 'active' : ''}`}
            onClick={onToggleLayers}
            title="Toggle Layers Panel (L key)"
            aria-label="Toggle layers panel"
          >
            📚
          </button>
        )}

        {/* Measure Tool */}
        {onToggleMeasure && (
          <button
            className={`map-control-btn ${isMeasureActive ? 'active' : ''}`}
            onClick={onToggleMeasure}
            title="Measure Distance (M key)"
            aria-label="Toggle measure tool"
          >
            📏
          </button>
        )}

        {/* Search Toggle */}
        {onToggleSearch && (
          <button
            className={`map-control-btn ${isSearchOpen ? 'active' : ''}`}
            onClick={onToggleSearch}
            title="Search Nodes (Ctrl+F)"
            aria-label="Toggle search"
          >
            🔎
          </button>
        )}

        {/* Street View / Node Inspector */}
        {onToggleStreetView && (
          <button
            className="map-control-btn"
            onClick={onToggleStreetView}
            title="Node Inspector (Detailed View)"
            aria-label="Open node inspector"
          >
            👁️
          </button>
        )}
      </div>

      {/* More Tools Toggle */}
      <div className="map-controls-group">
        <button
          className={`map-control-btn ${showMoreTools ? 'active' : ''}`}
          onClick={() => setShowMoreTools(!showMoreTools)}
          title="More Tools"
          aria-label="Toggle more tools"
        >
          ⋯
        </button>
      </div>

      {/* Additional Tools (Collapsible) */}
      {showMoreTools && (
        <div className="map-controls-group more-tools">
          {/* Share */}
          {onShare && (
            <button
              className="map-control-btn secondary"
              onClick={onShare}
              title="Share View (Copy Link)"
              aria-label="Share current view"
            >
              🔗
            </button>
          )}

          {/* Print */}
          {onPrint && (
            <button
              className="map-control-btn secondary"
              onClick={onPrint}
              title="Print Map (Ctrl+P)"
              aria-label="Print map"
            >
              🖨️
            </button>
          )}

          {/* Generate More (Dev) */}
          {showGenerateMore && onGenerateMore && (
            <button
              className="map-control-btn secondary"
              onClick={onGenerateMore}
              title="Generate More Test Data"
              aria-label="Generate additional test nodes"
            >
              ➕
            </button>
          )}
        </div>
      )}
    </div>
  );
};
