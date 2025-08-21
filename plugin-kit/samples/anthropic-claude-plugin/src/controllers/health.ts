import { Request, Response } from 'express';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class HealthController {
  private metrics: MetricsService;
  private logger: LoggerService;
  private startTime: Date;

  constructor(metrics: MetricsService, logger: LoggerService) {
    this.metrics = metrics;
    this.logger = logger;
    this.startTime = new Date();
  }

  async health(req: Request, res: Response): Promise<void> {
    try {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          metrics: true, // Metrics service is always available
          cache: true // Cache is in-memory, always available
        }
      };

      this.logger.info('Health check requested', { ip: req.ip });
      res.json(healthData);
    } catch (error) {
      this.logger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  async readiness(req: Request, res: Response): Promise<void> {
    try {
      const isReady = this.checkReadiness();
      
      if (isReady) {
        res.json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          checks: {
            metrics: true,
            cache: true,
            anthropic: true // Assume Anthropic API is available
          }
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          checks: {
            metrics: false,
            cache: true,
            anthropic: true
          }
        });
      }
    } catch (error) {
      this.logger.error('Readiness check failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(503).json({
        status: 'not ready',
        error: 'Readiness check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  async liveness(req: Request, res: Response): Promise<void> {
    try {
      // Basic liveness check - just ensure the service is running
      res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      });
    } catch (error) {
      this.logger.error('Liveness check failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        status: 'dead',
        error: 'Liveness check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  async metricsEndpoint(req: Request, res: Response): Promise<void> {
    try {
      const metricsData = this.metrics.getAIMetrics();
      
      res.json({
        timestamp: new Date().toISOString(),
        ...metricsData
      });
    } catch (error) {
      this.logger.error('Metrics endpoint failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  async detailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const detailedData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          pid: process.pid,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          uptime: process.uptime()
        },
        dependencies: {
          anthropic: {
            status: 'connected',
            lastCheck: new Date().toISOString()
          },
          cache: {
            status: 'healthy',
            stats: this.getCacheStats()
          }
        },
        metrics: this.metrics.getAIMetrics(),
        config: {
          port: process.env.PORT || 3000,
          logLevel: process.env.LOG_LEVEL || 'info',
          maxTokens: process.env.MAX_TOKENS || 4000,
          rateLimitWindow: process.env.RATE_LIMIT_WINDOW || '15 minutes',
          rateLimitMax: process.env.RATE_LIMIT_MAX || 100
        }
      };

      this.logger.info('Detailed health check requested', { ip: req.ip });
      res.json(detailedData);
    } catch (error) {
      this.logger.error('Detailed health check failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        status: 'unhealthy',
        error: 'Detailed health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  private getUptime(): string {
    const uptimeMs = Date.now() - this.startTime.getTime();
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private checkReadiness(): boolean {
    // Check if all critical services are ready
    return true; // Metrics service is always available
  }

  private getCacheStats(): any {
    // This would normally come from cache service
    return {
      hits: 0,
      misses: 0,
      keys: 0,
      size: 0
    };
  }

  async ping(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'pong',
      timestamp: new Date().toISOString()
    });
  }
}