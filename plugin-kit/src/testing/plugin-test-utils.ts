/**
 * Plugin Testing Utilities
 * Comprehensive testing framework for Plugin Kit plugins
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface PluginTestConfig {
  pluginPath: string;
  testDataDir: string;
  timeout?: number;
  verbose?: boolean;
  mockResponses?: boolean;
}

export interface TestResult {
  success: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  metrics: Record<string, any>;
}

export interface MockResponse {
  endpoint: string;
  method: string;
  status: number;
  data: any;
  delay?: number;
}

export class PluginTestRunner extends EventEmitter {
  private config: PluginTestConfig;
  private testResults: Map<string, TestResult> = new Map();
  private mockServer: MockServer | null = null;

  constructor(config: PluginTestConfig) {
    super();
    this.config = { timeout: 30000, verbose: false, mockResponses: true, ...config };
    this.setupTestEnvironment();
  }

  private setupTestEnvironment(): void {
    if (!fs.existsSync(this.config.testDataDir)) {
      fs.mkdirSync(this.config.testDataDir, { recursive: true });
    }

    if (this.config.mockResponses) {
      this.mockServer = new MockServer();
    }
  }

  async runTestSuite(testSuite: TestSuite): Promise<Map<string, TestResult>> {
    this.emit('test:start', { suite: testSuite.name, tests: testSuite.tests.length });
    
    const startTime = Date.now();
    
    for (const test of testSuite.tests) {
      await this.runSingleTest(test);
    }
    
    const duration = Date.now() - startTime;
    this.emit('test:complete', { suite: testSuite.name, duration, results: this.testResults });
    
    return this.testResults;
  }

  async runSingleTest(test: PluginTest): Promise<TestResult> {
    const startTime = Date.now();
    this.emit('test:start', { name: test.name });

    try {
      const result = await this.executeTest(test);
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        success: result.success,
        duration,
        errors: result.errors || [],
        warnings: result.warnings || [],
        metrics: result.metrics || {}
      };

      this.testResults.set(test.name, testResult);
      this.emit('test:result', { name: test.name, result: testResult });
      
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult: TestResult = {
        success: false,
        duration,
        errors: [error.message || 'Test execution failed'],
        warnings: [],
        metrics: {}
      };

      this.testResults.set(test.name, testResult);
      this.emit('test:error', { name: test.name, error, result: testResult });
      
      return testResult;
    }
  }

  private async executeTest(test: PluginTest): Promise<any> {
    const testFunction = test.testFunction;
    
    if (typeof testFunction === 'function') {
      return await testFunction(this.createTestContext());
    } else if (typeof testFunction === 'string') {
      return await this.executeScriptTest(testFunction);
    }
    
    throw new Error('Invalid test function');
  }

  private createTestContext() {
    return {
      mock: this.mockServer,
      log: (message: string, level: string = 'info') => {
        if (this.config.verbose) {
          console[level as keyof Console](`[TEST] ${message}`);
        }
      },
      assert: this.createAssertionHelpers(),
      data: this.createDataHelpers()
    };
  }

  private createAssertionHelpers() {
    return {
      equal: (actual: any, expected: any, message?: string) => {
        if (actual !== expected) {
          throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
      },
      notEqual: (actual: any, expected: any, message?: string) => {
        if (actual === expected) {
          throw new Error(message || `Expected not ${expected}, got ${actual}`);
        }
      },
      deepEqual: (actual: any, expected: any, message?: string) => {
        if (!this.deepEqual(actual, expected)) {
          throw new Error(message || `Objects not deeply equal`);
        }
      },
      throws: async (fn: () => Promise<any>, message?: string) => {
        try {
          await fn();
          throw new Error(message || 'Expected function to throw');
        } catch (error) {
          // Expected
        }
      }
    };
  }

  private createDataHelpers() {
    return {
      load: (filename: string) => {
        const filePath = path.join(this.config.testDataDir, filename);
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      },
      save: (filename: string, data: any) => {
        const filePath = path.join(this.config.testDataDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      },
      generate: (template: string, count: number) => {
        return Array.from({ length: count }, (_, i) => 
          template.replace(/\$\{i\}/g, i.toString())
        );
      }
    };
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      
      return true;
    }
    
    return false;
  }

  private async executeScriptTest(scriptPath: string): Promise<any> {
    const fullPath = path.resolve(this.config.pluginPath, scriptPath);
    const script = require(fullPath);
    
    if (typeof script.run === 'function') {
      return await script.run(this.createTestContext());
    }
    
    throw new Error('Script must export a run function');
  }

  generateReport(): string {
    const totalTests = this.testResults.size;
    const passedTests = Array.from(this.testResults.values()).filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = Array.from(this.testResults.values()).reduce((sum, r) => sum + r.duration, 0);

    let report = `
Plugin Test Report
==================

Summary:
- Total Tests: ${totalTests}
- Passed: ${passedTests}
- Failed: ${failedTests}
- Total Duration: ${totalDuration}ms

Results:
`;

    for (const [name, result] of this.testResults) {
      report += `- ${name}: ${result.success ? 'PASS' : 'FAIL'} (${result.duration}ms)
`;
      if (result.errors.length > 0) {
        report += `  Errors: ${result.errors.join(', ')}
`;
      }
      if (result.warnings.length > 0) {
        report += `  Warnings: ${result.warnings.join(', ')}
`;
      }
    }

    return report;
  }
}

export class MockServer {
  private mocks: Map<string, MockResponse> = new Map();

  addMock(response: MockResponse): void {
    const key = `${response.method.toUpperCase()}:${response.endpoint}`;
    this.mocks.set(key, response);
  }

  removeMock(endpoint: string, method: string): void {
    const key = `${method.toUpperCase()}:${endpoint}`;
    this.mocks.delete(key);
  }

  async mockRequest(endpoint: string, method: string): Promise<any> {
    const key = `${method.toUpperCase()}:${endpoint}`;
    const mock = this.mocks.get(key);
    
    if (!mock) {
      throw new Error(`No mock found for ${method} ${endpoint}`);
    }

    if (mock.delay) {
      await new Promise(resolve => setTimeout(resolve, mock.delay));
    }

    return {
      status: mock.status,
      data: mock.data
    };
  }

  clearMocks(): void {
    this.mocks.clear();
  }
}

export interface PluginTest {
  name: string;
  description?: string;
  testFunction: ((context: any) => Promise<any>) | string;
  timeout?: number;
  dependencies?: string[];
}

export interface TestSuite {
  name: string;
  description?: string;
  tests: PluginTest[];
  setup?: (context: any) => Promise<void>;
  teardown?: (context: any) => Promise<void>;
}

export class PluginDebugger {
  private breakpoints: Map<string, boolean> = new Map();
  private logs: string[] = [];

  setBreakpoint(pluginPath: string, line: number): void {
    this.breakpoints.set(`${pluginPath}:${line}`, true);
  }

  removeBreakpoint(pluginPath: string, line: number): void {
    this.breakpoints.delete(`${pluginPath}:${line}`);
  }

  shouldBreak(pluginPath: string, line: number): boolean {
    return this.breakpoints.has(`${pluginPath}:${line}`);
  }

  log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    this.logs.push(logEntry);
    
    if (level === 'error') {
      console.error(logEntry);
    } else if (level === 'warn') {
      console.warn(logEntry);
    } else {
      console.log(logEntry);
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  saveLogs(filePath: string): void {
    fs.writeFileSync(filePath, this.logs.join('\n'));
  }
}

export class PerformanceProfiler {
  private metrics: Map<string, number[]> = new Map();

  start(name: string): () => void {
    const startTime = process.hrtime.bigint();
    
    return () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }
      
      this.metrics.get(name)!.push(duration);
    };
  }

  getMetrics(name?: string): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    const metricsToProcess = name ? [name] : Array.from(this.metrics.keys());
    
    for (const metricName of metricsToProcess) {
      const values = this.metrics.get(metricName) || [];
      if (values.length > 0) {
        result[metricName] = {
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    }
    
    return result;
  }

  reset(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

// Export utilities for easy usage
export const TestUtils = {
  createTestRunner: (config: PluginTestConfig) => new PluginTestRunner(config),
  createDebugger: () => new PluginDebugger(),
  createProfiler: () => new PerformanceProfiler(),
  createMockServer: () => new MockServer(),
  
  // Common test helpers
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  randomString: (length: number) => Math.random().toString(36).substring(2, length + 2),
  randomInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
  
  // File helpers
  readTestData: (filename: string, testDataDir: string) => {
    const filePath = path.join(testDataDir, filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  },
  
  writeTestData: (filename: string, data: any, testDataDir: string) => {
    const filePath = path.join(testDataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
};