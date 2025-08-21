# Architecture Overview

This document summarizes the high-level architecture and module responsibilities for the CircuitExp1 Metro-map visualizer.

## High-level layers

- Electron Main (Node)
  - File: `electron-main.cjs`
  - Responsibilities: app lifecycle, BrowserWindow creation, secure BrowserWindow options (sandbox, contextIsolation), IPC handlers for favorites, recent scans, settings, and scan orchestration.
  - Persistence helpers: `favorites-store.cjs`, `recent-scans-store.cjs`, `user-settings-store.cjs`.

- Preload (Bridge)
  - Files: `preload.cjs`, `preload.js`
  - Responsibilities: expose a minimal, well-typed API surface to the renderer. Only curated functions are exported (no full Node exposure).

- Renderer (React + PixiJS)
  - Entry: `src/main.tsx` (or platform equivalent)
  - Key modules:
    - `src/visualization/metro-stage.tsx` — main stage managing Pixi containers, sprite lifecycle, culling, and overlays.
    - `src/visualization/layout-v2.ts` — deterministic layout algorithm used to compute station positions and aggregation.
    - `src/visualization/graph-adapter.ts` — converts filesystem scan deltas into adapter deltas for layout/rendering.
    - `src/visualization/line-routing.ts` — computes orthogonal rounded routes for metro lines.
  - Debug hooks: `window.__metroDebug` provides runtime helpers for perf probes and snapshot export during tests.

- Validation & Security
  - `ipc-validation.cjs` — central validator used in main handlers. Guards include `noTraversal` for path inputs and shape/type checks for IPC payloads.
  - Content Security Policy is hardened in production builds (`electron-main.cjs`).

- Build, Test & CI
  - Tests: Vitest unit tests + Playwright E2E projects. Configs in `vitest.config.ts` and `playwright.config.ts`.
  - Scripts: `scripts/` contains perf helpers (`stress-tree.ts`, `perf-leak.ts`) and audit helpers (`audit-licenses.cjs`).
  - Packaging: `electron-builder` configuration is stored via `package.json` build block and helper scripts for icon generation.

## Data flow (simplified)
1. Renderer requests scan via IPC `scan:start` → Main spawns scan manager (`scan-manager.cjs`) → emits deltas to main.
2. Main sanitizes payloads via `ipc-validation.cjs` then forwards deltas to renderer via `scan:delta` IPC.
3. Renderer `graph-adapter` applies deltas → `layout-v2` computes positions → `metro-stage` updates sprites (culling & LOD applied).

## Where to look for implementation
- IPC & stores: `electron-main.cjs`, `favorites-store.cjs`, `recent-scans-store.cjs`, `user-settings-store.cjs`.
- Renderer: `src/visualization/metro-stage.tsx`, `src/visualization/layout-v2.ts`, `src/visualization/graph-adapter.ts`, `src/visualization/line-routing.ts`.
- Tests & audits: `tests/` (unit/e2e), `scripts/audit-licenses.cjs`, `licenses-summary.json`, `npm-audit.json`.

## Notes
- Packaging on Windows may require elevated privileges for symlink creation during local builds; CI is recommended for producing signed installers.
- The architecture favors a small, safe preload surface and deterministic layout for reproducible tests.

