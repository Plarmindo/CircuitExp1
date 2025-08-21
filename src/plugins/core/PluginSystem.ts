/**
 * CircuitExp1 Plugin System Core
 * 
 * This module provides the foundational architecture for a robust plugin system
 * that enables extensibility while maintaining system stability and performance.
 */

import { EventEmitter } from 'events';

// Core Plugin Types
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  keywords?: string[];
  engines: {
    circuitexp1: string;
    node?: string;
  };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  main: string;
  types?: string;
}

export interface PluginAPI {
  // Core system access
  getVersion(): string;
  getConfig(): Record<string, any>;
  setConfig(key: string, value: any): void;
  
  // Event system
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): boolean;
  
  // Logging
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void;
  
  // File system access (sandboxed)
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  
  // Network access (controlled)
  fetch(url: string, options?: RequestInit): Promise<Response>;
  
  // UI integration
  registerComponent(type: string, component: React.ComponentType): void;
  unregisterComponent(type: string, componentId: string): void;
  
  // Data access
  getData(key: string): Promise<any>;
  setData(key: string, value: any): Promise<void>;
  deleteData(key: string): Promise<void>;
}

export interface Plugin {
  metadata: PluginMetadata;
  activate(api: PluginAPI): Promise<void>;
  deactivate(): Promise<void>;
  
  // Optional lifecycle methods
  onConfigChange?(newConfig: Record<string, any>): void;
  onThemeChange?(theme: string): void;
  onLayoutChange?(layout: any): void;
}

export interface PluginRegistry {
  register(plugin: Plugin): Promise<void>;
  unregister(pluginId: string): Promise<void>;
  get(pluginId: string): Plugin | undefined;
  list(): Plugin[];
  isEnabled(pluginId: string): boolean;
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Plugin Security and Sandboxing
export interface SecurityPolicy {
  allowFileSystem: boolean;
  allowNetwork: boolean;
  allowedDomains?: string[];
  maxFileSize: number;
  maxMemoryUsage: number;
  timeout: number;
}

// Plugin Events
export const PluginEvents = {
  PLUGIN_REGISTERED: 'plugin:registered',
  PLUGIN_UNREGISTERED: 'plugin:unregistered',
  PLUGIN_ENABLED: 'plugin:enabled',
  PLUGIN_DISABLED: 'plugin:disabled',
  PLUGIN_ERROR: 'plugin:error',
  CONFIG_CHANGED: 'config:changed',
  THEME_CHANGED: 'theme:changed',
} as const;

// Error Types
export class PluginError extends Error {
  constructor(
    message: string,
    public pluginId: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export class PluginValidationError extends PluginError {
  constructor(pluginId: string, errors: string[]) {
    super(
      `Plugin validation failed: ${errors.join(', ')}`,
      pluginId,
      'VALIDATION_ERROR',
      { errors }
    );
  }
}

export class PluginSecurityError extends PluginError {
  constructor(pluginId: string, violation: string) {
    super(
      `Security violation: ${violation}`,
      pluginId,
      'SECURITY_ERROR',
      { violation }
    );
  }
}

// Plugin Manager Implementation
export class PluginManager extends EventEmitter implements PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private enabledPlugins = new Set<string>();
  private securityPolicies = new Map<string, SecurityPolicy>();
  
  async register(plugin: Plugin): Promise<void> {
    // Validate plugin
    const validation = await this.validatePlugin(plugin);
    if (!validation.valid) {
      throw new PluginValidationError(plugin.metadata.id, validation.errors);
    }
    
    // Set security policy
    this.securityPolicies.set(plugin.metadata.id, {
      allowFileSystem: false,
      allowNetwork: false,
      maxFileSize: 1024 * 1024, // 1MB
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      timeout: 10000, // 10 seconds for tests
    });
    
    this.plugins.set(plugin.metadata.id, plugin);
    this.emit(PluginEvents.PLUGIN_REGISTERED, plugin);
  }
  
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      if (this.enabledPlugins.has(pluginId)) {
        await this.disable(pluginId);
      }
      this.plugins.delete(pluginId);
      this.securityPolicies.delete(pluginId);
      this.emit(PluginEvents.PLUGIN_UNREGISTERED, pluginId);
    }
  }
  
  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }
  
  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  isEnabled(pluginId: string): boolean {
    return this.enabledPlugins.has(pluginId);
  }
  
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginError('Plugin not found', pluginId, 'NOT_FOUND');
    }
    
    if (this.enabledPlugins.has(pluginId)) {
      return;
    }
    
    try {
      const api = this.createPluginAPI(pluginId);
      await plugin.activate(api);
      this.enabledPlugins.add(pluginId);
      this.emit(PluginEvents.PLUGIN_ENABLED, plugin);
    } catch (error) {
      this.emit(PluginEvents.PLUGIN_ERROR, plugin, error);
      throw new PluginError(
        `Failed to activate plugin: ${error.message}`,
        pluginId,
        'ACTIVATION_ERROR',
        { error }
      );
    }
  }
  
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !this.enabledPlugins.has(pluginId)) {
      return;
    }
    
    try {
      await plugin.deactivate();
      this.enabledPlugins.delete(pluginId);
      this.emit(PluginEvents.PLUGIN_DISABLED, plugin);
    } catch (error) {
      this.emit(PluginEvents.PLUGIN_ERROR, plugin, error);
      throw new PluginError(
        `Failed to deactivate plugin: ${error.message}`,
        pluginId,
        'DEACTIVATION_ERROR',
        { error }
      );
    }
  }
  
  private async validatePlugin(plugin: Plugin): Promise<PluginValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate metadata
    if (!plugin.metadata.id) errors.push('Plugin ID is required');
    if (!plugin.metadata.name) errors.push('Plugin name is required');
    if (!plugin.metadata.version) errors.push('Plugin version is required');
    if (!plugin.metadata.main) errors.push('Plugin main entry point is required');
    
    // Validate version format
    if (plugin.metadata.version && !/^\d+\.\d+\.\d+/.test(plugin.metadata.version)) {
      warnings.push('Version should follow semantic versioning (e.g., 1.0.0)');
    }
    
    // Check for duplicate IDs
    if (this.plugins.has(plugin.metadata.id)) {
      errors.push(`Plugin with ID '${plugin.metadata.id}' already exists`);
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }
  
  private createPluginAPI(pluginId: string): PluginAPI {
    const securityPolicy = this.securityPolicies.get(pluginId)!;
    
    return {
      getVersion: () => '0.0.0',
      getConfig: () => ({}),
      setConfig: (key: string, value: any) => {
        // Implementation would connect to actual config system
        this.emit('config:changed', { pluginId, key, value });
      },
      on: this.on.bind(this),
      off: this.off.bind(this),
      emit: this.emit.bind(this),
      log: (level, message, meta) => {
        console[level](`[${pluginId}] ${message}`, meta);
      },
      readFile: async (path: string) => {
        if (!securityPolicy.allowFileSystem) {
          throw new PluginSecurityError(pluginId, 'File system access denied');
        }
        // Implementation would use sandboxed file system
        throw new Error('File system access not implemented');
      },
      writeFile: async (path: string, content: string) => {
        if (!securityPolicy.allowFileSystem) {
          throw new PluginSecurityError(pluginId, 'File system access denied');
        }
        throw new Error('File system access not implemented');
      },
      exists: async (path: string) => {
        if (!securityPolicy.allowFileSystem) {
          throw new PluginSecurityError(pluginId, 'File system access denied');
        }
        throw new Error('File system access not implemented');
      },
      fetch: async (url: string, options?: RequestInit) => {
        if (!securityPolicy.allowNetwork) {
          throw new PluginSecurityError(pluginId, 'Network access denied');
        }
        if (securityPolicy.allowedDomains && !securityPolicy.allowedDomains.some(domain => url.includes(domain))) {
          throw new PluginSecurityError(pluginId, `Domain not allowed: ${url}`);
        }
        return fetch(url, options);
      },
      registerComponent: (type: string, component: React.ComponentType) => {
        // Implementation would register with React component system
        console.log(`Registering component ${type} for plugin ${pluginId}`);
      },
      unregisterComponent: (type: string, componentId: string) => {
        console.log(`Unregistering component ${type} for plugin ${pluginId}`);
      },
      getData: async (key: string) => {
        // Implementation would use plugin-specific storage
        return null;
      },
      setData: async (key: string, value: any) => {
        // Implementation would use plugin-specific storage
      },
      deleteData: async (key: string) => {
        // Implementation would use plugin-specific storage
      },
    };
  }
}

// Singleton instance
export const pluginManager = new PluginManager();