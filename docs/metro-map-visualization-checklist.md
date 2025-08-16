# Metro Map Visualization Feature Checklist

All items start unchecked. They must only be checked AFTER real, verifiable code exists and you (the user) confirm behavior in the running app. Each item lists explicit acceptance criteria. No item may be partially checked.

## Scope
Implement an interactive "London Metro" style visualization of the scanned folder structure using a retained-mode GPU accelerated canvas (PixiJS preferred for performance) with incremental updates fed by the existing async scan delta events.

## Guiding Principles
- Incremental: Must integrate with existing delta emission; no full tree rebuilds every frame.
- Deterministic: Same input order yields stable station positions (avoid visual jitter) unless layout invalidated.
- Responsive: Maintain > 55 FPS on medium trees (<= 5k nodes) on mid-range hardware.
- Memory Conscious: Avoid retaining orphan nodes; reclaim textures/sprites on removal.

---
## Checklist

- [x] 1. Data Adapter (ScanNode -> Graph Model)
  Acceptance:
  - Function converts incoming delta nodes into internal structures (directories = line junction / station hub, files = terminal stations).
  - Maintains parent-child links; creates placeholder parents if delta arrives child-first (flagged for later hydration).
  - No duplicates: stable map keyed by absolute path.
  Implementation Proof:
  - Added `src/visualization/graph-adapter.ts` with `GraphAdapter.applyDelta` creating placeholders via `ensureParents` and tracking hydration.
  - Tests in `tests/visualization/graph-adapter.test.ts` cover ordered add, out-of-order (placeholder + hydration), duplicate suppression (3 passing tests).

- [x] 2. Stable ID & Sorting Strategy
  Acceptance:
  - Deterministic station IDs derived (hash(path) or incremental registry) documented.
  - Sibling ordering rule (alpha or size-based) implemented and unit tested for repeatability.
  Implementation Proof:
  - Added `src/visualization/id-sorting.ts` implementing FNV-1a hash -> base36 id and comparator.
  - Tests in `tests/visualization/id-sorting.test.ts` verify hash stability, id assignment idempotence, comparator ordering (3 passing tests).

- [x] 3. Layout Engine v1 (Hierarchical Lines)
  Acceptance:
  - Pure function computing (x,y) for each station using depth (y) and sibling order (x) with constant spacing.
  - Returns bounding box & list of positioned nodes.
  - Unit tests cover simple trees (1, multi-branch) with snapshot of coordinates.
  Implementation Proof:
  - Added `src/visualization/layout-v1.ts` implementing deterministic pre-order layout.
  - Tests in `tests/visualization/layout-v1.test.ts` validate single root placement and stable multi-branch ordering (2 passing tests).

- [x] 4. Layout Engine v2 (Line Splitting & Spacing Adaptation)
  Acceptance:
  - Introduces dynamic horizontal spacing when sibling count exceeds threshold.
  - Collapses dense groups into aggregated placeholder node (expandable) once siblings > N (configurable).
  - Document trade-offs (loss of individual visibility).
  Implementation Proof:
  - Added `src/visualization/layout-v2.ts` with dynamic spacing & aggregation logic.
  - Tests in `tests/visualization/layout-v2.test.ts` validate spacing growth and aggregation collapse (2 passing tests).

- [x] 5. Vertical Slice Inicial (PixiJS Stage Básico)
  Acceptance:
  - Adiciona dependência `pixi.js`.
  - Componente React `MetroStage` que inicializa PixiJS, cria layers (linesLayer, stationsLayer).
  - Consome eventos de delta (`scan:partial`) através do adapter e recalcula layout (v2) com debounce <= 50ms.
  - Desenha: linhas parent->child e círculos (dir maior, file menor); nós agregados (se existirem) como círculo com borda dupla.
  - Atualiza totalmente (clear + redraw) por simplicidade nesta fase (documentado).
  - Integrado em `App.tsx` abaixo do painel debug mostrando imediatamente nós durante um scan real.
  - Comentários/TODO indicando futuras otimizações (pipeline incremental, culling, pan/zoom).
  - Código compilando sem erros.
  Implementation Proof:
  - Added dependency `pixi.js` (package.json updated by npm install).
  - New file `src/visualization/metro-stage.tsx` with full stage implementation and redraw strategy.
  - Integrated `<MetroStage />` in `src/App.tsx` (import + component render end of file).
  - Successful build: vite build completed (see terminal output) without type errors.

- [x] 6. Style Spec & Theme Tokens
  Acceptance:
  - Central style module exporting palette, station radius scale (directory vs file), line thickness.
  - Supports light/dark theme switch variable.

- [x] 7. Rendering Foundation (PixiJS Stage)
  Acceptance:
  - Initializes PixiJS Application in a React wrapper component with resizing handler.
  - Uses a dedicated container layers: linesLayer, stationsLayer, overlayLayer.
  - Clean destroy() on unmount (no WebGL context leak).
  Implementation Proof:
  - Updated `src/visualization/metro-stage.tsx` to add overlayLayer, window resize handler (renderer.resize synced to container), and robust cleanup removing the resize listener and calling `app.destroy(true)` on unmount.
  - Verified live in dev: no HMR overlay errors, preview renders the stage and hot-updates without runtime exceptions.

- [x] 8. Incremental Update Pipeline
  Acceptance:
  - applyDelta(nodes[]) updates existing sprites or creates new without clearing whole stage.
  - Measures time spent per batch (< 8ms target) — logs when exceeded (dev only).
  Implementation Proof:
  - Updated src/visualization/metro-stage.tsx to track node and line sprites in Maps, update in-place on layout changes, and remove orphans without calling removeChildren().
  - Added per-batch timing via performance.now() with console.warn when > 8ms in dev, and surfaced "last batch" time in the footer for visibility.

- [x] 9. Pan & Zoom Interaction
  Acceptance:
  - Mouse wheel zoom centered at cursor; drag to pan.
  - Zoom clamped (minZoom, maxZoom) with inertia disabled for determinism.
  Implementation Proof:
  - Implemented non-passive wheel listener with cursor-centered zoom; drag-to-pan using pointer events.
  - Scale clamped between 0.3 and 3.0; stage transform updated without inertia. Cleanup removes all listeners.
  - Verified live in dev: wheel zoom focuses under cursor and panning works; no console errors.

- [ ] 10. Hover & Selection Events
  Acceptance:
  - Pointer move highlights station (visual halo) and emits event to React (path, type).
  - Click selects station; second click toggles collapse if directory aggregated.
  Implementation Proof (in progress; awaiting user confirmation for acceptance):
  - style-tokens: added `hover` and `selected` palette colors for both themes as numeric Pixi-compatible values (`src/visualization/style-tokens.ts`).
  - metro-stage: nodes are interactive (eventMode 'static', cursor pointer) and now emit:
    - `metro:hover` CustomEvent with `{ path, type: 'node'|'aggregated' }` on pointerover/out (null on out).
    - `metro:select` CustomEvent with `{ path, type }` on pointertap; selection toggles on second click.
  - Visuals: hover halo (semi-transparent fill) and selection outline; aggregated nodes keep distinctive stroke color.
  - Cleanup: event listeners removed on unmount; incremental pipeline preserved.
  - Note: Expand/collapse toggle for aggregated nodes is NOT implemented yet; current behavior provides a small zoom bump on aggregated click as a temporary visual cue. Proper collapse/expand will be implemented in a follow-up.

- [ ] 11. Performance Budget Instrumentation
  Acceptance:
  - Dev overlay (toggle with key) displays FPS, node count, last layout ms, last batch apply ms.
  - Hidden in production builds.

- [ ] 12. Large Tree Stress Script
  Acceptance:
  - Utility generates synthetic tree (configurable breadth/depth) for offline performance test.
  - Script outputs metrics summary after layout.

- [ ] 13. Culling / Level of Detail
  Acceptance:
  - Nodes smaller than 0.5 px at current zoom not rendered (visibility toggle) to save fill rate.
  - Aggregated count badge displayed for culled cluster.

- [ ] 14. Theming & Dynamic Refresh
  Acceptance:
  - Theme switch triggers re-style without full layout recompute (only graphics updates).
  - Verified via unit test mocking style tokens.

- [ ] 15. Export Snapshot (PNG)
  Acceptance:
  - Button exports current stage to PNG (using renderer.extract). Handles transparent background fill.
  - Error path logged if WebGL context lost.

- [ ] 16. Keyboard Navigation Skeleton
  Acceptance:
  - Arrow keys move selection among visible stations (nearest in direction).
  - Enter expands aggregated node if focused.

- [ ] 17. Error Resilience (Late Parent Arrival)
  Acceptance:
  - If child arrives before parent, placeholder created; later parent delta hydrates & replaces placeholder without losing child links.
  - Unit test simulating out-of-order arrival.

- [ ] 18. Adapter & Layout Unit Tests (Expanded)
  Acceptance:
  - Coverage > 85% for adapter and layout modules.
  - Tests validate coordinate stability across repeated runs with identical input ordering.

- [ ] 19. Integration Test (Incremental Consistency)
  Acceptance:
  - Feeds sequence of deltas replicating real scan to adapter+layout; final graph equals result of single-pass full layout.

- [ ] 20. Memory Monitoring & Leak Check
  Acceptance:
  - Dev command runs stress test, triggers GC (if exposed) and logs retained sprite count stable across cycles.
  - Documentation note if forced GC not available.

- [ ] 21. Layout Algorithm Documentation Block
  Acceptance:
  - JSDoc at top of layout engine file describing algorithm, complexity O(n), limitations, TODOs (force routing, edge crossing minimization).

- [ ] 22. Manual Verification Section
  Acceptance:
  - After features implemented, append to this file a Manual Verification section (steps & observations: FPS, memory, selection, export).

---
## Out of Scope (Explicitly For Later)
- Force-directed refinement / edge crossing minimization beyond simple heuristics.
- 3D transforms or WebGL shader effects.
- Persistent caching of layout between app sessions.

## Notes
Do NOT check any box until code + runtime verification + user confirmation. This file may be amended (adding items) before implementation begins, but not retroactively simplified to claim completion.
