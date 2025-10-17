# Action Plan: Critical Fixes for Production Readiness

**Created:** January 7, 2025  
**Status:** ACTIVE  
**Target Completion:** 6-8 weeks  
**Current Production Readiness:** 6.5/10 → **Target:** 8.5/10

---

## 🎯 Overview

This action plan addresses the three P0 (Priority 0) blockers and two P1 (Priority 1) issues identified in the comprehensive evaluation. Each task includes specific steps, success criteria, and verification methods.

---

## 🚨 PHASE 1: P0 Blockers (Weeks 1-2)

### Task 1: Build System Stability Fix

**Priority:** P0 (CRITICAL)  
**Estimated Effort:** 3-5 days  
**Assigned To:** [TBD]  
**Dependencies:** None (blocking everything else)

#### Current Issues
```markdown
❌ Vite spawn EINVAL errors (intermittent)
❌ /@vite/client timeout issues
❌ Inconsistent development server startup
❌ Windows-specific path handling issues
```

#### Root Cause Analysis Required
1. **Investigate Vite spawn failures**
   ```powershell
   # Test spawn reliability
   for ($i=1; $i -le 20; $i++) {
     Write-Host "Attempt $i"
     npm run dev
     Start-Sleep -Seconds 2
     # Kill process
     Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
   }
   ```

2. **Check Windows path issues**
   - Review `vite.config.ts` path handling
   - Test with various Windows path formats
   - Verify symlink handling

3. **Analyze health check implementation**
   - Review `scripts/health-check.cjs`
   - Test timeout scenarios
   - Add retry logic

#### Implementation Steps

**Step 1: Fix Path Handling (Day 1)**

```typescript
// vite.config.ts - Add Windows-specific path normalization
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Ensure proper path handling on Windows
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    host: '0.0.0.0',
    fs: {
      // Use absolute paths for Windows compatibility
      allow: [path.resolve(__dirname, '..')]
    }
  },
  resolve: {
    symlinks: false,
    alias: {
      // Add explicit aliases to avoid resolution issues
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@visualization': path.resolve(__dirname, './src/visualization')
    }
  },
  // Add retry logic for module resolution
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020'
    },
    force: false // Set to true if persistent issues
  }
});
```

**Step 2: Enhance Health Check (Day 2)**

```javascript
// scripts/health-check.cjs - Add retry logic and better error handling
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

async function spawnViteWithRetry(retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[health-check] Spawn attempt ${attempt}/${retries}`);
      
      const viteProcess = spawn(npxCmd, ['vite', '--port', '5175', '--strictPort'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      // Wait for stable startup
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Spawn timeout')), 10000);
        viteProcess.stdout.on('data', (data) => {
          if (data.toString().includes('ready in')) {
            clearTimeout(timeout);
            resolve();
          }
        });
        viteProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      return { ok: true, viteProcess };
    } catch (error) {
      console.error(`[health-check] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < retries) {
        console.log(`[health-check] Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        return { ok: false, error: error.message };
      }
    }
  }
}

// Add process cleanup to prevent port conflicts
process.on('exit', () => {
  try {
    // Kill any remaining Vite processes
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq vite*"', { stdio: 'ignore' });
    }
  } catch (e) {
    // Ignore cleanup errors
  }
});
```

**Step 3: Add Build Monitoring (Day 3)**

```javascript
// scripts/build-monitor.cjs - NEW FILE
/**
 * Monitors build reliability and reports issues
 */
const fs = require('fs');
const path = require('path');

class BuildMonitor {
  constructor() {
    this.logFile = path.join(__dirname, '../.build-monitor.log');
    this.failures = [];
  }

  logAttempt(success, error = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      success,
      error: error?.message || null,
      stack: error?.stack || null
    };

    this.failures.push(entry);
    fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
  }

  getStats() {
    if (!fs.existsSync(this.logFile)) return null;

    const lines = fs.readFileSync(this.logFile, 'utf-8').split('\n').filter(Boolean);
    const attempts = lines.map(l => JSON.parse(l));
    
    const total = attempts.length;
    const successful = attempts.filter(a => a.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total * 100).toFixed(2) : 0;

    return { total, successful, failed, successRate };
  }

  report() {
    const stats = this.getStats();
    if (!stats) {
      console.log('[build-monitor] No build history available');
      return;
    }

    console.log('\n=== Build Reliability Report ===');
    console.log(`Total Attempts: ${stats.total}`);
    console.log(`Successful: ${stats.successful}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Success Rate: ${stats.successRate}%`);
    
    if (parseFloat(stats.successRate) < 95) {
      console.warn('⚠️  Build success rate below 95% threshold!');
    } else {
      console.log('✅ Build stability acceptable');
    }
  }
}

module.exports = { BuildMonitor };
```

**Step 4: Update Package Scripts (Day 3)**

```json
// package.json - Add monitoring scripts
{
  "scripts": {
    "dev": "node scripts/build-monitor.cjs start && vite --port 5175 --strictPort",
    "dev:monitored": "node scripts/build-monitor.cjs wrap \"npm run dev\"",
    "build:monitored": "node scripts/build-monitor.cjs wrap \"npm run build\"",
    "monitor:report": "node scripts/build-monitor.cjs report",
    "monitor:reset": "node scripts/build-monitor.cjs reset"
  }
}
```

#### Success Criteria
- [ ] 20 consecutive successful dev server starts
- [ ] Health check passes 100% over 10 runs
- [ ] Build success rate >95% over 50 builds
- [ ] No EINVAL errors in 24-hour period
- [ ] Cross-platform verification (Windows/Mac/Linux)

#### Verification Commands
```bash
# Test build stability
npm run monitor:reset
for i in {1..20}; do npm run dev:monitored; done
npm run monitor:report

# Health check verification
for i in {1..10}; do npm run health; done

# Full build cycle test
npm run build:monitored
```

---

### Task 2: WebGL Module Loading Fix

**Priority:** P0 (CRITICAL)  
**Estimated Effort:** 4-6 days  
**Assigned To:** [TBD]  
**Dependencies:** Task 1 (build system must be stable)

#### Current Issues
```markdown
❌ Dynamic imports of WebGL modules failing
❌ GPU context management unreliable
❌ Core visualization functionality affected
❌ No graceful fallback to Canvas renderer
```

#### Root Cause Analysis

1. **Investigate dynamic import failures**
   ```typescript
   // Check current implementation
   // src/visualization/index.ts
   
   // Problem: Dynamic imports may be failing due to:
   // - Incorrect module paths
   // - Build configuration issues
   // - Circular dependencies
   // - Missing error handling
   ```

2. **Test WebGL availability**
   ```typescript
   // Add WebGL detection utility
   // src/visualization/webgl-detector.ts
   ```

#### Implementation Steps

**Step 1: Create WebGL Detection Utility (Day 1)**

```typescript
// src/visualization/webgl-detector.ts - NEW FILE
/**
 * Robust WebGL capability detection
 */

export interface WebGLCapabilities {
  supported: boolean;
  version: 1 | 2 | null;
  renderer: string | null;
  vendor: string | null;
  maxTextureSize: number | null;
  error: string | null;
}

export class WebGLDetector {
  private static cachedResult: WebGLCapabilities | null = null;

  static detect(): WebGLCapabilities {
    // Return cached result if available
    if (this.cachedResult) {
      return this.cachedResult;
    }

    try {
      const canvas = document.createElement('canvas');
      
      // Try WebGL2 first
      let gl: WebGLRenderingContext | WebGL2RenderingContext | null = 
        canvas.getContext('webgl2') || canvas.getContext('webgl');

      if (!gl) {
        this.cachedResult = {
          supported: false,
          version: null,
          renderer: null,
          vendor: null,
          maxTextureSize: null,
          error: 'WebGL not available'
        };
        return this.cachedResult;
      }

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      
      this.cachedResult = {
        supported: true,
        version: gl instanceof WebGL2RenderingContext ? 2 : 1,
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
        vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        error: null
      };

      // Cleanup
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }

      return this.cachedResult;
    } catch (error) {
      this.cachedResult = {
        supported: false,
        version: null,
        renderer: null,
        vendor: null,
        maxTextureSize: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      return this.cachedResult;
    }
  }

  static reset(): void {
    this.cachedResult = null;
  }

  static logCapabilities(): void {
    const caps = this.detect();
    console.group('WebGL Capabilities');
    console.log('Supported:', caps.supported);
    console.log('Version:', caps.version);
    console.log('Renderer:', caps.renderer);
    console.log('Vendor:', caps.vendor);
    console.log('Max Texture Size:', caps.maxTextureSize);
    if (caps.error) {
      console.error('Error:', caps.error);
    }
    console.groupEnd();
  }
}
```

**Step 2: Fix Dynamic Import Pattern (Day 2-3)**

```typescript
// src/visualization/index.ts - REFACTOR
import { WebGLDetector } from './webgl-detector';

/**
 * Lazy load visualization modules with proper error handling
 */

export type VisualizationRenderer = 'webgl' | 'canvas';

interface LoadResult<T> {
  success: boolean;
  module: T | null;
  error: string | null;
  renderer: VisualizationRenderer;
}

// Cache loaded modules
let webglModuleCache: any = null;
let canvasModuleCache: any = null;

/**
 * Load WebGL renderer with fallback to Canvas
 */
export async function loadVisualizationRenderer(): Promise<LoadResult<any>> {
  // Check WebGL support
  const webglCaps = WebGLDetector.detect();
  
  console.log('[viz] Loading renderer...');
  WebGLDetector.logCapabilities();

  // Try WebGL first if supported
  if (webglCaps.supported) {
    try {
      console.log('[viz] Attempting WebGL renderer...');
      
      if (!webglModuleCache) {
        // Use explicit import with error handling
        webglModuleCache = await import(
          /* webpackChunkName: "webgl-renderer" */
          './stage/metro-stage'
        ).catch(error => {
          console.error('[viz] WebGL module import failed:', error);
          return null;
        });
      }

      if (webglModuleCache) {
        console.log('[viz] ✅ WebGL renderer loaded successfully');
        return {
          success: true,
          module: webglModuleCache,
          error: null,
          renderer: 'webgl'
        };
      }
    } catch (error) {
      console.warn('[viz] WebGL renderer failed to load:', error);
    }
  }

  // Fallback to Canvas renderer
  console.log('[viz] Falling back to Canvas renderer...');
  
  try {
    if (!canvasModuleCache) {
      canvasModuleCache = await import(
        /* webpackChunkName: "canvas-renderer" */
        './stage/fallback-renderer'
      ).catch(error => {
        console.error('[viz] Canvas module import failed:', error);
        return null;
      });
    }

    if (canvasModuleCache) {
      console.log('[viz] ✅ Canvas renderer loaded successfully');
      return {
        success: true,
        module: canvasModuleCache,
        error: null,
        renderer: 'canvas'
      };
    }
  } catch (error) {
    console.error('[viz] Canvas renderer failed to load:', error);
    return {
      success: false,
      module: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      renderer: 'canvas'
    };
  }

  // Both renderers failed
  return {
    success: false,
    module: null,
    error: 'All renderers failed to load',
    renderer: 'canvas'
  };
}

/**
 * Preload renderer during app initialization
 */
export async function preloadRenderer(): Promise<void> {
  try {
    const result = await loadVisualizationRenderer();
    if (!result.success) {
      console.error('[viz] Preload failed:', result.error);
    }
  } catch (error) {
    console.error('[viz] Preload error:', error);
  }
}

// Export for use in components
export { WebGLDetector };
```

**Step 3: Update MetroStage Component (Day 4)**

```typescript
// src/visualization/stage/metro-stage.tsx - UPDATE
import React, { useEffect, useRef, useState } from 'react';
import { loadVisualizationRenderer, WebGLDetector } from '../index';
import type { MetroStageProps } from './types';

export const MetroStage: React.FC<MetroStageProps> = (props) => {
  const [rendererType, setRendererType] = useState<'webgl' | 'canvas' | 'loading'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const rendererRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    async function initializeRenderer() {
      try {
        const result = await loadVisualizationRenderer();
        
        if (!mounted) return;

        if (result.success && result.module) {
          setRendererType(result.renderer);
          rendererRef.current = result.module;
          setLoadError(null);
        } else {
          setLoadError(result.error || 'Failed to load renderer');
          console.error('[MetroStage] Renderer load failed:', result.error);
        }
      } catch (error) {
        if (!mounted) return;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setLoadError(errorMsg);
        console.error('[MetroStage] Initialization error:', error);
      }
    }

    initializeRenderer();

    return () => {
      mounted = false;
    };
  }, []);

  // Show loading state
  if (rendererType === 'loading') {
    return (
      <div className="metro-stage-loading">
        <div className="spinner"></div>
        <p>Loading visualization engine...</p>
      </div>
    );
  }

  // Show error state
  if (loadError) {
    return (
      <div className="metro-stage-error">
        <h3>⚠️ Visualization Engine Error</h3>
        <p>{loadError}</p>
        <button onClick={() => window.location.reload()}>
          Reload Application
        </button>
        <details>
          <summary>Technical Details</summary>
          <pre>{JSON.stringify(WebGLDetector.detect(), null, 2)}</pre>
        </details>
      </div>
    );
  }

  // Render with appropriate renderer
  if (rendererType === 'canvas') {
    console.warn('[MetroStage] Using Canvas fallback renderer');
  }

  // Your existing MetroStage implementation here...
  return (
    <div className="metro-stage" data-renderer={rendererType}>
      {/* Existing implementation */}
    </div>
  );
};
```

**Step 4: Add Renderer Tests (Day 5)**

```typescript
// tests/visualization/renderer-loading.test.ts - NEW FILE
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadVisualizationRenderer, WebGLDetector } from '../../src/visualization/index';

describe('Visualization Renderer Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    WebGLDetector.reset();
  });

  it('should detect WebGL capabilities', () => {
    const caps = WebGLDetector.detect();
    expect(caps).toHaveProperty('supported');
    expect(caps).toHaveProperty('version');
    expect(caps).toHaveProperty('renderer');
  });

  it('should load renderer successfully', async () => {
    const result = await loadVisualizationRenderer();
    expect(result.success).toBe(true);
    expect(result.module).not.toBeNull();
    expect(['webgl', 'canvas']).toContain(result.renderer);
  });

  it('should handle WebGL unavailable gracefully', async () => {
    // Mock WebGL unavailable
    vi.spyOn(WebGLDetector, 'detect').mockReturnValue({
      supported: false,
      version: null,
      renderer: null,
      vendor: null,
      maxTextureSize: null,
      error: 'WebGL not available'
    });

    const result = await loadVisualizationRenderer();
    expect(result.success).toBe(true);
    expect(result.renderer).toBe('canvas');
  });

  it('should cache loaded modules', async () => {
    const result1 = await loadVisualizationRenderer();
    const result2 = await loadVisualizationRenderer();
    
    expect(result1.module).toBe(result2.module);
  });
});
```

#### Success Criteria
- [ ] WebGL detection works reliably
- [ ] Dynamic imports succeed 100% of the time
- [ ] Canvas fallback works when WebGL unavailable
- [ ] All renderer tests pass
- [ ] No console errors during renderer loading
- [ ] Tested on multiple GPU configurations

#### Verification Commands
```bash
# Run renderer tests
npm test -- tests/visualization/renderer-loading.test.ts

# Test in browser
npm run dev
# Open console, check for WebGL logs

# Test Canvas fallback
# Disable WebGL in browser DevTools
# Verify app still works
```

---

### Task 3: GPU Test Failures Fix

**Priority:** P0 (CRITICAL)  
**Estimated Effort:** 2-3 days  
**Assigned To:** [TBD]  
**Dependencies:** Task 2 (renderer loading must work)

#### Current Issues
```markdown
❌ 4 tests failing in gpu-context-management.test.ts
❌ safeResize functionality not working correctly
❌ Viewport dimension validation issues
```

#### Implementation Steps

**Step 1: Review Failing Tests (Day 1)**

```bash
# Run specific test file to see failures
npm test -- tests/visualization/gpu-context-management.test.ts --reporter=verbose
```

**Step 2: Fix safeResize Function (Day 1-2)**

```typescript
// src/visualization/stage/gpu-utils.ts - FIX
/**
 * Safely resize GPU context with validation
 */
export function safeResize(
  renderer: any,
  width: number,
  height: number,
  options: { maxWidth?: number; maxHeight?: number } = {}
): { success: boolean; actualWidth: number; actualHeight: number; error?: string } {
  const maxWidth = options.maxWidth || 4096;
  const maxHeight = options.maxHeight || 4096;
  
  // Validate inputs
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return {
      success: false,
      actualWidth: renderer.width || 0,
      actualHeight: renderer.height || 0,
      error: 'Invalid dimensions: must be finite numbers'
    };
  }

  if (width <= 0 || height <= 0) {
    return {
      success: false,
      actualWidth: renderer.width || 0,
      actualHeight: renderer.height || 0,
      error: 'Invalid dimensions: must be positive'
    };
  }

  // Clamp to safe limits
  const safeWidth = Math.min(Math.max(1, Math.floor(width)), maxWidth);
  const safeHeight = Math.min(Math.max(1, Math.floor(height)), maxHeight);

  try {
    // Attempt resize
    renderer.resize(safeWidth, safeHeight);
    
    return {
      success: true,
      actualWidth: safeWidth,
      actualHeight: safeHeight
    };
  } catch (error) {
    console.error('[gpu-utils] Resize failed:', error);
    return {
      success: false,
      actualWidth: renderer.width || 0,
      actualHeight: renderer.height || 0,
      error: error instanceof Error ? error.message : 'Resize failed'
    };
  }
}
```

**Step 3: Update Tests to Match Implementation (Day 2)**

```typescript
// tests/visualization/gpu-context-management.test.ts - UPDATE
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeResize } from '../../src/visualization/stage/gpu-utils';

describe('GPU Context Management', () => {
  let mockRenderer: any;

  beforeEach(() => {
    mockRenderer = {
      width: 800,
      height: 600,
      resize: vi.fn((w, h) => {
        mockRenderer.width = w;
        mockRenderer.height = h;
      })
    };
  });

  describe('safeResize', () => {
    it('should resize with valid dimensions', () => {
      const result = safeResize(mockRenderer, 1024, 768);
      
      expect(result.success).toBe(true);
      expect(result.actualWidth).toBe(1024);
      expect(result.actualHeight).toBe(768);
      expect(mockRenderer.resize).toHaveBeenCalledWith(1024, 768);
    });

    it('should reject invalid dimensions (NaN)', () => {
      const result = safeResize(mockRenderer, NaN, 600);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('finite numbers');
      expect(mockRenderer.resize).not.toHaveBeenCalled();
    });

    it('should reject invalid dimensions (negative)', () => {
      const result = safeResize(mockRenderer, -100, 600);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('positive');
      expect(mockRenderer.resize).not.toHaveBeenCalled();
    });

    it('should reject invalid dimensions (zero)', () => {
      const result = safeResize(mockRenderer, 0, 600);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('positive');
      expect(mockRenderer.resize).not.toHaveBeenCalled();
    });

    it('should clamp to maximum dimensions', () => {
      const result = safeResize(mockRenderer, 5000, 5000, {
        maxWidth: 4096,
        maxHeight: 4096
      });
      
      expect(result.success).toBe(true);
      expect(result.actualWidth).toBe(4096);
      expect(result.actualHeight).toBe(4096);
    });

    it('should handle resize errors gracefully', () => {
      mockRenderer.resize = vi.fn(() => {
        throw new Error('GPU context lost');
      });

      const result = safeResize(mockRenderer, 1024, 768);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('GPU context lost');
    });
  });
});
```

**Step 4: Run Full Test Suite (Day 3)**

```bash
# Verify all GPU tests pass
npm test -- tests/visualization/gpu-context-management.test.ts

# Run full test suite
npm test

# Check coverage
npm run test:coverage
```

#### Success Criteria
- [ ] All 4 GPU tests pass
- [ ] safeResize handles all edge cases
- [ ] Dimension validation works correctly
- [ ] Error handling is robust
- [ ] Coverage maintained at 80%+

---

## ⚡ PHASE 2: P1 Issues (Weeks 3-4)

### Task 4: Expand Test Coverage

**Priority:** P1 (HIGH)  
**Estimated Effort:** 1-2 weeks  
**Target:** 50-60% overall coverage

#### Implementation Strategy

```typescript
// Step 1: Add UI component tests (Week 3)
// - MetroUI.tsx
// - App.tsx
// - ResponsiveMetroStage.tsx
// - Error components

// Step 2: Add integration tests (Week 4)
// - Full scan workflow
// - Favorites management
// - Settings persistence
// - Theme switching

// Step 3: Update coverage config
// vitest.config.ts - expand include list
```

### Task 5: Memory Leak Investigation

**Priority:** P1 (HIGH)  
**Estimated Effort:** 5-7 days  
**Target:** <100KB growth per 1000 cycles

#### Implementation Strategy

```bash
# Extended memory profiling
npm run perf:leak -- --cycles=1000

# GPU resource audit
# Review all PixiJS resource creation/destruction

# Add automated leak detection
# Integrate into CI pipeline
```

---

## 📊 Progress Tracking

### Week 1 Checklist
- [ ] Day 1: Fix build system path handling
- [ ] Day 2: Add health check retry logic
- [ ] Day 3: Implement build monitoring
- [ ] Day 4: WebGL detection utility
- [ ] Day 5: Fix dynamic imports

### Week 2 Checklist
- [ ] Day 1: Update MetroStage component
- [ ] Day 2: Add renderer tests
- [ ] Day 3: Fix GPU test failures
- [ ] Day 4: Verify all P0 fixes
- [ ] Day 5: Documentation updates

### Week 3-4 Checklist
- [ ] UI component test suite
- [ ] Integration test suite
- [ ] Memory leak testing
- [ ] Coverage verification

---

## 🎯 Success Metrics

**After Phase 1 (P0 Fixes):**
- ✅ Build success rate >95%
- ✅ All GPU tests passing
- ✅ Renderer loading 100% reliable
- ✅ Zero console errors in dev mode

**After Phase 2 (P1 Fixes):**
- ✅ Test coverage >50%
- ✅ Memory leak <100KB/1000 cycles
- ✅ All accessibility tests passing
- ✅ Ready for beta testing

---

## 📝 Notes

- All fixes should include tests
- Document any workarounds
- Update PRODUCTION_READINESS_ANALYSIS.md after each task
- Run full test suite before marking tasks complete
- Cross-platform verification required for P0 tasks

---

**Status:** Ready to begin  
**Next Review:** After Week 1 completion
