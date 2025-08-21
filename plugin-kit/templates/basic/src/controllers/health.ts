import { Router } from 'express';
import { MetricsService } from '../services/metrics';

export class HealthController {
  public router: Router;
  private metricsService: MetricsService;

  constructor(metricsService: MetricsService) {
    this.router = Router();
    this.metricsService = metricsService;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/', this.getHealth.bind(this));
    this.router.get('/ready', this.getReadiness.bind(this));
    this.router.get('/live', this.getLiveness.bind(this));
  }

  private getHealth(req: any, res: any): void {
    const metrics = this.metricsService.getMetrics();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      metrics: {
        requests: metrics.requests,
        errors: metrics.errors,
        performance: metrics.performance
      }
    };

    res.json(health);
  }

  private getReadiness(req: any, res: any): void {
    const isReady = true; // Add actual readiness checks
    
    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString()
    });
  }

  private getLiveness(req: any, res: any): void {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  }
}