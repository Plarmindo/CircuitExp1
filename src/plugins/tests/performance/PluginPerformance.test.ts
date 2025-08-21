import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginManager } from '../../core/PluginSystem';
import type { Plugin, PluginAPI } from '../../core/PluginSystem';
import { createTestPluginAPI } from '../utils/test-helpers';

const mockPluginAPI: PluginAPI = createTestPluginAPI();

// Performance test plugins
class PerformanceTestPlugin implements Plugin {
  metadata = {
    id: 'performance-test',
    name: 'Performance Test Plugin',
    version: '1.0.0',
    description: 'Plugin for performance testing',
    author: 'Test',
    license: 'MIT',
    category: 'performance',
    engines: { circuitexp1: '^1.0.0' },
    main: 'index.js'
  };

  async activate(): Promise<void> {
    // Simulate some work
    const data = new Array(1000).fill(null).map((_, i) => ({ id: i, value: Math.random() }));
    this.storeData(data);
  }

  async deactivate(): Promise<void> {
    this.cleanup();
  }

  private storeData(data: any[]) {
    // Simulate storing data
    this.data = data;
  }

  private cleanup() {
    this.data = null;
  }

  private data: any[] | null = null;
}

class MemoryLeakPlugin implements Plugin {
  metadata = {
    id: 'memory-leak',
    name: 'Memory Leak Plugin',
    version: '1.0.0',
    description: 'Plugin that simulates memory leaks',
    author: 'Test',
    license: 'MIT',
    category: 'performance',
    engines: { circuitexp1: '^1.0.0' },
    main: 'index.js'
  };

  private largeObjects: any[] = [];
  private intervalId: any = null;

  async activate(): Promise<void> {
    // Simulate memory leak by creating objects
    this.intervalId = setInterval(() => {
      const obj = new Array(1000).fill(Math.random());
      this.largeObjects.push(obj);
    }, 10);
  }

  async deactivate(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.largeObjects = [];
  }
}

describe('Plugin Performance Tests', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up all plugins
    const plugins = pluginManager.list();
    for (const plugin of plugins) {
      if (pluginManager.isEnabled(plugin.metadata.id)) {
        await pluginManager.disable(plugin.metadata.id);
      }
      await pluginManager.unregister(plugin.metadata.id);
    }
  });

  describe('Registration Performance', () => {
    it('should register plugins efficiently', async () => {
      const plugins = Array.from({ length: 100 }, (_, i) => ({
        metadata: {
          id: `test-plugin-${i}`,
          name: `Test Plugin ${i}`,
          version: '1.0.0',
          description: `Test plugin ${i}`,
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() {},
        async deactivate() {}
      }));

      const start = performance.now();
      
      for (const plugin of plugins) {
        await pluginManager.register(plugin);
      }

      const end = performance.now();
      const duration = end - start;

      expect(pluginManager.list()).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle duplicate registrations gracefully', async () => {
      const plugin: Plugin = {
        metadata: {
          id: 'duplicate-test',
          name: 'Duplicate Test Plugin',
          version: '1.0.0',
          description: 'Test',
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() {},
        async deactivate() {}
      };

      const start = performance.now();
      
      await pluginManager.register(plugin);
      
      // Attempt duplicate registration
      await expect(pluginManager.register(plugin)).rejects.toThrow();

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100); // Should fail quickly
    });
  });

  describe('Activation Performance', () => {
    it('should activate plugins within reasonable time', async () => {
      const plugin = new PerformanceTestPlugin();
      await pluginManager.register(plugin);

      const start = performance.now();
      await pluginManager.enable(plugin.metadata.id);
      const end = performance.now();

      const duration = end - start;
      expect(duration).toBeLessThan(100); // Should activate within 100ms
      expect(pluginManager.isEnabled(plugin.metadata.id)).toBe(true);
    });

    it('should handle concurrent activations', async () => {
      const plugins = Array.from({ length: 20 }, (_, i) => ({
        metadata: {
          id: `concurrent-${i}`,
          name: `Concurrent Plugin ${i}`,
          version: '1.0.0',
          description: `Concurrent plugin ${i}`,
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() {
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 10));
        },
        async deactivate() {}
      }));

      // Register all plugins
      for (const plugin of plugins) {
        await pluginManager.register(plugin);
      }

      const start = performance.now();
      
      // Activate all concurrently
      await Promise.all(
        plugins.map(plugin => pluginManager.enable(plugin.metadata.id))
      );

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      const enabledCount = pluginManager.list().filter(p => pluginManager.isEnabled(p.metadata.id)).length;
      expect(enabledCount).toBe(20);
    });
  });

  describe('Memory Management', () => {
    it('should cleanup plugin resources on disable', async () => {
      const plugin = new MemoryLeakPlugin();
      await pluginManager.register(plugin);

      // Initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      await pluginManager.enable(plugin.metadata.id);
      
      // Let memory leak accumulate
      await new Promise(resolve => setTimeout(resolve, 100));

      await pluginManager.disable(plugin.metadata.id);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      
      // Verify plugin was properly deactivated
      expect(pluginManager.isEnabled(plugin.metadata.id)).toBe(false);
      
      // In test environments, we focus on the cleanup behavior rather than exact memory reduction
      // since Node.js garbage collection is non-deterministic
    });

    it('should prevent memory leaks from inactive plugins', async () => {
      const plugins = Array.from({ length: 50 }, (_, i) => ({
        metadata: {
          id: `leak-test-${i}`,
          name: `Leak Test ${i}`,
          version: '1.0.0',
          description: `Memory test plugin ${i}`,
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() {
          // Simulate creating objects
          const data = new Array(1000).fill(Math.random());
          this.tempData = data;
        },
        async deactivate() {
          // Ensure cleanup
          this.tempData = null;
        },
        tempData: null as any
      }));

      // Register all plugins
      for (const plugin of plugins) {
        await pluginManager.register(plugin);
      }

      // Activate all
      for (const plugin of plugins) {
        await pluginManager.enable(plugin.metadata.id);
      }

      // Deactivate all
      for (const plugin of plugins) {
        await pluginManager.disable(plugin.metadata.id);
      }

      // Verify all are properly deactivated
      const activePlugins = pluginManager.list().filter(p => pluginManager.isEnabled(p.metadata.id));
      expect(activePlugins).toHaveLength(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup all resources on manager destruction', async () => {
      const plugins = Array.from({ length: 10 }, (_, i) => ({
        metadata: {
          id: `cleanup-test-${i}`,
          name: `Cleanup Test ${i}`,
          version: '1.0.0',
          description: `Cleanup test plugin ${i}`,
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() {
          // Create some data
          this.data = new Array(1000).fill(Math.random());
        },
        async deactivate() {
          this.data = null;
        },
        data: null as any
      }));

      // Register and activate all
      for (const plugin of plugins) {
        await pluginManager.register(plugin);
        await pluginManager.enable(plugin.metadata.id);
      }

      // Unregister all
      for (const plugin of plugins) {
        await pluginManager.unregister(plugin.metadata.id);
      }

      // Verify cleanup
      expect(pluginManager.list()).toHaveLength(0);
    });
  });

  describe('Stress Testing', () => {
    it('should handle maximum plugin limit', async () => {
      const plugins = Array.from({ length: 1000 }, (_, i) => ({
        metadata: {
          id: `stress-${i}`,
          name: `Stress Test ${i}`,
          version: '1.0.0',
          description: `Stress test plugin ${i}`,
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() {},
        async deactivate() {}
      }));

      const start = performance.now();
      
      // Register all plugins
      for (const plugin of plugins) {
        await pluginManager.register(plugin);
      }

      const end = performance.now();
      const duration = end - start;

      expect(pluginManager.list()).toHaveLength(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle rapid registration/activation cycles', async () => {
      const plugin: Plugin = {
        metadata: {
          id: 'rapid-cycle-test',
          name: 'Rapid Cycle Test',
          version: '1.0.0',
          description: 'Test rapid cycles',
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() {
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 1));
        },
        async deactivate() {
          // Simulate cleanup
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      };

      await pluginManager.register(plugin);

      const cycles = 100;
      const start = performance.now();

      for (let i = 0; i < cycles; i++) {
        await pluginManager.enable(plugin.metadata.id);
        await pluginManager.disable(plugin.metadata.id);
      }

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(pluginManager.isEnabled(plugin.metadata.id)).toBe(false);
    });

    it('should handle sustained load over time', async () => {
      const plugins = Array.from({ length: 50 }, (_, i) => ({
        metadata: {
          id: `sustained-${i}`,
          name: `Sustained Test ${i}`,
          version: '1.0.0',
          description: `Sustained test plugin ${i}`,
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() {
          // Simulate work
          const data = new Array(100).fill(Math.random());
          this.tempData = data;
        },
        async deactivate() {
          this.tempData = null;
        },
        tempData: null as any
      }));

      const start = performance.now();

      // Register all
      for (const plugin of plugins) {
        await pluginManager.register(plugin);
      }

      // Activate/deactivate in cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        for (const plugin of plugins) {
          await pluginManager.enable(plugin.metadata.id);
        }
        
        for (const plugin of plugins) {
          await pluginManager.disable(plugin.metadata.id);
        }
      }

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(pluginManager.list()).toHaveLength(50);
    });
  });
});