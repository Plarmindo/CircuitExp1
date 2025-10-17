import { MemoryLeakDetector } from '../../src/performance/memory-leak-detector';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';

// Set default max listeners for all EventEmitters in tests
EventEmitter.defaultMaxListeners = 100;

describe('MemoryLeakDetector', () => {
  let detector: MemoryLeakDetector;
  const testDir = join(process.cwd(), 'memory-leaks');
  let testEmitter: EventEmitter | null = null;
  let timerHandles: NodeJS.Timeout[] = [];
  let testData: any[] = [];
  let testObjects: Record<string, any> = {};

  const ensureTestDirectory = () => {
    try {
      if (!existsSync(testDir)) {
        mkdirSync(testDir, { recursive: true });
      }
    } catch (error) {
      console.warn('Warning: Failed to create test directory:', error);
    }
  };

  const cleanupTestDirectory = () => {
    try {
      if (existsSync(testDir)) {
        const files = require('fs').readdirSync(testDir);
        files.forEach((file: string) => {
          if (file.startsWith('memory-leak-') && file.includes('test-')) {
            try {
              unlinkSync(join(testDir, file));
            } catch (error) {
              console.warn(`Warning: Failed to delete test file ${file}:`, error);
            }
          }
        });
      }
    } catch (error) {
      console.warn('Warning: Failed to cleanup test directory:', error);
    }
  };

  const forceGarbageCollection = async (cycles = 3, delay = 100) => {
    if (global.gc) {
      try {
        for (let i = 0; i < cycles; i++) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.warn('Warning: Garbage collection failed:', error);
      }
    }
  };

  const cleanupGlobalState = () => {
    if (typeof global !== 'undefined') {
      const globals = ['testData', 'testObjects', 'testEmitter', 'testTimers', 'testListeners'];
      globals.forEach(key => {
        try {
          delete (global as any)[key];
        } catch (error) {
          console.warn(`Warning: Failed to cleanup global.${key}:`, error);
        }
      });
    }
  };

  const cleanupTimers = () => {
    timerHandles.forEach(handle => {
      try {
        clearInterval(handle);
        clearTimeout(handle);
      } catch (error) {
        console.warn('Warning: Timer cleanup failed:', error);
      }
    });
    timerHandles = [];
  };

  const cleanupEventEmitter = () => {
    if (testEmitter) {
      try {
        testEmitter.removeAllListeners();
        testEmitter = null;
      } catch (error) {
        console.warn('Warning: Event emitter cleanup failed:', error);
      }
    }
  };

  beforeEach(async () => {
    // Ensure test directory exists
    ensureTestDirectory();

    // Initialize detector with test configuration
    detector = new MemoryLeakDetector({
      threshold: 1, // Lower threshold for testing
      iterations: 10,
      warmupIterations: 2, // Increased warmup iterations
      snapshotInterval: 2,
    });
    
    // Reset test state
    testData = [];
    testObjects = {};
    
    // Clean up any existing state
    cleanupTimers();
    cleanupEventEmitter();
    
    // Initialize a fresh event emitter
    testEmitter = new EventEmitter();
    
    await forceGarbageCollection(3, 100);
    cleanupGlobalState();
    
    // Add longer delay to ensure memory stabilizes
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  afterEach(async () => {
    // Clean up test files
    cleanupTestDirectory();
    
    // Clean up all resources
    cleanupEventEmitter();
    cleanupTimers();
    
    // Clear test data
    testData = [];
    testObjects = {};
    
    await forceGarbageCollection(5, 150); // More aggressive cleanup in afterEach
    cleanupGlobalState();
    
    // Add longer delay to ensure memory stabilizes
    await new Promise(resolve => setTimeout(resolve, 400));
  });

  describe('Basic Leak Detection', () => {
    it('should detect memory leaks in array accumulation', async () => {
      const leakyFn = () => {
        testData.push(...Array.from({ length: 500 }, (_, i) => i)); // Reduced size
      };

      const result = await detector.detectLeak('array-accumulation', leakyFn);

      expect(result.leakDetected).toBe(true);
      expect(result.totalGrowth).toBeGreaterThan(0);
      expect(result.leakRate).toBeGreaterThan(0);
      expect(result.snapshots).toHaveLength(6); // initial + 5 snapshots (10/2 + final)
      
      // Clean up
      testData = [];
      await forceGarbageCollection(3, 100);
    });

    it('should not detect false positives for stable memory', async () => {
      // Create data outside the function to avoid repeated allocations
      const staticData = Array.from({ length: 100 }, (_, i) => i);

      const stableFn = () => {
        // Use existing data without creating new objects
        return staticData.reduce((sum, x) => sum + x, 0);
      };

      const result = await detector.detectLeak('stable-memory', stableFn);

      expect(result.leakDetected).toBe(false);
      expect(result.totalGrowth).toBeLessThan(1); // Less than 1MB growth
      expect(result.report.severity).toBe('low');
      
      await forceGarbageCollection(3, 100);
    });

    it('should detect leaks in object accumulation', async () => {
      const leakyFn = () => {
        // Create fewer objects per iteration but still ensure detectable growth
        for (let i = 0; i < 5; i++) { // Reduced number of objects
          const key = `obj_${i}_${Date.now()}_${Math.random()}`;
          testObjects[key] = { data: new Array(250).fill(0) }; // Reduced array size
        }
      };

      const result = await detector.detectLeak('object-accumulation', leakyFn);

      expect(result.leakDetected).toBe(true);
      expect(result.totalGrowth).toBeGreaterThan(0);
      
      // Clean up
      testObjects = {};
      await forceGarbageCollection(3, 100);
    });
  });

  describe('Event Listener Leaks', () => {
    it('should detect event listener leaks', async () => {
      const listeners: Array<() => void> = [];

      const leakyFn = () => {
        // Create fewer listeners per iteration with delay
        for (let i = 0; i < 3; i++) { // Reduced number of listeners
          const listener = () => {};
          listeners.push(listener);
          testEmitter!.on('test', listener);
        }
      };

      const result = await detector.detectLeak('event-listener-leak', leakyFn);

      // Clean up listeners
      listeners.forEach(listener => {
        try {
          testEmitter!.removeListener('test', listener);
        } catch (error) {
          console.warn('Warning: Listener cleanup failed:', error);
        }
      });
      
      cleanupEventEmitter();
      await forceGarbageCollection(3, 100);

      expect(result.leakDetected).toBe(true);
      expect(result.analysis.recommendations.some(rec => rec.includes('event listeners'))).toBe(true);
    });
  });

  describe('Timer Leaks', () => {
    it('should detect timer leaks', async () => {
      const leakyFn = () => {
        // Create fewer timers per iteration with longer intervals
        for (let i = 0; i < 2; i++) { // Reduced number of timers
          const handle = setInterval(() => {}, 2000); // Increased interval
          timerHandles.push(handle);
        }
      };

      const result = await detector.detectLeak('timer-leak', leakyFn);

      cleanupTimers();
      await forceGarbageCollection(3, 100);

      expect(result.leakDetected).toBe(true);
      expect(result.analysis.recommendations.some(rec => rec.includes('timers'))).toBe(true);
    });
  });
});
