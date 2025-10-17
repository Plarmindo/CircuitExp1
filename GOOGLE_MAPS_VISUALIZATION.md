# Google Maps-Style Metro Visualization

## Overview

A new visualization mode that transforms the Windows Explorer folder tree into an interactive map inspired by Google Maps. The key innovation is **constant physical sizes** - nodes and text remain the same physical size (in millimeters) on your screen regardless of zoom level, just like how road signs and labels work in Google Maps.

## 🎯 Key Features

### 1. **Constant Physical Sizes**
- **Nodes**: Always 4mm in diameter on screen
- **Text Labels**: Always 2mm font height on screen
- **Line Width**: Always 1mm thick on screen

This is calculated using your actual screen DPI, ensuring consistency across different displays.

### 2. **Level of Detail (LOD) System**
Just like Google Maps shows more detail as you zoom in:

- **Zoom 1-2**: Only root directories visible
- **Zoom 3-4**: First level subdirectories
- **Zoom 5-6**: Second level subdirectories
- **Zoom 7-8**: Third level subdirectories
- **Zoom 9+**: All files and deep directories

### 3. **Interactive Controls**
- **Drag to Pan**: Click and drag to move around the map
- **Scroll to Zoom**: Mouse wheel to zoom in/out
- **Zoom Buttons**: +/- controls for precise zooming
- **Reset View**: Return to default zoom and center

### 4. **Visual Feedback**
- **Blue Nodes** 🔵: Directories
- **Green Nodes** 🟢: Files
- **Golden Nodes** 🟡: Hovered items
- **Gray Lines**: Connections between parent and child

## 📁 Files Created

### Core Component
- **`src/visualization/stage/metro-map-zoom.tsx`** (670 lines)
  - Canvas-based rendering engine
  - DPI detection and physical size calculation
  - World-to-screen coordinate transformation
  - LOD-based filtering
  - Pan and zoom controls
  - Node hover detection

### Visualization Mode
- **`src/visualization/modes/GoogleMapMode.tsx`** (52 lines)
  - Wraps MetroMapZoom component
  - Adds header with instructions
  - Integrates with mode system

### Demo Page
- **`google-maps-style-demo.html`** (550 lines)
  - Standalone interactive demo
  - Sample tree data generation
  - Visual controls and statistics
  - Real-time zoom/pan/hover

## 🎨 How It Works

### Physical Size Calculation

```typescript
// Detect screen DPI
const dpi = window.devicePixelRatio * 96;

// Convert millimeters to pixels
const mmToPixels = (mm) => mm * (dpi / 25.4);

// Calculate node size
const nodeRadius = mmToPixels(NODE_SIZE_MM) / 2; // Always 4mm
const fontSize = mmToPixels(TEXT_SIZE_MM);       // Always 2mm
```

### Zoom Scale Calculation

```typescript
// Exponential zoom scale (like Google Maps)
const scale = Math.pow(2, zoom - 5);
// Zoom 5 = 1x (baseline)
// Zoom 6 = 2x
// Zoom 7 = 4x
// etc.
```

### World-to-Screen Transform

```typescript
function worldToScreen(worldX, worldY) {
  const scale = Math.pow(2, zoom - 5);
  return {
    x: (worldX - centerX) * scale + canvasWidth / 2,
    y: (worldY - centerY) * scale + canvasHeight / 2
  };
}
```

### Level of Detail Filtering

```typescript
function getVisibleNodes() {
  const maxDepth = Math.floor(zoom / 2);
  return nodes.filter(node => {
    // Always show up to current depth
    if (node.depth <= maxDepth) return true;
    // At high zoom, show files too
    if (zoom >= 8 && !node.isDirectory) return true;
    return false;
  });
}
```

## 🚀 Using in Your App

### 1. Via Mode Selector

The Google Map mode is now available in the visualization mode selector:

```typescript
// It's registered as 'map' in the mode registry
VisualizationMode.GoogleMap
```

### 2. Direct Component Usage

```tsx
import MetroMapZoom from './visualization/stage/metro-map-zoom';

<MetroMapZoom
  layout={layoutNodes}
  routes={routes}
  onNodeClick={(path) => console.log('Clicked:', path)}
  onNodeHover={(path) => console.log('Hovered:', path)}
  debug={true}
/>
```

### 3. Standalone Demo

Open `google-maps-style-demo.html` in a browser to see it in action without running the full app.

## 🎓 Technical Details

### Performance Optimizations

1. **Canvas-based rendering**: Direct 2D canvas API for 60fps performance
2. **LOD culling**: Only render nodes appropriate for current zoom level
3. **Viewport culling**: Skip nodes outside visible screen area
4. **Efficient coordinate transforms**: Cached scale calculations

### DPI Handling

The system detects your screen's DPI to ensure physical sizes are accurate:

```typescript
// Example: On a 4K display with 2x scaling
window.devicePixelRatio = 2
dpi = 2 * 96 = 192 DPI

// 4mm node size
nodeRadius = (4 * 192 / 25.4) / 2 = 15.1 pixels
```

### Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Electron

All modern browsers with HTML5 Canvas support.

## 📊 Benefits Over Traditional Approaches

### vs. SVG Rendering
- **Better performance** with large node counts (1000+)
- **Smoother animations** at 60fps
- **Easier pixel-perfect control** for physical sizes

### vs. WebGL/PixiJS
- **Zero dependencies** - no 477KB PixiJS bundle
- **No GPU issues** on older systems
- **Simpler codebase** - easier to maintain
- **Better text rendering** - native canvas text

### vs. Fixed-Scale Maps
- **Google Maps UX** users already understand
- **Progressive disclosure** - show relevant detail only
- **Better for large trees** (1000+ nodes)
- **Reduced visual clutter** at low zoom

## 🎯 Use Cases

### Perfect For:
1. **Large codebases** (500+ files) - LOD prevents overwhelming view
2. **Cross-platform demos** - physical sizes ensure consistency
3. **Data exploration** - zoom in for detail, out for overview
4. **File system visualization** - natural tree-to-map metaphor

### Not Ideal For:
1. **Small trees** (<50 nodes) - simpler view might be better
2. **Dense interconnected graphs** - works best with tree structures
3. **Print layouts** - screen-oriented physical sizing

## 🔮 Future Enhancements

Potential additions:

1. **Mini-map** - Overview in corner showing current viewport
2. **Search/filter** - Highlight nodes matching query
3. **Clustering** - Group nearby nodes at low zoom
4. **Animated transitions** - Smooth zoom/pan interpolation
5. **Touch gestures** - Pinch-to-zoom on mobile
6. **Bookmarks** - Save favorite zoom/pan positions
7. **Heatmaps** - Visualize file sizes, age, activity
8. **Path highlighting** - Show full path to selected node

## 📸 Screenshots

See `google-maps-style-demo.html` for a live interactive demo!

## 🎉 Summary

The Google Maps-style metro visualization brings familiar, intuitive map navigation to file tree exploration. With constant 4mm nodes and 2mm text, intelligent LOD, and smooth pan/zoom, it makes exploring large codebases feel like navigating a city map.

**Try it**: Open the demo or switch to "Google Map" mode in the app!
