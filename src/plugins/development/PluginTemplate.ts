/**
 * CircuitExp1 Plugin Development Template
 * 
 * This file serves as a template and guide for creating new plugins.
 * Copy this file and customize it according to your plugin's needs.
 */

import { Plugin, PluginAPI, PluginMetadata } from '../core/PluginSystem';

/**
 * Plugin metadata - This is required for every plugin
 */
const pluginMetadata: PluginMetadata = {
  id: 'my-plugin-id', // Unique identifier for your plugin
  name: 'My Plugin Name',
  version: '1.0.0',
  description: 'A brief description of what your plugin does',
  author: 'Your Name',
  homepage: 'https://github.com/yourusername/my-plugin',
  repository: 'https://github.com/yourusername/my-plugin',
  license: 'MIT',
  keywords: ['example', 'demo', 'plugin'],
  engines: {
    circuitexp1: '>=0.0.0',
  },
  main: './dist/index.js',
  types: './dist/index.d.ts',
  dependencies: {},
  peerDependencies: {},
};

/**
 * Main plugin class
 * This is where your plugin's core functionality lives
 */
export class MyPlugin implements Plugin {
  metadata = pluginMetadata;
  private api: PluginAPI | null = null;
  private isActive = false;

  /**
   * Called when the plugin is activated
   * Use this to initialize your plugin, set up event listeners, etc.
   */
  async activate(api: PluginAPI): Promise<void> {
    this.api = api;
    this.isActive = true;

    // Log activation
    api.log('info', `${this.metadata.name} v${this.metadata.version} activated`);

    // Register event listeners
    api.on('config:changed', this.handleConfigChange.bind(this));
    api.on('theme:changed', this.handleThemeChange.bind(this));

    // Register UI components
    // api.registerComponent('toolbar', MyToolbarComponent);
    // api.registerComponent('sidebar', MySidebarComponent);

    // Initialize plugin functionality
    await this.initialize();
  }

  /**
   * Called when the plugin is deactivated
   * Use this to clean up resources, remove event listeners, etc.
   */
  async deactivate(): Promise<void> {
    if (!this.isActive || !this.api) return;

    this.api.log('info', `${this.metadata.name} deactivated`);

    // Clean up
    // this.api.unregisterComponent('toolbar', 'my-toolbar');
    // this.api.unregisterComponent('sidebar', 'my-sidebar');

    this.api = null;
    this.isActive = false;
  }

  /**
   * Optional: Handle configuration changes
   */
  onConfigChange(newConfig: Record<string, any>): void {
    this.api?.log('debug', 'Configuration changed', newConfig);
    // React to configuration changes
  }

  /**
   * Optional: Handle theme changes
   */
  onThemeChange(theme: string): void {
    this.api?.log('debug', `Theme changed to: ${theme}`);
    // Update UI for new theme
  }

  /**
   * Initialize plugin functionality
   * This is where you set up your plugin's main features
   */
  private async initialize(): Promise<void> {
    // Example: Load plugin configuration
    const config = await this.api!.getData('config');
    if (config) {
      this.api!.log('debug', 'Loaded configuration', config);
    }

    // Example: Register custom functionality
    // await this.registerCustomFeatures();
  }

  /**
   * Example: Custom plugin functionality
   */
  private async registerCustomFeatures(): Promise<void> {
    // Your plugin's custom functionality goes here
    // For example:
    // - Custom file parsers
    // - Additional visualization modes
    // - Export formats
    // - Analysis tools
  }
}

// Export the plugin for registration
export default MyPlugin;

/**
 * Plugin Development Guidelines
 * 
 * 1. Plugin Structure:
 *    - Always export a class that implements the Plugin interface
 *    - Include comprehensive metadata in PluginMetadata
 *    - Use semantic versioning (MAJOR.MINOR.PATCH)
 * 
 * 2. Naming Conventions:
 *    - Plugin IDs: kebab-case (e.g., 'file-analyzer', 'theme-customizer')
 *    - Class names: PascalCase (e.g., 'FileAnalyzerPlugin')
 *    - File names: kebab-case (e.g., 'file-analyzer.ts')
 * 
 * 3. Error Handling:
 *    - Always handle errors gracefully
 *    - Use the provided logging API
 *    - Don't throw uncaught exceptions
 * 
 * 4. Security:
 *    - Never expose sensitive data
 *    - Validate all inputs
 *    - Use sandboxed file system access
 *    - Respect security policies
 * 
 * 5. Performance:
 *    - Use async operations for heavy tasks
 *    - Clean up resources on deactivation
 *    - Avoid memory leaks
 * 
 * 6. Testing:
 *    - Write unit tests for your plugin
 *    - Test activation/deactivation cycles
 *    - Test with different configurations
 * 
 * 7. Documentation:
 *    - Include README.md with installation instructions
 *    - Document all configuration options
 *    - Provide usage examples
 * 
 * 8. Distribution:
 *    - Package as npm module
 *    - Include TypeScript definitions
 *    - Provide both source and compiled versions
 */

/**
 * Quick Start Example:
 * 
 * 1. Create a new directory for your plugin:
 *    mkdir src/plugins/my-awesome-plugin
 * 
 * 2. Copy this template:
 *    cp src/plugins/development/PluginTemplate.ts src/plugins/my-awesome-plugin/index.ts
 * 
 * 3. Customize the metadata and implementation
 * 
 * 4. Build your plugin:
 *    npm run build:plugin --plugin=my-awesome-plugin
 * 
 * 5. Test your plugin:
 *    npm run test:plugin --plugin=my-awesome-plugin
 * 
 * 6. Package for distribution:
 *    npm run package:plugin --plugin=my-awesome-plugin
 */