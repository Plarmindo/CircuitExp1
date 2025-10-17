# London Metro Map-Style Disk Folder Visualizer

This project is a cross-platform desktop application built with Electron, React, TypeScript, and D3.js/PixiJS. It
visualizes disk folder structures in a London Metro Map style, supporting interactive zoom/pan, bookmarks, and file
system access.

## Features

### Core Features
- **Metro-Style Visualization**: Interactive London Metro Map-style directory visualization with PixiJS
- **Fast Scanning**: High-performance directory scanning (7,400+ nodes/sec)
- **Interactive Navigation**: Zoom, pan, and explore directory structures
- **Bookmarks**: Save and manage favorite directories
- **Cross-Platform**: Windows, macOS, and Linux support

### New Features (Week 2)

#### 🕒 Recent Scans Quick Access
- **One-click re-scanning** of recently viewed directories
- **Smart path display** with automatic shortening for long paths
- **Persistent history** across sessions
- **Quick access panel** with expand/collapse functionality
- View last 10 scanned directories with timestamps

#### ⚡ Real-time Scan Progress Indicator
- **Live progress bar** showing 0-100% completion
- **Node count tracking** (processed / total nodes)
- **Throughput calculation** (nodes/second display)
- **Time estimation** (elapsed time and estimated remaining)
- **Visual feedback** with smooth animations and status colors
- **Cancel support** for long-running scans

#### 🔄 Progressive Loading Optimization
- **Incremental rendering** as scan results arrive
- **Batched updates** to avoid UI blocking
- **Smooth performance** even with 100K+ nodes
- **Configurable batch sizes** for optimal performance
- **FPS monitoring** to maintain responsive UI

## Features & Architecture

This project combines a lightweight Electron main process (IPC + stores) with a renderer built in React and PixiJS for
the interactive Metro-style visualization. Key components:

- `electron-main.cjs` — app lifecycle, IPC handlers, and wiring to persistence stores (`favorites-store.cjs`,
  `recent-scans-store.cjs`, `user-settings-store.cjs`).
- `preload.cjs` / `preload.js` — whitelist of safe IPC bridges exposed to the renderer under `window.__metroAPI`.
- `src/visualization/*` — rendering stage (`metro-stage.tsx`), layout algorithm (`layout-v2.ts`), graph adapter
  (`graph-adapter.ts`), and routing helpers (`line-routing.ts`).
- `ipc-validation.cjs` — central IPC payload validator used by main handlers to harden inputs.
- `scripts/` and `tests/` — perf scripts, benchmarks and unit + E2E tests (Vitest + Playwright).

See `docs/architecture-overview.md` for a consolidated diagram and a brief module map.

## Getting Started (Development)

1. Install dependencies: `npm install`
2. Start the renderer dev server (Vite): `npm run dev`
3. In a second terminal start Electron pointing at the dev server: `npm start`
4. Or run both together with auto orchestration: `npm run dev:all`

## Building Production UI

Build static renderer assets into `dist/`: `npm run build:ui`

## Packaging Desktop App

Generates installers / artifacts (NSIS & portable on Windows, dmg on macOS, AppImage on Linux): `npm run dist`

Artifacts are emitted to the `dist/` output folder managed by electron-builder (`dist/*.exe`, `.dmg`, `.AppImage`).
Ensure you ran tests before packaging.

## Test & Quality

- Unit tests: `npm test`
- Watch mode: `npm run test:watch`
- E2E (Playwright): `npm run test:e2e`
- Coverage (CI target): `npm run coverage:ci`

## Performance / Bench

- Synthetic large tree: `npm run perf:tree`
- Memory leak probe: `npm run perf:leak`

### Performance Benchmarks

The application has been rigorously tested for performance and scalability:

| Directory Size | Target | Actual Performance | Status |
|---------------|--------|-------------------|--------|
| Small (100 nodes) | < 1s | 26ms | ✅ 38x faster |
| Medium (10K nodes) | < 10s | 2.08s | ✅ 4.8x faster |
| Large (100K nodes) | < 2min | 21.55s | ✅ 5.6x faster |

- **Average Throughput**: 7,400 nodes/second
- **Memory Efficiency**: < 10MB for 100K nodes
- **Memory Leaks**: None detected (10-iteration stress test)
- **Scalability**: Linear O(n) performance confirmed

See `DAY6_PERFORMANCE_COMPLETE.md` for detailed performance analysis.

## Security & Production Features

The app implements comprehensive security measures for production deployment:

- **Strict Security Model**: Uses `contextIsolation: true` with no `nodeIntegration`
- **Input Validation**: Comprehensive IPC validation via `ipc-validation.cjs`
- **Path Traversal Protection**: Prevents unauthorized file system access
- **Content Security Policy**: Production-hardened CSP with nonce-based inline script support
- **Code Signing**: Multi-platform code signing (Windows EV, macOS Developer ID, Linux GPG)
- **PII Detection**: Automatic detection and redaction of sensitive information
- **Rate Limiting**: Protection against abuse and resource exhaustion

## Production Deployment

### Code Signing Setup

1. **Configure Environment**: Copy `.env.code-signing.template` to `.env` and fill in your certificate details
2. **Setup Code Signing**: Run `npm run setup:code-signing` to configure certificates
3. **Build Signed Packages**: Use `npm run build:signed` for production builds
4. **Verify Signatures**: Run `npm run verify:signatures` to validate signed packages

### Production Build Commands

- **Signed Windows Build**: `npm run dist:win:signed`
- **Signed macOS Build**: `npm run dist:mac:signed`
- **Signed Linux Build**: `npm run dist:linux:signed`
- **All Platforms**: `npm run build:signed`

### Security Verification

- **Signature Verification**: `npm run verify:signatures`
- **Security Audit**: `npm run audit:security`
- **Dependency Check**: `npm run audit:deps`

See `PRODUCTION_DEPLOYMENT.md` for detailed deployment instructions and `SECURITY_HARDENING_GUIDE.md` for security configuration.

## Roadmap (High-Level)

- Enhanced accessibility features (keyboard navigation, screen reader support)
- Advanced filtering and aggregation UI
- Export functionality for reports and snapshots
- Multi-language internationalization support
