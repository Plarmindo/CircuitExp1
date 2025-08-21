/**
 * Metrics Service for comprehensive application monitoring
 * Tracks performance, usage patterns, and system health
 */
import { createLogger } from '../logger/central-logger';
// Simple browser-compatible EventEmitter for renderer process
class BrowserEventEmitter {
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.listeners.get(event);
    if (!listeners) return false;
    listeners.forEach(listener => listener(...args));
    return true;
  }

  off(event: string, listener: (...args: any[]) => void): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }
}

// Use browser-compatible EventEmitter instead of Node.js events
const EventEmitter = BrowserEventEmitter;

const log = createLogger({ component: 'metrics' });

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: number;
  responseTime?: number;
}

export interface UsageMetric {
  event: string;
  count: number;
  properties?: Record<string, unknown>;
  timestamp: number;
}

class MetricsService extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private usageStats: UsageMetric[] = [];
  private maxMetrics = 1000;
  private maxUsage = 500;

  constructor() {
    super();
    this.startPeriodicHealthChecks();
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    log.debug('Metric recorded', { name, value, unit, tags });
    this.emit('metric', metric);
  }

  /**
   * Record usage analytics (opt-in)
   */
  recordUsage(event: string, properties?: Record<string, unknown>): void {
    const existing = this.usageStats.find((s) => s.event === event);
    if (existing) {
      existing.count++;
      existing.properties = { ...existing.properties, ...properties };
    } else {
      this.usageStats.push({
        event,
        count: 1,
        properties,
        timestamp: Date.now(),
      });
    }

    if (this.usageStats.length > this.maxUsage) {
      this.usageStats = this.usageStats.slice(-this.maxUsage);
    }

    log.debug('Usage recorded', { event, properties });
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, {
      name,
      status: 'healthy',
      lastCheck: Date.now(),
    });

    // Run immediately and then periodically
    this.runHealthCheck(name, checkFn);
    setInterval(() => this.runHealthCheck(name, checkFn), 30000); // Every 30 seconds
  }

  private async runHealthCheck(name: string, checkFn: () => Promise<HealthCheck>): Promise<void> {
    try {
      const startTime = Date.now();
      const result = await checkFn();
      result.responseTime = Date.now() - startTime;
      this.healthChecks.set(name, result);

      if (result.status !== 'healthy') {
        log.warn('Health check failed', { name, status: result.status, message: result.message });
      }
    } catch (error) {
      const failedCheck: HealthCheck = {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: Date.now(),
      };
      this.healthChecks.set(name, failedCheck);
      log.error('Health check error', {
        name,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(limit = 100): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get all health checks
   */
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get overall system health
   */
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheck[];
    summary: Record<string, number>;
  } {
    const checks = this.getHealthChecks();
    const summary = {
      healthy: checks.filter((c) => c.status === 'healthy').length,
      degraded: checks.filter((c) => c.status === 'degraded').length,
      unhealthy: checks.filter((c) => c.status === 'unhealthy').length,
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.unhealthy > 0) status = 'unhealthy';
    else if (summary.degraded > 0) status = 'degraded';

    return { status, checks, summary };
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): UsageMetric[] {
    return this.usageStats;
  }

  /**
   * Export metrics for external systems
   */
  exportMetrics(): {
    metrics: PerformanceMetric[];
    health: HealthCheck[];
    usage: UsageMetric[];
    timestamp: number;
  } {
    return {
      metrics: this.metrics,
      health: this.getHealthChecks(),
      usage: this.usageStats,
      timestamp: Date.now(),
    };
  }

  /**
   * Clear all metrics (for testing)
   */
  clear(): void {
    this.metrics = [];
    this.usageStats = [];
    this.healthChecks.clear();
  }

  private startPeriodicHealthChecks(): void {
    // File system health check
    this.registerHealthCheck('filesystem', async () => {
      try {
        // Check filesystem via IPC if available
        if (window.electronAPI?.checkFilesystem) {
          const result = await window.electronAPI.checkFilesystem();
          return {
            name: 'filesystem',
            status: result.status as 'healthy' | 'degraded' | 'unhealthy',
            message: result.message,
            lastCheck: Date.now(),
          };
        }
        
        return {
          name: 'filesystem',
          status: 'healthy',
          message: 'Filesystem check skipped in renderer',
          lastCheck: Date.now(),
        };
      } catch (error) {
        return {
          name: 'filesystem',
          status: 'unhealthy',
          message: 'File system check failed',
          lastCheck: Date.now(),
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapLimitMB = require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024;
      const usagePercent = (heapUsedMB / heapLimitMB) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Memory usage: ${heapUsedMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%)`;

      if (usagePercent > 90) {
        status = 'unhealthy';
        message += ' - Critical memory usage';
      } else if (usagePercent > 75) {
        status = 'degraded';
        message += ' - High memory usage';
      }

      return {
        name: 'memory',
        status,
        message,
        lastCheck: Date.now(),
      };
    });
  }
}

export const metricsService = new MetricsService();
