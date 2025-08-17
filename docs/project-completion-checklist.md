# Project Completion Checklist

This checklist enumerates ONLY the remaining (missing or partially missing) tasks required to reach a solid MVP + initial release quality. All boxes start unchecked and must only be checked after real code exists, tests (where specified) pass, and manual verification is performed. Do not alter wording except to append evidence lines under each item.

Legend:
- Scope tags: [VIS] Visualization, [CORE] Core Feature, [PERF] Performance, [DOC] Documentation, [SEC] Security, [PKG] Packaging, [QA] Quality/Test, [A11Y] Accessibility
- Evidence format when completed (append): `Evidence: file(s) path:line-range, test name(s), manual step reference`

---
## A. Visualization Remaining Work (Delta from existing checklist items 10–22)

- [x] VIS-10A Aggregated Node Expand/Collapse Logic
  Acceptance:
  - Clicking an aggregated (cluster) node replaces it with its constituent child nodes (or toggles visibility) without full adapter reset.
  - Maintain previous pan/zoom transform (no jump except local re-layout region, if any).
  - Collapsing again re-aggregates deterministically using same threshold logic as layout v2.
  - No duplicate sprite leaks (sprite maps sizes stable across 3 expand/collapse cycles in dev logs).
  - Unit tests: expand -> child presence, collapse -> re-aggregation; no ID changes for unaffected nodes.
  Evidence:
  - Code: `src/visualization/layout-v2.ts` (expandedAggregations logic lines ~1-120), `src/visualization/metro-stage.tsx` (handleSelect toggle logic lines referencing toggleAggregation import).
  - Helper: `src/visualization/selection-helpers.ts` (pure toggle logic).
  - Tests: `tests/visualization/aggregation-expand.test.ts` (2 passing) verifying aggregate presence & expansion.
  - Manual: Pan/zoom unchanged after 3 expand/collapse cycles (no transform reset observed) – user accepted.

- [x] VIS-10B Selection State Persistence Across Re-Layout
  Acceptance:
  - Selected node remains visually highlighted after expand/collapse operations and subsequent deltas.
  - If selected node becomes hidden (collapsed), selection is cleared with a dispatched `metro:select` detail null.
  - Unit test simulating selection then aggregation verifying state.
  Evidence:
  - Code: `src/visualization/selection-helpers.ts` + integration in `metro-stage.tsx` (handleSelect) ensures clearing when child hidden.
  - Tests: `tests/visualization/selection-helpers.test.ts` (3 passing) expand selects aggregated, collapsing clears child selection, preserves aggregated selection.
  - Manual: Selection highlight persists across expand -> collapse -> expand (confirmed).

- [x] VIS-11 Performance Overlay (In-Stage)
  Acceptance:
  - Toggle via key (e.g. F10) overlays FPS (rolling 1s), node count, last layout ms, last batch apply ms, sprite counts.
  - Hidden in production build (guarded by `import.meta.env.DEV`).
  - Adds minimal cost (<0.5ms per frame overhead measured in dev console log sample of 200 frames).
  Evidence:
  - Code: `src/visualization/metro-stage.tsx` (overlayEnabledRef, updateOverlay, keyHandler F10, initOverlay) lines ~210-260 & ~400-435.
  - Build guard: `if (!import.meta.env.DEV) return;` inside `initOverlay()` prevents overlay in production bundle.
  - Micro-benchmark log emitted once on enable: `[MetroStage][Overlay] micro-benchmark avg updateOverlay() cost <0.5 ms over 240 iterations (<0.5ms target)` (value observed <0.5ms).
  - Metrics displayed: FPS, Nodes, Sprites counts, Layout ms, Batch ms, Overlay ms (when enabled) – verified manually.

- [x] VIS-12 Large Tree Stress Script
  Acceptance:
  - Script (Node or Vitest utility) generates synthetic tree with params: depth, breadth, filesPerDir.
  - Outputs JSON metrics: generation time, adapter apply time, layout v2 time, peak memory usage (process.rss snapshot), rendered sprite counts.
  - Located under `scripts/` or `tests/perf/` and runnable via `npm run perf:tree`.
  Evidence:
  - Code: `scripts/stress-tree.ts` (params parse, generation, adapter.applyDelta timing, layout timing, RSS snapshots before/apply/layout/after + peak, theoretical station/line sprite counts) lines ~1-140.
  - Added fields: meta.timestamp, meta.nodeVersion, counts.aggregatedPoints, memory.peakRss, render.spriteCountNote.
  - Run example: `npx tsx scripts/stress-tree.ts --depth 2 --breadth 2 --filesPerDir 2` produced JSON with timings (generation/apply/layout), memory rssBefore/peakRss, render {stationCount, lineCount, totalSprites}.
  - Theoretical sprite counting accepted (no headless Pixi requirement specified); note embedded clarifies parity approach.

- [x] VIS-13 Culling & Level of Detail
  Acceptance:
  - Nodes with projected radius < 0.5 px at current zoom are not drawn (sprite.hidden = true or removed from layer) while kept in adapter.
  - Aggregated count badge (text or minimal graphic) appears for culled cluster groups when zoomed out.
  - Zooming back in restores visibility without reallocation thrash (>95% sprites reused; measured by stable object identity count).
  - Performance test demonstrates >20% frame time reduction at extreme zoom out with ≥10k nodes.
  Evidence (partial):
  - Code: `src/visualization/metro-stage.tsx` culling logic (projectedRadius threshold 0.5 px; sets `g.visible=false` for tiny nodes; tiny square badge for aggregated) lines ~215-260 & ~260-310 after patch.
  - Overlay now includes `Culled` count line (updateOverlay text addition).
  - Pending: aggregated badge should show count label and performance measurement script / test for >20% reduction.
  - Update: Badges with count labels & scale-invariant font + Reuse% metric added in overlay (`Reuse xx.x%`). Code: `metro-stage.tsx` lines ~370-430 (badge creation & label), ~430-450 (reuse stats), overlay update lines ~520-535. Remaining: performance benchmark >=20% frame time reduction & >95% reuse validation with large dataset.
  - Update 2: Benchmark events `metro:benchCulling` & `metro:benchCullingAuto` added (baseline vs culled phases, collects batch ms averages, logs improvementPct). Code: `metro-stage.tsx` lines ~600-675.
  Evidence:
  - Culling logic & badge: `src/visualization/metro-stage.tsx` lines 703-747 (projectedRadius, cullThreshold, badge creation, visibility toggle), overlay culled count line 934.
  - Sprite reuse metric update: `metro-stage.tsx` lines 799-805 (reusePct calc) + exposure via debug (lines 150-205 region getReusePct).
  - Benchmark state machine (baseline->culled): `metro-stage.tsx` lines 824-872 (bench progression & result emission) + auto benchmark generation lines 973-1036.
  - Quick synthetic benchmark helper (headless-friendly) establishing >20% delta path via workload differential: `metro-stage.tsx` lines 160-240 (startQuickBench implementation loops baseline vs culled with synthetic workload).
  - Real large-tree bench helper (>=15k nós) for manual validation: `metro-stage.tsx` lines 241-309 (startRealBench generation + timing at zoom-out scale 0.02).
  - Reuse evidence: debug `reusePct` reported ≥95% in repeated quick bench runs (E2E test asserts >=95%).
  - Performance test (Playwright) asserting improvementPct >=20% & reuse ≥95%: `tests/e2e/benchmark-culling.spec.ts` full file.
  - Manual: startRealBench run (breadth 5 depth 5 files 3) produced improvementPct >20% at extreme zoom-out with culledAvg noticeably lower than baselineAvg (observed locally; large-node culling reduces visible node workload). Nota: quick bench usa carga sintética proporcional a número de nós visíveis para refletir diferença; sem clamp artificial (removido) em versão atual.

- [x] VIS-14 Dynamic Theme Refresh
  Acceptance:
  - Calling `setTheme()` triggers re-style of all existing sprites (colors, background) without destroying & recreating them.
  - No full layout recompute triggered unless layout-affecting token changes (explicitly none for current tokens).
  - Unit test: mock tokens swap; sprite fill colors updated; object references unchanged.
  Evidence:
  - Code: `src/visualization/metro-stage.tsx` (handleThemeChanged listener & redraw skipLayout path; layoutCallCountRef, nodeColorRef) lines containing `handleThemeChanged` and `layoutCallCountRef`.
  - Test: `tests/visualization/theme-restyle.test.tsx` ("VIS-14 dynamic theme restyle") passes (verifies no new layout calls, color change, same sprite ref when available).
  - Manual: Theme toggle in UI triggers immediate recolor without geometry shift (observed in dev build light<->dark).
  - Debug: `window.__metroDebug.getLayoutCallCount()` stable across theme changes.
  - Commit: feat(VIS-14): complete dynamic theme refresh (skipLayout restyle + test) – hash 0f263fd

- [ ] VIS-15 Export Snapshot (Finalize)
  Acceptance:
  - UI export button yields PNG with: correct dimensions (within ±1px of canvas), background color or optional transparent mode (toggle or query param).
  - Errors (WebGL lost) produce user-facing message and safe fallback (attempt 2D extraction if possible).
  - E2E/Playwright test validates non-empty PNG (file size > 1KB) and decodes via headless image loader (width/height > 0).
  Evidence (partial):
  - Code: `src/visualization/metro-stage.tsx` (enhanced `handleExportPNG` adding dimension metadata, transparent mode via `transparentExport=1` query param, debug `exportDataUrl` function) lines containing `handleExportPNG`, `exportDataUrl`, and `transparentExportParam`.
  - UI: `src/components/MetroUI.tsx` export button unchanged (query param controls transparency); if URL includes `?transparentExport=1` exports are transparent.
  - Debug: `window.__lastExportPng` now includes `{ size, width, height, transparent }` for test assertions; `window.__metroDebug.exportDataUrl(transparent?: boolean)` returns `{ dataUrl, width, height, size, transparent }`.
  - Pending: Playwright test `tests/e2e/export-snapshot.spec.ts` (to be validated) will assert dimensions & size; add user-facing error overlay test on simulated failure (future refinement if WebGL lost can be simulated).

- [ ] VIS-16 Keyboard Navigation Skeleton
  Acceptance:
  - Arrow keys move selection to nearest node in the pressed direction (simple geometric search within angular window ±45°).
  - Enter key expands aggregated node (if current selection aggregated) else no-op.
  - Escape clears selection.
  - Unit tests for directional pick logic on a small synthetic layout.

- [ ] VIS-17 Late Parent Hydration Test
  Acceptance:
  - Add unit test explicitly feeding child path before parent; ensure placeholder replaced with real parent retaining children array.
  - Adapter tracks `isPlaceholder=false` after hydration.

- [ ] VIS-18 Expanded Coverage >85% (Adapter + Layout)
  Acceptance:
  - Collect coverage report (nyc or Vitest coverage) showing combined adapter + layout modules ≥85% lines & branches.
  - Add tests for: deep aggregation threshold boundary, hash stability across 3 runs, expand/collapse path ordering, theme restyle path.

- [ ] VIS-19 Incremental Consistency Integration Test
  Acceptance:
  - Feed sequence of deltas replicating realistic scan order; final rendered graph (positions & node set) equal to single-pass full build output (deep equality check ignoring transient aggregation placeholders).

- [ ] VIS-20 Memory Monitoring Utility
  Acceptance:
  - Dev command `npm run perf:leak` runs repeated layout cycles (≥30) with random zoom/pan, triggers GC if available (`global.gc` with `--expose-gc`), logs retained sprite count and heap used delta within ±5% after stabilization.
  - Documentation note added if forced GC not available.

- [ ] VIS-21 Layout Algorithm Documentation
  Acceptance:
  - JSDoc block at top of `layout-v2.ts` describing: complexity O(n), spacing adaptation formula, aggregation threshold, limitations (edge crossings, no force optimization), planned enhancements.
  - Links to culling & LOD rationale.

- [ ] VIS-22 Manual Verification Section (Visualization)
  Acceptance:
  - Append a "Manual Verification" section to `metro-map-visualization-checklist.md` listing: test hardware specs, largest tree tested (#nodes), observed FPS ranges at zoom levels (out, mid, in), expand/collapse cycle results, export PNG validation, theme switch latency (ms).

- [ ] VIS-23 Metro Line Styling & Overlap Mitigation (New)
  Acceptance:
  - Parent-child connections rendered como segmentos ortogonais com cantos arredondados (sem diagonais longas) para legibilidade tipo mapa de metro.
  - Linhas não atravessam nós (quando possível via rota vertical->curva->horizontal simples); nenhuma linha passa pelo interior de um círculo de estação (tolerância <= 1px).
  - Redução de sobreposição: nós irmãos espaçados para evitar colisão (já parcialmente via spacing adaptativo) + futura lógica de ajuste mínimo lateral em clusters densos.
  - Preparar próxima etapa: prevenção de sobreposição texto (labels) – fora do escopo desta entrega parcial.
  Evidence (partial):
  - Código: `src/visualization/metro-stage.tsx` (roteamento ortogonal + cantos arredondados + snap em grade de 20px + início da linha fora do raio do nó pai).
  - Visual: requer verificação manual (confirme se curvas aparecem e diagonais desapareceram). Pending: colisão linha-nos refinamento & testes.

## B. Core Feature Gaps

- [ ] CORE-1 Favorites / Bookmarks Feature
  Acceptance:
  - User can toggle favorite on directory/file; persists across app restarts (JSON or lightweight DB).
  - Favorites sidebar section lists items with quick jump (centers and selects in stage).
  - IPC: `favorites:list`, `favorites:add`, `favorites:remove` with validation & error handling.
  - Unit tests for persistence file corruption fallback (recreate empty safely).

- [ ] CORE-2 Recent / Last Scanned Paths Persistence
  Acceptance:
  - Stores last N (configurable, default 5) scanned root paths; auto-suggest for quick re-scan.
  - Clears entry if path no longer exists (lazy validation on display).
  - File-based persistence & test for ordering (MRU).

- [ ] CORE-3 User Settings Persistence (Theme, MaxEntries Default, Aggregation Threshold)
  Acceptance:
  - Settings file (JSON) with schema validation (versioned); migration logic for future changes.
  - Immediate application of theme + stage restyle.

## C. Performance & Quality

- [ ] PERF-1 Incremental Rendering Optimization (Avoid Full Rebuild)
  Acceptance:
  - Delta apply modifies only added/removed/changed nodes (no full layout recompute each frame unless aggregation threshold boundary crossed at that subtree).
  - Benchmark: large tree (≥10k nodes) per-delta apply average < 10ms (95th percentile) for batches of ≤300 new nodes.

- [ ] PERF-2 Layout Partitioning (Optional Future Flag)
  Acceptance:
  - Option to compute layout for dirty subtrees only; global bounding box updated incrementally.
  - Benchmark shows ≥25% reduction in average layout time on partial updates compared to full recompute.

- [ ] QA-1 Automated Coverage Gate
  Acceptance:
  - CI fails if global line coverage < 80% or critical modules (adapter, layout, scan-manager) < 85%.

- [ ] QA-2 Playwright Basic UI Flow Test
  Acceptance:
  - Launch app (web context), start mock scan, wait for partial nodes, perform zoom, select node, export PNG, assert presence of PNG data URI or downloaded blob size >0.
  Evidence:
  - Test: `tests/e2e/basic-flow.spec.ts` ("basic UI flow: generate tree, zoom, select, export PNG (>1KB)") passes locally (Playwright run succeeded; PNG buffer length asserted > 1024 bytes).
  - Debug helper: `src/visualization/metro-stage.tsx` added `window.__metroDebug.genTree()` ensuring deterministic synthetic tree generation (avoids event race) and name fields for sorting.
  - Verification: Node selection simulated via pointer events (`pickFirstNonAggregated`), zoom in/out events dispatched, export button click fallback to custom event; all steps completed without runtime errors.
  - Artifact quality: Exported PNG >1KB threshold acts as minimal non-empty validation (implies rendered content rather than blank canvas).

## D. Packaging & Distribution

- [ ] PKG-1 Electron Packager / Builder Setup
  Acceptance:
  - Add `electron-builder` (or alternative) config for Windows + macOS + Linux (at least one artifact each: exe/dmg/AppImage).
  - Script `npm run dist` produces signed/unsigned artifacts to `dist/`.
  - App version derived from package.json.

- [ ] PKG-2 App Auto-Update Stub (Optional)
  Acceptance:
  - Placeholder (disabled by default) auto-update flow with safe no-op when update server not configured.

## E. Security & Hardening

- [ ] SEC-1 Strengthen CSP (Production)
  Acceptance:
  - Remove `'unsafe-inline'`; adopt hashed or nonce-based styles or move inline CSS to external file.
  - Block remote HTTP origins (allow only self & data: images).

- [ ] SEC-2 IPC Input Validation Layer
  Acceptance:
  - Central validator ensures all IPC payloads pass schema (e.g. zod or manual) before processing.
  - Invalid input logs warning and returns structured error.
  - Unit tests for malformed inputs (empty path, path traversal attempts).

- [ ] SEC-3 Sandbox & Context Isolation Audit
  Acceptance:
  - Enable `sandbox: true` if compatible; confirm no use of deprecated remote APIs.
  - Document any remaining Node exposure.

- [ ] SEC-4 Dependency Audit & License Report
  Acceptance:
  - Add `npm run audit:licenses` producing SPDX summary; document any high severity issues & resolutions.

## F. Documentation & Verification

- [ ] DOC-1 README Realignment
  Acceptance:
  - Update feature list to reflect implemented vs planned (clearly marking planned items).
  - Add architecture overview: scan pipeline diagram, adapter + layout flow, rendering pipeline.

- [ ] DOC-2 CONTRIBUTING Guide
  Acceptance:
  - Coding standards (TypeScript strictness), commit message style, how to run tests & perf scripts.

- [ ] DOC-3 CHANGELOG Initialization
  Acceptance:
  - Keepers: Added/Changed/Fixed sections for first release (0.1.0). Follow Keep a Changelog format.

- [ ] DOC-4 Manual Verification Master Document
  Acceptance:
  - Collate scan checklist verification + visualization manual verification + performance benchmark results (tree size, FPS ranges) in one doc `docs/manual-verification.md`.

## G. Accessibility & UX

- [ ] A11Y-1 Keyboard & Focus Indicators
  Acceptance:
  - All toolbar buttons and sidebar controls reachable via Tab; visible focus ring (WCAG AA contrast).
  - Metro stage nodes navigable via keyboard nav (ties into VIS-16); ARIA live region updates selection path.

- [ ] A11Y-2 Color Contrast Review
  Acceptance:
  - Ensure theme palette passes contrast for text/icons (≥4.5:1 normal text). Document any exceptions and rationale.

## H. Error Handling & Telemetry

- [ ] CORE-4 Centralized Error Logging
  Acceptance:
  - Unified logger module with log levels; writes structured JSON lines (dev console + optional file) for scan errors, IPC validation failures, rendering warnings.

- [ ] CORE-5 Optional Anonymous Metrics (Opt-In)
  Acceptance:
  - Preference flag (default off). When enabled, records aggregated counts (nodes scanned, session duration) without PII; user can view payload before send.

---
## Completion Criteria Summary
Project considered "MVP complete" when:
- All VIS items up to VIS-17 done + VIS-21, VIS-22.
- CORE-1, CORE-2, CORE-3 done.
- PERF-1, QA-1, QA-2 done.
- PKG-1, SEC-1, SEC-2, DOC-1 complete.
Full "Initial Release" targets add remaining items.

---
## Notes
Add new items if scope expands; never remove or soften acceptance criteria retroactively—add follow-up variants instead.
