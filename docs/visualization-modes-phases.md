# Visualization Modes — Production Phases and Task Breakdown

This plan operationalizes the integration of three visualization modes (Drawer Explorer, Semantic Zoom + Drill-in, Split View) into the main UI with first-class support for Favorites and Recents, accessibility, performance, and telemetry.

## Scope
- Add selectable visualization modes with safe defaults and deep-linking.
- Unify fast navigation (Favorites/Recents) across modes.
- Ensure A11y, performance, and reliability standards.
- Stage rollout with feature flags and telemetry.

---

## Phase 1 — Infrastructure & Scaffolding (ACTIVE)
Foundational work to enable modes without feature parity pressure.

Deliverables:
- VisualizationMode enum + mode registry (strategy pattern).
- ModeProvider context + persistence (URL param + user settings).
- Mode Switcher control in shell (MetroUI) with keyboard/ARIA.
- Shell components for Drawer, Semantic Zoom, Split View (lean placeholders using shared map engine where applicable).
- Unified navigation API that abstracts Favorites and Recents.
- Feature flag to gate the feature (env + settings).
- Telemetry event schema and minimal instrumentation for mode switch and navigation actions.

Acceptance criteria:
- App boots in default mode; user can switch modes without full reload.
- Last-used mode persists; URL deep link (?mode=drawer|zoom|split) is respected.
- Favorites/Recents entry points appear consistently; “jump to” works in all modes.
- No regressions in existing navigation; automated unit tests for registry/provider pass.

---

## Phase 2 — Mode Implementations
Polish each mode to MVP quality with consistent navigation primitives.

Deliverables:
- Drawer Explorer: folder/map list UX, filters, keyboard nav, optional minimap.
- Semantic Zoom + Drill-in: zoom thresholds, focus path breadcrumbs, smooth transitions.
- Split View: synchronized panes, selection linking, compare patterns.

Acceptance criteria:
- Each mode satisfies its user journey (browse > find > jump > act) with <150ms perceived interactions on target hardware.
- Favorites/Recents are first-class in each mode (visible, 1–2 clicks/keys to jump).
- Screen-reader pass for core interactions; keyboard coverage parity across modes.

---

## Phase 3 — Performance, A11y, Testing Hardening
Stabilize at scale and across environments/hardware.

Deliverables:
- Code-splitting and lazy-loading per mode; list virtualization where needed.
- GPU/canvas fallbacks and safe-resize guards; error surfaces for unsupported environments.
- A11y: focus management, ARIA roles/states, roving tabindex for composite widgets.
- Tests: unit (modes/registry/provider), integration (navigation), e2e (mode switch + favorites/recents flows).

Acceptance criteria:
- Bundle size budgets met; time-to-interactive within thresholds.
- A11y audit passes (keyboard + SR for primary flows).
- CI runs deterministic; flaky tests addressed; error budget respected.

---

## Phase 4 — Rollout, Telemetry, and Polish
Move from beta to default safely.

Deliverables:
- Progressive rollout via feature flags; kill switch ready.
- Telemetry dashboards for adoption, engagement, and failure modes.
- UX polish (empty states, hints, docs), and help content.
- Post-launch bug triage and stabilization.

Acceptance criteria:
- Adoption and success metrics reach targets; no P0/P1 defects open.
- Feature enabled by default; fallback path documented.

---

## Cross-Cutting Tasks and Ownership
- Navigation: unify Favorites/Recents APIs; consistent placements and shortcuts.
- Security/Privacy: respect settings and PII boundaries in telemetry.
- Observability: structured logs and concise error messages.
- Developer Experience: clear extension points for new modes/themes.

---

## Risks & Mitigations
- Mode drift: enforce shared contracts and common components.
- Performance regressions: budgets + profiling + lazy-loading.
- A11y gaps: early audits and keyboard-first principles.
- Complexity creep: strict scope control per phase; acceptance criteria as gates.

---

## Dependencies
- Existing Favorites/Recents stores and settings infra.
- Shared rendering engine and overlay/pan-zoom utilities.
- Build/test pipelines (Vitest/Playwright) and feature flagging.

---

## Timeline (indicative)
- Phase 1: 1–2 sprints
- Phase 2: 2–3 sprints (in parallel per-mode where possible)
- Phase 3: 1 sprint
- Phase 4: 1 sprint

Note: Overlap allowed where risks are low and interfaces are stable.

## Mouse-only mode selection
- During all phases, switching between Drawer, Semantic Zoom, and Split View is performed using the on-screen segmented Mode Switcher.
- Keyboard shortcuts for mode switching are intentionally not supported; switching is mouse-only to avoid accidental changes.
- Deep links with `?mode=` continue to initialize the starting mode, but subsequent changes must be done with the mouse.
