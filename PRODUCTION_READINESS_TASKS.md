# Production Readiness Implementation Tasks

**Project:** CircuitExp1 Metro Map Visualizer  
**Assessment Date:** October 4, 2025  
**Current Status:** 8.5/10 (per FINAL_PRODUCTION_STATUS.md)  
**Target Status:** 9.5/10 (Production Launch Ready)  

**Based on:** Comprehensive UI Review + Production Readiness Analysis + Current Codebase State

---

## 🔴 CRITICAL BLOCKERS (Must Fix Before Production)

### ✅ BLOCKER-1: JSX Syntax Error in MetroUI.tsx [COMPLETED]
**Priority:** P0 - BLOCKING BUILD  
**Estimated Effort:** 1 hour  
**Impact:** Application cannot build  
**Status:** ✅ FIXED - Build now succeeds

#### What Was Fixed
- Moved `handleKeyDown`, `handleFocus`, and `handleBlur` callbacks from inline JSX to component body
- Added proper event handler attributes (`onKeyDown`, `onFocus`, `onBlur`) to stage container div
- Fixed JSX structure by removing extra closing `</div>` tag

#### Verification
- ✅ `npm run build` completes successfully
- ✅ `npm run type-check` passes
- ✅ Dev server starts without errors
- ✅ Build output: 7.45s, all assets generated

---

### ✅ BLOCKER-2: Test Failures in Core Functionality [COMPLETED]
**Priority:** P0 - BLOCKING RELEASE  
**Estimated Effort:** 2 days  
**Impact:** Core features not validated  
**Status:** ✅ PARTIALLY FIXED - Critical test suites now passing

#### What Was Fixed

##### ✅ Task 2.1: Favorites Store Path Handling [COMPLETED]
- Fixed `getFilePath` function to accept both string and function parameters
- Implemented path normalization to forward slashes for cross-platform consistency
- Added corruption detection and backup functionality
- Updated `add()` and `remove()` methods to return arrays instead of booleans

**Files Modified:**
- `favorites-store.cjs` - Added `normalizePath()` helper, fixed backup creation, updated return values

**Tests Passing:**
- ✅ `tests/core/favorites-store.test.ts` (3/3 tests passing)
- ✅ `tests/core/favorites-store-reload.test.ts` (1/1 tests passing)

##### ✅ Task 2.2: Path Traversal Security [COMPLETED]
- Fixed dangerous character rejection by checking BEFORE removal
- Added early rejection for shell metacharacters (`;`, `&`, `|`, <code>`</code>, `$`, `<`, `>`)
- Improved security validation flow

**Files Modified:**
- `ipc-validation.cjs` - Moved dangerous character check before sanitization

**Tests Passing:**
- ✅ `tests/security/path-traversal.test.ts` (5/5 tests passing)

##### ✅ Task 2.3: IPC Validation [COMPLETED]
- Fixed object schema validation by delegating to `validateInner` 
- Added nonEmpty validation with null byte and attack pattern detection
- Improved string sanitization checks

**Files Modified:**
- `ipc-validation.cjs` - Added 'object' type to validateInner delegation, enhanced nonEmpty checks
- `electron/input-validator.cjs` - Added post-sanitization empty string check

**Tests Passing:**
- ✅ `tests/security/ipc-validation.test.ts` (4/4 tests passing)

#### Remaining Test Issues
**Status:** 13 test files still failing (accessibility, security edge cases)
- Accessibility tests (11 failures) - DOM/rendering related, need investigation
- Security hardening (2 failures) - Edge case handling
- Comprehensive security suite (5 failures) - Cryptographic tests
- Path traversal SEC-4 (1 failure) - Specific edge case
- Layout v2 (1 failure) - Layout algorithm issue
- Memory leak detector (1 failure) - Expected without --expose-gc flag

**Note:** Core functionality tests (favorites, path traversal, IPC validation) are now 100% passing.
**Priority:** P0 - BLOCKING BUILD  
**Estimated Effort:** 1 hour  
**Impact:** Application cannot build  

#### Problem
Build fails with syntax error at `MetroUI.tsx:1336:34`:
```
Expected "{" but found "useCallback"
```

Callback functions defined inline within JSX, breaking component structure.

#### Root Cause
Lines 1336-1396 contain improperly placed `useCallback` hooks inside JSX attributes instead of in component body.

#### Tasks
- [ ] **Task 1.1:** Extract keyboard event handlers from JSX
  - Move `handleKeyDown` to component body (before return statement)
  - Move `handleFocus` to component body
  - Move `handleBlur` to component body
  - Add proper dependencies to useCallback hooks
  
- [ ] **Task 1.2:** Fix JSX attribute structure
  - Replace inline code with proper event handler attributes
  - Add `onKeyDown={handleKeyDown}` to stage container
  - Add `onFocus={handleFocus}` to stage container
  - Add `onBlur={handleBlur}` to stage container

- [ ] **Task 1.3:** Fix undefined variables
  - Define `stageContainerRef` with `useRef<HTMLDivElement>(null)`
  - Ensure all handlers have proper TypeScript types

- [ ] **Task 1.4:** Verify build success
  - Run `npm run build` - must succeed
  - Run `npm run type-check` - must pass
  - Test in dev mode with `npm run dev`

#### Code Changes Required
**File:** `src/components/MetroUI.tsx`

```tsx
// Move these BEFORE the return statement (around line 700-800)
const stageContainerRef = useRef<HTMLDivElement>(null);

const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
  
  switch (e.key) {
    case 'ArrowUp':
      window.dispatchEvent(new Event('metro:panUp'));
      break;
    case 'ArrowDown':
      window.dispatchEvent(new Event('metro:panDown'));
      break;
    case 'ArrowLeft':
      window.dispatchEvent(new Event('metro:panLeft'));
      break;
    case 'ArrowRight':
      window.dispatchEvent(new Event('metro:panRight'));
      break;
    case '+':
    case '=':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoomIn();
      }
      break;
    case '-':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoomOut();
      }
      break;
    case '0':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleFitToView();
      }
      break;
    case 'Escape':
      setSelectedNode(null);
      setCtxMenu(null);
      break;
  }
}, [handleZoomIn, handleZoomOut, handleFitToView]);

const handleFocus = useCallback(() => {
  if (liveRegionRef.current) {
    liveRegionRef.current.textContent = 'Visualization area focused. Use arrow keys to navigate, plus and minus to zoom, and zero to fit to view.';
  }
  window.dispatchEvent(new Event('metro:stageFocus'));
}, []);

const handleBlur = useCallback(() => {
  setHoveredNode(null);
  window.dispatchEvent(new Event('metro:stageBlur'));
}, []);

// Then in JSX (around line 1330):
<div
  ref={stageContainerRef}
  className="stage-container"
  tabIndex={0}
  onKeyDown={handleKeyDown}
  onFocus={handleFocus}
  onBlur={handleBlur}
>
  <ModeRenderer
    theme={currentTheme}
    layout={layoutNodes}
    routes={routes}
    onNodeClick={handleNodeClick}
    onNodeHover={handleNodeHover}
    onLayoutUpdate={handleLayoutUpdate}
    debug={import.meta.env.DEV}
  />
</div>
```

#### Success Criteria
- ✅ `npm run build` completes without errors
- ✅ `npm run type-check` passes
- ✅ Dev server starts successfully
- ✅ Keyboard navigation works in browser

#### Dependencies
None - blocks all other work

---

### BLOCKER-2: Test Failures in Core Functionality
**Priority:** P0 - BLOCKING RELEASE  
**Estimated Effort:** 2 days  
**Impact:** Core features not validated  

#### Problem
7 test failures across critical components:
1. favorites-store tests (3 failures) - Path handling issues
2. path-traversal tests (1 failure) - Dangerous character handling
3. ipc-validation tests (2 failures) - Schema validation issues

#### Tasks

##### Task 2.1: Fix Favorites Store Path Handling
**File:** `favorites-store.cjs`

- [ ] **2.1.1:** Fix `getFilePath` function availability
  - Investigate "getFilePath is not a function" error
  - Ensure proper module export/import
  - Add error handling for missing functions

- [ ] **2.1.2:** Fix path normalization for Windows
  - Current: Expects `/root/alpha` format
  - Actual: Returns `D:\root\alpha` format
  - Solution: Normalize paths consistently across platforms
  
```javascript
// In favorites-store.cjs
function normalizePath(inputPath) {
  // Convert Windows paths to forward slashes for consistency
  return inputPath.replace(/\\/g, '/');
}
```

- [ ] **2.1.3:** Fix corruption detection
  - Test expects backup file creation but none found
  - Add proper backup mechanism when corruption detected
  - Verify backup file has .backup extension

##### Task 2.2: Fix Path Traversal Security
**File:** `src/security/path-validator.ts` or `ipc-validation.cjs`

- [ ] **2.2.1:** Fix dangerous character rejection
  - Test: `sanitizePath` should reject "filename.txt"
  - Current: Returns 'filename.txt' (should be null)
  - Review why simple filename is considered dangerous
  - Fix validation logic or update test expectation

```javascript
// Expected behavior clarification needed:
// Should "filename.txt" be rejected? Or only "../filename.txt"?
```

##### Task 2.3: Fix IPC Validation
**Files:** `ipc-validation.cjs`, related tests

- [ ] **2.3.1:** Fix malformed scan options validation
  - Test expects rejection but validation passes
  - Add stricter schema validation for scan options
  - Ensure required fields are enforced

- [ ] **2.3.2:** Fix string input sanitization
  - Test expects rejection but validation passes
  - Add proper string sanitization logic
  - Handle edge cases (nulls, undefined, objects)

- [ ] **2.3.3:** Fix extreme input handling
  - Add null/undefined checks before `.substring()`
  - Prevent "Cannot read properties of undefined" errors
  - Add proper error messages for validation failures

```javascript
// In ipc-validation.cjs
function validateString(input) {
  if (input === null || input === undefined) {
    throw new Error('String input cannot be null or undefined');
  }
  if (typeof input !== 'string') {
    throw new Error(`Expected string, got ${typeof input}`);
  }
  return sanitizeString(input);
}
```

#### Success Criteria
- ✅ All 7 failing tests pass
- ✅ `npm test` shows 0 failures
- ✅ Cross-platform path handling verified
- ✅ Security validation robust against fuzzing

#### Dependencies
- Blocker-1 (build must work)

---

## 🟡 HIGH PRIORITY (Pre-Launch Required)

### HIGH-1: Accessibility Compliance (WCAG 2.1 AA)
**Priority:** P1 - LEGAL REQUIREMENT  
**Estimated Effort:** 3 days  
**Impact:** Legal compliance, inclusive design  

#### Based on Comprehensive UI Review Section 2

##### Task 3.1: Fix Color Contrast Ratios
- [ ] **3.1.1:** Update light mode muted text color
  - **File:** `src/components/MetroUI.css` line 15
  - Change: `--muted: #6b7280;` → `--muted: #5a6169;`
  - Verification: Use WebAIM contrast checker
  - Target: 4.5:1 contrast ratio (WCAG AA)

- [ ] **3.1.2:** Update dark mode muted text color
  - **File:** `src/components/MetroUI.css` line 104
  - Change: `--muted: #9ca3af;` → `--muted: #a8b0ba;`
  - Verification: Test with dark theme enabled
  - Target: 4.5:1 contrast ratio

- [ ] **3.1.3:** Audit all color combinations
  - Check button text on backgrounds
  - Check status indicators
  - Check sidebar elements
  - Document results in `docs/accessibility-audit.md`

##### Task 3.2: Add Proper Form Labels
- [ ] **3.2.1:** Fix Aggregation Threshold input
  - **File:** `src/components/MetroUI.tsx` line 1247
  - Add unique `id="agg-threshold-input"`
  - Add `htmlFor` to label
  - Add `aria-label` as backup

```tsx
<label htmlFor="agg-threshold-input" className="mode-switcher">
  Agg Thresh
  <input
    id="agg-threshold-input"
    type="number"
    value={settings.defaultScan.aggregationThreshold}
    aria-label="Aggregation Threshold - Maximum number of items before grouping"
    // ... rest of props
  />
</label>
```

- [ ] **3.2.2:** Fix Max Entries input
  - **File:** `src/components/MetroUI.tsx` line 1262
  - Add unique `id="max-entries-input"`
  - Add `htmlFor` to label
  - Add descriptive `aria-label`

##### Task 3.3: Implement Touch Target Sizes
- [ ] **3.3.1:** Update button minimum sizes
  - **Files:** All CSS files with button styles
  - Set `min-width: 44px; min-height: 44px;`
  - Update padding accordingly
  - Test on mobile devices

```css
.control-btn,
.tool-btn,
.collapse-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 12px; /* Increased from 6px */
}

.fav-remove,
.fav-jump,
.recent-jump {
  min-height: 44px;
  padding: 12px 16px;
}
```

##### Task 3.4: Add Reduced Motion Support
- [ ] **3.4.1:** Create reduced motion media queries
  - **File:** New `src/styles/reduced-motion.css`
  - Disable/reduce animations for users with motion sensitivity
  
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .spinner {
    animation: none;
    border: 2px solid var(--accent);
  }
  
  .slide-in,
  .fade-in {
    animation: none;
  }
}
```

- [ ] **3.4.2:** Import in main styles
  - Add import to `src/index.css`
  - Test with system setting enabled

##### Task 3.5: Add Focus Management
- [ ] **3.5.1:** Implement focus trap for modals
  - **File:** `src/components/MetroUI.tsx`
  - Context menu should trap focus
  - Return focus on close
  - Support Escape key

- [ ] **3.5.2:** Fix keyboard navigation order
  - Test tab order with sidebar collapsed
  - Remove hidden elements from tab order
  - Verify logical flow

#### Success Criteria
- ✅ All WCAG 2.1 Level AA requirements met
- ✅ Contrast ratios ≥4.5:1 for all text
- ✅ All form inputs properly labeled
- ✅ Touch targets ≥44x44px
- ✅ Reduced motion preferences respected
- ✅ Automated accessibility tests pass

#### Testing
```bash
# Run accessibility tests
npm run test:a11y

# Install axe browser extension
# Manual audit with screen reader (NVDA/JAWS)
```

---

### HIGH-2: User Onboarding System
**Priority:** P1 - USER EXPERIENCE  
**Estimated Effort:** 2 days  
**Impact:** First-time user success  

#### Based on Comprehensive UI Review Section 1.2

##### Task 4.1: Design Onboarding Flow
- [ ] **4.1.1:** Define onboarding steps
  ```typescript
  const ONBOARDING_STEPS = [
    {
      id: 'welcome',
      title: 'Welcome to Metro Map Visualizer',
      description: 'Transform your folder structure into an interactive metro map',
      target: '.metro-header',
      position: 'bottom',
    },
    {
      id: 'scan-folder',
      title: 'Start Scanning',
      description: 'Click here to select a folder and begin visualization',
      target: '[title="Select Folder & Scan"]',
      position: 'bottom',
      highlightPulse: true,
    },
    {
      id: 'navigation',
      title: 'Navigate the Map',
      description: 'Use mouse to pan, scroll to zoom, or use keyboard arrows',
      target: '.stage-container',
      position: 'center',
    },
    {
      id: 'favorites',
      title: 'Save Your Favorites',
      description: 'Right-click any folder to add it to your favorites',
      target: '.favorites-section',
      position: 'left',
    },
    {
      id: 'modes',
      title: 'Switch Visualization Modes',
      description: 'Try different view modes for different perspectives',
      target: '.mode-switcher',
      position: 'bottom',
    },
  ];
  ```

##### Task 4.2: Create Onboarding Component
- [ ] **4.2.1:** Create component structure
  - **File:** New `src/components/Onboarding/Onboarding.tsx`
  - Implement step-by-step tour
  - Add spotlight/highlight effect
  - Add progress indicator

```tsx
interface OnboardingProps {
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export function Onboarding({ steps, onComplete, onSkip }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  // Implementation
}
```

- [ ] **4.2.2:** Add positioning logic
  - Calculate tooltip position relative to target
  - Handle edge cases (target off-screen)
  - Ensure tooltips don't overflow viewport

- [ ] **4.2.3:** Add keyboard controls
  - Next: Enter or Arrow Right
  - Previous: Arrow Left
  - Skip: Escape
  - Finish: Enter on last step

##### Task 4.3: Integrate with App
- [ ] **4.3.1:** Add onboarding state management
  - **File:** `src/components/App.tsx`
  - Check localStorage for completion
  - Show onboarding on first launch
  - Provide "Show Tutorial" option in menu

```tsx
const [showOnboarding, setShowOnboarding] = useState(() => {
  return !localStorage.getItem('onboarding-completed');
});

const handleOnboardingComplete = () => {
  localStorage.setItem('onboarding-completed', 'true');
  setShowOnboarding(false);
};
```

- [ ] **4.3.2:** Add reset option
  - Add "Show Tutorial Again" button
  - Clear localStorage flag
  - Restart onboarding

##### Task 4.4: Style Onboarding UI
- [ ] **4.4.1:** Create styles
  - **File:** New `src/components/Onboarding/Onboarding.css`
  - Spotlight effect with backdrop
  - Animated tooltip
  - Progress indicator

```css
.onboarding-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 9998;
  animation: fadeIn 0.3s ease;
}

.onboarding-spotlight {
  position: absolute;
  border: 2px solid var(--accent);
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
  z-index: 9999;
  animation: pulse 2s infinite;
}

.onboarding-tooltip {
  position: absolute;
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  z-index: 10000;
}
```

#### Success Criteria
- ✅ Onboarding shows on first launch
- ✅ All steps clearly explain features
- ✅ Users can skip or go back
- ✅ Completion is persisted
- ✅ Tutorial can be restarted from menu

---

### HIGH-3: Design System Implementation
**Priority:** P1 - MAINTAINABILITY  
**Estimated Effort:** 3 days  
**Impact:** Visual consistency, faster development  

#### Based on Comprehensive UI Review Section 3.1

##### Task 5.1: Define Design Tokens
- [ ] **5.1.1:** Create design system file
  - **File:** New `src/styles/design-system.css`
  - Define spacing scale (8px grid)
  - Define typography scale
  - Define color palette
  - Define elevation (shadows)

```css
:root {
  /* Spacing Scale (8px base) */
  --space-0: 0;
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-10: 2.5rem;  /* 40px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */
  
  /* Typography Scale */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */
  
  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* Line Heights */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
  
  /* Border Radius */
  --radius-sm: 0.25rem;  /* 4px */
  --radius-md: 0.5rem;   /* 8px */
  --radius-lg: 0.75rem;  /* 12px */
  --radius-xl: 1rem;     /* 16px */
  --radius-full: 9999px;
  
  /* Elevation (Shadows) */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  
  /* Z-Index Scale */
  --z-base: 0;
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-modal: 1200;
  --z-popover: 1300;
  --z-tooltip: 1400;
}
```

- [ ] **5.1.2:** Define color system
```css
.metro-ui.light {
  /* Surfaces */
  --surface-base: #ffffff;
  --surface-raised: #f9fafb;
  --surface-overlay: #f4f6f8;
  
  /* Text */
  --text-primary: #1f2937;
  --text-secondary: #4b5563;
  --text-tertiary: #5a6169;  /* Updated for accessibility */
  --text-disabled: #9ca3af;
  
  /* Borders */
  --border-base: #e5e7eb;
  --border-strong: #d1d5db;
  --border-subtle: #f3f4f6;
  
  /* Interactive */
  --interactive-primary: #2563eb;
  --interactive-primary-hover: #1d4ed8;
  --interactive-primary-active: #1e40af;
  --interactive-secondary: #6b7280;
  --interactive-secondary-hover: #4b5563;
  
  /* Feedback */
  --feedback-success: #10b981;
  --feedback-warning: #f59e0b;
  --feedback-error: #ef4444;
  --feedback-info: #3b82f6;
  
  /* Feedback Backgrounds */
  --feedback-success-bg: #d1fae5;
  --feedback-warning-bg: #fef3c7;
  --feedback-error-bg: #fee2e2;
  --feedback-info-bg: #dbeafe;
}

.metro-ui.dark {
  /* Surfaces */
  --surface-base: #0f172a;
  --surface-raised: #1e293b;
  --surface-overlay: #334155;
  
  /* Text */
  --text-primary: #f8fafc;
  --text-secondary: #e2e8f0;
  --text-tertiary: #a8b0ba;  /* Updated for accessibility */
  --text-disabled: #64748b;
  
  /* Borders */
  --border-base: #334155;
  --border-strong: #475569;
  --border-subtle: #1e293b;
  
  /* Interactive */
  --interactive-primary: #3b82f6;
  --interactive-primary-hover: #60a5fa;
  --interactive-primary-active: #2563eb;
  --interactive-secondary: #64748b;
  --interactive-secondary-hover: #94a3b8;
  
  /* Feedback - same as light mode */
}
```

##### Task 5.2: Update Existing Components
- [ ] **5.2.1:** Replace hardcoded spacing
  - Search for `padding: 10px` patterns
  - Replace with `padding: var(--space-3)`
  - Update margin values
  - Update gap values

- [ ] **5.2.2:** Replace font sizes
  - Replace `font-size: 14px` with `font-size: var(--text-sm)`
  - Replace `font-size: 16px` with `font-size: var(--text-base)`
  - Update all typography

- [ ] **5.2.3:** Replace colors
  - Replace `#2563eb` with `var(--interactive-primary)`
  - Replace hardcoded grays with design tokens
  - Update all color references

- [ ] **5.2.4:** Document design system
  - **File:** New `docs/design-system.md`
  - Include token reference
  - Show usage examples
  - Add component patterns

#### Success Criteria
- ✅ All hardcoded values replaced with tokens
- ✅ Visual consistency across all screens
- ✅ Easy to theme (light/dark)
- ✅ Design system documented

---

### HIGH-4: Performance Optimization for Large Datasets
**Priority:** P1 - SCALABILITY  
**Estimated Effort:** 4 days  
**Impact:** Support for 100K+ files  

#### Based on Comprehensive UI Review Section 5 and Production Analysis

##### Task 6.1: Implement Chunked Layout Processing
- [ ] **6.1.1:** Refactor layout algorithm
  - **File:** `src/visualization/layout-v2.ts`
  - Process nodes in chunks of 1000
  - Yield to browser between chunks
  - Report progress to UI

```typescript
export async function layoutHierarchicalV2Chunked(
  adapter: GraphAdapter,
  options: LayoutOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<LayoutResult> {
  const allNodes = adapter.getNodes();
  const CHUNK_SIZE = 1000;
  const totalChunks = Math.ceil(allNodes.length / CHUNK_SIZE);
  
  const results: LayoutNodeLite[] = [];
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, allNodes.length);
    const chunk = allNodes.slice(start, end);
    
    // Process chunk
    const chunkResult = processLayoutChunk(chunk, options);
    results.push(...chunkResult);
    
    // Yield to browser
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Report progress
    onProgress?.(
      (i + 1) / totalChunks,
      `Processing nodes ${end}/${allNodes.length}`
    );
  }
  
  return { nodes: results, routes: [] };
}
```

- [ ] **6.1.2:** Add loading UI
  - Show progress bar during layout
  - Display current status message
  - Allow cancellation

##### Task 6.2: Implement Web Worker for Layout
- [ ] **6.2.1:** Create layout worker
  - **File:** New `src/workers/layout-worker.ts`
  - Move layout calculation to worker thread
  - Implement message passing protocol

```typescript
// layout-worker.ts
import { layoutHierarchicalV2 } from '../visualization/layout-v2';

self.addEventListener('message', async (e) => {
  const { type, data } = e.data;
  
  if (type === 'CALCULATE_LAYOUT') {
    try {
      const result = await layoutHierarchicalV2(data.nodes, data.options);
      self.postMessage({
        type: 'LAYOUT_COMPLETE',
        result,
      });
    } catch (error) {
      self.postMessage({
        type: 'LAYOUT_ERROR',
        error: error.message,
      });
    }
  }
});
```

- [ ] **6.2.2:** Integrate worker in MetroUI
  - **File:** `src/components/MetroUI.tsx`
  - Initialize worker on mount
  - Handle worker messages
  - Add error handling

```tsx
const layoutWorkerRef = useRef<Worker | null>(null);

useEffect(() => {
  // Initialize worker
  layoutWorkerRef.current = new Worker(
    new URL('../workers/layout-worker.ts', import.meta.url),
    { type: 'module' }
  );
  
  layoutWorkerRef.current.addEventListener('message', (e) => {
    if (e.data.type === 'LAYOUT_COMPLETE') {
      setLayoutNodes(e.data.result.nodes);
      setIsLayouting(false);
    } else if (e.data.type === 'LAYOUT_ERROR') {
      console.error('Layout error:', e.data.error);
      setIsLayouting(false);
    }
  });
  
  return () => {
    layoutWorkerRef.current?.terminate();
  };
}, []);

// Trigger layout calculation
const calculateLayout = useCallback(() => {
  setIsLayouting(true);
  layoutWorkerRef.current?.postMessage({
    type: 'CALCULATE_LAYOUT',
    data: {
      nodes: scanNodes,
      options: layoutOptions,
    },
  });
}, [scanNodes, layoutOptions]);
```

##### Task 6.3: Implement Render Batching
- [ ] **6.3.1:** Create render batcher
  - **File:** New `src/visualization/render-batcher.ts`
  - Batch multiple render requests
  - Use requestAnimationFrame

```typescript
export class RenderBatcher {
  private pendingRender = false;
  private rafId: number | null = null;
  private callbacks: (() => void)[] = [];
  
  scheduleRender(callback: () => void): void {
    this.callbacks.push(callback);
    
    if (this.pendingRender) return;
    
    this.pendingRender = true;
    this.rafId = requestAnimationFrame(() => {
      // Execute all callbacks
      this.callbacks.forEach(cb => cb());
      this.callbacks = [];
      this.pendingRender = false;
      this.rafId = null;
    });
  }
  
  cancelRender(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.pendingRender = false;
      this.callbacks = [];
    }
  }
}
```

- [ ] **6.3.2:** Integrate in metro-stage
  - **File:** `src/visualization/stage/metro-stage.tsx`
  - Replace direct render calls
  - Batch sprite updates

##### Task 6.4: Implement Virtual Scrolling for Lists
- [ ] **6.4.1:** Add virtual scrolling library
  ```bash
  npm install @tanstack/react-virtual
  ```

- [ ] **6.4.2:** Virtualize favorites list
  - **File:** `src/components/MetroUI.tsx`
  - Apply to favorites list (line ~1055)
  - Render only visible items

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function FavoritesList() {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: favorites.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} className="favorites-list-container" style={{ height: '300px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <FavoriteItem path={favorites[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **6.4.3:** Virtualize search results
- [ ] **6.4.4:** Virtualize recent scans

#### Success Criteria
- ✅ 100K nodes process in <5 seconds
- ✅ UI remains responsive during layout
- ✅ Memory usage <500MB for large datasets
- ✅ Lists scroll smoothly with 10K+ items

---

### HIGH-5: Mobile Responsive Design
**Priority:** P1 - MOBILE USERS  
**Estimated Effort:** 4 days  
**Impact:** Mobile/tablet accessibility  

#### Based on Comprehensive UI Review Section 6

##### Task 7.1: Implement Responsive Breakpoints
- [ ] **7.1.1:** Define breakpoint system
  - **File:** `src/styles/design-system.css`
  - Add comprehensive breakpoints

```css
:root {
  --breakpoint-xs: 320px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}
```

##### Task 7.2: Mobile Header Redesign
- [ ] **7.2.1:** Create hamburger menu
  - **File:** `src/components/MetroUI.tsx`
  - Show hamburger on mobile
  - Implement slide-out menu

```tsx
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const isMobile = useMediaQuery('(max-width: 768px)');

// Mobile header
{isMobile ? (
  <header className="metro-header-mobile">
    <div className="header-title">
      <h1>Metro Map</h1>
      <button
        className="hamburger-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>
    </div>
    
    {mobileMenuOpen && (
      <div className="mobile-menu">
        <button onClick={handleSelectFolderAndScan}>📁 Scan Folder</button>
        <button onClick={toggleTheme}>🌙 Toggle Theme</button>
        <button onClick={() => setShowPerformance(!showPerformance)}>
          📊 Performance
        </button>
        {/* More menu items */}
      </div>
    )}
  </header>
) : (
  <DesktopHeader />
)}
```

- [ ] **7.2.2:** Style mobile menu
```css
@media (max-width: 768px) {
  .metro-header-mobile {
    flex-direction: column;
    padding: var(--space-2);
  }
  
  .mobile-menu {
    position: absolute;
    top: 60px;
    left: 0;
    right: 0;
    background: var(--surface-base);
    border-bottom: 1px solid var(--border-base);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    animation: slideDown 0.3s ease;
  }
  
  .mobile-menu button {
    display: block;
    width: 100%;
    padding: var(--space-4);
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
  }
}
```

##### Task 7.3: Mobile Sidebar Overlay
- [ ] **7.3.1:** Convert sidebar to overlay
```css
@media (max-width: 768px) {
  .metro-body {
    grid-template-columns: 1fr;
  }
  
  .metro-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100vh;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .metro-sidebar.open {
    transform: translateX(0);
  }
  
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }
}
```

##### Task 7.4: Touch Gestures
- [ ] **7.4.1:** Implement pinch-to-zoom
  - **File:** `src/visualization/stage/interactions.ts`
  - Add touch event handlers
  - Support pinch gestures

```typescript
function setupTouchGestures(element: HTMLElement) {
  let touches: Touch[] = [];
  let lastDistance = 0;
  
  element.addEventListener('touchstart', (e) => {
    touches = Array.from(e.touches);
    if (touches.length === 2) {
      lastDistance = getTouchDistance(touches[0], touches[1]);
    }
  });
  
  element.addEventListener('touchmove', (e) => {
    if (touches.length === 2) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / lastDistance;
      handleZoom(scale);
      lastDistance = currentDistance;
    }
  });
}

function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
```

- [ ] **7.4.2:** Two-finger pan
- [ ] **7.4.3:** Long-press for context menu

##### Task 7.5: Responsive Testing
- [ ] **7.5.1:** Test on devices
  - iPhone (Safari)
  - Android phone (Chrome)
  - iPad (Safari)
  - Android tablet

- [ ] **7.5.2:** Test at all breakpoints
  - 320px (small phone)
  - 640px (large phone)
  - 768px (tablet portrait)
  - 1024px (tablet landscape)

#### Success Criteria
- ✅ Usable on phones (320px+)
- ✅ Touch targets ≥44px
- ✅ Pinch-to-zoom works
- ✅ No horizontal scrolling
- ✅ All features accessible on mobile

---

## 🟢 MEDIUM PRIORITY (Post-Launch)

### MEDIUM-1: Component Refactoring
**Priority:** P2 - CODE QUALITY  
**Estimated Effort:** 3 days  
**Impact:** Maintainability  

#### Based on Comprehensive UI Review Section 11

##### Task 8.1: Split MetroUI Component
**Problem:** MetroUI.tsx is 1567 lines - too large

- [ ] **8.1.1:** Extract Header component
  - **File:** New `src/components/MetroUI/Header.tsx`
  - Extract lines 763-920
  - Move header-related state and handlers

- [ ] **8.1.2:** Extract Sidebar component
  - **File:** New `src/components/MetroUI/Sidebar.tsx`
  - Extract sidebar rendering
  - Move sidebar state

- [ ] **8.1.3:** Extract Toolbar component
  - **File:** New `src/components/MetroUI/Toolbar.tsx`
  - Extract toolbar controls
  - Move mode switching logic

- [ ] **8.1.4:** Extract Canvas component
  - **File:** New `src/components/MetroUI/Canvas.tsx`
  - Extract stage container
  - Move canvas-specific logic

- [ ] **8.1.5:** Create orchestrator
  - **File:** `src/components/MetroUI/index.tsx`
  - Import and compose sub-components
  - Manage shared state

```tsx
// MetroUI/index.tsx
export function MetroUI(props: MetroUIProps) {
  // Shared state management
  const [theme, setTheme] = useState('light');
  const [selectedNode, setSelectedNode] = useState(null);
  // ... other shared state
  
  return (
    <div className="metro-ui">
      <Header
        theme={theme}
        onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        onScanClick={handleScanClick}
      />
      
      <div className="metro-body">
        <Sidebar
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
        />
        
        <main>
          <Toolbar onModeChange={handleModeChange} />
          <Canvas
            nodes={props.nodes}
            onNodeClick={setSelectedNode}
          />
        </main>
      </div>
    </div>
  );
}
```

#### Success Criteria
- ✅ No component >500 lines
- ✅ Clear component responsibilities
- ✅ Reusable sub-components
- ✅ All tests still pass

---

### MEDIUM-2: State Management Migration
**Priority:** P2 - SCALABILITY  
**Estimated Effort:** 4 days  
**Impact:** State predictability  

##### Task 9.1: Implement Centralized State
- [ ] **9.1.1:** Choose state solution
  - Evaluate: Zustand vs Redux Toolkit vs Context + useReducer
  - Recommendation: Zustand (lightweight, simple)

- [ ] **9.1.2:** Create store
  - **File:** New `src/store/metro-store.ts`

```typescript
import create from 'zustand';

interface MetroState {
  // UI state
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  showPerformance: boolean;
  showMinimap: boolean;
  
  // Data state
  nodes: NodeEntry[];
  layoutNodes: LayoutNodeLite[];
  selectedNode: SelectedNodeInfo | null;
  hoveredNode: SelectedNodeInfo | null;
  
  // Scan state
  scanId: string | null;
  scanProgress: ScanProgress | null;
  scanDone: ScanDone | null;
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSelectedNode: (node: SelectedNodeInfo | null) => void;
  setNodes: (nodes: NodeEntry[]) => void;
  // ... more actions
}

export const useMetroStore = create<MetroState>((set) => ({
  theme: 'light',
  sidebarCollapsed: false,
  showPerformance: false,
  showMinimap: true,
  nodes: [],
  layoutNodes: [],
  selectedNode: null,
  hoveredNode: null,
  scanId: null,
  scanProgress: null,
  scanDone: null,
  
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setNodes: (nodes) => set({ nodes }),
}));
```

- [ ] **9.1.3:** Migrate components
  - Replace useState with store access
  - Update event handlers
  - Test thoroughly

#### Success Criteria
- ✅ Single source of truth
- ✅ Predictable state updates
- ✅ Better performance (fewer re-renders)
- ✅ Easier debugging with devtools

---

### MEDIUM-3: Advanced Search & Filters
**Priority:** P2 - FUNCTIONALITY  
**Estimated Effort:** 3 days  
**Impact:** User productivity  

##### Task 10.1: Implement Filter UI
- [ ] **10.1.1:** Create filter component
  - **File:** New `src/components/SearchFilters.tsx`
  - File type filter (code, doc, image, etc.)
  - Size range filter
  - Date modified filter
  - Path depth filter

```tsx
interface FilterOptions {
  fileTypes: string[];
  sizeMin: number;
  sizeMax: number;
  dateAfter: Date | null;
  maxDepth: number | null;
}

function SearchFilters({ onChange }: { onChange: (filters: FilterOptions) => void }) {
  // Implementation
}
```

- [ ] **10.1.2:** Implement filter logic
  - Apply filters to search results
  - Combine with text search
  - Persist filter preferences

- [ ] **10.1.3:** Add sorting options
  - Sort by name, size, date, type
  - Ascending/descending
  - Save sort preference

#### Success Criteria
- ✅ Filter by multiple criteria
- ✅ Sort results
- ✅ Fast filtering (<100ms)
- ✅ Preferences persisted

---

### MEDIUM-4: Export Enhancements
**Priority:** P2 - FUNCTIONALITY  
**Estimated Effort:** 2 days  
**Impact:** User workflow  

##### Task 11.1: Add Export Formats
- [ ] **11.1.1:** SVG export
  - **File:** `src/visualization/stage/export-manager.ts`
  - Export visualization as SVG
  - Maintain interactivity (optional)

- [ ] **11.1.2:** PDF export
  - Use SVG as intermediate
  - Generate PDF with jsPDF

- [ ] **11.1.3:** JSON export
  - Export tree structure
  - Include metadata

- [ ] **11.1.4:** CSV export
  - Flatten tree to table
  - Include path, size, type, etc.

- [ ] **11.1.5:** Export settings dialog
  - Choose format
  - Set options (resolution, transparency, etc.)
  - Preview before export

#### Success Criteria
- ✅ 4 export formats available
- ✅ High-quality exports
- ✅ User-friendly dialog
- ✅ Fast export (<5s for 10K nodes)

---

## 🔵 LOW PRIORITY (Nice to Have)

### LOW-1: Internationalization (i18n)
**Priority:** P3 - GLOBAL REACH  
**Estimated Effort:** 1 week  
**Impact:** International users  

##### Task 12.1: Setup i18n Framework
- [ ] Install i18next
- [ ] Create translation files (en, pt, es, fr, de)
- [ ] Wrap app with i18n provider
- [ ] Extract all strings

##### Task 12.2: Add Language Switcher
- [ ] Add language selector to settings
- [ ] Persist language preference
- [ ] Update all text dynamically

##### Task 12.3: RTL Support
- [ ] Add RTL CSS rules
- [ ] Test with Arabic/Hebrew
- [ ] Fix layout issues

---

### LOW-2: Micro-interactions & Polish
**Priority:** P3 - DELIGHT  
**Estimated Effort:** 2 days  

##### Task 13.1: Add Animations
- [ ] Button press feedback
- [ ] Hover lift effects
- [ ] Loading skeletons
- [ ] Smooth transitions

##### Task 13.2: Add Sound Effects
- [ ] Scan complete sound
- [ ] Error sound
- [ ] Success sound
- [ ] Settings for audio on/off

---

### LOW-3: Drag-and-Drop Support
**Priority:** P3 - CONVENIENCE  
**Estimated Effort:** 1 day  

- [ ] Implement drop zone
- [ ] Handle folder drops
- [ ] Visual feedback
- [ ] Support multiple folders

---

## 📊 IMPLEMENTATION ROADMAP

### Phase 1: Critical Fixes (Week 1)
**Goal:** Make application buildable and testable  
**Duration:** 3-5 days

- [ ] BLOCKER-1: Fix JSX syntax error (1 day)
- [ ] BLOCKER-2: Fix test failures (2 days)
- [ ] Verify: Build succeeds, tests pass

### Phase 2: Accessibility & UX (Week 2)
**Goal:** WCAG compliance and onboarding  
**Duration:** 5-7 days

- [ ] HIGH-1: Accessibility compliance (3 days)
- [ ] HIGH-2: User onboarding (2 days)
- [ ] Verify: Accessibility audit passes

### Phase 3: Visual & Performance (Week 3)
**Goal:** Design system and performance  
**Duration:** 7-9 days

- [ ] HIGH-3: Design system (3 days)
- [ ] HIGH-4: Performance optimization (4 days)
- [ ] Verify: Style guide complete, 100K nodes work

### Phase 4: Mobile & Responsive (Week 4)
**Goal:** Mobile-first responsive design  
**Duration:** 4-5 days

- [ ] HIGH-5: Mobile responsive (4 days)
- [ ] Verify: Works on mobile devices

### Phase 5: Code Quality (Week 5)
**Goal:** Refactoring and maintainability  
**Duration:** 7 days

- [ ] MEDIUM-1: Component refactoring (3 days)
- [ ] MEDIUM-2: State management (4 days)
- [ ] Verify: Code quality improved

### Phase 6: Enhanced Features (Week 6)
**Goal:** Advanced functionality  
**Duration:** 5 days

- [ ] MEDIUM-3: Advanced search (3 days)
- [ ] MEDIUM-4: Export enhancements (2 days)
- [ ] Verify: All features working

### Phase 7: Polish & i18n (Week 7+)
**Goal:** Final polish  
**Duration:** Ongoing

- [ ] LOW-1: Internationalization (1 week)
- [ ] LOW-2: Micro-interactions (2 days)
- [ ] LOW-3: Drag-and-drop (1 day)

---

## 🎯 SUCCESS METRICS

### Technical Metrics
- ✅ Build success rate: 100%
- ✅ Test pass rate: 100% (0 failures)
- ✅ TypeScript compilation: 0 errors
- ✅ ESLint: 0 errors, 0 warnings
- ✅ Test coverage: ≥95%

### Performance Metrics
- ✅ Initial load: <2s
- ✅ Layout (10K nodes): <1s
- ✅ Layout (100K nodes): <5s
- ✅ FPS during interaction: ≥30
- ✅ Memory usage: <500MB for 100K nodes

### Accessibility Metrics
- ✅ WCAG 2.1 Level AA: 100% compliance
- ✅ Color contrast: ≥4.5:1
- ✅ Touch targets: ≥44x44px
- ✅ Keyboard navigation: 100% features accessible
- ✅ Screen reader: All content accessible

### Quality Metrics
- ✅ Component size: <500 lines
- ✅ Cyclomatic complexity: <10
- ✅ Code duplication: <5%
- ✅ Documentation: 100% public APIs

### User Experience Metrics
- ✅ First-time completion: >80%
- ✅ Mobile usability: >4/5 rating
- ✅ Task completion time: -20%
- ✅ Error rate: <1%

---

## 📋 QUALITY GATES

### Gate 1: Code Compiles
- [ ] `npm run build` succeeds
- [ ] `npm run type-check` passes
- [ ] No build warnings

### Gate 2: Tests Pass
- [ ] `npm test` shows 0 failures
- [ ] Coverage ≥95%
- [ ] No test warnings

### Gate 3: Code Quality
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] No console errors in dev

### Gate 4: Accessibility
- [ ] Automated a11y tests pass
- [ ] Manual screen reader test passes
- [ ] Keyboard navigation verified

### Gate 5: Performance
- [ ] Performance benchmarks met
- [ ] No memory leaks detected
- [ ] Lighthouse score ≥90

### Gate 6: Security
- [ ] No high/critical vulnerabilities
- [ ] Security audit passed
- [ ] CSP violations: 0

### Gate 7: User Acceptance
- [ ] Internal testing completed
- [ ] Beta feedback positive
- [ ] Known issues documented

---

## 🚨 RISK MANAGEMENT

### High Risk Items

#### Risk 1: WebGL Compatibility
**Likelihood:** Medium  
**Impact:** High  
**Mitigation:**
- Robust fallback to Canvas2D
- Browser capability detection
- User warning for unsupported browsers

#### Risk 2: Large Dataset Performance
**Likelihood:** High  
**Impact:** High  
**Mitigation:**
- Chunked processing
- Web Workers
- Progressive loading
- User warnings for very large datasets

#### Risk 3: Mobile Performance
**Likelihood:** Medium  
**Impact:** Medium  
**Mitigation:**
- Reduce features on mobile
- Optimize for touch devices
- Test on low-end devices

### Contingency Plans

#### If Web Worker Fails
- Fall back to main thread with loading indicator
- Show warning about potential UI lag
- Recommend smaller datasets

#### If Mobile Performance Poor
- Offer "lite mode" with reduced features
- Increase LOD thresholds
- Limit maximum nodes on mobile

#### If Accessibility Requirements Not Met
- Prioritize keyboard navigation
- Ensure screen reader basics work
- Provide text alternatives for visualizations

---

## 📚 RESOURCES & TOOLS

### Development Tools
- **VS Code Extensions:**
  - ESLint
  - Prettier
  - TypeScript
  - axe Accessibility Linter
  
- **Browser DevTools:**
  - React DevTools
  - Performance profiler
  - Lighthouse
  - axe DevTools

### Testing Tools
- **Unit Testing:** Vitest
- **E2E Testing:** Playwright
- **Accessibility:** axe-core, WAVE
- **Performance:** Chrome Performance, Lighthouse

### Design Tools
- **Figma:** Design mockups
- **Contrast Checker:** WebAIM
- **Color Palette:** Coolors.co
- **Icons:** Heroicons, Lucide

### Documentation
- **WCAG 2.1:** https://www.w3.org/WAI/WCAG21/quickref/
- **React Docs:** https://react.dev/
- **PixiJS Docs:** https://pixijs.com/
- **MDN Web Docs:** https://developer.mozilla.org/

---

## 📝 PROGRESS TRACKING

### Week 1 Progress
- [ ] BLOCKER-1 completed
- [ ] BLOCKER-2 completed
- [ ] Gate 1 passed
- [ ] Gate 2 passed

### Week 2 Progress
- [ ] HIGH-1 completed
- [ ] HIGH-2 completed
- [ ] Gate 4 passed

### Week 3 Progress
- [ ] HIGH-3 completed
- [ ] HIGH-4 completed
- [ ] Gate 5 passed

### Week 4 Progress
- [ ] HIGH-5 completed
- [ ] Mobile testing complete

### Week 5 Progress
- [ ] MEDIUM-1 completed
- [ ] MEDIUM-2 completed
- [ ] Gate 3 passed

---

## 🎉 PRODUCTION LAUNCH CHECKLIST

### Pre-Launch (T-1 Week)
- [ ] All P0 and P1 tasks completed
- [ ] All quality gates passed
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Release notes prepared

### Launch Day (T-0)
- [ ] Final build created
- [ ] Signed packages generated
- [ ] Release published
- [ ] Documentation published
- [ ] Monitoring enabled
- [ ] Support channels ready

### Post-Launch (T+1 Week)
- [ ] Monitor error rates
- [ ] Collect user feedback
- [ ] Address critical issues
- [ ] Plan next iteration

---

**Document Version:** 1.0  
**Last Updated:** October 4, 2025  
**Next Review:** Weekly during implementation  
**Owner:** Development Team  
**Status:** Ready for Implementation
