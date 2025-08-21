# London Metro Map-Style Disk Folder Visualizer

This project is a cross-platform desktop application built with Electron, React, TypeScript, and D3.js/PixiJS. It visualizes disk folder structures in a London Metro Map style, supporting interactive zoom/pan, bookmarks, and file system access.

## Features

## Features & Architecture

This project combines a lightweight Electron main process (IPC + stores) with a renderer built in React and PixiJS for the interactive Metro-style visualization. Key components:

- `electron-main.cjs` — app lifecycle, IPC handlers, and wiring to persistence stores (`favorites-store.cjs`, `recent-scans-store.cjs`, `user-settings-store.cjs`).
- `preload.cjs` / `preload.js` — whitelist of safe IPC bridges exposed to the renderer under `window.__metroAPI`.
- `src/visualization/*` — rendering stage (`metro-stage.tsx`), layout algorithm (`layout-v2.ts`), graph adapter (`graph-adapter.ts`), and routing helpers (`line-routing.ts`).
- `ipc-validation.cjs` — central IPC payload validator used by main handlers to harden inputs.
- `scripts/` and `tests/` — perf scripts, benchmarks and unit + E2E tests (Vitest + Playwright).

See `docs/architecture-overview.md` for a consolidated diagram and a brief module map.

## Getting Started (Development)
1. Install dependencies: `npm install`
2. Start the renderer dev server (Vite): `npm run dev`
3. In a second terminal start Electron pointing at the dev server: `npm start`
4. Or run both together with auto orchestration: `npm run dev:all`

## Building Production UI
Build static renderer assets into `dist/`:
`npm run build:ui`

## Packaging Desktop App
Generates installers / artifacts (NSIS & portable on Windows, dmg on macOS, AppImage on Linux):
`npm run dist`

Artifacts are emitted to the `dist/` output folder managed by electron-builder (`dist/*.exe`, `.dmg`, `.AppImage`). Ensure you ran tests before packaging.

## Test & Quality
- Unit tests: `npm test`
- Watch mode: `npm run test:watch`
- E2E (Playwright): `npm run test:e2e`
- Coverage (CI target): `npm run coverage:ci`

## Performance / Bench
- Synthetic large tree: `npm run perf:tree`
- Memory leak probe: `npm run perf:leak`

## Security Notes
The app uses a strict preload with `contextIsolation: true` and no `nodeIntegration`. IPC channels are minimal; further hardening (CSP tightening for production, IPC validation) is pending.

## Roadmap (High-Level)
- Packaging hardening & signing
- IPC schema validation layer
- Accessibility (keyboard navigation, focus ring, color contrast)
- Enhanced aggregation + filtering UI
- Export snapshot / report
