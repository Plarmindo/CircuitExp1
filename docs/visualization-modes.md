# Visualization Modes: Drawer Explorer, Semantic Zoom + Drill-in, Split View

This document proposes adopting three complementary visualization modes (like "themes" for layout/behavior) that users can switch between without losing context. The goal is to reduce overwhelm while maintaining speed and discoverability.

## Executive summary
- Modes to ship side-by-side:
  1) Drawer Explorer (right-side file drawer tied to selection)
  2) Semantic Zoom + Drill-in (zoom thresholds with context overlays)
  3) Split View (persistent map + file browser with resizable splitter)
- Keep one shared rendering engine and global state; modes are shells that compose UI around the engine.
- Decouple layout “modes” from visual “themes” (color/typography/density).

## Modes overview
### Drawer Explorer
- What: Station click opens a right-side drawer with files/folders for that node; map stays full-width.
- Pros: Maintains spatial context; quick peek; minimal layout shift; great for small screens.
- Cons: Limited real estate; deep navigation can feel cramped; discoverability depends on click affordance.
- Best for: Triage, quick inspection, keyboard-centric users.

### Semantic Zoom + Drill-in
- What: Progressive disclosure by zoom thresholds (lines → stations → file summaries → thumbnails), with transient drill-in overlays.
- Pros: Extremely scalable; avoids clutter; high information density when zoomed in; power-user friendly.
- Cons: Learning curve; requires careful thresholds; overlay layering must avoid occluding targets.
- Best for: Large projects, analysis workflows, expert users.

### Split View
- What: Persistent file browser beside the map; selections are synchronized both ways; resizable splitter.
- Pros: Highest discoverability; great for compare and drag-and-drop; strong for documentation tasks.
- Cons: Uses horizontal space; can feel “busy” on small screens; two panes to manage.
- Best for: Wide monitors, daily browsing, onboarding.

## Architecture approach
- Mode registry (strategy pattern): id, label, capabilities, lazy-loaded render() that composes the shared engine + mode chrome.
- Shared state (context/store): selection, hover, filters, file view (grid/list), zoomLevel, focus; persists across mode switches (URL + localStorage).
- Shared map engine: single source of truth for pan/zoom, selection, culling/batching, and safety checks (viewport validation, WebGPU fallbacks).
- Theming independent of mode (light/dark/high-contrast, compact/comfortable density).

## Accessibility
- Drawer/Split: focus management, escape to close drawer, ARIA landmarks/labels, keyboard resize for splitter.
- Overlays: escape to dismiss; return focus to origin; visible focus rings; minimum contrast ratios.
- Keyboard: tab order across controls, arrow-key navigation for lists, +/- for zoom with aria-live updates.

## Performance
- Lazy-load modes with dynamic import; shared engine remains always-loaded.
- Maintain culling, batch draws, and safe resize/viewport validation to avoid GPU stalls.
- Preload likely assets when switching modes; cancel in-flight work on quick switches.

## Telemetry (opt-in)
- Mode adoption and dwell time; switches per session.
- Time-to-interaction after mode switch; overlay open latency.
- Errors (GPU fallback usage, resize failures), rage clicks, aborted drills.

## Risks & mitigations
- Mode drift (inconsistent behavior): centralize selection/zoom/filters in the store and keep mode shells thin.
- Bundle bloat: code-split each mode; tree-shake optional UI parts.
- State duplication: single source of truth; no per-mode forks for core state.
- Discoverability: add onboarding tips and mode descriptions on first use.

## Implementation plan (phased)
1) Extract VisualizationMode interface + registry; lift current prototypes behind shells. No UX change yet.
2) Add global Mode Switcher in Controls; persist to URL/localStorage; maintain selection/filters across switches.
3) Harden unified event contract (selection, hover, zoom, drill) and cross-mode persistence.
4) Add Theme Switcher and tokens (colors, typography, spacing, density) decoupled from modes.
5) Tests and performance baselines (load, select, filter, zoom per mode); feature flag in Settings for gradual rollout.

## Open questions
- Default mode: Split View (discoverability) or Drawer (lightweight)?
- Persistence: remember last-used mode per user and allow deep-linking (e.g., ?mode=split)?
- Semantic thresholds: target scale switches for line→station→file layers?
- Density defaults: compact vs comfortable?
- Keyboard priorities: which commands matter most for your users?

## Future ideas (for discussion)
- Hybrid auto-switch: adapt mode by screen size and zoom intent (overrideable by user).
- Adaptive density: increase information density with zoom-in and reduce at overview.
- Smart summarization: station/file cluster “roll-ups” (counts, types, recents) to reduce visual noise.
- Progressive previews: hover prefetching + lightweight previews in drawer/overlay.
- Compare mode: pin two stations or folders side-by-side within Split View.
- Collaborative cursors/annotations for shared reviews.

## Acceptance criteria (MVP)
- Users can switch modes without losing selection, filters, or zoom level.
- Each mode passes A11y smoke tests (keyboard, focus, contrast) and baseline perf targets.
- Deep-linking loads the requested mode and state restores from localStorage on refresh.

## Mode Switching (Mouse-Only)
- Users select between Drawer, Semantic Zoom, and Split View using the segmented Mode Switcher control in the UI header.
- Keyboard-based mode toggling is not available by design; use the mouse to switch modes.
- Deep-linking via `?mode=drawer|zoom|split` is supported at load time; subsequent mode changes require mouse interaction.
