import { vi } from 'vitest';

// Mock global objects
if (typeof global !== 'undefined') {
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  };
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true
});

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor() {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  value: IntersectionObserverMock,
  writable: true
});

// Mock fetch
global.fetch = vi.fn();

// Mock performance
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn()
};

// Mock process for Node.js environment
if (typeof process === 'undefined') {
  (global as any).process = {
    env: {},
    memoryUsage: vi.fn(() => ({
      heapUsed: 1000000,
      heapTotal: 2000000,
      external: 100000,
      rss: 5000000
    }))
  };
}

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});