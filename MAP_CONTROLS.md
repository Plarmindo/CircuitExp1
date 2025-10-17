# Map Controls - Google Maps-Style Tools

## Overview

All canvas-based visualization modes now include Google Maps-style navigation controls with tooltips. These tools provide consistent zoom and navigation functionality across all modes.

## Features Added

### 1. **MapControls Component** (`src/components/MapControls.tsx`)

A reusable React component that provides:

- **Zoom In** (🔍+) - Increases zoom level
- **Zoom Out** (🔍−) - Decreases zoom level  
- **Zoom Level Indicator** - Shows current zoom (e.g., "2.5x")
- **Window Zoom** (📐) - Toggle CAD-style area selection mode
- **Reset View** (⟲) - Fits all nodes in view
- **Generate More** (➕) - Optional button for test data generation

### 2. **Tooltips**

All buttons include native browser tooltips via the `title` attribute:

- "Zoom In"
- "Zoom Out"
- "Current zoom: [value]x"
- "Window Zoom (Shift+Drag to select area)"
- "Reset View (Fit all nodes)"
- "Generate More Test Data"

### 3. **Modes Updated**

The MapControls component has been integrated into:

1. **SemanticZoomMode** - Shows zoom level indicator
2. **GoogleMapMode** - Positioned in lower-left corner
3. **SplitViewMode** - Controls for both split views
4. **DrawerExplorerMode** - Controls in main stage area

## Usage

### Basic Integration

```tsx
import { MapControls } from '../../components/MapControls';

const MyMode: React.FC<Props> = (props) => {
  const handleZoomIn = useCallback(() => {
    window.dispatchEvent(new CustomEvent('metro:zoomIn'));
  }, []);

  const handleZoomOut = useCallback(() => {
    window.dispatchEvent(new CustomEvent('metro:zoomOut'));
  }, []);

  const handleResetView = useCallback(() => {
    window.dispatchEvent(new CustomEvent('metro:fitToView'));
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MetroStage {...props} />
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        zoomLevel={currentZoom}
      />
    </div>
  );
};
```

### Advanced Features

#### Window Zoom Mode

```tsx
const [isWindowZoomActive, setIsWindowZoomActive] = useState(false);

const handleToggleWindowZoom = useCallback(() => {
  setIsWindowZoomActive(prev => !prev);
  // Emit event to MetroStage to enable window zoom
  window.dispatchEvent(new CustomEvent('metro:toggleWindowZoom'));
}, []);

<MapControls
  onToggleWindowZoom={handleToggleWindowZoom}
  isWindowZoomActive={isWindowZoomActive}
  // ...other props
/>
```

#### With Test Data Generation

```tsx
<MapControls
  showGenerateMore={true}
  onGenerateMore={handleGenerateTestData}
  // ...other props
/>
```

## Event System

The controls communicate with MetroStage via custom events:

- `metro:zoomIn` - Zoom in at viewport center
- `metro:zoomOut` - Zoom out at viewport center
- `metro:fitToView` - Reset view to show all nodes
- `metro:toggleWindowZoom` - Enable/disable window zoom mode

These events are handled by the interaction handlers in `src/visualization/stage/interaction-handlers.ts`.

## Styling

The controls use CSS from `src/components/styles/MapControls.css`:

### Features:
- **Dark theme** with golden accent colors
- **Hover effects** with elevation
- **Active state** with pulse animation for window zoom
- **Responsive sizing** for mobile devices
- **Accessibility** support (high contrast, reduced motion)

### CSS Variables Used:
- Background: `rgba(30, 30, 40, 0.95)`
- Primary: `#ffb300` (golden)
- Secondary: `#29b6f6` (blue)
- Active: `#66bb6a` (green)

## Accessibility

### Features:
- Proper ARIA labels (`aria-label` attributes)
- Keyboard accessible (all controls are `<button>` elements)
- Screen reader friendly
- High contrast mode support
- Reduced motion support (disables animations)

### Example ARIA Labels:
```html
<button aria-label="Zoom in" title="Zoom In">🔍+</button>
<button aria-label="Reset view to show all nodes" title="Reset View (Fit all nodes)">⟲</button>
```

## Interaction Handlers

New handler added to `interaction-handlers.ts`:

### `handleZoomToArea()`

Implements CAD-style window zoom (zoom to selected rectangle):

```typescript
handleZoomToArea(screenX1, screenY1, screenX2, screenY2): void
```

**Parameters:**
- `screenX1, screenY1` - Start corner of selection rectangle
- `screenX2, screenY2` - End corner of selection rectangle

**Behavior:**
1. Calculates rectangle center and dimensions
2. Converts screen coordinates to world coordinates
3. Calculates scale to fit rectangle (with 90% padding)
4. Animates viewport to center on selected area

## Implementation Notes

### Position

Controls are positioned absolutely in the lower-left corner:

```css
.map-controls {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 100;
}
```

### Button Sizing

Minimum 44x44px touch targets for accessibility (WCAG 2.1):

```css
.map-control-btn {
  min-width: 44px;
  min-height: 44px;
}
```

### Animation

Active window zoom mode uses pulse animation:

```css
@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(102, 187, 106, 0.6);
  }
  50% {
    box-shadow: 0 0 20px rgba(102, 187, 106, 0.9);
  }
}
```

## Future Enhancements

Potential improvements:

1. **Zoom slider** - Visual slider for precise zoom control
2. **Keyboard shortcuts** - Hotkeys for common actions
3. **History** - Undo/redo navigation stack
4. **Bookmarks** - Save/restore favorite views
5. **Pan controls** - Arrow buttons for directional panning
6. **Rotation** - Rotate viewport (for non-standard layouts)

## Testing

To test the controls:

1. **Scan a folder** in the desktop app
2. **Observe controls** in lower-left corner
3. **Try each button**:
   - Zoom in/out - Should smoothly zoom at center
   - Reset view - Should fit all nodes in viewport
   - Window zoom - Should show green selection rectangle on Shift+drag

### Test Cases

- ✅ Zoom in/out buttons work
- ✅ Tooltips appear on hover
- ✅ Keyboard navigation works
- ✅ Buttons are 44x44px (mobile friendly)
- ✅ Active state animates correctly
- ✅ Controls don't overlap with other UI
- ✅ Works in all canvas modes

## Related Files

- `src/components/MapControls.tsx` - Main component
- `src/components/styles/MapControls.css` - Styles
- `src/visualization/stage/interaction-handlers.ts` - Event handlers
- `src/visualization/stage/metro-stage.tsx` - MetroStage integration
- `src/visualization/modes/*.tsx` - Mode integrations

## Connection Line Rendering

### Fixed Issue

Previously, connection lines between nodes were not displaying in the canvas. This was caused by the `renderLayout` function using a `BatchRenderer` that created placeholder objects for edges but never actually drew the line geometry.

### Solution

Modified `src/visualization/stage/metro-stage.tsx` to:

1. Create or get the `lines-layer` Container
2. Clear previous lines
3. Process route commands (M, L, Q) to build paths
4. Use PixiJS Graphics API to draw lines with proper styling

### Code Changes

```typescript
// Create lines container
let linesContainer = app.stage.children.find(c => c.name === 'lines-layer') as Container;
if (!linesContainer) {
  linesContainer = new Container();
  linesContainer.name = 'lines-layer';
  app.stage.addChildAt(linesContainer, 0); // Behind everything
}

// Render routes using Graphics
routes.forEach((command) => {
  switch (command.type) {
    case 'M': // Move to - start new path
    case 'L': // Line to - add point
    case 'Q': // Quadratic curve - approximate with segments
  }
});
```

### Line Styling

- **Color**: `0x95a5a6` (gray)
- **Width**: `2px`
- **Alpha**: `0.7` (70% opacity)
- **Curves**: Quadratic curves converted to 20 line segments

### Result

All visualization modes now properly display connection lines between nodes, matching the behavior of the Google Maps demo.

