/**
 * Health Service for application health monitoring
 * Provides health check endpoints and system status
 */
import { createLogger } from '../logger/central-logger';
import { metricsService } from './metrics-service';
import { getRecentLogs } from '../logger/central-logger';

const log = createLogger({ component: 'health' });

export interface HealthEndpoint {
  path: string;
  handler: () => Promise<HealthResponse>;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, HealthCheckResult>;
  metrics?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  responseTime?: number;
  lastChecked: string;
}

class HealthService {
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private startTime = Date.now();

  constructor() {
    this.registerDefaultChecks();
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFn);
    log.info('Health check registered', { name });
  }

  /**
   * Get application health status
   */
  async getHealth(): Promise<HealthResponse> {
    const checks: Record<string, HealthCheckResult> = {};

    // Run all registered checks
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        const startTime = Date.now();
        const result = await checkFn();
        result.responseTime = Date.now() - startTime;
        checks[name] = result;
      } catch (error) {
        checks[name] = {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString(),
        };
      }
    });

    await Promise.all(checkPromises);

    // Determine overall status
    const hasFailures = Object.values(checks).some((c) => c.status === 'fail');
    const hasWarnings = Object.values(checks).some((c) => c.status === 'warn');

    const status = hasFailures ? 'error' : hasWarnings ? 'ok' : 'ok';

    // Get package version
    const version = this.getVersion();

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      version,
      uptime: Date.now() - this.startTime,
      checks,
      metrics: this.getBasicMetrics(),
    };

    log.debug('Health check completed', { status, checksCount: Object.keys(checks).length });
    return response;
  }

  /**
   * Get basic system metrics
   */
  private getBasicMetrics(): Record<string, unknown> {
    const memUsage = process.memoryUsage();
    const systemMetrics = {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpu: process.cpuUsage(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      recentLogs: getRecentLogs(10),
    };

    return systemMetrics;
  }

  /**
   * Get application version
   */
  private getVersion(): string {
    try {
      // Get version from main process via IPC if available
      if (window.electronAPI?.getAppVersion) {
        return window.electronAPI.getAppVersion() || '0.0.0';
      }
      return '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Memory health check
    this.registerCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

      if (heapUsedMB > 1000) {
        return {
          status: 'fail',
          message: `High memory usage: ${heapUsedMB.toFixed(1)}MB`,
          lastChecked: new Date().toISOString(),
        };
      } else if (heapUsedMB > 500) {
        return {
          status: 'warn',
          message: `Elevated memory usage: ${heapUsedMB.toFixed(1)}MB`,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: 'pass',
        message: `Memory usage normal: ${heapUsedMB.toFixed(1)}MB`,
        lastChecked: new Date().toISOString(),
      };
    });

    // Disk space check
    this.registerCheck('disk_space', async () => {
      try {
        // Check disk space via IPC if available
        if (window.electronAPI?.checkDiskSpace) {
          const result = await window.electronAPI.checkDiskSpace();
          return {
            status: result.status,
            message: result.message,
            lastChecked: new Date().toISOString(),
          };
        }
        
        return {
          status: 'pass',
          message: 'Disk space check skipped in renderer',
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'fail',
          message: `Disk space check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date().toISOString(),
        };
      }
    });

    // Logging system check
    this.registerCheck('logging', async () => {
      const recentLogs = getRecentLogs(5);
      if (recentLogs.length === 0) {
        return {
          status: 'warn',
          message: 'No recent log entries',
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: 'pass',
        message: `Logging system active (${recentLogs.length} recent entries)`,
        lastChecked: new Date().toISOString(),
      };
    });

    // Metrics service check
    this.registerCheck('metrics', async () => {
      const health = metricsService.getSystemHealth();
      if (health.status === 'unhealthy') {
        return {
          status: 'fail',
          message: 'Metrics service reports unhealthy system',
          lastChecked: new Date().toISOString(),
        };
      } else if (health.status === 'degraded') {
        return {
          status: 'warn',
          message: 'Metrics service reports degraded system',
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: 'pass',
        message: 'Metrics service healthy',
        lastChecked: new Date().toISOString(),
      };
    });
  }

  /**
   * Get a simple liveness check
   */
  async getLiveness(): Promise<{ status: 'ok'; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get a readiness check
   */
  async getReadiness(): Promise<{
    status: 'ready' | 'not_ready';
    timestamp: string;
    checks: string[];
  }> {
    const health = await this.getHealth();
    const failingChecks = Object.entries(health.checks)
      .filter(([_, check]) => check.status === 'fail')
      .map(([name]) => name);

    return {
      status: failingChecks.length === 0 ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: failingChecks,
    };
  }
}

export const healthService = new HealthService();
