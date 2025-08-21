import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { OpenAI } from 'openai';
import { AIService } from './services/ai';
import { ValidationService } from './services/validation';
import { LoggerService } from './services/logger';
import { MetricsService } from './services/metrics';
import { SecurityService } from './services/security';
import { HealthController } from './controllers/health';
import { CompletionController } from './controllers/completion';
import { ReviewController } from './controllers/review';
import { AnalysisController } from './controllers/analysis';
import { ChatController } from './controllers/chat';
import { ConfigController } from './controllers/config';

export class OpenAIGPTPlugin {
  private app: express.Application;
  private server: any;
  private openai: OpenAI;
  private aiService: AIService;
  private validationService: ValidationService;
  private logger: LoggerService;
  private metrics: MetricsService;
  private security: SecurityService;

  constructor(private config: {
    port: number;
    host: string;
    openaiApiKey: string;
    apiKeys: string[];
    corsOrigins: string[];
    rateLimitWindow: number;
    rateLimitMax: number;
  }) {
    this.app = express();
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    
    this.logger = new LoggerService();
    this.metrics = new MetricsService();
    this.security = new SecurityService(config.apiKeys);
    this.validationService = new ValidationService();
    this.aiService = new AIService(this.openai, this.logger);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors({ origin: this.config.corsOrigins }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    const limiter = rateLimit({
      windowMs: this.config.rateLimitWindow,
      max: this.config.rateLimitMax,
      message: { error: 'Too many requests' }
    });
    this.app.use(limiter);

    this.app.use((req, res, next) => {
      this.metrics.recordRequest();
      this.logger.info(`${req.method} ${req.path}`, { ip: req.ip });
      next();
    });
  }

  private setupRoutes(): void {
    const healthController = new HealthController(this.metrics);
    const completionController = new CompletionController(this.aiService, this.validationService, this.logger);
    const reviewController = new ReviewController(this.aiService, this.validationService, this.logger);
    const analysisController = new AnalysisController(this.aiService, this.validationService, this.logger);
    const chatController = new ChatController(this.aiService, this.validationService, this.logger);
    const configController = new ConfigController();

    this.app.use('/health', healthController.getRouter());
    this.app.use('/api/completion', completionController.getRouter());
    this.app.use('/api/review', reviewController.getRouter());
    this.app.use('/api/analysis', analysisController.getRouter());
    this.app.use('/api/chat', chatController.getRouter());
    this.app.use('/config', configController.getRouter());
  }

  private setupErrorHandling(): void {
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled error', err);
      this.metrics.recordError();
      res.status(500).json({ error: 'Internal server error' });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', reason);
      process.exit(1);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        this.logger.info(`OpenAI GPT Plugin running on ${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.logger.info('Server stopped');
          resolve();
        });
      });
    }
  }

  getApp(): express.Application {
    return this.app;
  }

  getMetrics(): any {
    return this.metrics.getMetrics();
  }
}

// CLI entry point
if (require.main === module) {
  const config = {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    apiKeys: (process.env.API_KEYS || '').split(',').filter(Boolean),
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100')
  };

  if (!config.openaiApiKey) {
    console.error('OPENAI_API_KEY is required');
    process.exit(1);
  }

  const plugin = new OpenAIGPTPlugin(config);
  
  plugin.start().catch(console.error);

  process.on('SIGTERM', () => {
    plugin.stop().catch(console.error);
  });

  process.on('SIGINT', () => {
    plugin.stop().catch(console.error);
  });
}