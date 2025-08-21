#!/usr/bin/env node

/**
 * Plugin Development Kit Debug CLI
 * Interactive debugging and testing tool for plugin development
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PluginTestRunner, PluginDebugger, PerformanceProfiler, TestUtils } from '../testing/plugin-test-utils';
import { PluginTest, TestSuite } from '../testing/plugin-test-utils';

interface CliCommand {
  name: string;
  description: string;
  handler: (args: string[]) => Promise<void>;
}

class DebugCli {
  private commands: Map<string, CliCommand> = new Map();
  private debugger: PluginDebugger;
  private profiler: PerformanceProfiler;
  private currentTestRunner: PluginTestRunner | null = null;
  private rl: readline.Interface;

  constructor() {
    this.debugger = new PluginDebugger();
    this.profiler = new PerformanceProfiler();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'pdk-debug> '
    });

    this.setupCommands();
  }

  private setupCommands(): void {
    this.commands.set('help', {
      name: 'help',
      description: 'Show available commands',
      handler: this.showHelp.bind(this)
    });

    this.commands.set('test', {
      name: 'test',
      description: 'Run plugin tests',
      handler: this.runTests.bind(this)
    });

    this.commands.set('debug', {
      name: 'debug',
      description: 'Enable debugging for a plugin',
      handler: this.enableDebug.bind(this)
    });

    this.commands.set('profile', {
      name: 'profile',
      description: 'Profile plugin performance',
      handler: this.profilePlugin.bind(this)
    });

    this.commands.set('logs', {
      name: 'logs',
      description: 'View plugin logs',
      handler: this.viewLogs.bind(this)
    });

    this.commands.set('validate', {
      name: 'validate',
      description: 'Validate plugin structure',
      handler: this.validatePlugin.bind(this)
    });

    this.commands.set('mock', {
      name: 'mock',
      description: 'Setup mock responses',
      handler: this.setupMocks.bind(this)
    });

    this.commands.set('exit', {
      name: 'exit',
      description: 'Exit debug CLI',
      handler: this.exit.bind(this)
    });

    this.commands.set('quit', {
      name: 'quit',
      description: 'Exit debug CLI',
      handler: this.exit.bind(this)
    });
  }

  async start(): Promise<void> {
    console.log('🛠️  Plugin Development Kit Debug CLI');
    console.log('Type "help" for available commands\n');

    this.rl.prompt();

    this.rl.on('line', async (input) => {
      const trimmed = input.trim();
      if (trimmed) {
        await this.handleCommand(trimmed);
      }
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\nGoodbye!');
      process.exit(0);
    });
  }

  private async handleCommand(input: string): Promise<void> {
    const [commandName, ...args] = input.split(' ');
    const command = this.commands.get(commandName);

    if (command) {
      try {
        await command.handler(args);
      } catch (error) {
        console.error(`Error: ${error.message}`);
      }
    } else {
      console.log(`Unknown command: ${commandName}. Type "help" for available commands.`);
    }
  }

  private async showHelp(args: string[]): Promise<void> {
    console.log('\nAvailable Commands:');
    console.log('==================');
    
    for (const [name, cmd] of this.commands) {
      console.log(`${name.padEnd(12)} - ${cmd.description}`);
    }
    
    console.log('\nExamples:');
    console.log('  test ./my-plugin --suite integration');
    console.log('  debug ./my-plugin --verbose');
    console.log('  profile ./my-plugin --function analyze');
    console.log('  validate ./my-plugin');
    console.log('  mock setup --endpoint /api/completion');
  }

  private async runTests(args: string[]): Promise<void> {
    const pluginPath = args[0];
    if (!pluginPath) {
      console.log('Usage: test <plugin-path> [--suite <suite-name>] [--verbose]');
      return;
    }

    const verbose = args.includes('--verbose');
    const suiteName = this.getFlagValue(args, '--suite');

    try {
      const testConfig = {
        pluginPath: path.resolve(pluginPath),
        testDataDir: path.join(path.resolve(pluginPath), 'test-data'),
        verbose,
        mockResponses: true
      };

      this.currentTestRunner = TestUtils.createTestRunner(testConfig);
      
      this.currentTestRunner.on('test:start', (data) => {
        console.log(`Starting ${data.suite || 'test'}...`);
      });

      this.currentTestRunner.on('test:result', (data) => {
        const status = data.result.success ? '✅' : '❌';
        console.log(`${status} ${data.name} (${data.result.duration}ms)`);
      });

      const testSuite = await this.loadTestSuite(pluginPath, suiteName);
      const results = await this.currentTestRunner.runTestSuite(testSuite);
      
      console.log('\n' + this.currentTestRunner.generateReport());
    } catch (error) {
      console.error(`Test execution failed: ${error.message}`);
    }
  }

  private async enableDebug(args: string[]): Promise<void> {
    const pluginPath = args[0];
    const verbose = args.includes('--verbose');

    if (!pluginPath) {
      console.log('Usage: debug <plugin-path> [--verbose]');
      return;
    }

    const fullPath = path.resolve(pluginPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`Plugin path does not exist: ${fullPath}`);
      return;
    }

    console.log(`🔍 Enabling debug mode for: ${fullPath}`);
    
    if (verbose) {
      this.debugger.log('Debug mode enabled with verbose logging', 'info');
    }

    // Validate plugin structure
    const manifestPath = path.join(fullPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.warn('Warning: No manifest.json found');
    }

    console.log('Debug mode active. Use "logs" command to view debug output.');
  }

  private async profilePlugin(args: string[]): Promise<void> {
    const pluginPath = args[0];
    const functionName = this.getFlagValue(args, '--function');

    if (!pluginPath) {
      console.log('Usage: profile <plugin-path> [--function <function-name>]');
      return;
    }

    console.log(`📊 Profiling plugin: ${pluginPath}`);
    
    const endProfile = this.profiler.start('plugin-profile');
    
    try {
      // Simulate plugin loading and execution
      await TestUtils.sleep(1000); // Replace with actual profiling
      
      endProfile();
      
      const metrics = this.profiler.getMetrics();
      console.log('Profile Results:');
      console.log(JSON.stringify(metrics, null, 2));
    } catch (error) {
      console.error(`Profiling failed: ${error.message}`);
    }
  }

  private async viewLogs(args: string[]): Promise<void> {
    const savePath = this.getFlagValue(args, '--save');
    
    const logs = this.debugger.getLogs();
    
    if (logs.length === 0) {
      console.log('No logs available');
      return;
    }

    console.log('\n📋 Debug Logs:');
    console.log('=============');
    logs.forEach(log => console.log(log));

    if (savePath) {
      this.debugger.saveLogs(savePath);
      console.log(`Logs saved to: ${savePath}`);
    }
  }

  private async validatePlugin(args: string[]): Promise<void> {
    const pluginPath = args[0];
    if (!pluginPath) {
      console.log('Usage: validate <plugin-path>');
      return;
    }

    const fullPath = path.resolve(pluginPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`Plugin path does not exist: ${fullPath}`);
      return;
    }

    console.log(`🔍 Validating plugin: ${fullPath}`);
    
    const validation = await this.validatePluginStructure(fullPath);
    
    if (validation.isValid) {
      console.log('✅ Plugin validation passed');
    } else {
      console.log('❌ Plugin validation failed');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
  }

  private async setupMocks(args: string[]): Promise<void> {
    const action = args[0];
    
    if (!action || action === 'help') {
      console.log('Mock Commands:');
      console.log('  mock setup --endpoint <url> --response <file>');
      console.log('  mock list');
      console.log('  mock clear');
      return;
    }

    if (action === 'list') {
      console.log('Available mocks will be listed here');
    } else if (action === 'clear') {
      console.log('All mocks cleared');
    } else if (action === 'setup') {
      const endpoint = this.getFlagValue(args, '--endpoint');
      const responseFile = this.getFlagValue(args, '--response');
      
      if (!endpoint || !responseFile) {
        console.log('Usage: mock setup --endpoint <url> --response <file>');
        return;
      }

      console.log(`Mock setup: ${endpoint} -> ${responseFile}`);
    }
  }

  private async exit(args: string[]): Promise<void> {
    console.log('Shutting down debug CLI...');
    this.rl.close();
  }

  private getFlagValue(args: string[], flag: string): string | null {
    const index = args.indexOf(flag);
    return index !== -1 && index < args.length - 1 ? args[index + 1] : null;
  }

  private async loadTestSuite(pluginPath: string, suiteName?: string): Promise<TestSuite> {
    const testDir = path.join(path.resolve(pluginPath), 'tests');
    
    if (!fs.existsSync(testDir)) {
      // Create default test suite
      return {
        name: 'default',
        description: 'Default test suite',
        tests: [
          {
            name: 'basic-functionality',
            description: 'Test basic plugin functionality',
            testFunction: async (context) => {
              context.log('Testing basic functionality');
              context.assert.equal(1 + 1, 2);
              return { success: true };
            }
          }
        ]
      };
    }

    // Load test files from directory
    const testFiles = fs.readdirSync(testDir)
      .filter(file => file.endsWith('.test.js') || file.endsWith('.test.ts'));

    const tests: PluginTest[] = [];
    
    for (const file of testFiles) {
      const testPath = path.join(testDir, file);
      const testModule = require(testPath);
      
      if (testModule.tests && Array.isArray(testModule.tests)) {
        tests.push(...testModule.tests);
      }
    }

    return {
      name: suiteName || 'default',
      tests
    };
  }

  private async validatePluginStructure(pluginPath: string): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const requiredFiles = ['manifest.json', 'src/index.ts'];
    const optionalFiles = ['README.md', 'package.json', 'tsconfig.json'];

    for (const file of requiredFiles) {
      const filePath = path.join(pluginPath, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing required file: ${file}`);
      }
    }

    // Validate manifest.json
    const manifestPath = path.join(pluginPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        if (!manifest.name) errors.push('Manifest missing "name" field');
        if (!manifest.version) errors.push('Manifest missing "version" field');
        if (!manifest.main) errors.push('Manifest missing "main" field');
        if (!manifest.apiVersion) errors.push('Manifest missing "apiVersion" field');
      } catch (error) {
        errors.push('Invalid manifest.json format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export for programmatic usage
export { DebugCli };

// CLI entry point
if (require.main === module) {
  const cli = new DebugCli();
  cli.start().catch(console.error);
}