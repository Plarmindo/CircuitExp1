# Draggable Windows Feature

## Overview
Implemented draggable, closable floating windows for all overlay panels (Minimap, Performance Metrics, LOD Stats). Each window saves its position to localStorage and restores it on reload.

## Features Added

### ✅ DraggableWindow Component
**File**: `src/components/DraggableWindow.tsx`

A reusable React component that provides:
- **Drag & Drop**: Click and drag window header to reposition
- **Close Button**: X button in header to close window
- **Position Persistence**: Saves position to localStorage using unique window ID
- **Viewport Constraints**: Prevents dragging windows outside viewport
- **Smooth UX**: Visual feedback while dragging (opacity, cursor changes)

**Props**:
```typescript
interface DraggableWindowProps {
  title: string;              // Window title shown in header
  id: string;                 // Unique ID for localStorage
  children: React.ReactNode;  // Window content
  defaultPosition?: { x: number; y: number }; // Initial position
  onClose?: () => void;       // Close callback
  className?: string;         // Additional CSS classes
}
```

**Usage**:
```tsx
<DraggableWindow
  title="Minimap"
  id="minimap"
  defaultPosition={{ x: 20, y: 400 }}
  onClose={() => setShowMinimap(false)}
>
  <MiniMap layout={layoutNodes} />
</DraggableWindow>
```

### ✅ Styled Windows
**File**: `src/components/styles/DraggableWindow.css`

Professional styling with:
- Dark theme matching app aesthetic
- Smooth borders and shadows
- Hover effects on close button
- Responsive design for mobile
- Custom styles for each window type (minimap, performance, LOD)

### ✅ Updated Windows

#### 1. Minimap Window
- **Location**: Bottom-left by default
- **ID**: `minimap`
- **Default Position**: `{ x: 20, y: window.innerHeight - 250 }`
- **Toggle Button**: 🗺️ in toolbar
- **Size**: 200x150px canvas

#### 2. Performance Metrics Window
- **Location**: Top-right by default
- **ID**: `performance`
- **Default Position**: `{ x: window.innerWidth - 240, y: 20 }`
- **Toggle Button**: 📈 in toolbar
- **Content**: FPS, node count, memory usage, layout time

#### 3. LOD Stats Window
- **Location**: Top-right (below performance) by default
- **ID**: `lod-hud`
- **Default Position**: `{ x: window.innerWidth - 240, y: 100 }`
- **Toggle Button**: 📊 in toolbar (NEW!)
- **Content**: Scale, depth cap, rendered/culled node counts

## Technical Implementation

### Position Persistence
Each window saves its position to localStorage using a key pattern:
```
window-position-{id}
```

Example:
```javascript
localStorage.setItem('window-position-minimap', '{"x":20,"y":400}');
```

### Drag Implementation
1. **mousedown** on header starts drag
2. **mousemove** updates position with viewport constraints
3. **mouseup** ends drag and saves position
4. Prevents dragging outside viewport bounds

### State Management
Each window has a corresponding state variable in MetroUI:
- `showMinimap` - Controls minimap visibility
- `showPerformance` - Controls performance window visibility
- `showLodHud` - Controls LOD stats visibility (NEW!)

## User Experience

### How to Use:
1. **Toggle Windows**: Click toolbar buttons (🗺️ 📈 📊)
2. **Move Windows**: Click and drag the window header
3. **Close Windows**: Click the × button in header
4. **Persistent Position**: Windows remember their position between sessions

### Visual Feedback:
- **Dragging**: Window becomes slightly transparent (90%)
- **Hover**: Close button highlights
- **Cursor**: Changes to "grab" over header, "grabbing" while dragging

## Files Modified

### New Files:
- `src/components/DraggableWindow.tsx` - Core draggable window component
- `src/components/styles/DraggableWindow.css` - Window styling

### Modified Files:
- `src/components/MetroUI.tsx`:
  - Imported DraggableWindow component
  - Added `showLodHud` state
  - Wrapped minimap, performance, and LOD HUD in DraggableWindow
  - Added LOD toggle button to toolbar

## Benefits

1. **Better UX**: Users can position windows where they want
2. **Less Clutter**: Close windows when not needed
3. **Persistent Layout**: Positions saved across sessions
4. **Professional Look**: Polished, modern window management
5. **Reusable Component**: Easy to add more draggable windows in future

## Future Enhancements

Potential improvements:
- [ ] Resize windows by dragging corners
- [ ] Minimize/maximize buttons
- [ ] Snap to edges/corners
- [ ] Window stacking (z-index management)
- [ ] Keyboard shortcuts (Escape to close)
- [ ] Window groups (tabbed interface)

## Testing

To test:
1. Start app and scan a folder
2. Toggle windows on/off with toolbar buttons
3. Drag windows to different positions
4. Close windows with × button
5. Refresh page - positions should be restored
6. Try dragging near viewport edges - should be constrained

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Electron desktop app
- ⚠️ Mobile: Limited support (touch events not implemented)

## Performance

Minimal performance impact:
- Position updates only during drag
- localStorage operations only on position change
- No continuous polling or animation loops
- Event listeners properly cleaned up on unmount
