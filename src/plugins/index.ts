/**
 * CircuitExp1 Plugin System
 * 
 * This is the main entry point for the plugin system.
 * It exports all core components and provides a clean API
 * for plugin development and management.
 */

// Core plugin system
export * from './core/PluginSystem';

// Import system
export * from './import/ZipPluginImporter';

// Development utilities
export * from './development/PluginTemplate';

// Deployment and validation
export * from './deployment/PluginValidator';
export * from './deployment/deploy';

// Types and interfaces
export type {
  Plugin,
  PluginAPI,
  PluginMetadata,
  PluginRegistry,
  PluginEvents,
  SecurityPolicy,
  PluginValidationResult,
  DeploymentConfig,
  DeploymentResult
} from './core/PluginSystem';

export type {
  ZipPluginBundle,
  ImportResult,
  RollbackInfo
} from './import/ZipPluginImporter';

// Constants
export const PLUGIN_CATEGORIES = [
  'themes',
  'export', 
  'interaction',
  'analysis',
  'integration'
] as const;

export const PLUGIN_VERSION = '1.0.0';
export const PLUGIN_API_VERSION = '1.0.0';

// Utility functions
export function isPlugin(obj: any): obj is import('./core/PluginSystem').Plugin {
  return obj && 
         typeof obj.activate === 'function' && 
         typeof obj.deactivate === 'function' &&
         obj.metadata &&
         typeof obj.metadata.id === 'string';
}

export function validatePluginId(id: string): boolean {
  return /^[a-z0-9-]+$/.test(id) && id.length >= 3 && id.length <= 50;
}

export function getPluginCategoryName(categoryId: string): string {
  const categoryMap: Record<string, string> = {
    themes: 'Themes & Styling',
    export: 'Export & Sharing',
    interaction: 'Interaction & Navigation',
    analysis: 'Analysis & Insights',
    integration: 'Integrations'
  };
  return categoryMap[categoryId] || 'Unknown';
}

// Registry access
export { default as pluginRegistry } from './registry.json';

// Re-export commonly used classes
export { PluginManager } from './core/PluginSystem';
export { PluginValidator } from './deployment/PluginValidator';
export { PluginDeploymentSystem } from './deployment/deploy';
export { ZipPluginImporter } from './import/ZipPluginImporter';

// Development helpers
export const createPlugin = {
  template: () => import('./development/PluginTemplate'),
  scaffold: () => import('./development/scaffolding.js')
};

// Error handling
export class PluginSystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PluginSystemError';
  }
}

// Version compatibility check
export function checkCompatibility(
  pluginVersion: string,
  systemVersion: string = PLUGIN_API_VERSION
): boolean {
  const [pluginMajor, pluginMinor] = pluginVersion.split('.').map(Number);
  const [systemMajor, systemMinor] = systemVersion.split('.').map(Number);
  
  return pluginMajor === systemMajor && pluginMinor <= systemMinor;
}

// Default export for convenience
export default {
  PluginManager,
  PluginValidator,
  PluginDeploymentSystem,
  ZipPluginImporter,
  PLUGIN_CATEGORIES,
  PLUGIN_VERSION,
  PLUGIN_API_VERSION,
  isPlugin,
  validatePluginId,
  getPluginCategoryName,
  checkCompatibility,
  PluginSystemError
};