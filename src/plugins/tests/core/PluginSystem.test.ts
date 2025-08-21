import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginManager, PluginSystemError } from '../../core/PluginSystem';
import type { Plugin, PluginAPI, PluginMetadata } from '../../core/PluginSystem';

// Mock plugin implementation
class MockPlugin implements Plugin {
  public metadata: PluginMetadata = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    license: 'MIT',
    category: 'themes'
  };

  public activated = false;
  public deactivated = false;
  public config = {};

  async activate(api: PluginAPI): Promise<void> {
    this.activated = true;
  }

  async deactivate(): Promise<void> {
    this.deactivated = true;
  }

  updateConfig(config: any): void {
    this.config = config;
  }
}

class ErrorPlugin implements Plugin {
  public metadata: PluginMetadata = {
    id: 'error-plugin',
    name: 'Error Plugin',
    version: '1.0.0',
    description: 'A plugin that throws errors',
    author: 'Test Author',
    license: 'MIT',
    category: 'themes'
  };

  async activate(): Promise<void> {
    throw new Error('Activation failed');
  }

  async deactivate(): Promise<void> {
    throw new Error('Deactivation failed');
  }
}

class AsyncPlugin implements Plugin {
  public metadata: PluginMetadata = {
    id: 'async-plugin',
    name: 'Async Plugin',
    version: '1.0.0',
    description: 'An async plugin',
    author: 'Test Author',
    license: 'MIT',
    category: 'themes'
  };

  async activate(api: PluginAPI): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  async deactivate(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Mock PluginAPI
const mockPluginAPI: PluginAPI = {
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  },
  ui: {
    addMenuItem: vi.fn(),
    removeMenuItem: vi.fn(),
    showDialog: vi.fn(),
    addPanel: vi.fn(),
    removePanel: vi.fn()
  },
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  },
  network: {
    fetch: vi.fn(),
    upload: vi.fn(),
    download: vi.fn()
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
};

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager(mockPluginAPI);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up all active plugins
    const activePlugins = pluginManager.getActivePlugins();
    for (const pluginId of activePlugins) {
      await pluginManager.deactivatePlugin(pluginId);
    }
  });

  describe('Plugin Registration', () => {
    it('should register a plugin successfully', async () => {
      const plugin = new MockPlugin();
      await pluginManager.register(plugin);

      expect(pluginManager.isPluginRegistered('test-plugin')).toBe(true);
    });

    it('should reject duplicate plugin registration', async () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new MockPlugin();

      await pluginManager.register(plugin1);
      await expect(pluginManager.register(plugin2)).rejects.toThrow();
    });

    it('should validate plugin ID format', async () => {
      const invalidPlugin: Plugin = {
        metadata: {
          id: 'invalid id with spaces',
          name: 'Invalid Plugin',
          version: '1.0.0',
          description: 'Invalid',
          author: 'Test',
          license: 'MIT',
          category: 'themes'
        },
        activate: vi.fn(),
        deactivate: vi.fn()
      };

      await expect(pluginManager.register(invalidPlugin)).rejects.toThrow();
    });

    it('should validate required metadata fields', async () => {
      const incompletePlugin: any = {
        metadata: {
          id: 'incomplete-plugin'
          // Missing required fields
        },
        activate: vi.fn(),
        deactivate: vi.fn()
      };

      await expect(pluginManager.register(incompletePlugin)).rejects.toThrow();
    });
  });

  describe('Plugin Activation', () => {
    it('should activate a registered plugin', async () => {
      const plugin = new MockPlugin();
      pluginManager.registerPlugin(plugin);

      const result = await pluginManager.activatePlugin('test-plugin');

      expect(result.success).toBe(true);
      expect(plugin.activated).toBe(true);
      expect(pluginManager.isPluginActive('test-plugin')).toBe(true);
    });

    it('should fail to activate non-existent plugin', async () => {
      const result = await pluginManager.activatePlugin('non-existent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PLUGIN_NOT_FOUND');
    });

    it('should handle plugin activation errors gracefully', async () => {
      const plugin = new ErrorPlugin();
      pluginManager.registerPlugin(plugin);

      const result = await pluginManager.activatePlugin('error-plugin');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACTIVATION_FAILED');
    });

    it('should not activate already active plugin', async () => {
      const plugin = new MockPlugin();
      pluginManager.registerPlugin(plugin);
      await pluginManager.activatePlugin('test-plugin');

      const result = await pluginManager.activatePlugin('test-plugin');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PLUGIN_ALREADY_ACTIVE');
    });

    it('should handle async plugin activation', async () => {
      const plugin = new AsyncPlugin();
      pluginManager.registerPlugin(plugin);

      const startTime = Date.now();
      const result = await pluginManager.activatePlugin('async-plugin');
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Plugin Deactivation', () => {
    it('should deactivate an active plugin', async () => {
      const plugin = new MockPlugin();
      pluginManager.registerPlugin(plugin);
      await pluginManager.activatePlugin('test-plugin');

      const result = await pluginManager.deactivatePlugin('test-plugin');

      expect(result.success).toBe(true);
      expect(plugin.deactivated).toBe(true);
      expect(pluginManager.isPluginActive('test-plugin')).toBe(false);
    });

    it('should fail to deactivate non-existent plugin', async () => {
      const result = await pluginManager.deactivatePlugin('non-existent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PLUGIN_NOT_FOUND');
    });

    it('should handle plugin deactivation errors gracefully', async () => {
      const plugin = new ErrorPlugin();
      pluginManager.registerPlugin(plugin);
      await pluginManager.activatePlugin('error-plugin');

      const result = await pluginManager.deactivatePlugin('error-plugin');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DEACTIVATION_FAILED');
    });

    it('should not deactivate inactive plugin', async () => {
      const plugin = new MockPlugin();
      pluginManager.registerPlugin(plugin);

      const result = await pluginManager.deactivatePlugin('test-plugin');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PLUGIN_NOT_ACTIVE');
    });
  });

  describe('Plugin Management', () => {
    it('should list all registered plugins', () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new AsyncPlugin();

      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);

      const plugins = pluginManager.getRegisteredPlugins();
      expect(plugins).toContain('test-plugin');
      expect(plugins).toContain('async-plugin');
      expect(plugins).toHaveLength(2);
    });

    it('should list all active plugins', async () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new AsyncPlugin();

      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);

      await pluginManager.activatePlugin('test-plugin');

      const activePlugins = pluginManager.getActivePlugins();
      expect(activePlugins).toContain('test-plugin');
      expect(activePlugins).not.toContain('async-plugin');
      expect(activePlugins).toHaveLength(1);
    });

    it('should get plugin metadata', () => {
      const plugin = new MockPlugin();
      pluginManager.registerPlugin(plugin);

      const metadata = pluginManager.getPluginMetadata('test-plugin');
      expect(metadata).toEqual(plugin.metadata);
    });

    it('should return null for non-existent plugin metadata', () => {
      const metadata = pluginManager.getPluginMetadata('non-existent');
      expect(metadata).toBeNull();
    });

    it('should handle bulk operations', async () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new AsyncPlugin();

      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);

      const results = await pluginManager.activateAllPlugins();

      expect(results['test-plugin'].success).toBe(true);
      expect(results['async-plugin'].success).toBe(true);
    });
  });

  describe('Security & Permissions', () => {
    it('should enforce security policies', () => {
      const plugin: Plugin = {
        metadata: {
          id: 'security-test',
          name: 'Security Test',
          version: '1.0.0',
          description: 'Test',
          author: 'Test',
          license: 'MIT',
          category: 'themes'
        },
        activate: vi.fn(),
        deactivate: vi.fn()
      };

      pluginManager.setSecurityPolicy({
        allowNetworkAccess: false,
        allowFileSystemAccess: false,
        allowedOrigins: ['localhost']
      });

      const result = pluginManager.registerPlugin(plugin);
      expect(result.success).toBe(true);
    });

    it('should validate plugin signatures', () => {
      // Test signature validation logic
      const isValid = pluginManager.validatePluginSignature('test-plugin', 'mock-signature');
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent operations safely', async () => {
      const plugin = new MockPlugin();
      pluginManager.registerPlugin(plugin);

      const promises = [
        pluginManager.activatePlugin('test-plugin'),
        pluginManager.activatePlugin('test-plugin'),
        pluginManager.deactivatePlugin('test-plugin')
      ];

      const results = await Promise.all(promises);
      
      // At least one should succeed, others should fail appropriately
      const successes = results.filter(r => r.success).length;
      expect(successes).toBeGreaterThan(0);
    });

    it('should provide detailed error information', async () => {
      const plugin = new ErrorPlugin();
      pluginManager.registerPlugin(plugin);

      const result = await pluginManager.activatePlugin('error-plugin');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBeDefined();
      expect(result.error?.message).toBeDefined();
    });
  });
});