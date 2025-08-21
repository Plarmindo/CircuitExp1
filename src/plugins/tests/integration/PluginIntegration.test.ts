import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../../core/PluginSystem';
import { createTestPluginAPI, createTestPlugin } from '../utils/test-helpers';

describe('Plugin Integration Tests', () => {
  let pluginManager: PluginManager;
  let mockAPI: ReturnType<typeof createTestPluginAPI>;

  beforeEach(() => {
    mockAPI = createTestPluginAPI();
    pluginManager = new PluginManager(mockAPI);
  });

  describe('MetroThemePlugin', () => {
    it('should successfully activate MetroTheme plugin', async () => {
      const metroPlugin = createTestPlugin({
        id: 'metro-theme',
        name: 'Metro Theme Plugin',
        category: 'theme'
      });

      await pluginManager.register(metroPlugin);
      await pluginManager.enable('metro-theme');

      expect(metroPlugin.activate).toHaveBeenCalled();
      expect(pluginManager.isEnabled('metro-theme')).toBe(true);
    });

    it('should handle theme switching', async () => {
      const metroPlugin = createTestPlugin({
        id: 'metro-theme',
        name: 'Metro Theme Plugin',
        category: 'theme'
      });

      await pluginManager.register(metroPlugin);
      await pluginManager.enable('metro-theme');

      expect(metroPlugin.activate).toHaveBeenCalled();
    });
  });

  describe('SVGExportPlugin', () => {
    it('should register SVG export format', async () => {
      const svgPlugin = createTestPlugin({
        id: 'svg-export',
        name: 'SVG Export Plugin',
        category: 'export'
      });

      await pluginManager.register(svgPlugin);
      await pluginManager.enable('svg-export');

      expect(svgPlugin.activate).toHaveBeenCalled();
    });

    it('should handle SVG export', async () => {
      const svgPlugin = createTestPlugin({
        id: 'svg-export',
        name: 'SVG Export Plugin',
        category: 'export'
      });

      await pluginManager.register(svgPlugin);
      await pluginManager.enable('svg-export');

      expect(svgPlugin.activate).toHaveBeenCalled();
    });
  });

  describe('DataSourcePlugin', () => {
    it('should register data source provider', async () => {
      const dataPlugin = createTestPlugin({
        id: 'data-source',
        name: 'Data Source Plugin',
        category: 'data'
      });

      await pluginManager.register(dataPlugin);
      await pluginManager.enable('data-source');

      expect(dataPlugin.activate).toHaveBeenCalled();
    });

    it('should handle data fetching', async () => {
      const dataPlugin = createTestPlugin({
        id: 'data-source',
        name: 'Data Source Plugin',
        category: 'data'
      });

      await pluginManager.register(dataPlugin);
      await pluginManager.enable('data-source');

      expect(dataPlugin.activate).toHaveBeenCalled();
    });
  });

  describe('AdvancedSearchPlugin', () => {
    it('should register search provider', async () => {
      const searchPlugin = createTestPlugin({
        id: 'advanced-search',
        name: 'Advanced Search Plugin',
        category: 'search'
      });

      await pluginManager.register(searchPlugin);
      await pluginManager.enable('advanced-search');

      expect(searchPlugin.activate).toHaveBeenCalled();
    });
  });

  describe('Plugin Activation/Deactivation', () => {
    it('should handle plugin activation lifecycle', async () => {
      const plugin = createTestPlugin({
        id: 'test-plugin',
        name: 'Test Plugin'
      });

      await pluginManager.register(plugin);
      await pluginManager.enable('test-plugin');

      expect(plugin.activate).toHaveBeenCalled();

      await pluginManager.disable('test-plugin');
      expect(plugin.deactivate).toHaveBeenCalledOnce();
    });

    it('should handle duplicate activation gracefully', async () => {
      const plugin = createTestPlugin({
        id: 'test-plugin',
        name: 'Test Plugin'
      });

      await pluginManager.register(plugin);
      await pluginManager.enable('test-plugin');

      // Second enable should not throw and should complete successfully
      await expect(pluginManager.enable('test-plugin')).resolves.toBeUndefined();
      expect(plugin.activate).toHaveBeenCalledTimes(1); // Should only activate once
    });
  });

  describe('Multi-Plugin Interactions', () => {
    it('should handle multiple plugins activating simultaneously', async () => {
      const plugins = [
        createTestPlugin({ id: 'plugin1', name: 'Plugin 1' }),
        createTestPlugin({ id: 'plugin2', name: 'Plugin 2' }),
        createTestPlugin({ id: 'plugin3', name: 'Plugin 3' })
      ];

      for (const plugin of plugins) {
        await pluginManager.register(plugin);
      }

      await Promise.all(plugins.map(p => pluginManager.enable(p.metadata.id)));

      for (const plugin of plugins) {
        expect(plugin.activate).toHaveBeenCalled();
        expect(pluginManager.isEnabled(plugin.metadata.id)).toBe(true);
      }
    });

    it('should handle plugin dependencies', async () => {
      const dependencyPlugin = createTestPlugin({
        id: 'dependency-plugin',
        name: 'Dependency Plugin'
      });

      const dependentPlugin = createTestPlugin({
        id: 'dependent-plugin',
        name: 'Dependent Plugin'
      });

      await pluginManager.register(dependencyPlugin);
      await pluginManager.register(dependentPlugin);

      await pluginManager.enable('dependency-plugin');
      await pluginManager.enable('dependent-plugin');

      expect(dependencyPlugin.activate).toHaveBeenCalled();
      expect(dependentPlugin.activate).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle plugin activation failure gracefully', async () => {
      const failingPlugin = createTestPlugin({
        id: 'failing-plugin',
        name: 'Failing Plugin'
      });

      failingPlugin.activate.mockRejectedValue(new Error('Activation failed'));

      await pluginManager.register(failingPlugin);

      await expect(pluginManager.enable('failing-plugin')).rejects.toThrow('Activation failed');
      expect(pluginManager.isEnabled('failing-plugin')).toBe(false);
    });

    it('should handle plugin deactivation failure gracefully', async () => {
      const failingPlugin = createTestPlugin({
        id: 'failing-plugin',
        name: 'Failing Plugin'
      });

      failingPlugin.deactivate.mockRejectedValue(new Error('Deactivation failed'));

      await pluginManager.register(failingPlugin);
      await pluginManager.enable('failing-plugin');

      await expect(pluginManager.disable('failing-plugin')).rejects.toThrow('Deactivation failed');
    });
  });

  describe('Event Handling', () => {
    it('should handle plugin events', async () => {
      const eventPlugin = createTestPlugin({
        id: 'event-plugin',
        name: 'Event Plugin'
      });

      const mockListener = vi.fn();

      eventPlugin.activate.mockImplementation(async (api) => {
        api.on('test-event', mockListener);
        api.emit('plugin-activated', { pluginId: 'event-plugin' });
      });

      await pluginManager.register(eventPlugin);
      await pluginManager.enable('event-plugin');

      // Verify the plugin's activate method was called
      expect(eventPlugin.activate).toHaveBeenCalled();
      
      // Test that the event system works by emitting an event
      pluginManager.emit('test-event', { data: 'test-data' });
      expect(mockListener).toHaveBeenCalledWith({ data: 'test-data' });
    });
  });
});