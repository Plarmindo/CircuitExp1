# Zoom Unification - Issues Fixed

## Issues Identified and Resolved

### 1. ✅ Duplicate Zoom Controls FIXED
**Problem**: Multiple sets of zoom controls visible (top-center AND top-right in split view)

**Root Cause**: 
- `MetroStageSVG.tsx` had its own zoom controls in top-right corner
- Each visualization mode also had `MapControls` from centralized system

**Solution**:
- ✅ Removed zoom control buttons from `MetroStageSVG.tsx` (lines 521-561)
- ✅ Added event listeners to `MetroStageSVG` to respond to centralized zoom events:
  - `metro:zoomIn` - Zoom in
  - `metro:zoomOut` - Zoom out
  - `metro:fitToView` - Fit all nodes
- ✅ Removed unused `metroButtonStyle` constant

**Files Modified**:
- `src/visualization/stage/metro-stage-svg.tsx`

### 2. ⚠️ Lines Not Displaying - INVESTIGATION NEEDED

**Current State**:
- Lines ARE being rendered in code (verified in `MetroStageSVG.tsx` lines 350-385)
- Edge rendering logic exists and creates fallback edges from tree structure
- Lines rendered as `<line>` SVG elements with proper styling

**Possible Causes**:
1. **No layout data**: If `layout` prop is empty array, no edges can be built
2. **No routes data**: If `routes` prop is empty AND tree structure can't be inferred
3. **Lines hidden by settings**: MapSettingsControls might have lines toggled off
4. **Z-index issue**: Lines might be behind background
5. **Viewport issue**: Lines might be outside visible area

**Debug Steps Needed**:
```typescript
// Add to MetroStageSVG.tsx line ~135
console.log('[MetroStageSVG] Layout nodes:', layout.length);
console.log('[MetroStageSVG] Routes:', routes.length);
console.log('[MetroStageSVG] Edges built:', edges.length);
console.log('[MetroStageSVG] Sample edge:', edges[0]);
```

**Quick Test**:
1. Open browser DevTools (F12)
2. Inspect the SVG element
3. Look for `<g class="edges">` element
4. Check if `<line>` elements exist inside
5. Check line attributes (x1, y1, x2, y2, stroke, strokeWidth)

### 3. ⏳ Window Area Zoom - NOT YET IMPLEMENTED

**Current State**:
- ✅ Button exists in MapControls
- ✅ Toggle handler implemented in all 4 modes
- ✅ Event listeners set up to receive `metro:areaSelected` event
- ❌ Selection rectangle drawing NOT implemented in stages
- ❌ `metro:areaSelected` event NOT being emitted anywhere

**What's Needed**:
The visualization stages need to:
1. Listen for `metro:toggleWindowZoom` event
2. When active + Shift held + mouse drag, draw selection rectangle
3. On mouse release, emit `metro:areaSelected` with coordinates

**Implementation Needed in**:
- `ResponsiveMetroStage.tsx`
- `MetroStageSVG.tsx`
- `metro-map-zoom.tsx` (for Google Map mode)

**Example Implementation**:
```typescript
// In MetroStageSVG.tsx
const [windowZoomActive, setWindowZoomActive] = useState(false);
const [selectionRect, setSelectionRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);

useEffect(() => {
  const handleToggle = (e: CustomEvent) => {
    setWindowZoomActive(e.detail.active);
  };
  window.addEventListener('metro:toggleWindowZoom', handleToggle);
  return () => window.removeEventListener('metro:toggleWindowZoom', handleToggle);
}, []);

const handleMouseDown = (e: React.MouseEvent) => {
  if (windowZoomActive && e.shiftKey) {
    const rect = svgRef.current?.getBoundingClientRect();
    setSelectionRect({ 
      x: e.clientX - rect.left, 
      y: e.clientY - rect.top, 
      width: 0, 
      height: 0 
    });
  }
};

// ... similar handlers for mousemove and mouseup

// In SVG JSX:
{selectionRect && (
  <rect
    x={selectionRect.x}
    y={selectionRect.y}
    width={selectionRect.width}
    height={selectionRect.height}
    fill="rgba(41, 182, 246, 0.2)"
    stroke="#29b6f6"
    strokeWidth="2"
    strokeDasharray="5,5"
  />
)}
```

## Testing Results

### Before Fix:
- ❌ Duplicate zoom controls visible
- ❌ Lines not displaying
- ❌ Window zoom not working

### After Fix:
- ✅ Single set of zoom controls (MapControls only)
- ⚠️ Lines still need investigation
- ⏳ Window zoom needs stage implementation

## Next Actions

### Immediate (High Priority):
1. **Debug line rendering**:
   ```bash
   # Add console.logs to see data flow
   # Check browser DevTools Elements tab for SVG structure
   # Verify layout prop contains nodes
   # Verify edges array is populated
   ```

2. **Verify MapSettingsControls state**:
   - Check if "Show Lines" is toggled ON
   - Check localStorage for persisted settings

3. **Test with sample data**:
   - Scan a directory to generate layout
   - Verify nodes AND edges appear

### Medium Priority:
4. **Implement window zoom selection rectangle** in stages
5. **Test all zoom functions** work across all 4 modes
6. **Update documentation** with new zoom architecture

### Low Priority:
7. Performance testing with large datasets
8. Add smooth zoom animations
9. Add zoom level indicator

## Files Modified in This Fix

1. ✅ `src/visualization/stage/metro-stage-svg.tsx`
   - Removed duplicate zoom controls (lines 521-561)
   - Removed unused `metroButtonStyle` constant
   - Added event listeners for centralized zoom (lines 187-204)

## Commands to Test

```bash
# Rebuild and run
npm run build
npx electron .

# Or use dev mode
npm run dev
```

## Expected Behavior

### Zoom Controls:
- ✅ Single set of controls visible per mode
- ✅ Located consistently in top-center of viewport
- ✅ All modes respond to same controls
- ✅ Keyboard shortcuts work (Ctrl+Plus, Ctrl+Minus, Ctrl+0)

### Lines Display:
- ⚠️ Lines should connect all nodes in tree structure
- ⚠️ Lines should be visible with gray color (#95a5a6)
- ⚠️ Lines should have 7px stroke width and 0.7 opacity

### Window Zoom:
- ⏳ Button toggles mode on/off
- ⏳ Shift+Drag draws selection rectangle
- ⏳ Release zooms to selected area

## Known Working Features

✅ Centralized ZoomContext
✅ MapControls component
✅ MapSettingsControls component
✅ Event system (metro:zoomIn, metro:zoomOut, metro:fitToView)
✅ Keyboard shortcuts
✅ All 4 modes using unified zoom
✅ No duplicate controls

## Remaining Issues

⚠️ Lines not displaying (needs investigation)
⏳ Window zoom selection (needs implementation)
⏳ ZoomToArea implementation in stages

## Debugging Guide

### Check if lines are in DOM:
1. Open DevTools (F12)
2. Elements tab
3. Find `<svg>` element
4. Look for `<g class="edges">`
5. Count `<line>` elements

### Check if data is loaded:
1. Console tab
2. Look for `[MetroStageSVG]` logs
3. Check layout.length and edges.length

### Check MapSettings:
1. Click MapSettings panel (bottom-left)
2. Verify "Show Lines" is checked
3. Check line width slider > 0

### Force refresh:
```bash
# Clear cache and rebuild
rm -rf dist/
npm run build
npx electron .
```
