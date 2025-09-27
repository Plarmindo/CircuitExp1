import { MemoryLeakDetector } from '../../src/performance/memory-leak-detector';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';

describe('MemoryLeakDetector', () => {
  let detector: MemoryLeakDetector;
  const testDir = join(process.cwd(), 'memory-leaks');

  beforeEach(async () => {
    detector = new MemoryLeakDetector({
      threshold: 1, // Lower threshold for testing
      iterations: 10,
      warmupIterations: 1,
      snapshotInterval: 2,
    });
    
    // Clear any global variables that might interfere
    if (typeof global !== 'undefined') {
      delete (global as any).testData;
      delete (global as any).testObjects;
    }
    
    // Force multiple garbage collection cycles if available
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    // Add longer delay to ensure memory stabilizes
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const files = require('fs').readdirSync(testDir);
      files.forEach((file: string) => {
        if (file.startsWith('memory-leak-') && file.includes('test-')) {
          unlinkSync(join(testDir, file));
        }
      });
    } catch (e) {
      // Directory might not exist
    }
    
    // Clear any global variables that might interfere
    if (typeof global !== 'undefined') {
      delete (global as any).testData;
      delete (global as any).testObjects;
    }
    
    // Force multiple garbage collection cycles if available
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    // Add longer delay to ensure memory stabilizes
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  describe('Basic Leak Detection', () => {
    it('should detect memory leaks in array accumulation', async () => {
      let data: number[] = [];
      const leakyFn = () => {
        data.push(...Array.from({ length: 1000 }, (_, i) => i));
      };

      const result = await detector.detectLeak('array-accumulation', leakyFn);

      expect(result.leakDetected).toBe(true);
      expect(result.totalGrowth).toBeGreaterThan(0);
      expect(result.leakRate).toBeGreaterThan(0);
      expect(result.snapshots).toHaveLength(6); // initial + 5 snapshots (10/2 + final)
      
      // Clean up
      data = [];
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
    });

    it('should detect leaks in object accumulation', async () => {
      let objects: Record<string, any> = {};
      const leakyFn = () => {
        // Increase deterministic growth per iteration to ensure robust detection even under baseline noise
        for (let i = 0; i < 20; i++) {
          const key = `obj_${i}_${Date.now()}_${Math.random()}`;
          objects[key] = { data: new Array(500).fill(0) };
        }
      };

      const result = await detector.detectLeak('object-accumulation', leakyFn);

      expect(result.leakDetected).toBe(true);
      expect(result.totalGrowth).toBeGreaterThan(0);
      
      // Clean up
      objects = {};
    });
  });

  describe('Event Listener Leaks', () => {
    it('should detect event listener leaks', async () => {
      // Create a global emitter that can be tracked
      (global as any).testEmitter = new EventEmitter();
      const emitter = (global as any).testEmitter;

      const leakyFn = () => {
        for (let i = 0; i < 10; i++) {
          emitter.on('test', () => {});
        }
      };

      const result = await detector.detectLeak('event-listener-leak', leakyFn);

      // Clean up
      delete (global as any).testEmitter;

      console.log('=== TEST DEBUG ===');
      console.log('Leak detected:', result.leakDetected);
      console.log('Recommendations:', JSON.stringify(result.analysis.recommendations, null, 2));
      console.log('Looking for "event listeners"');
      result.analysis.recommendations.forEach((rec, index) => {
        console.log(`[${index}]: "${rec}" - contains "event listeners": ${rec.includes('event listeners')}`);
      });
      console.log('==================');

      expect(result.leakDetected).toBe(true);

      // Check if any recommendation contains "event listeners"
      const hasEventListenerRecommendation = result.analysis.recommendations.some(rec =>
        rec.includes('event listeners')
      );
      expect(hasEventListenerRecommendation).toBe(true);
    });
  });

  describe('Timer Leaks', () => {
    it('should detect timer leaks', async () => {
      const leakyFn = () => {
        for (let i = 0; i < 5; i++) {
          setInterval(() => {}, 1000);
        }
      };

      const result = await detector.detectLeak('timer-leak', leakyFn);

      expect(result.leakDetected).toBe(true);

      // Check if any recommendation contains "timers"
      const hasTimerRecommendation = result.analysis.recommendations.some(rec =>
        rec.includes('timers')
      );
      expect(hasTimerRecommendation).toBe(true);
    });
  });
});
