# CircuitExp1 Integration Implementation Plan

## Overview
This plan addresses the critical gaps identified in the evaluation report to integrate scan-manager.cjs with electron-main.cjs and establish proper IPC communication.

## Phase 1: Core Infrastructure Setup (Week 1)

### Task 1.1: Fix Configuration Drift
**Priority**: P0 (Blocking)
**Estimated Time**: 4 hours
**Dependencies**: None

**Objective**: Standardize port configuration and dev/prod detection

**Implementation Steps**:
1. Update vite.config.ts to use port 5175 (align with scripts)
2. Set NODE_ENV=development in npm start script
3. Fix isDev detection in electron-main.cjs
4. Remove unsupported BrowserWindow options
5. Consolidate electron-builder config

**Files to Modify**:
- `vite.config.ts`: Change port from 5176 to 5175
- `package.json`: Add NODE_ENV to start script
- `electron-main.cjs`: Fix isDev logic, remove invalid options
- `electron-builder.config.js`: Move all config from package.json

**Expected Outcome**: Consistent development environment setup

### Task 1.2: Add Preload Integration
**Priority**: P0 (Blocking)
**Estimated Time**: 2 hours
**Dependencies**: Task 1.1

**Objective**: Connect preload.cjs to electron-main.cjs

**Implementation Steps**:
1. Add preload path to BrowserWindow webPreferences
2. Verify contextIsolation and sandbox settings
3. Test IPC channel allowlist functionality

**Files to Modify**:
- `electron-main.cjs`: Add preload configuration

**Expected Outcome**: Secure IPC bridge established

### Task 1.3: Implement Core IPC Handlers
**Priority**: P0 (Blocking)
**Estimated Time**: 6 hours
**Dependencies**: Task 1.2

**Objective**: Wire basic IPC handlers for scan operations

**Implementation Steps**:
1. Import scan-manager.cjs in electron-main.cjs
2. Add ipcMain.handle for scan:start, scan:cancel, scan:state
3. Add input validation using ipc-validation.cjs
4. Implement path security validation with allowlist

**Files to Modify**:
- `electron-main.cjs`: Add IPC handlers with validation

**Expected Outcome**: Basic scan IPC communication working

## Phase 2: Event Flow Integration (Week 1-2)

### Task 2.1: Connect Scan Manager Events
**Priority**: P0 (Blocking)
**Estimated Time**: 4 hours
**Dependencies**: Task 1.3

**Objective**: Forward scan-manager events to renderer

**Implementation Steps**:
1. Set up scan-manager event listeners in electron-main.cjs
2. Map scan:registered to scan:started for renderer
3. Forward scan:progress, scan:partial, scan:done via webContents.send
4. Add error event handling and classification

**Files to Modify**:
- `electron-main.cjs`: Add event forwarding logic

**Expected Outcome**: Complete scan event flow working

### Task 2.2: Remove Legacy Scan Function
**Priority**: P1
**Estimated Time**: 2 hours
**Dependencies**: Task 2.1

**Objective**: Replace synchronous scanFolder with async scan-manager

**Implementation Steps**:
1. Remove existing scanFolder function
2. Update select-and-scan-folder handler to use scan-manager
3. Add proper error handling for edge cases

**Files to Modify**:
- `electron-main.cjs`: Remove scanFolder, update handler

**Expected Outcome**: No blocking file operations in main thread

## Phase 3: Security Implementation (Week 2)

### Task 3.1: Implement Path Security
**Priority**: P0 (Security Critical)
**Estimated Time**: 6 hours
**Dependencies**: Task 1.3

**Objective**: Add comprehensive path validation and security

**Implementation Steps**:
1. Create path allowlist for scan roots (user directories only)
2. Implement realpath-based path validation
3. Add symlink handling policy (default: disabled)
4. Integrate SecurityValidator for all path inputs
5. Add audit logging for security violations

**Files to Modify**:
- `electron-main.cjs`: Add security validation
- `electron/security-config.cjs`: Add path allowlist constants

**Expected Outcome**: Path traversal attacks prevented

### Task 3.2: Implement Rate Limiting
**Priority**: P1 (Security)
**Estimated Time**: 4 hours
**Dependencies**: Task 3.1

**Objective**: Prevent abuse and resource exhaustion

**Implementation Steps**:
1. Add rate limiting for scan operations (max 1 concurrent scan)
2. Implement request throttling per session
3. Add resource limits (maxDepth, maxEntries defaults)
4. Add timeout mechanisms for long-running scans

**Files to Modify**:
- `electron-main.cjs`: Add rate limiting logic
- `scan-manager.cjs`: Ensure default limits are enforced

**Expected Outcome**: DoS attacks and resource exhaustion prevented

### Task 3.3: Harden CSP Implementation
**Priority**: P1 (Security)
**Estimated Time**: 3 hours
**Dependencies**: Task 1.1

**Objective**: Ensure CSP is properly enforced in all modes

**Implementation Steps**:
1. Verify CSPManager integration in both dev and prod
2. Add nonce support for inline scripts
3. Test CSP enforcement in packaged app
4. Remove unsafe-* directives from production CSP

**Files to Modify**:
- `electron-main.cjs`: Improve CSP integration
- `src/security/csp-manager.cjs`: Add nonce rotation

**Expected Outcome**: XSS and injection attacks prevented

## Phase 4: Performance & Reliability (Week 2-3)

### Task 4.1: Implement Event Throttling
**Priority**: P1 (Performance)
**Estimated Time**: 3 hours
**Dependencies**: Task 2.1

**Objective**: Prevent UI performance issues from event storms

**Implementation Steps**:
1. Add event throttling (max 10 progress events/sec)
2. Implement batching for partial node events
3. Add backpressure handling if renderer lags
4. Optimize payload sizes for large datasets

**Files to Modify**:
- `electron-main.cjs`: Add throttling logic
- `scan-manager.cjs`: Tune batch sizes

**Expected Outcome**: Smooth UI performance during large scans

### Task 4.2: Add Memory Management
**Priority**: P1 (Scalability)
**Estimated Time**: 4 hours
**Dependencies**: Task 4.1

**Objective**: Handle large directory trees without memory exhaustion

**Implementation Steps**:
1. Implement LRU cache for nodeByPath map
2. Add memory usage monitoring
3. Implement early termination on memory limits
4. Add streaming mode for very large trees

**Files to Modify**:
- `scan-manager.cjs`: Add memory management

**Expected Outcome**: Stable memory usage for large scans

### Task 4.3: Enhance Error Handling
**Priority**: P1 (Reliability)
**Estimated Time**: 3 hours
**Dependencies**: Task 2.1

**Objective**: Provide robust error handling and user feedback

**Implementation Steps**:
1. Implement comprehensive error classification
2. Add user-friendly error messages with suggested actions
3. Add error recovery mechanisms where possible
4. Implement error event propagation to UI

**Files to Modify**:
- `scan-manager.cjs`: Enhance error classification
- `electron-main.cjs`: Add error event forwarding

**Expected Outcome**: Clear user feedback and graceful error handling

## Phase 5: Testing & Validation (Week 3)

### Task 5.1: Fix Test Infrastructure
**Priority**: P0 (Blocking)
**Estimated Time**: 6 hours
**Dependencies**: Task 1.1

**Objective**: Restore working test environment

**Implementation Steps**:
1. Investigate and fix test timeouts
2. Update test configuration for new IPC architecture
3. Add integration tests for scan flow
4. Fix E2E test Electron configuration

**Files to Modify**:
- `vitest.config.ts`: Fix test configuration
- `playwright.config.ts`: Remove insecure test flags
- `tests/`: Add new integration tests

**Expected Outcome**: All tests passing, CI pipeline working

### Task 5.2: Add Security Tests
**Priority**: P1 (Security Validation)
**Estimated Time**: 4 hours
**Dependencies**: Task 5.1, Task 3.1

**Objective**: Validate security implementations

**Implementation Steps**:
1. Add path traversal attack tests
2. Add rate limiting validation tests
3. Add CSP enforcement tests
4. Add input validation fuzzing tests

**Files to Create**:
- `tests/security/`: New security test suite

**Expected Outcome**: Security vulnerabilities caught by tests

### Task 5.3: Add Performance Tests
**Priority**: P1 (Performance Validation)
**Estimated Time**: 3 hours
**Dependencies**: Task 5.1, Task 4.1

**Objective**: Validate performance characteristics

**Implementation Steps**:
1. Add large dataset tests (10k+ files)
2. Add memory usage validation tests
3. Add event throttling validation
4. Add scan timeout tests

**Files to Create**:
- `tests/performance/`: New performance test suite

**Expected Outcome**: Performance regressions caught by tests

## Phase 6: Documentation & Deployment (Week 3-4)

### Task 6.1: Update Documentation
**Priority**: P1 (Maintenance)
**Estimated Time**: 4 hours
**Dependencies**: All previous tasks

**Objective**: Align documentation with implementation

**Implementation Steps**:
1. Update PRODUCTION_DEPLOYMENT_CHECKLIST.md with real status
2. Update API_DOCUMENTATION.md with new IPC contracts
3. Update README.md with current architecture
4. Document security implementation details

**Files to Modify**:
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `API_DOCUMENTATION.md`
- `README.md`
- `SECURITY_HARDENING_GUIDE.md`

**Expected Outcome**: Documentation matches implementation

### Task 6.2: Production Validation
**Priority**: P1 (Deployment)
**Estimated Time**: 4 hours
**Dependencies**: Task 6.1

**Objective**: Validate production readiness

**Implementation Steps**:
1. Test signed builds on all platforms
2. Validate CSP in packaged applications
3. Test update mechanisms
4. Run security audit tools

**Expected Outcome**: Production deployment ready

## Implementation Dependencies

```
Task 1.1 (Config) → Task 1.2 (Preload) → Task 1.3 (IPC)
                                           ↓
Task 2.1 (Events) → Task 2.2 (Legacy)
    ↓                   ↓
Task 3.1 (Security) → Task 3.2 (Rate Limit)
    ↓
Task 3.3 (CSP)
    ↓
Task 4.1 (Throttling) → Task 4.2 (Memory) → Task 4.3 (Errors)
                                               ↓
Task 5.1 (Tests) → Task 5.2 (Security Tests) → Task 5.3 (Perf Tests)
    ↓
Task 6.1 (Docs) → Task 6.2 (Production)
```

## Risk Mitigation

### High Risk Tasks
- **Task 1.3**: Core IPC implementation - requires careful validation
- **Task 3.1**: Security implementation - critical for preventing attacks
- **Task 5.1**: Test fixes - may reveal additional issues

### Mitigation Strategies
- Implement behind feature flags for gradual rollout
- Add comprehensive logging for debugging
- Use conservative defaults for all limits
- Implement circuit breakers for error recovery

## Success Criteria

### Functional
- [ ] Scan operations work end-to-end via IPC
- [ ] Progress events update UI in real-time
- [ ] Error handling provides actionable feedback
- [ ] Large datasets (10k+ files) scan successfully

### Security
- [ ] Path traversal attacks are blocked
- [ ] Rate limiting prevents abuse
- [ ] CSP prevents XSS attacks
- [ ] All inputs are validated and sanitized

### Performance
- [ ] No blocking operations in main thread
- [ ] Memory usage remains stable for large scans
- [ ] UI remains responsive during scans
- [ ] Event throughput is optimized

### Quality
- [ ] All tests pass consistently
- [ ] Code coverage meets quality gates
- [ ] Documentation is accurate and complete
- [ ] Production builds work on all platforms

## Estimated Timeline
- **Week 1**: Phase 1-2 (Core Infrastructure & Event Flow)
- **Week 2**: Phase 3-4 (Security & Performance)
- **Week 3**: Phase 5 (Testing & Validation)
- **Week 4**: Phase 6 (Documentation & Deployment)

**Total Estimated Effort**: 65 hours (3-4 weeks with focused development)

## Post-Implementation

### Monitoring
- Set up telemetry for scan performance metrics
- Monitor error rates and types
- Track memory usage patterns
- Monitor security event logs

### Future Enhancements
- Worker thread isolation for scanning
- Persistent caching for large directories
- Advanced filtering and search capabilities
- Plugin system integration