import { Request, Response } from 'express';
import { MetricsService } from '../services/metrics';
import { LoggerService } from '../services/logger';

export class HealthController {
  constructor(
    private metrics: MetricsService,
    private logger: LoggerService
  ) {}

  async health(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.metrics.getSummary();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: metrics.uptime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        metrics: {
          requests: metrics.requests,
          errors: metrics.errors,
          avgResponseTime: metrics.avgResponseTime,
          availability: metrics.availability,
          totalTokens: metrics.totalTokens
        }
      };

      this.logger.debug('Health check requested', { path: req.path });
      res.json(health);
    } catch (error) {
      this.logger.error('Health check failed', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Internal server error'
      });
    }
  }

  async readiness(req: Request, res: Response): Promise<void> {
    try {
      // Check if services are ready
      const ready = {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          services: true,
          database: true, // Assuming no database for this plugin
          cache: true,
          ai: true // Assuming OpenAI is available
        }
      };

      this.logger.debug('Readiness check requested', { path: req.path });
      res.json(ready);
    } catch (error) {
      this.logger.error('Readiness check failed', error);
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Service unavailable'
      });
    }
  }

  async liveness(req: Request, res: Response): Promise<void> {
    try {
      const alive = {
        status: 'alive',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      };

      this.logger.debug('Liveness check requested', { path: req.path });
      res.json(alive);
    } catch (error) {
      this.logger.error('Liveness check failed', error);
      res.status(500).json({
        status: 'dead',
        timestamp: new Date().toISOString(),
        error: 'Service not responding'
      });
    }
  }
}