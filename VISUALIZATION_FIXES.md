# Visualization Fixes - Metro Map UX Improvements

## Overview
This document describes the fixes implemented to address three critical UX issues with the metro map visualization that were identified during desktop app testing.

## Issues Fixed

### ✅ 1. Initial View - Fit All Nodes
**Problem**: Map didn't automatically fit to show all nodes on initial load. Users saw a random zoomed-in area instead of an overview.

**Solution**: 
- Modified `metro-stage.tsx` useEffect (line ~1107) to automatically call `handleFitToView()` after layout loads
- Added 200ms delay after redraw to ensure layout is fully rendered before fitting
- Now users immediately see all their folder structure on scan completion

**Files Modified**:
- `src/visualization/stage/metro-stage.tsx`

**Code Change**:
```typescript
// Auto fit-to-view when layout is first loaded with nodes
if (layout && layout.length > 0 && interactionsApiRef.current?.handleFitToView) {
  console.log('[MetroStage] Auto-fitting to view with', layout.length, 'nodes');
  setTimeout(() => {
    interactionsApiRef.current?.handleFitToView();
  }, 200);
}
```

### ✅ 2. MiniMap Rendering
**Problem**: Minimap component existed but showed empty space - no nodes rendered, no viewport indicator.

**Root Cause**: 
- MiniMap component was a shell with no data passed to it
- No layout data, viewport state, or bounds calculation
- No canvas rendering implementation

**Solution**:
- **Rewrote MiniMap component** (`src/components/MiniMap.tsx`):
  - Changed from div-based to canvas-based rendering
  - Renders all layout nodes as small colored dots (blue for directories, green for files)
  - Draws viewport rectangle showing current view with orange highlight
  - Implements click-and-drag navigation
  - Auto-calculates bounds and scales to fit all nodes

- **Added viewport tracking** in MetroStage:
  - Added `onViewportChange` prop to `MetroStageProps`
  - Created `emitViewportChange()` function that calculates viewport bounds
  - Called after each `redrawScene()` to keep minimap updated
  - Emits: centerX, centerY, scale, viewportWidth, viewportHeight

- **Wired data flow through MetroUI**:
  - Added `viewportBounds` state to track current viewport
  - Added `handleMinimapViewportChange` callback for minimap clicks
  - Passed layout and viewport data to MiniMap component
  - Added ModeRenderer support for onViewportChange prop

- **Implemented minimap navigation**:
  - Added `handleCenterAt(worldX, worldY)` to interaction handlers
  - Added `metro:centerAt` event listener in event-listeners.ts
  - Clicking minimap now pans main view to that world position

**Files Modified**:
- `src/components/MiniMap.tsx` (complete rewrite)
- `src/visualization/stage/metro-stage.tsx` (viewport tracking)
- `src/components/MetroUI.tsx` (data wiring)
- `src/visualization/stage/interaction-handlers.ts` (centerAt handler)
- `src/visualization/stage/event-listeners.ts` (centerAt event)

**MiniMap Features**:
```typescript
interface MiniMapProps {
  layout?: LayoutNode[];           // All nodes to render
  viewportBounds?: ViewportBounds; // Current viewport state
  onViewportChange?: (x, y) => void; // Click handler
}
```

### 🔧 3. Window/Area Zoom (CAD-style) - PENDING
**Problem**: Missing CAD-style window zoom feature from google-maps-style-demo.html (Shift+drag to zoom into selected rectangle).

**Status**: Not yet implemented. Requires:
- Window zoom mode state (isWindowZoomMode, windowZoomStart, windowZoomEnd)
- Shift key detection
- Mouse event handlers for rectangle drawing
- Rectangle rendering (green dashed with semi-transparent fill)
- Zoom-to-bounds calculation on mouse up
- UI toggle button

**Reference**: `google-maps-style-demo.html` lines ~1000-1100

### 🔧 4. Zoom/Pan Controls - PENDING
**Problem**: Zoom behavior differs from smooth Google Maps demo experience.

**Status**: Partially implemented. Needs:
- Verify zoom-at-mouse-position works correctly
- Add smooth scroll zoom with delta-based factor
- Enhance pan limits to prevent excessive panning
- Add zoom level indicator to UI
- Test with various screen sizes and DPI settings

## Technical Architecture

### Viewport State Flow
```
MetroStage (PixiJS)
  ↓ emitViewportChange()
  ↓ viewport bounds (centerX, centerY, scale, viewportWidth, viewportHeight)
ModeRenderer
  ↓ onViewportChange prop
MetroUI
  ↓ viewportBounds state
  ↓ effectiveLayout + viewportBounds
MiniMap (Canvas)
  ↓ renders nodes + viewport rectangle
  ↓ onClick
  ↓ handleMinimapViewportChange(worldX, worldY)
  ↓ dispatches 'metro:centerAt' event
event-listeners.ts
  ↓ onCenterAt handler
  ↓ interactionHandlers.handleCenterAt(x, y)
MetroStage (PixiJS)
  ↓ updates app.stage.x/y
  ↓ redraw + emitViewportChange() (cycle continues)
```

### Event System
- **metro:fit** - Fit all nodes to view
- **metro:zoomIn** - Zoom in by factor 1.2
- **metro:zoomOut** - Zoom out by factor 1/1.2
- **metro:centerAt** - Pan to world position (new, for minimap)
- **metro:exportPNG** - Export current view

## Testing
To test these fixes:
1. Start app: `npm run dev` + `npm run dev:electron`
2. Scan a folder with nested structure
3. **Initial View**: Verify all nodes visible on first load
4. **MiniMap**: Toggle minimap, verify nodes rendered with blue/green dots
5. **MiniMap Navigation**: Click minimap, verify main view pans to that area
6. **MiniMap Viewport**: Pan/zoom main view, verify orange rectangle moves in minimap

## Known Issues
- Pre-existing TypeScript linting warnings (using `any` type) - not related to these changes
- Window zoom feature not yet implemented (Task 2)
- Zoom/pan polish pending (Task 4)

## Next Steps
1. Implement window/area zoom (Shift+drag rectangle) - ~1-2 hours
2. Polish zoom/pan controls for smooth UX - ~1-2 hours
3. Test with large folder structures (1000+ files)
4. Performance optimization if needed

## Files Changed Summary
### Modified:
- `src/visualization/stage/metro-stage.tsx` - Auto fit-to-view, viewport tracking
- `src/components/MiniMap.tsx` - Complete rewrite with canvas rendering
- `src/components/MetroUI.tsx` - Viewport state, minimap data wiring
- `src/visualization/stage/interaction-handlers.ts` - handleCenterAt function
- `src/visualization/stage/event-listeners.ts` - metro:centerAt event

### Reference:
- `google-maps-style-demo.html` - Complete working reference for all features

## Completion Status
- ✅ **Task 1**: Fix Initial View - Fit All Nodes (COMPLETED)
- ⏳ **Task 2**: Add Window/Area Zoom (NOT STARTED)
- ✅ **Task 3**: Fix MiniMap Rendering (COMPLETED)
- ⏳ **Task 4**: Improve Zoom/Pan Controls (NOT STARTED)

**Overall: 2/4 tasks completed (50%)**
