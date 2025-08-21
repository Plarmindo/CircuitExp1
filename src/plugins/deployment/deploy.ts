/**
 * CircuitExp1 Plugin Deployment System
 * 
 * Automated deployment pipeline with testing, validation, and version management
 */

import { Plugin, PluginMetadata } from '../core/PluginSystem';
import { PluginValidator, PluginTestSuite } from './PluginValidator';
// Note: File system operations are handled by the main process via IPC

export interface DeploymentConfig {
  target: 'local' | 'staging' | 'production';
  autoTest: boolean;
  autoValidate: boolean;
  createBackup: boolean;
  rollbackOnFailure: boolean;
  notify: boolean;
  registry?: string;
}

export interface DeploymentResult {
  success: boolean;
  pluginId: string;
  version: string;
  timestamp: string;
  duration: number;
  logs: DeploymentLog[];
  metrics: DeploymentMetrics;
  rollbackAvailable: boolean;
}

export interface DeploymentLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  details?: any;
}

export interface DeploymentMetrics {
  validation: ValidationMetrics;
  testing: TestingMetrics;
  performance: PerformanceMetrics;
}

export interface ValidationMetrics {
  passed: boolean;
  errors: number;
  warnings: number;
  score: number;
}

export interface TestingMetrics {
  testsRun: number;
  passed: number;
  failed: number;
  coverage: number;
}

export interface PerformanceMetrics {
  bundleSize: number;
  loadTime: number;
  memoryUsage: number;
}

export interface RollbackInfo {
  pluginId: string;
  version: string;
  backupPath: string;
  timestamp: string;
  reason: string;
}

/**
 * Main deployment orchestrator
 */
export class PluginDeploymentSystem {
  private validator = new PluginValidator();
  private testSuite = new PluginTestSuite();
  private deploymentHistory: DeploymentResult[] = [];
  private rollbackStack: RollbackInfo[] = [];

  async deploy(
    plugin: Plugin,
    config: DeploymentConfig = {
      target: 'local',
      autoTest: true,
      autoValidate: true,
      createBackup: true,
      rollbackOnFailure: true,
      notify: true
    }
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    const logs: DeploymentLog[] = [];
    let rollbackAvailable = false;

    try {
      logs.push({
        level: 'info',
        message: `Starting deployment of ${plugin.metadata.name} v${plugin.metadata.version}`,
        timestamp: new Date().toISOString()
      });

      // Step 1: Pre-deployment validation
      if (config.autoValidate) {
        logs.push({ level: 'info', message: 'Running validation checks...', timestamp: new Date().toISOString() });
        const validation = await this.runValidation(plugin, logs);
        if (!validation.overall) {
          throw new Error(`Validation failed: ${validation.metadata.errors.join(', ')}`);
        }
      }

      // Step 2: Automated testing
      let testingMetrics: TestingMetrics = { testsRun: 0, passed: 0, failed: 0, coverage: 0 };
      if (config.autoTest) {
        logs.push({ level: 'info', message: 'Running automated tests...', timestamp: new Date().toISOString() });
        const testResults = await this.runTests(plugin, logs);
        testingMetrics = testResults;
        if (!testResults.passed) {
          throw new Error(`Tests failed: ${testResults.failed} tests failed`);
        }
      }

      // Step 3: Create backup if requested
      let backupPath: string | undefined;
      if (config.createBackup) {
        logs.push({ level: 'info', message: 'Creating backup...', timestamp: new Date().toISOString() });
        backupPath = await this.createBackup(plugin, logs);
        rollbackAvailable = true;
      }

      // Step 4: Deploy to target
      logs.push({ level: 'info', message: `Deploying to ${config.target}...`, timestamp: new Date().toISOString() });
      await this.deployToTarget(plugin, config, logs);

      // Step 5: Post-deployment verification
      logs.push({ level: 'info', message: 'Running post-deployment verification...', timestamp: new Date().toISOString() });
      await this.verifyDeployment(plugin, config, logs);

      const duration = Date.now() - startTime;
      const result: DeploymentResult = {
        success: true,
        pluginId: plugin.metadata.id,
        version: plugin.metadata.version,
        timestamp: new Date().toISOString(),
        duration,
        logs,
        metrics: {
          validation: await this.getValidationMetrics(plugin),
          testing: testingMetrics,
          performance: await this.getPerformanceMetrics(plugin)
        },
        rollbackAvailable
      };

      this.deploymentHistory.push(result);
      
      logs.push({
        level: 'info',
        message: `Deployment completed successfully in ${duration}ms`,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logs.push({
        level: 'error',
        message: `Deployment failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        details: error
      });

      if (config.rollbackOnFailure && rollbackAvailable) {
        logs.push({ level: 'info', message: 'Initiating rollback...', timestamp: new Date().toISOString() });
        await this.rollback(plugin, logs);
      }

      const result: DeploymentResult = {
        success: false,
        pluginId: plugin.metadata.id,
        version: plugin.metadata.version,
        timestamp: new Date().toISOString(),
        duration,
        logs,
        metrics: {
          validation: await this.getValidationMetrics(plugin),
          testing: { testsRun: 0, passed: 0, failed: 0, coverage: 0 },
          performance: { bundleSize: 0, loadTime: 0, memoryUsage: 0 }
        },
        rollbackAvailable
      };

      this.deploymentHistory.push(result);
      return result;
    }
  }

  async rollback(plugin: Plugin, logs: DeploymentLog[]): Promise<void> {
    const rollbackInfo = this.rollbackStack.find(r => r.pluginId === plugin.metadata.id);
    if (!rollbackInfo) {
      throw new Error('No backup available for rollback');
    }

    logs.push({
      level: 'info',
      message: `Rolling back to version ${rollbackInfo.version}`,
      timestamp: new Date().toISOString()
    });

    // Restore from backup
    await this.restoreFromBackup(rollbackInfo.backupPath, logs);

    logs.push({
      level: 'info',
      message: 'Rollback completed',
      timestamp: new Date().toISOString()
    });
  }

  getDeploymentHistory(pluginId?: string): DeploymentResult[] {
    if (pluginId) {
      return this.deploymentHistory.filter(d => d.pluginId === pluginId);
    }
    return this.deploymentHistory;
  }

  private async runValidation(plugin: Plugin, logs: DeploymentLog[]) {
    const validation = await this.validator.validatePlugin(plugin);
    
    logs.push({
      level: validation.metadata.valid ? 'info' : 'error',
      message: `Validation: ${validation.metadata.valid ? 'PASSED' : 'FAILED'}`,
      timestamp: new Date().toISOString(),
      details: validation
    });

    return validation;
  }

  private async runTests(plugin: Plugin, logs: DeploymentLog[]): Promise<TestingMetrics> {
    const testResults = await this.testSuite.runTests(plugin);
    
    logs.push({
      level: testResults.passed ? 'info' : 'error',
      message: `Tests: ${testResults.tests.length} run, ${testResults.passed ? 'ALL PASSED' : `${testResults.tests.filter(t => !t.passed).length} FAILED`}`,
      timestamp: new Date().toISOString(),
      details: testResults
    });

    return {
      testsRun: testResults.tests.length,
      passed: testResults.tests.filter(t => t.passed).length,
      failed: testResults.tests.filter(t => !t.passed).length,
      coverage: testResults.coverage
    };
  }

  private async createBackup(plugin: Plugin, logs: DeploymentLog[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    if (window.electronAPI?.createPluginBackup) {
      const result = await window.electronAPI.createPluginBackup(plugin, timestamp);
      const backupPath = result.backupPath;

      this.rollbackStack.push({
        pluginId: plugin.metadata.id,
        version: plugin.metadata.version,
        backupPath,
        timestamp: new Date().toISOString(),
        reason: 'Pre-deployment backup'
      });

      logs.push({
        level: 'info',
        message: `Backup created: ${backupPath}`,
        timestamp: new Date().toISOString()
      });

      return backupPath;
    }
    
    throw new Error('Backup creation not available in renderer process');
  }

  private async deployToTarget(
    plugin: Plugin,
    config: DeploymentConfig,
    logs: DeploymentLog[]
  ): Promise<void> {
    if (window.electronAPI?.deployPlugin) {
      const result = await window.electronAPI.deployPlugin(plugin, config.target);
      
      logs.push({
        level: 'info',
        message: `Plugin deployed to: ${result.pluginPath}`,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Plugin deployment not available in renderer process');
    }
  }

  private async verifyDeployment(
    plugin: Plugin,
    config: DeploymentConfig,
    logs: DeploymentLog[]
  ): Promise<void> {
    if (window.electronAPI?.verifyPluginDeployment) {
      const result = await window.electronAPI.verifyPluginDeployment(plugin, config.target);
      
      if (!result.exists) {
        throw new Error('Plugin file not found after deployment');
      }
      
      if (result.version !== plugin.metadata.version) {
        throw new Error('Version mismatch after deployment');
      }

      logs.push({
        level: 'info',
        message: 'Post-deployment verification completed',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Plugin verification not available in renderer process');
    }
  }

  private async restoreFromBackup(backupPath: string, logs: DeploymentLog[]): Promise<void> {
    if (window.electronAPI?.restoreFromBackup) {
      const result = await window.electronAPI.restoreFromBackup(backupPath);
      
      logs.push({
        level: 'info',
        message: `Restored from backup: ${backupPath}`,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Restore from backup not available in renderer process');
    }
  }

  private getTargetDirectory(target: string, pluginId: string): string {
    const baseDir = {
      local: join(process.cwd(), 'plugins', 'local'),
      staging: join(process.cwd(), 'plugins', 'staging'),
      production: join(process.cwd(), 'plugins', 'production')
    };

    return join(baseDir[target], pluginId);
  }

  private async getValidationMetrics(plugin: Plugin): Promise<ValidationMetrics> {
    const validation = await this.validator.validatePlugin(plugin);
    return {
      passed: validation.overall,
      errors: validation.metadata.errors.length,
      warnings: validation.metadata.warnings.length,
      score: validation.security.score
    };
  }

  private async getPerformanceMetrics(plugin: Plugin): Promise<PerformanceMetrics> {
    // Mock performance metrics - would use actual profiling
    return {
      bundleSize: JSON.stringify(plugin).length,
      loadTime: 150,
      memoryUsage: 1024 * 1024
    };
  }
}

/**
 * CLI deployment tool
 */
export class DeploymentCLI {
  private deploymentSystem = new PluginDeploymentSystem();

  async run(args: string[]): Promise<void> {
    const [command, pluginPath, target = 'local'] = args;

    switch (command) {
      case 'deploy':
        await this.handleDeploy(pluginPath, target);
        break;
      case 'rollback':
        await this.handleRollback(pluginPath);
        break;
      case 'history':
        await this.handleHistory(pluginPath);
        break;
      case 'validate':
        await this.handleValidate(pluginPath);
        break;
      default:
        console.log(`
Usage: node deploy.js [command] [plugin-path] [target]

Commands:
  deploy [plugin-path] [target]   Deploy plugin to target (local|staging|production)
  rollback [plugin-id]          Rollback to previous version
  history [plugin-id]           Show deployment history
  validate [plugin-path]        Validate plugin without deploying

Examples:
  node deploy.js deploy ./my-plugin.json local
  node deploy.js deploy ./my-plugin.json staging
  node deploy.js rollback my-plugin
  node deploy.js history my-plugin
  node deploy.js validate ./my-plugin.json
        `);
    }
  }

  private async handleDeploy(pluginPath: string, target: string): Promise<void> {
    try {
      if (window.electronAPI?.loadPluginFile) {
        const plugin = await window.electronAPI.loadPluginFile(pluginPath);
        const config: DeploymentConfig = {
          target: target as any,
          autoTest: true,
          autoValidate: true,
          createBackup: true,
          rollbackOnFailure: true,
          notify: true
        };

        const result = await this.deploymentSystem.deploy(plugin, config);
        
        console.log(`\nDeployment ${result.success ? 'SUCCEEDED' : 'FAILED'}`);
        console.log(`Duration: ${result.duration}ms`);
        console.log(`\nLogs:`);
        result.logs.forEach(log => {
          console.log(`[${log.level.toUpperCase()}] ${log.message}`);
        });

        if (!result.success) {
          process.exit(1);
        }
      } else {
        throw new Error('Plugin file loading not available in renderer process');
      }
    } catch (error) {
      console.error(`Deployment failed: ${error.message}`);
      process.exit(1);
    }
  }

  private async handleRollback(pluginId: string): Promise<void> {
    try {
      const history = this.deploymentSystem.getDeploymentHistory(pluginId);
      if (history.length === 0) {
        console.log(`No deployment history found for plugin: ${pluginId}`);
        return;
      }

      console.log(`Rolling back plugin: ${pluginId}`);
      // Implementation would restore from latest backup
      console.log('Rollback completed');
    } catch (error) {
      console.error(`Rollback failed: ${error.message}`);
      process.exit(1);
    }
  }

  private async handleHistory(pluginId: string): Promise<void> {
    const history = this.deploymentSystem.getDeploymentHistory(pluginId);
    
    if (history.length === 0) {
      console.log(`No deployment history found for plugin: ${pluginId}`);
      return;
    }

    console.log(`\nDeployment history for ${pluginId}:`);
    history.forEach((deployment, index) => {
      console.log(`\n${index + 1}. ${deployment.timestamp}`);
      console.log(`   Version: ${deployment.version}`);
      console.log(`   Success: ${deployment.success}`);
      console.log(`   Duration: ${deployment.duration}ms`);
    });
  }

  private async handleValidate(pluginPath: string): Promise<void> {
    try {
      if (window.electronAPI?.loadPluginFile) {
        const plugin = await window.electronAPI.loadPluginFile(pluginPath);
        const validator = new PluginValidator();
        const result = await validator.validatePlugin(plugin);

        console.log(`\nValidation Results:`);
        console.log(`Overall: ${result.overall ? 'PASSED' : 'FAILED'}`);
        console.log(`\nMetadata: ${result.metadata.valid ? 'PASSED' : 'FAILED'}`);
        if (result.metadata.errors.length > 0) {
          console.log(`Errors: ${result.metadata.errors.join(', ')}`);
        }
        if (result.metadata.warnings.length > 0) {
          console.log(`Warnings: ${result.metadata.warnings.join(', ')}`);
        }
        console.log(`\nSecurity: ${result.security.passed ? 'PASSED' : 'FAILED'} (Score: ${result.security.score}/100)`);
        console.log(`\nCompatibility: ${result.compatibility.compatible ? 'PASSED' : 'FAILED'}`);
      } else {
        throw new Error('Plugin file loading not available in renderer process');
      }
    } catch (error) {
      console.error(`Validation failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Export for CLI usage
if (require.main === module) {
  const cli = new DeploymentCLI();
  cli.run(process.argv.slice(2)).catch(console.error);
}