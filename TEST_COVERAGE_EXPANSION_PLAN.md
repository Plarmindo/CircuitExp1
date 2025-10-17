# Test Coverage Expansion Plan

**Created:** January 7, 2025  
**Current Coverage:** ~25-30% (estimated)  
**Target Coverage:** 60%+ overall, 80%+ for critical paths  
**Timeline:** 2-3 weeks

---

## 📊 Current Coverage Status

### ✅ Already Covered (80%+ each)
```typescript
scan-manager.cjs
src/visualization/graph-adapter.ts
src/visualization/layout-v1.ts
src/visualization/layout-v2.ts
src/visualization/incremental-layout.ts
src/visualization/line-routing.ts
src/visualization/navigation-helpers.ts
src/visualization/selection-helpers.ts
```

### ❌ Not Covered (Critical Components)
```typescript
// Main Application (Priority: CRITICAL)
src/App.tsx                                    // 0% coverage
src/main.tsx                                   // 0% coverage

// Core UI Components (Priority: HIGH)
src/components/MetroUI.tsx                     // 0% coverage
src/components/ResponsiveMetroStage.tsx        // 0% coverage
src/visualization/stage/metro-stage.tsx        // 0% coverage

// Visualization Modes (Priority: HIGH)
src/visualization/modes/ModeProvider.tsx       // 0% coverage
src/visualization/modes/DrawerExplorerMode.tsx // 0% coverage
src/visualization/modes/SplitViewMode.tsx      // 0% coverage

// Error Handling (Priority: HIGH)
src/components/ErrorBoundary.tsx               // 0% coverage
src/components/ErrorHandler.tsx                // 0% coverage

// Security (Priority: CRITICAL)
src/security/security-hardening.ts             // ~20% coverage
src/security/security-middleware.ts            // 0% coverage
src/security/plugin-validator.ts               // 0% coverage

// Services (Priority: MEDIUM)
src/services/error-reporter.ts                 // 0% coverage
src/services/audit-logger.ts                   // 0% coverage
src/services/metrics-service.ts                // 0% coverage

// Settings & Navigation (Priority: MEDIUM)
src/settings/SettingsProvider.tsx              // 0% coverage
src/navigation/unified-navigation.ts           // 0% coverage

// Electron Main Process (Priority: HIGH)
electron-main.cjs                              // 0% coverage
preload.cjs                                    // 0% coverage
ipc-validation.cjs                             // ~30% coverage
```

---

## 🎯 Phase 1: Critical Path Coverage (Week 1)

### Priority 1: Main Application Flow

**File:** `src/App.tsx`  
**Target:** 70%+ coverage  
**Estimated Effort:** 1 day

```typescript
// tests/App.test.tsx - NEW FILE
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('should initialize error handlers', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<App />);
    
    // Trigger error
    window.dispatchEvent(new ErrorEvent('error', {
      error: new Error('Test error'),
      message: 'Test error'
    }));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });

    errorSpy.mockRestore();
  });

  it('should handle scan events', async () => {
    render(<App />);

    // Mock scan:start event
    const event = new CustomEvent('scan:start', {
      detail: { scanId: 'test-123' }
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      // Verify scan state updated
      expect(screen.queryByText(/scanning/i)).toBeInTheDocument();
    });
  });

  it('should handle scan progress updates', async () => {
    render(<App />);

    const progressEvent = new CustomEvent('scan:progress', {
      detail: {
        scanId: 'test-123',
        dirsProcessed: 10,
        filesProcessed: 100,
        approxCompletion: 0.5
      }
    });
    window.dispatchEvent(progressEvent);

    await waitFor(() => {
      expect(screen.queryByText(/progress/i)).toBeInTheDocument();
    });
  });

  it('should handle scan completion', async () => {
    render(<App />);

    const doneEvent = new CustomEvent('scan:done', {
      detail: { scanId: 'test-123' }
    });
    window.dispatchEvent(doneEvent);

    await waitFor(() => {
      expect(screen.queryByText(/complete/i)).toBeInTheDocument();
    });
  });
});
```

### Priority 2: MetroUI Component

**File:** `src/components/MetroUI.tsx`  
**Target:** 60%+ coverage  
**Estimated Effort:** 2 days

```typescript
// tests/components/MetroUI.test.tsx - NEW FILE
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetroUIInner } from '../../src/components/MetroUI';
import { ModeProvider } from '../../src/visualization/modes/ModeProvider';
import { SettingsProvider } from '../../src/settings/SettingsProvider';

// Helper to render with providers
function renderMetroUI(props = {}) {
  const defaultProps = {
    scanId: null,
    progress: null,
    nodes: [],
    receivedNodes: 0,
    done: null,
    rootPath: null,
    ...props
  };

  return render(
    <SettingsProvider>
      <ModeProvider>
        <MetroUIInner {...defaultProps} />
      </ModeProvider>
    </SettingsProvider>
  );
}

describe('MetroUI', () => {
  it('should render toolbar controls', () => {
    renderMetroUI();
    
    expect(screen.getByLabelText(/zoom in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/zoom out/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reset view/i)).toBeInTheDocument();
  });

  it('should toggle sidebar', () => {
    renderMetroUI();
    
    const toggleButton = screen.getByLabelText(/toggle sidebar/i);
    fireEvent.click(toggleButton);
    
    // Verify sidebar state changed
    expect(screen.getByRole('complementary')).toHaveClass('collapsed');
  });

  it('should display scan progress', () => {
    renderMetroUI({
      scanId: 'test-123',
      progress: {
        dirsProcessed: 50,
        filesProcessed: 500,
        approxCompletion: 0.5
      }
    });

    expect(screen.getByText(/50/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('should render nodes when provided', () => {
    const nodes = [
      { path: '/test/dir1', name: 'dir1', kind: 'dir' as const },
      { path: '/test/dir2', name: 'dir2', kind: 'dir' as const }
    ];

    renderMetroUI({ nodes, receivedNodes: 2 });
    
    // Verify stage receives nodes
    const stage = screen.getByRole('main');
    expect(stage).toBeInTheDocument();
  });

  it('should handle theme switching', () => {
    renderMetroUI();
    
    const themeButton = screen.getByLabelText(/toggle theme/i);
    fireEvent.click(themeButton);
    
    // Verify theme changed
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('should show completion message', () => {
    renderMetroUI({
      done: {},
      receivedNodes: 100
    });

    expect(screen.getByText(/scan complete/i)).toBeInTheDocument();
  });

  it('should handle favorites', async () => {
    renderMetroUI();
    
    // Open favorites panel
    const favButton = screen.getByLabelText(/favorites/i);
    fireEvent.click(favButton);
    
    // Verify favorites panel appears
    expect(screen.getByText(/favorite locations/i)).toBeInTheDocument();
  });
});
```

### Priority 3: Error Boundaries

**File:** `src/components/ErrorBoundary.tsx`  
**Target:** 90%+ coverage  
**Estimated Effort:** 0.5 day

```typescript
// tests/components/ErrorBoundary.test.tsx - NEW FILE
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// Component that throws error on demand
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child component')).toBeInTheDocument();
  });

  it('should catch and display errors', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    
    spy.mockRestore();
  });

  it('should show error details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const details = screen.getByText(/error details/i);
    expect(details).toBeInTheDocument();

    spy.mockRestore();
  });

  it('should allow retry', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const retryButton = screen.getByText(/try again/i);
    retryButton.click();

    expect(reloadSpy).toHaveBeenCalled();

    spy.mockRestore();
    reloadSpy.mockRestore();
  });

  it('should render custom fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();

    spy.mockRestore();
  });
});
```

---

## 🎯 Phase 2: Security & Services Coverage (Week 2)

### Priority 4: Security Hardening

**File:** `src/security/security-hardening.ts`  
**Target:** 85%+ coverage  
**Estimated Effort:** 2 days

```typescript
// tests/security/security-hardening-extended.test.ts - NEW FILE
import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityHardening } from '../../src/security/security-hardening';

describe('SecurityHardening - Extended Tests', () => {
  let security: SecurityHardening;

  beforeEach(() => {
    security = new SecurityHardening();
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', () => {
      const ip = '192.168.1.1';
      
      // Allow first 100 requests
      for (let i = 0; i < 100; i++) {
        expect(security.checkRateLimit(ip, 'http')).toBe(true);
      }
      
      // Block 101st request
      expect(security.checkRateLimit(ip, 'http')).toBe(false);
    });

    it('should reset rate limits after window', async () => {
      const ip = '192.168.1.2';
      
      // Exhaust limit
      for (let i = 0; i < 100; i++) {
        security.checkRateLimit(ip, 'http');
      }
      expect(security.checkRateLimit(ip, 'http')).toBe(false);
      
      // Wait for reset (mock time)
      // In real implementation, test with fake timers
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      expect(security.checkRateLimit(ip, 'http')).toBe(true);
    });
  });

  describe('CSRF Protection', () => {
    it('should generate valid CSRF tokens', () => {
      const token = security.generateCSRFToken('session-123');
      
      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(20);
    });

    it('should validate matching tokens', () => {
      const sessionId = 'session-123';
      const token = security.generateCSRFToken(sessionId);
      
      const result = security.validateCSRFToken(token, sessionId);
      expect(result.valid).toBe(true);
    });

    it('should reject mismatched tokens', () => {
      const token = security.generateCSRFToken('session-123');
      
      const result = security.validateCSRFToken(token, 'session-456');
      expect(result.valid).toBe(false);
    });

    it('should reject expired tokens', async () => {
      const token = security.generateCSRFToken('session-123');
      
      // Mock time passing (1 hour)
      await new Promise(resolve => setTimeout(resolve, 3600000));
      
      const result = security.validateCSRFToken(token, 'session-123');
      expect(result.valid).toBe(false);
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events', () => {
      const events: any[] = [];
      security.on('securityEvent', (event) => events.push(event));
      
      security.logSecurityEvent('TEST_EVENT', { foo: 'bar' });
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEST_EVENT');
      expect(events[0].details.foo).toBe('bar');
    });

    it('should track event history', () => {
      security.logSecurityEvent('EVENT_1', {});
      security.logSecurityEvent('EVENT_2', {});
      
      const history = security.getSecurityEvents();
      expect(history).toHaveLength(2);
    });

    it('should filter events by severity', () => {
      security.logSecurityEvent('HIGH_SEVERITY', {}, 'high');
      security.logSecurityEvent('LOW_SEVERITY', {}, 'low');
      
      const highEvents = security.getSecurityEvents({ severity: 'high' });
      expect(highEvents).toHaveLength(1);
      expect(highEvents[0].type).toBe('HIGH_SEVERITY');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML entities', () => {
      const result = security.sanitizeHtml('<div>Hello &amp; World</div>');
      expect(result).toBe('<div>Hello & World</div>');
    });

    it('should remove dangerous attributes', () => {
      const result = security.sanitizeHtml('<div onclick="alert(1)">Text</div>');
      expect(result).not.toContain('onclick');
    });

    it('should preserve safe HTML', () => {
      const safe = '<p><strong>Bold</strong> and <em>italic</em></p>';
      const result = security.sanitizeHtml(safe);
      expect(result).toBe(safe);
    });
  });
});
```

### Priority 5: Services Coverage

**File:** `src/services/*`  
**Target:** 70%+ coverage  
**Estimated Effort:** 1 day

```typescript
// tests/services/error-reporter.test.ts - NEW FILE
// tests/services/audit-logger.test.ts - NEW FILE
// tests/services/metrics-service.test.ts - NEW FILE

// Similar comprehensive test structure for each service
```

---

## 🎯 Phase 3: Integration Tests (Week 3)

### Priority 6: End-to-End Workflows

```typescript
// tests/integration/scan-workflow.test.ts - NEW FILE
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

describe('Scan Workflow Integration', () => {
  it('should complete full scan workflow', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 1. Select folder
    const selectButton = screen.getByText(/select folder/i);
    await user.click(selectButton);

    // Mock folder selection
    // (Would need to mock Electron dialog)

    // 2. Wait for scan to start
    await waitFor(() => {
      expect(screen.getByText(/scanning/i)).toBeInTheDocument();
    });

    // 3. Verify progress updates
    await waitFor(() => {
      expect(screen.getByText(/files processed/i)).toBeInTheDocument();
    });

    // 4. Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/complete/i)).toBeInTheDocument();
    }, { timeout: 10000 });

    // 5. Verify visualization rendered
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

// tests/integration/favorites-workflow.test.ts - NEW FILE
// tests/integration/settings-workflow.test.ts - NEW FILE
// tests/integration/theme-workflow.test.ts - NEW FILE
```

---

## 📝 Update Coverage Configuration

```typescript
// vitest.config.ts - UPDATE
export default defineConfig({
  test: {
    // ... existing config
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      
      // EXPANDED include list
      include: [
        // Existing (core algorithms)
        'scan-manager.cjs',
        'src/visualization/graph-adapter.ts',
        'src/visualization/layout-*.ts',
        'src/visualization/line-routing.ts',
        'src/visualization/navigation-helpers.ts',
        'src/visualization/selection-helpers.ts',
        
        // NEW: Main application
        'src/App.tsx',
        'src/main.tsx',
        
        // NEW: Core UI components
        'src/components/MetroUI.tsx',
        'src/components/ResponsiveMetroStage.tsx',
        'src/components/ErrorBoundary.tsx',
        'src/components/ErrorHandler.tsx',
        
        // NEW: Visualization
        'src/visualization/stage/metro-stage.tsx',
        'src/visualization/modes/**/*.tsx',
        
        // NEW: Security
        'src/security/**/*.ts',
        
        // NEW: Services
        'src/services/**/*.ts',
        
        // NEW: Settings & Navigation
        'src/settings/**/*.tsx',
        'src/navigation/**/*.ts'
      ],
      
      // Updated thresholds
      thresholds: {
        lines: 60,      // Was 80, now more realistic
        branches: 55,   // Was 70
        functions: 60,  // Was 75
        statements: 60  // Was 80
      },
    },
  },
});
```

---

## 📊 Coverage Tracking

### Target Coverage by Category

| Category | Current | Target | Priority |
|----------|---------|--------|----------|
| Core Algorithms | 80% | 85% | P2 |
| Main Application | 0% | 70% | P0 |
| UI Components | 5% | 60% | P1 |
| Error Handling | 10% | 90% | P0 |
| Security | 20% | 85% | P0 |
| Services | 0% | 70% | P1 |
| Integration | 0% | 40% | P1 |
| **Overall** | **~28%** | **60%+** | - |

### Weekly Milestones

**Week 1:**
- [ ] App.tsx: 70%+
- [ ] MetroUI.tsx: 60%+
- [ ] ErrorBoundary.tsx: 90%+
- [ ] Overall: 35%+

**Week 2:**
- [ ] SecurityHardening: 85%+
- [ ] Services: 70%+
- [ ] Settings: 60%+
- [ ] Overall: 45%+

**Week 3:**
- [ ] Integration tests: 40%+
- [ ] MetroStage: 50%+
- [ ] Modes: 60%+
- [ ] Overall: 60%+

---

## 🛠️ Testing Tools & Utilities

### Mock Electron APIs

```typescript
// tests/mocks/electron.ts - NEW FILE
export const mockElectron = {
  ipcRenderer: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  },
  
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({
      filePaths: ['/mock/path']
    })
  }
};

// Setup in tests/setup.ts
global.window.__metroAPI = mockElectron;
```

### Test Utilities

```typescript
// tests/utils/test-helpers.ts - NEW FILE
import { render } from '@testing-library/react';
import { SettingsProvider } from '../../src/settings/SettingsProvider';
import { ModeProvider } from '../../src/visualization/modes/ModeProvider';

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <SettingsProvider>
      <ModeProvider>
        {ui}
      </ModeProvider>
    </SettingsProvider>
  );
}

export function waitForAsync(callback: () => void, timeout = 5000) {
  return waitFor(callback, { timeout });
}

export function mockScanData(count = 10) {
  return Array.from({ length: count }, (_, i) => ({
    path: `/test/dir${i}`,
    name: `dir${i}`,
    kind: 'dir' as const,
    size: 1024 * i
  }));
}
```

---

## ✅ Success Criteria

**Phase 1 Complete When:**
- [ ] Overall coverage >35%
- [ ] All critical path tests passing
- [ ] Error boundaries fully tested

**Phase 2 Complete When:**
- [ ] Overall coverage >45%
- [ ] Security components >85% coverage
- [ ] Services >70% coverage

**Phase 3 Complete When:**
- [ ] Overall coverage >60%
- [ ] Integration tests >40% coverage
- [ ] All test suites passing

**Final Success:**
- [ ] 60%+ overall coverage achieved
- [ ] 85%+ coverage on security components
- [ ] 70%+ coverage on main application flow
- [ ] 90%+ coverage on error handling
- [ ] All tests green in CI

---

**Timeline:** 3 weeks  
**Effort:** ~15 days of focused development  
**Review:** Weekly progress check-ins
