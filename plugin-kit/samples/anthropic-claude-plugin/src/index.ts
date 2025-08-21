import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { AIService } from './services/ai';
import { ValidationService } from './services/validation';
import { LoggerService } from './services/logger';
import { MetricsService } from './services/metrics';
import { SecurityService } from './services/security';
import { CacheService } from './services/cache';

import { HealthController } from './controllers/health';
import { CompletionController } from './controllers/completion';
import { ReviewController } from './controllers/review';
import { AnalysisController } from './controllers/analysis';
import { ChatController } from './controllers/chat';
import { ConfigController } from './controllers/config';

// Load environment variables
dotenv.config();

class AnthropicClaudePlugin {
  private app: express.Application;
  private port: number;
  private host: string;
  private logger: LoggerService;
  private metrics: MetricsService;
  private cache: CacheService;
  private security: SecurityService;
  private validation: ValidationService;
  private ai: AIService;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3001', 10);
    this.host = process.env.HOST || 'localhost';

    // Initialize services
    this.logger = new LoggerService();
    this.metrics = new MetricsService();
    this.cache = new CacheService(this.logger);
    this.security = new SecurityService(this.logger, this.cache);
    this.validation = new ValidationService();
    this.ai = new AIService(this.logger);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
    this.app.use(cors({
      origin: corsOrigins,
      credentials: true
    }));

    // Rate limiting
    const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
    const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
    
    this.app.use(rateLimit({
      windowMs: rateLimitWindowMs,
      max: rateLimitMaxRequests,
      message: {
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Custom key generator for API key-based rate limiting
      keyGenerator: (req) => {
        return (req.headers['x-api-key'] as string || req.ip) as string;
      }
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        apiKey: req.headers['x-api-key'] ? '[REDACTED]' : 'none'
      });
      next();
    });

    // API key validation middleware
    this.app.use((req, res, next) => {
      // Skip API key validation for health endpoints
      if (req.path.startsWith('/health') || req.path.startsWith('/ready') || req.path.startsWith('/live')) {
        return next();
      }

      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'API key is required'
        });
      }

      if (!this.security.validateApiKey(apiKey)) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid API key'
        });
      }

      next();
    });
  }

  private setupRoutes(): void {
    // Initialize controllers
    const healthController = new HealthController(this.metrics, this.logger);
    const completionController = new CompletionController(
      this.ai, this.validation, this.metrics, this.logger
    );
    const reviewController = new ReviewController(
      this.ai, this.validation, this.metrics, this.logger
    );
    const analysisController = new AnalysisController(
      this.ai, this.validation, this.metrics, this.logger
    );
    const chatController = new ChatController(
      this.ai, this.validation, this.metrics, this.logger
    );
    const configController = new ConfigController(this.metrics, this.logger);

    // Health and status endpoints
    this.app.get('/health', (req, res) => healthController.health(req, res));
    this.app.get('/ready', (req, res) => healthController.readiness(req, res));
    this.app.get('/live', (req, res) => healthController.liveness(req, res));

    // API endpoints
    this.app.post('/api/completion', (req, res) => completionController.complete(req, res));
    this.app.post('/api/completion/stream', (req, res) => completionController.completeStream(req, res));
    
    this.app.post('/api/review', (req, res) => reviewController.review(req, res));
    this.app.post('/api/review/quick', (req, res) => reviewController.quickReview(req, res));
    
    this.app.post('/api/analysis', (req, res) => analysisController.analyze(req, res));
    this.app.post('/api/analysis/bugs', (req, res) => analysisController.detectBugs(req, res));
    this.app.post('/api/analysis/tests', (req, res) => analysisController.generateTests(req, res));
    this.app.post('/api/analysis/docs', (req, res) => analysisController.generateDocs(req, res));
    
    this.app.post('/api/chat', (req, res) => chatController.chat(req, res));
    this.app.post('/api/chat/stream', (req, res) => chatController.chatStream(req, res));
    
    this.app.get('/api/config', (req, res) => configController.getConfig(req, res));
    this.app.post('/api/config', (req, res) => configController.updateConfig(req, res));

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Anthropic Claude Plugin',
        version: '1.0.0',
        description: 'AI-powered code completion and analysis plugin using Anthropic Claude',
        endpoints: [
          'GET /health',
          'GET /ready',
          'GET /live',
          'POST /api/completion',
          'POST /api/completion/stream',
          'POST /api/review',
          'POST /api/review/quick',
          'POST /api/analysis',
          'POST /api/analysis/bugs',
          'POST /api/analysis/tests',
          'POST /api/analysis/docs',
          'POST /api/chat',
          'POST /api/chat/stream',
          'GET /api/config'
        ]
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      this.logger.warn('404 Not Found', { path: req.path, method: req.method });
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
      });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled error', error, {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      this.metrics.recordError('unhandled_error', req.path, error.message || 'Unknown error');

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  async start(): Promise<void> {
    try {
      await this.app.listen(this.port, this.host);
      this.logger.info(`Anthropic Claude Plugin started on http://${this.host}:${this.port}`);
      this.logger.info(`Health check available at http://${this.host}:${this.port}/health`);
    } catch (error) {
      this.logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Shutting down server...');
    this.cache.flushAll();
    this.security.cleanup();
    process.exit(0);
  }
}

// Start the plugin if this file is run directly
if (require.main === module) {
  const plugin = new AnthropicClaudePlugin();
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => plugin.stop());
  process.on('SIGINT', () => plugin.stop());
  
  plugin.start();
}

export default AnthropicClaudePlugin;