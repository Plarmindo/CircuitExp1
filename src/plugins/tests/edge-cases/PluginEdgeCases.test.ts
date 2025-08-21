import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginManager } from '../../core/PluginSystem';
import type { Plugin, PluginAPI } from '../../core/PluginSystem';
import { createTestPluginAPI } from '../utils/test-helpers';

const mockPluginAPI: PluginAPI = createTestPluginAPI();

// Helper function to create test plugins
function createTestPlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    metadata: {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test plugin for edge cases',
      author: 'Test',
      license: 'MIT',
      category: 'test',
      engines: { circuitexp1: '^1.0.0' },
      main: 'index.js',
      ...overrides.metadata
    },
    async activate() {
      // Default implementation
    },
    async deactivate() {
      // Default implementation
    },
    ...overrides
  };
}

describe('Plugin Edge Cases Tests', () => {
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

  describe('Malformed Data Handling', () => {
    it('should handle plugins with missing required fields', async () => {
      const plugin: Plugin = {
        metadata: {
          id: 'incomplete-plugin',
          name: 'Incomplete Plugin',
          version: '1.0.0',
          description: 'Missing required fields',
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() { /* missing implementation */ },
        async deactivate() { /* missing implementation */ }
      };

      // Should still register successfully
      await pluginManager.register(plugin);
      expect(pluginManager.list()).toHaveLength(1);
    });

    it('should handle plugins with extremely long strings', async () => {
      const longString = 'a'.repeat(10000);
      const plugin = createTestPlugin({
        metadata: {
          id: 'long-string-plugin',
          name: longString,
          description: longString,
          author: longString,
          version: '1.0.0',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        }
      });

      await pluginManager.register(plugin);
      expect(pluginManager.list()).toHaveLength(1);
    });

    it('should handle plugins with special characters in metadata', async () => {
      const plugin = createTestPlugin({
        metadata: {
          id: 'special-chars-plugin',
          name: 'Plugin with "quotes" and <tags> & symbols',
          description: 'Plugin with \\backslashes\\ and \n newlines',
          author: 'Author with émojis 🎉',
          version: '1.0.0',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        }
      });

      await pluginManager.register(plugin);
      expect(pluginManager.list()).toHaveLength(1);
    });

    it('should handle empty plugin objects', async () => {
      const plugin: Plugin = {
        metadata: {
          id: 'empty-plugin',
          name: 'Empty Plugin',
          version: '1.0.0',
          description: '',
          author: '',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        },
        async activate() {},
        async deactivate() {}
      };

      await pluginManager.register(plugin);
      expect(pluginManager.list()).toHaveLength(1);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle plugins attempting XSS in metadata', async () => {
      const maliciousPlugin = createTestPlugin({
        metadata: {
          id: 'xss-plugin',
          name: '<script>alert("XSS")</script>',
          description: 'Malicious <img src=x onerror=alert(1)>',
          author: 'Hacker <script>alert("XSS")</script>',
          version: '1.0.0',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        }
      });

      await pluginManager.register(maliciousPlugin);
      expect(pluginManager.list()).toHaveLength(1);
    });

    it('should handle plugins attempting file system access', async () => {
      const fsPlugin = createTestPlugin({
        async activate() {
          // Attempt to access file system
          try {
            // This should be blocked by security policy
            const fs = require('fs');
            fs.readFileSync('/etc/passwd');
          } catch (error) {
            // Expected to fail
          }
        },
        async deactivate() {}
      });

      await pluginManager.register(fsPlugin);
      await expect(pluginManager.enable('test-plugin')).rejects.toThrow();
    });

    it('should handle plugins attempting network access', async () => {
      const networkPlugin = createTestPlugin({
        async activate() {
          // Attempt to make network requests
          try {
            await fetch('http://malicious-server.com');
          } catch (error) {
            // Expected to fail
          }
        },
        async deactivate() {}
      });

      await pluginManager.register(networkPlugin);
      await expect(pluginManager.enable('test-plugin')).rejects.toThrow();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle memory bomb plugins gracefully', async () => {
      const memoryBombPlugin = createTestPlugin({
        async activate() {
          // Attempt to consume excessive memory
          const largeArray = new Array(10000000).fill(0);
          throw new Error('Memory limit exceeded');
        },
        async deactivate() {}
      });

      await pluginManager.register(memoryBombPlugin);
      await expect(pluginManager.enable('test-plugin')).rejects.toThrow();
    });

    it('should handle infinite loops in activation', async () => {
      const infiniteLoopPlugin = createTestPlugin({
        async activate() {
          // Simulate infinite loop with timeout
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Activation timeout')), 5000);
          });
        },
        async deactivate() {}
      });

      await pluginManager.register(infiniteLoopPlugin);
      await expect(pluginManager.enable('test-plugin')).rejects.toThrow();
    });

    it('should handle plugins with extremely large data structures', async () => {
      const largeDataPlugin = createTestPlugin({
        async activate(api: PluginAPI) {
          // Create large data structure
          const largeData = {
            nodes: new Array(10000).fill(null).map((_, i) => ({
              id: i,
              name: `Node ${i}`,
              properties: { x: Math.random(), y: Math.random() }
            })),
            edges: new Array(50000).fill(null).map((_, i) => ({
              from: Math.floor(Math.random() * 10000),
              to: Math.floor(Math.random() * 10000),
              weight: Math.random()
            }))
          };
          
          api.setData('large-graph', largeData);
        },
        async deactivate() {}
      });

      await pluginManager.register(largeDataPlugin);
      await pluginManager.enable('test-plugin');
      expect(pluginManager.isEnabled('test-plugin')).toBe(true);
    });

    it('should handle rapid activation/deactivation cycles', async () => {
      const plugin = createTestPlugin();
      await pluginManager.register(plugin);

      // Perform rapid cycles
      for (let i = 0; i < 100; i++) {
        await pluginManager.enable('test-plugin');
        await pluginManager.disable('test-plugin');
      }

      expect(pluginManager.isEnabled('test-plugin')).toBe(false);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle async errors in activation', async () => {
      const asyncErrorPlugin = createTestPlugin({
        async activate() {
          await new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Async activation error')), 10);
          });
        },
        async deactivate() {}
      });

      await pluginManager.register(asyncErrorPlugin);
      await expect(pluginManager.enable('test-plugin')).rejects.toThrow('Async activation error');
    });

    it('should handle errors in deactivation', async () => {
      const deactivationErrorPlugin = createTestPlugin({
        async activate() {
          // Success
        },
        async deactivate() {
          throw new Error('Deactivation error');
        }
      });

      await pluginManager.register(deactivationErrorPlugin);
      await pluginManager.enable('test-plugin');
      await expect(pluginManager.disable('test-plugin')).rejects.toThrow('Deactivation error');
    });

    it('should handle circular dependencies', async () => {
      const plugin1 = createTestPlugin({
        metadata: { id: 'plugin-1', name: 'Plugin 1', version: '1.0.0', description: '', author: 'Test', license: 'MIT', category: 'test', engines: { circuitexp1: '^1.0.0' }, main: 'index.js' },
        async activate() {
          // Try to activate plugin 2
          await pluginManager.enable('plugin-2');
        },
        async deactivate() {}
      });

      const plugin2 = createTestPlugin({
        metadata: { id: 'plugin-2', name: 'Plugin 2', version: '1.0.0', description: '', author: 'Test', license: 'MIT', category: 'test', engines: { circuitexp1: '^1.0.0' }, main: 'index.js' },
        async activate() {
          // Try to activate plugin 1
          await pluginManager.enable('plugin-1');
        },
        async deactivate() {}
      });

      await pluginManager.register(plugin1);
      await pluginManager.register(plugin2);
      
      // Should handle circular dependency gracefully
      await expect(pluginManager.enable('plugin-1')).rejects.toThrow();
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle maximum ID length', async () => {
      const maxId = 'a'.repeat(255);
      const plugin = createTestPlugin({
        metadata: {
          id: maxId,
          name: 'Max ID Plugin',
          version: '1.0.0',
          description: '',
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        }
      });

      await pluginManager.register(plugin);
      expect(pluginManager.list()).toHaveLength(1);
    });

    it('should handle version format edge cases', async () => {
      const versions = [
        '1.0.0-alpha',
        '1.0.0-beta.1',
        '1.0.0+build.123',
        '1.0.0-alpha.1+build.456',
        '0.0.1',
        '999.999.999'
      ];

      for (const version of versions) {
        const plugin = createTestPlugin({
          metadata: {
            id: `version-${version.replace(/[^a-z0-9]/g, '-')}`,
            name: 'Version Test Plugin',
            version,
            description: '',
            author: 'Test',
            license: 'MIT',
            category: 'test',
            engines: { circuitexp1: '^1.0.0' },
            main: 'index.js'
          }
        });

        await pluginManager.register(plugin);
      }

      expect(pluginManager.list()).toHaveLength(versions.length);
    });

    it('should handle empty arrays and objects', async () => {
      const plugin = createTestPlugin({
        metadata: {
          id: 'empty-arrays-plugin',
          name: 'Empty Arrays Plugin',
          version: '1.0.0',
          description: '',
          author: 'Test',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js',
          tags: [],
          dependencies: {}
        }
      });

      await pluginManager.register(plugin);
      expect(pluginManager.list()).toHaveLength(1);
    });

    it('should handle Unicode characters', async () => {
      const plugin = createTestPlugin({
        metadata: {
          id: 'unicode-plugin',
          name: '插件测试 テスト тест',
          description: '🚀 Testing with Unicode: émojis, 中文, 日本語, русский',
          author: '测试作者 テスト作者 тестовый автор',
          version: '1.0.0',
          license: 'MIT',
          category: 'test',
          engines: { circuitexp1: '^1.0.0' },
          main: 'index.js'
        }
      });

      await pluginManager.register(plugin);
      expect(pluginManager.list()).toHaveLength(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent plugin registration', async () => {
      const plugins = Array.from({ length: 50 }, (_, i) => 
        createTestPlugin({
          metadata: {
            id: `concurrent-plugin-${i}`,
            name: `Concurrent Plugin ${i}`,
            version: '1.0.0',
            description: '',
            author: 'Test',
            license: 'MIT',
            category: 'test',
            engines: { circuitexp1: '^1.0.0' },
            main: 'index.js'
          }
        })
      );

      await Promise.all(plugins.map(plugin => pluginManager.register(plugin)));
      expect(pluginManager.list()).toHaveLength(50);
    });

    it('should handle concurrent activation/deactivation', async () => {
      const plugins = Array.from({ length: 10 }, (_, i) => 
        createTestPlugin({
          metadata: {
            id: `concurrent-activation-${i}`,
            name: `Concurrent Activation ${i}`,
            version: '1.0.0',
            description: '',
            author: 'Test',
            license: 'MIT',
            category: 'test',
            engines: { circuitexp1: '^1.0.0' },
            main: 'index.js'
          }
        })
      );

      await Promise.all(plugins.map(plugin => pluginManager.register(plugin)));

      // Concurrent activation
      await Promise.all(
        plugins.map(plugin => pluginManager.enable(plugin.metadata.id))
      );

      expect(pluginManager.list().filter(p => pluginManager.isEnabled(p.metadata.id))).toHaveLength(10);

      // Concurrent deactivation
      await Promise.all(
        plugins.map(plugin => pluginManager.disable(plugin.metadata.id))
      );

      expect(pluginManager.list().filter(p => pluginManager.isEnabled(p.metadata.id))).toHaveLength(0);
    });
  });
});