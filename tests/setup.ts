// Global test setup for Node-based unit tests (non-plugin)
import { vi, afterEach, expect } from 'vitest';
import { EventEmitter } from 'events';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Ensure Node environment-like globals exist
if (typeof global !== 'undefined') {
  // Provide EventEmitter to tests that reference it without import
  (global as any).EventEmitter = EventEmitter;

  // So tests don't spam console during CI, but keep the API
  global.console = {
    ...console,
    log: console.log, // keep logs visible for debugging mem leak tests
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  } as Console;

  // Provide stable process.memoryUsage mock fallback only if missing (should exist in node env)
  if (typeof process === 'undefined') {
    (global as any).process = {
      env: {},
      memoryUsage: vi.fn(() => ({
        heapUsed: 1000000,
        heapTotal: 2000000,
        external: 100000,
        rss: 5000000,
        arrayBuffers: 0,
      })),
    } as any;
  }
}

afterEach(() => {
  vi.clearAllMocks();
  // Clear any hanging timers
  vi.clearAllTimers();
  // Reset any modified globals
  vi.resetModules();
});

// Add test isolation cleanup
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection in tests:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in tests:', error);
});
