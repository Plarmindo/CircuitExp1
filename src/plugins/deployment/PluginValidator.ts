/**
 * CircuitExp1 Plugin Validator
 * 
 * Provides automated testing, validation, and compatibility checking
 * for plugin deployment and updates.
 */

import { Plugin, PluginMetadata, PluginValidationResult } from '../core/PluginSystem';
import { PluginError } from '../core/PluginSystem';

export interface ValidationOptions {
  strict?: boolean;
  checkSecurity?: boolean;
  checkDependencies?: boolean;
  checkCompatibility?: boolean;
  skipNetwork?: boolean;
}

export interface CompatibilityReport {
  compatible: boolean;
  issues: CompatibilityIssue[];
  warnings: CompatibilityWarning[];
  recommendations: string[];
}

export interface CompatibilityIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  details?: any;
}

export interface CompatibilityWarning {
  code: string;
  message: string;
  suggestion: string;
}

export interface SecurityScanResult {
  passed: boolean;
  issues: SecurityIssue[];
  score: number; // 0-100
}

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  code: string;
  message: string;
  line?: number;
  file?: string;
}

export interface PerformanceMetrics {
  loadTime: number; // milliseconds
  memoryUsage: number; // bytes
  bundleSize: number; // bytes
  dependencies: number;
}

/**
 * Comprehensive plugin validator
 */
export class PluginValidator {
  private readonly supportedEngines = {
    circuitexp1: '^0.0.0',
    node: '>=18.0.0'
  };

  private readonly securityPatterns = [
    {
      pattern: /eval\s*\(/gi,
      message: 'Use of eval is prohibited for security reasons',
      severity: 'critical' as const
    },
    {
      pattern: /new\s+Function\s*\(/gi,
      message: 'Dynamic code execution via new Function is not allowed',
      severity: 'critical' as const
    },
    {
      pattern: /document\.write\s*\(/gi,
      message: 'document.write() can lead to XSS vulnerabilities',
      severity: 'high' as const
    },
    {
      pattern: /innerHTML\s*=.*?<script/gi,
      message: 'Potential XSS vulnerability with innerHTML',
      severity: 'high' as const
    },
    {
      pattern: /window\.location\s*=?/gi,
      message: 'Direct location manipulation should be avoided',
      severity: 'medium' as const
    }
  ];

  /**
   * Validates plugin metadata
   */
  async validateMetadata(metadata: PluginMetadata): Promise<PluginValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!metadata.id) errors.push('Plugin ID is required');
    if (!metadata.name) errors.push('Plugin name is required');
    if (!metadata.version) errors.push('Plugin version is required');
    if (!metadata.author) errors.push('Plugin author is required');
    if (!metadata.license) errors.push('Plugin license is required');
    if (!metadata.main) errors.push('Plugin main entry point is required');
    if (!metadata.engines) errors.push('Plugin engines specification is required');

    // ID validation
    if (metadata.id && !/^[a-z0-9-]+$/.test(metadata.id)) {
      errors.push('Plugin ID must be kebab-case (lowercase letters, numbers, and hyphens)');
    }

    // Version validation
    if (metadata.version && !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(metadata.version)) {
      warnings.push('Version should follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)');
    }

    // Name validation
    if (metadata.name && metadata.name.length > 50) {
      warnings.push('Plugin name should be 50 characters or less');
    }

    // Description validation
    if (metadata.description && metadata.description.length > 200) {
      warnings.push('Plugin description should be 200 characters or less');
    }

    // Engine compatibility
    if (metadata.engines) {
      const circuitexp1Version = metadata.engines.circuitexp1;
      if (circuitexp1Version && !this.isVersionCompatible(circuitexp1Version, this.supportedEngines.circuitexp1)) {
        warnings.push(`CircuitExp1 engine version ${circuitexp1Version} may not be compatible with current system`);
      }

      const nodeVersion = metadata.engines.node;
      if (nodeVersion && !this.isVersionCompatible(nodeVersion, this.supportedEngines.node)) {
        warnings.push(`Node.js version ${nodeVersion} may not be compatible with current system`);
      }
    }

    // Dependencies validation
    if (metadata.dependencies) {
      const issues = await this.validateDependencies(metadata.dependencies);
      warnings.push(...issues);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Performs security scan on plugin code
   */
  async securityScan(pluginCode: string): Promise<SecurityScanResult> {
    const issues: SecurityIssue[] = [];
    let score = 100;

    // Check for security patterns
    for (const { pattern, message, severity } of this.securityPatterns) {
      const matches = pluginCode.match(pattern);
      if (matches) {
        issues.push({
          severity,
          code: `SECURITY_${severity.toUpperCase()}`,
          message,
          line: this.getLineNumber(pluginCode, matches.index || 0)
        });

        // Adjust score based on severity
        const deductions = {
          critical: 30,
          high: 20,
          medium: 10,
          low: 5
        };
        score -= deductions[severity];
      }
    }

    // Check for unsafe imports
    const unsafeImports = ['fs', 'child_process', 'vm', 'eval'];
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]|require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let match;
    while ((match = importRegex.exec(pluginCode)) !== null) {
      const module = match[1] || match[2];
      if (unsafeImports.includes(module)) {
        issues.push({
          severity: 'critical',
          code: 'UNSAFE_IMPORT',
          message: `Unsafe module import: ${module}`,
          line: this.getLineNumber(pluginCode, match.index)
        });
        score -= 30;
      }
    }

    return {
      passed: score >= 70 && issues.filter(i => i.severity === 'critical').length === 0,
      issues,
      score: Math.max(0, score)
    };
  }

  /**
   * Checks compatibility with current system
   */
  async checkCompatibility(metadata: PluginMetadata): Promise<CompatibilityReport> {
    const issues: CompatibilityIssue[] = [];
    const warnings: CompatibilityWarning[] = [];
    const recommendations: string[] = [];

    // Check engine compatibility
    if (metadata.engines) {
      for (const [engine, version] of Object.entries(metadata.engines)) {
        const supported = this.supportedEngines[engine as keyof typeof this.supportedEngines];
        if (supported && !this.isVersionCompatible(version, supported)) {
          issues.push({
            severity: 'error',
            code: 'INCOMPATIBLE_ENGINE',
            message: `Plugin requires ${engine} ${version}, but system supports ${supported}`,
            details: { engine, required: version, supported }
          });
        }
      }
    }

    // Check for deprecated APIs
    const deprecatedPatterns = [
      { pattern: /PluginAPI\.deprecatedMethod/g, message: 'Uses deprecated API method' }
    ];
    
    // This would need actual plugin code analysis
    // For now, we'll add recommendations
    recommendations.push('Use latest PluginAPI methods');
    recommendations.push('Test plugin with current system version');

    // Check bundle size (would need actual analysis)
    warnings.push({
      code: 'BUNDLE_SIZE',
      message: 'Consider minifying and optimizing plugin bundle',
      suggestion: 'Use webpack or rollup for bundling'
    });

    return {
      compatible: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      warnings,
      recommendations
    };
  }

  /**
   * Validates plugin dependencies
   */
  async validateDependencies(dependencies: Record<string, string>): Promise<string[]> {
    const warnings: string[] = [];

    for (const [name, version] of Object.entries(dependencies)) {
      // Check for known vulnerable packages
      const vulnerablePackages = ['lodash', 'moment', 'request'];
      if (vulnerablePackages.includes(name)) {
        warnings.push(`Package '${name}' has known security vulnerabilities. Consider alternatives.`);
      }

      // Check for outdated packages
      if (name.includes('react') && !version.startsWith('^19')) {
        warnings.push(`React version ${version} may not be compatible with system React 19.x`);
      }
    }

    return warnings;
  }

  /**
   * Performs comprehensive plugin validation
   */
  async validatePlugin(
    plugin: Plugin,
    options: ValidationOptions = {}
  ): Promise<{
    metadata: PluginValidationResult;
    security: SecurityScanResult;
    compatibility: CompatibilityReport;
    performance: PerformanceMetrics;
    overall: boolean;
  }> {
    const [metadata, security, compatibility] = await Promise.all([
      this.validateMetadata(plugin.metadata),
      options.checkSecurity !== false ? this.securityScan(JSON.stringify(plugin)) : 
        Promise.resolve({ passed: true, issues: [], score: 100 }),
      options.checkCompatibility !== false ? this.checkCompatibility(plugin.metadata) :
        Promise.resolve({ compatible: true, issues: [], warnings: [], recommendations: [] })
    ]);

    // Calculate performance metrics (mock data for now)
    const performance: PerformanceMetrics = {
      loadTime: 150, // ms
      memoryUsage: 1024 * 1024, // 1MB
      bundleSize: 500 * 1024, // 500KB
      dependencies: Object.keys(plugin.metadata.dependencies || {}).length
    };

    const overall = metadata.valid && security.passed && compatibility.compatible;

    return {
      metadata,
      security,
      compatibility,
      performance,
      overall
    };
  }

  /**
   * Creates a deployment package
   */
  async createDeploymentPackage(
    plugin: Plugin,
    options: { minify?: boolean; includeSourceMap?: boolean } = {}
  ): Promise<{
    package: Buffer;
    checksum: string;
    size: number;
  }> {
    // This would create a compressed package with plugin files
    // For now, return mock data
    const mockPackage = Buffer.from(JSON.stringify(plugin));
    return {
      package: mockPackage,
      checksum: 'mock-checksum',
      size: mockPackage.length
    };
  }

  /**
   * Validates version compatibility using semver
   */
  private isVersionCompatible(required: string, supported: string): boolean {
    // Simplified semver check - in production, use proper semver library
    const requiredParts = required.replace(/[^\d.]/g, '').split('.');
    const supportedParts = supported.replace(/[^\d.]/g, '').split('.');
    
    for (let i = 0; i < Math.min(requiredParts.length, supportedParts.length); i++) {
      const req = parseInt(requiredParts[i]) || 0;
      const sup = parseInt(supportedParts[i]) || 0;
      
      if (sup >= req) return true;
      if (sup < req) return false;
    }
    
    return true;
  }

  /**
   * Gets line number from character position
   */
  private getLineNumber(text: string, position: number): number {
    return text.substring(0, position).split('\n').length;
  }
}

/**
 * Automated testing suite for plugins
 */
export class PluginTestSuite {
  async runTests(plugin: Plugin): Promise<{
    passed: boolean;
    tests: TestResult[];
    coverage: number;
  }> {
    const tests: TestResult[] = [];
    
    // Test 1: Activation/Deactivation cycle
    tests.push(await this.testActivationCycle(plugin));
    
    // Test 2: Configuration handling
    tests.push(await this.testConfiguration(plugin));
    
    // Test 3: Event handling
    tests.push(await this.testEventHandling(plugin));
    
    // Test 4: Memory management
    tests.push(await this.testMemoryManagement(plugin));
    
    const passed = tests.every(t => t.passed);
    const coverage = 85; // Mock coverage percentage
    
    return { passed, tests, coverage };
  }

  private async testActivationCycle(plugin: Plugin): Promise<TestResult> {
    try {
      const mockAPI = createMockPluginAPI();
      await plugin.activate(mockAPI);
      await plugin.deactivate();
      return { name: 'Activation Cycle', passed: true };
    } catch (error) {
      return { name: 'Activation Cycle', passed: false, error: error.message };
    }
  }

  private async testConfiguration(plugin: Plugin): Promise<TestResult> {
    try {
      // Test configuration changes
      if (plugin.onConfigChange) {
        plugin.onConfigChange({ test: 'value' });
      }
      return { name: 'Configuration', passed: true };
    } catch (error) {
      return { name: 'Configuration', passed: false, error: error.message };
    }
  }

  private async testEventHandling(plugin: Plugin): Promise<TestResult> {
    try {
      // Test event handling
      if (plugin.onThemeChange) {
        plugin.onThemeChange('dark');
        plugin.onThemeChange('light');
      }
      return { name: 'Event Handling', passed: true };
    } catch (error) {
      return { name: 'Event Handling', passed: false, error: error.message };
    }
  }

  private async testMemoryManagement(plugin: Plugin): Promise<TestResult> {
    try {
      // Test for memory leaks
      const initialMemory = process.memoryUsage?.().heapUsed || 0;
      
      const mockAPI = createMockPluginAPI();
      await plugin.activate(mockAPI);
      await plugin.deactivate();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage?.().heapUsed || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      if (memoryIncrease > 1024 * 1024) { // 1MB threshold
        return { 
          name: 'Memory Management', 
          passed: false, 
          error: `Memory increased by ${memoryIncrease} bytes` 
        };
      }
      
      return { name: 'Memory Management', passed: true };
    } catch (error) {
      return { name: 'Memory Management', passed: false, error: error.message };
    }
  }
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

function createMockPluginAPI(): any {
  return {
    getVersion: () => '0.0.0',
    getConfig: () => ({}),
    setConfig: () => {},
    on: () => {},
    off: () => {},
    emit: () => true,
    log: () => {},
    readFile: async () => '',
    writeFile: async () => {},
    exists: async () => false,
    fetch: async () => new Response(),
    registerComponent: () => {},
    unregisterComponent: () => {},
    getData: async () => null,
    setData: async () => {},
    deleteData: async () => {},
  };
}

// Export singletons
export const pluginValidator = new PluginValidator();
export const pluginTestSuite = new PluginTestSuite();