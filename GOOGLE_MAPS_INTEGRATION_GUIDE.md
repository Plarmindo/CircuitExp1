# Complete Google Maps Feature Set Integration Guide

## Overview

This document provides a comprehensive guide for integrating the full Google Maps feature set into all visualization modes of CircuitExp1. The enhanced MapControls component now supports 15+ Google Maps-style features.

---

## New Components

### 1. Enhanced MapControls Component
**Location**: `src/components/MapControls.tsx`

**New Features Added:**
- ✅ Zoom In/Out (existing)
- ✅ Reset View (existing)
- ✅ Window Zoom (existing)
- ✅ Zoom Level Indicator (existing)
- 🆕 Rotate Left/Right with angle indicator
- 🆕 Fullscreen Toggle
- 🆕 Theme Toggle (Light/Dark/Satellite)
- 🆕 Layers Panel Toggle
- 🆕 Measure Tool
- 🆕 Search Toggle
- 🆕 Street View / Node Inspector
- 🆕 My Location / Center on Selection
- 🆕 More Tools Menu (collapsible)
- 🆕 Share View
- 🆕 Print Map

### 2. LayersPanel Component
**Location**: `src/components/LayersPanel.tsx`

**Features:**
- Toggle visibility of visualization layers
- Default layers: Nodes, Connections, Labels, Minimap, Grid, Metrics, Heatmap, Clusters
- Show All / Hide All bulk actions
- Animated slide-in panel
- Mobile responsive

### 3. SettingsPanel Component
**Location**: `src/components/SettingsPanel.tsx`

**Configuration Categories:**

#### Rendering Settings
- Node Size (4-32px)
- Font Size (8-24px)
- Line Width (1-8px)
- Color Scheme (Default, Colorful, Monochrome, Pastel)

#### Performance Settings
- LOD (Level of Detail) Toggle
- Max Visible Nodes (100-10000)
- Animation Speed (0.1x-3x)

#### Appearance Settings
- Show Background Grid
- Enable Shadows

#### Interaction Settings
- Smooth Zoom Animation
- Pan Inertia (Momentum)
- Snap to Grid

---

## Integration Guide

### Step 1: Update Mode Component State

Add state variables to track new features:

```typescript
import { useState, useCallback } from 'react';
import { MapControls } from '../../components/MapControls';
import { LayersPanel, defaultLayers, Layer } from '../../components/LayersPanel';
import { SettingsPanel } from '../../components/SettingsPanel';

function YourVisualizationMode() {
  // Existing state
  const [scale, setScale] = useState(1);
  
  // New feature states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'satellite'>('dark');
  const [isMeasureActive, setIsMeasureActive] = useState(false);
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [layers, setLayers] = useState<Layer[]>(defaultLayers);
  
  // Settings state
  const [nodeSize, setNodeSize] = useState(8);
  const [fontSize, setFontSize] = useState(12);
  const [lineWidth, setLineWidth] = useState(2);
  const [lodEnabled, setLodEnabled] = useState(true);
  const [maxVisibleNodes, setMaxVisibleNodes] = useState(5000);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [showShadows, setShowShadows] = useState(true);
  const [colorScheme, setColorScheme] = useState<'default' | 'colorful' | 'monochrome' | 'pastel'>('default');
  const [smoothZoom, setSmoothZoom] = useState(true);
  const [inertiaEnabled, setInertiaEnabled] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  
  // ... rest of component
}
```

### Step 2: Implement Handler Functions

```typescript
// Rotation handlers
const handleRotateLeft = useCallback(() => {
  setRotation(prev => (prev - 15) % 360);
  // Emit event to rotate stage
  window.dispatchEvent(new CustomEvent('metro:rotate', { 
    detail: { angle: rotation - 15 } 
  }));
}, [rotation]);

const handleRotateRight = useCallback(() => {
  setRotation(prev => (prev + 15) % 360);
  window.dispatchEvent(new CustomEvent('metro:rotate', { 
    detail: { angle: rotation + 15 } 
  }));
}, [rotation]);

// Fullscreen handler
const handleToggleFullscreen = useCallback(() => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    setIsFullscreen(true);
  } else {
    document.exitFullscreen();
    setIsFullscreen(false);
  }
}, []);

// Theme toggle handler
const handleToggleTheme = useCallback(() => {
  const themes: Array<'light' | 'dark' | 'satellite'> = ['light', 'dark', 'satellite'];
  const currentIndex = themes.indexOf(currentTheme);
  const nextTheme = themes[(currentIndex + 1) % themes.length];
  setCurrentTheme(nextTheme);
  
  // Emit theme change event
  window.dispatchEvent(new CustomEvent('metro:themeChanged', {
    detail: { theme: nextTheme }
  }));
}, [currentTheme]);

// Measure tool handler
const handleToggleMeasure = useCallback(() => {
  setIsMeasureActive(prev => !prev);
  // Activate measure mode in stage
  window.dispatchEvent(new CustomEvent('metro:toggleMeasure'));
}, []);

// Layers panel handler
const handleToggleLayers = useCallback(() => {
  setIsLayersPanelOpen(prev => !prev);
}, []);

// Settings panel handler (mapped to existing gear icon if present)
const handleToggleSettings = useCallback(() => {
  setIsSettingsPanelOpen(prev => !prev);
}, []);

// Search handler
const handleToggleSearch = useCallback(() => {
  setIsSearchOpen(prev => !prev);
  // Focus search input if opening
  if (!isSearchOpen) {
    setTimeout(() => {
      document.querySelector<HTMLInputElement>('.search-input')?.focus();
    }, 100);
  }
}, [isSearchOpen]);

// Node inspector / Street view
const handleToggleStreetView = useCallback(() => {
  // Open detailed node inspector for selected node
  window.dispatchEvent(new CustomEvent('metro:openInspector'));
}, []);

// My Location / Center on selection
const handleMyLocation = useCallback(() => {
  window.dispatchEvent(new CustomEvent('metro:centerOnSelection'));
}, []);

// Share handler
const handleShare = useCallback(() => {
  const url = new URL(window.location.href);
  url.searchParams.set('scale', scale.toString());
  url.searchParams.set('rotation', rotation.toString());
  
  navigator.clipboard.writeText(url.toString());
  alert('View link copied to clipboard!');
}, [scale, rotation]);

// Print handler
const handlePrint = useCallback(() => {
  window.print();
}, []);

// Layer toggle handler
const handleToggleLayer = useCallback((layerId: string) => {
  setLayers(prev => prev.map(layer => 
    layer.id === layerId 
      ? { ...layer, visible: !layer.visible }
      : layer
  ));
  
  // Emit event to update stage rendering
  window.dispatchEvent(new CustomEvent('metro:layerToggle', {
    detail: { layerId }
  }));
}, []);

// Settings reset handler
const handleResetSettings = useCallback(() => {
  setNodeSize(8);
  setFontSize(12);
  setLineWidth(2);
  setLodEnabled(true);
  setMaxVisibleNodes(5000);
  setAnimationSpeed(1);
  setShowGrid(false);
  setShowShadows(true);
  setColorScheme('default');
  setSmoothZoom(true);
  setInertiaEnabled(true);
  setSnapToGrid(false);
  
  // Emit event to reset stage
  window.dispatchEvent(new CustomEvent('metro:resetSettings'));
}, []);
```

### Step 3: Update JSX with Enhanced MapControls

```tsx
return (
  <div className="visualization-mode">
    {/* Main visualization stage */}
    <ResponsiveMetroStage
      {...props}
      // Pass settings as props
      nodeSize={nodeSize}
      fontSize={fontSize}
      lineWidth={lineWidth}
      lodEnabled={lodEnabled}
      maxVisibleNodes={maxVisibleNodes}
      showGrid={showGrid}
      showShadows={showShadows}
      colorScheme={colorScheme}
      rotation={rotation}
    />
    
    {/* Enhanced Map Controls */}
    <MapControls
      // Core controls
      onZoomIn={handleZoomIn}
      onZoomOut={handleZoomOut}
      onResetView={handleResetView}
      onToggleWindowZoom={handleToggleWindowZoom}
      zoomLevel={scale}
      isWindowZoomActive={isWindowZoomActive}
      
      // Advanced features
      onToggleFullscreen={handleToggleFullscreen}
      onRotateLeft={handleRotateLeft}
      onRotateRight={handleRotateRight}
      onToggleMeasure={handleToggleMeasure}
      onToggleLayers={handleToggleLayers}
      onToggleSearch={handleToggleSearch}
      onToggleStreetView={handleToggleStreetView}
      onToggleTheme={handleToggleTheme}
      onMyLocation={handleMyLocation}
      onShare={handleShare}
      onPrint={handlePrint}
      
      // State props
      isFullscreen={isFullscreen}
      isMeasureActive={isMeasureActive}
      isLayersPanelOpen={isLayersPanelOpen}
      isSearchOpen={isSearchOpen}
      currentTheme={currentTheme}
      rotation={rotation}
      
      // Dev tools
      showGenerateMore={import.meta.env.DEV}
      onGenerateMore={handleGenerateMore}
    />
    
    {/* Layers Panel */}
    {isLayersPanelOpen && (
      <LayersPanel
        layers={layers}
        onToggleLayer={handleToggleLayer}
        onClose={() => setIsLayersPanelOpen(false)}
      />
    )}
    
    {/* Settings Panel */}
    {isSettingsPanelOpen && (
      <SettingsPanel
        // Rendering
        nodeSize={nodeSize}
        onNodeSizeChange={setNodeSize}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        lineWidth={lineWidth}
        onLineWidthChange={setLineWidth}
        colorScheme={colorScheme}
        onColorSchemeChange={(scheme) => setColorScheme(scheme as any)}
        
        // Performance
        lodEnabled={lodEnabled}
        onLodEnabledChange={setLodEnabled}
        maxVisibleNodes={maxVisibleNodes}
        onMaxVisibleNodesChange={setMaxVisibleNodes}
        animationSpeed={animationSpeed}
        onAnimationSpeedChange={setAnimationSpeed}
        
        // Appearance
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        showShadows={showShadows}
        onShowShadowsChange={setShowShadows}
        
        // Interaction
        smoothZoom={smoothZoom}
        onSmoothZoomChange={setSmoothZoom}
        inertiaEnabled={inertiaEnabled}
        onInertiaEnabledChange={setInertiaEnabled}
        snapToGrid={snapToGrid}
        onSnapToGridChange={setSnapToGrid}
        
        onClose={() => setIsSettingsPanelOpen(false)}
        onReset={handleResetSettings}
      />
    )}
    
    {/* Keyboard shortcuts help (optional) */}
    <div className="keyboard-shortcuts-hint">
      Press <kbd>?</kbd> for keyboard shortcuts
    </div>
  </div>
);
```

### Step 4: Add Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyboard = (e: KeyboardEvent) => {
    // Ignore if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    switch(e.key.toLowerCase()) {
      case '+':
      case '=':
        handleZoomIn();
        e.preventDefault();
        break;
      case '-':
      case '_':
        handleZoomOut();
        e.preventDefault();
        break;
      case 'r':
        handleResetView();
        e.preventDefault();
        break;
      case 'q':
        handleRotateLeft();
        e.preventDefault();
        break;
      case 'e':
        handleRotateRight();
        e.preventDefault();
        break;
      case 'l':
        handleToggleLayers();
        e.preventDefault();
        break;
      case 'm':
        handleToggleMeasure();
        e.preventDefault();
        break;
      case 'f11':
        handleToggleFullscreen();
        e.preventDefault();
        break;
      case 'f':
        if (e.ctrlKey || e.metaKey) {
          handleToggleSearch();
          e.preventDefault();
        }
        break;
      case 'p':
        if (e.ctrlKey || e.metaKey) {
          handlePrint();
          e.preventDefault();
        }
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyboard);
  return () => window.removeEventListener('keydown', handleKeyboard);
}, [/* include all handlers */]);
```

---

## Implementation Checklist

### For Each Visualization Mode:

- [ ] **SemanticZoomMode**
  - [ ] Add all state variables
  - [ ] Implement all handlers
  - [ ] Add MapControls with all props
  - [ ] Add LayersPanel
  - [ ] Add SettingsPanel
  - [ ] Add keyboard shortcuts
  - [ ] Test all features

- [ ] **GoogleMapMode**
  - [ ] Add all state variables
  - [ ] Implement all handlers
  - [ ] Add MapControls with all props
  - [ ] Add LayersPanel
  - [ ] Add SettingsPanel
  - [ ] Add keyboard shortcuts
  - [ ] Test all features

- [ ] **SplitViewMode**
  - [ ] Add all state variables
  - [ ] Implement all handlers
  - [ ] Add MapControls for both views
  - [ ] Add LayersPanel (shared or per-view)
  - [ ] Add SettingsPanel
  - [ ] Add keyboard shortcuts
  - [ ] Test all features

- [ ] **DrawerExplorerMode**
  - [ ] Add all state variables
  - [ ] Implement all handlers
  - [ ] Add MapControls with all props
  - [ ] Add LayersPanel
  - [ ] Add SettingsPanel
  - [ ] Add keyboard shortcuts
  - [ ] Test all features

---

## New Event System

The following custom events should be implemented in the stage renderer:

### Rotation Events
```typescript
window.addEventListener('metro:rotate', (e: CustomEvent) => {
  const { angle } = e.detail;
  // Apply rotation to stage
});
```

### Layer Toggle Events
```typescript
window.addEventListener('metro:layerToggle', (e: CustomEvent) => {
  const { layerId } = e.detail;
  // Update layer visibility
});
```

### Measure Tool Events
```typescript
window.addEventListener('metro:toggleMeasure', () => {
  // Enable/disable measure mode
});
```

### Inspector Events
```typescript
window.addEventListener('metro:openInspector', () => {
  // Open detailed node inspector
});
```

### Center on Selection Events
```typescript
window.addEventListener('metro:centerOnSelection', () => {
  // Center viewport on selected node
});
```

### Settings Reset Events
```typescript
window.addEventListener('metro:resetSettings', () => {
  // Reset stage to default settings
});
```

---

## Feature Summary

### Implemented Features (15+)

1. ✅ **Zoom In/Out** - Standard zoom controls
2. ✅ **Zoom Level Indicator** - Shows current zoom percentage
3. ✅ **Reset View** - Fit all nodes in viewport
4. ✅ **Window Zoom** - CAD-style rectangle zoom
5. 🆕 **Rotate Map** - Left/right rotation with angle display
6. 🆕 **Fullscreen Mode** - F11 to toggle
7. 🆕 **Theme Toggle** - Light/Dark/Satellite modes
8. 🆕 **Layers Panel** - Toggle visibility of visualization layers
9. 🆕 **Settings Panel** - Comprehensive configuration options
10. 🆕 **Measure Tool** - Distance measurement between nodes
11. 🆕 **Search** - Quick node search with Ctrl+F
12. 🆕 **Node Inspector** - Detailed view like Street View
13. 🆕 **My Location** - Center on selected node
14. 🆕 **Share View** - Copy current view URL
15. 🆕 **Print Map** - Print current visualization
16. 🆕 **More Tools Menu** - Collapsible additional tools

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom In |
| `-` / `_` | Zoom Out |
| `R` | Reset View |
| `Q` | Rotate Left |
| `E` | Rotate Right |
| `L` | Toggle Layers |
| `M` | Toggle Measure |
| `F11` | Toggle Fullscreen |
| `Ctrl+F` | Toggle Search |
| `Ctrl+P` | Print |

---

## Testing Guide

### Visual Testing
1. Open each visualization mode
2. Verify all MapControls buttons appear
3. Test hover tooltips on all buttons
4. Check responsive layout on mobile
5. Verify panels slide in smoothly
6. Test fullscreen mode

### Functional Testing
1. Test each button action
2. Verify keyboard shortcuts work
3. Test layer toggles update rendering
4. Verify settings changes apply
5. Test share link generation
6. Test print functionality

### Accessibility Testing
1. Tab through all controls
2. Verify screen reader announcements
3. Test high contrast mode
4. Test with keyboard only
5. Verify ARIA labels
6. Test reduced motion mode

---

## Future Enhancements

- [ ] Add Traffic/Heat overlay for file activity
- [ ] Add Directions between nodes
- [ ] Add Timeline slider for version history
- [ ] Add 3D/Tilt view
- [ ] Add AR mode (if WebXR available)
- [ ] Add Collaboration features (live cursors)
- [ ] Add Annotations/Comments on nodes
- [ ] Add Bookmarks/Saved views
- [ ] Add Export to PNG/SVG
- [ ] Add Compare mode (diff two trees)

---

## Documentation Updates

After implementation, update:
- [ ] MAP_CONTROLS.md - Document new features
- [ ] TOOLTIPS_DOCUMENTATION.md - Add new tooltips
- [ ] API_DOCUMENTATION.md - Document new events
- [ ] README.md - Add feature showcase
- [ ] CHANGELOG.md - Version bump

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2024-01-XX | Added 10+ Google Maps features |
| 1.0 | 2024-01-XX | Initial MapControls implementation |

---

**Author**: CircuitExp1 Development Team  
**Last Updated**: January 2024
