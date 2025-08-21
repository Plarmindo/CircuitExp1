import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import winston from 'winston';
import { config } from 'dotenv';

import { PluginKitConfig } from './types/config';
import { HealthController } from './controllers/health';
import { CompletionController } from './controllers/completion';
import { ReviewController } from './controllers/review';
import { AnalysisController } from './controllers/analysis';
import { ChatController } from './controllers/chat';
import { ConfigController } from './controllers/config';
import { AIService } from './services/ai';
import { CacheService } from './services/cache';
import { LoggerService } from './services/logger';
import { ValidationService } from './services/validation';
import { SecurityService } from './services/security';
import { MetricsService } from './services/metrics';

// Load environment variables
config();

class BasicExternalPlugin {
  private app: express.Application;
  private server: any;
  private io: Server;
  private config: PluginKitConfig;
  private logger: winston.Logger;
  
  private healthController: HealthController;
  private completionController: CompletionController;
  private reviewController: ReviewController;
  private analysisController: AnalysisController;
  private chatController: ChatController;
  private configController: ConfigController;
  
  private aiService: AIService;
  private cacheService: CacheService;
  private validationService: ValidationService;
  private securityService: SecurityService;
  private metricsService: MetricsService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.loadConfig();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupErrorHandling();
  }

  private loadConfig(): void {
    try {
      this.config = require('../plugin-kit.config.json');
      this.logger = LoggerService.createLogger(this.config.logging);
      this.logger.info('Configuration loaded successfully');
    } catch (error) {
      console.error('Failed to load configuration:', error);
      process.exit(1);
    }
  }

  private initializeServices(): void {
    this.cacheService = new CacheService(this.config.storage.cache);
    this.validationService = new ValidationService();
    this.securityService = new SecurityService(this.config.security);
    this.metricsService = new MetricsService();
    this.aiService = new AIService(this.config.ai, this.cacheService, this.logger);
    
    this.healthController = new HealthController(this.metricsService);
    this.completionController = new CompletionController(this.aiService, this.validationService, this.securityService);
    this.reviewController = new ReviewController(this.aiService, this.validationService, this.securityService);
    this.analysisController = new AnalysisController(this.aiService, this.validationService, this.securityService);
    this.chatController = new ChatController(this.aiService, this.validationService, this.securityService);
    this.configController = new ConfigController(this.config);
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    if (this.config.api.cors.enabled) {
      this.app.use(cors({
        origin: this.config.api.cors.origins,
        methods: this.config.api.cors.methods,
        allowedHeaders: this.config.api.cors.headers
      }));
    }
    
    // Rate limiting
    if (this.config.api.rateLimit.enabled) {
      const limiter = rateLimit({
        windowMs: this.config.api.rateLimit.windowMs,
        max: this.config.api.rateLimit.maxRequests,
        message: {
          error: 'Too many requests',
          retryAfter: Math.ceil(this.config.api.rateLimit.windowMs / 1000)
        }
      });
      this.app.use(limiter);
    }
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
    
    // Metrics middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        this.metricsService.recordRequest({
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: Date.now() - start
        });
      });
      next();
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/health', this.healthController.router);
    this.app.use('/api/completion', this.completionController.router);
    this.app.use('/api/review', this.reviewController.router);
    this.app.use('/api/analysis', this.analysisController.router);
    this.app.use('/api/chat', this.chatController.router);
    this.app.use('/api/config', this.configController.router);
    
    // API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json({
        name: this.config.name,
        version: this.config.version,
        description: this.config.description,
        endpoints: this.config.api.endpoints,
        documentation: 'https://github.com/CircuitExp1/plugin-kit-external'
      });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      this.logger.info('Client connected', { socketId: socket.id });
      
      socket.on('completion:request', async (data) => {
        try {
          const result = await this.completionController.handleSocketRequest(data);
          socket.emit('completion:response', result);
        } catch (error) {
          socket.emit('completion:error', { error: error.message });
        }
      });
      
      socket.on('chat:request', async (data) => {
        try {
          const result = await this.chatController.handleSocketRequest(data);
          socket.emit('chat:response', result);
        } catch (error) {
          socket.emit('chat:error', { error: error.message });
        }
      });
      
      socket.on('disconnect', () => {
        this.logger.info('Client disconnected', { socketId: socket.id });
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
      });
    });
    
    // Error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });
      
      res.status(error.status || 500).json({
        error: error.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });
  }

  public async start(port?: number, host?: string): Promise<void> {
    const PORT = port || process.env.PORT || 3000;
    const HOST = host || process.env.HOST || 'localhost';
    
    return new Promise((resolve, reject) => {
      this.server.listen(PORT, HOST, (error?: any) => {
        if (error) {
          this.logger.error('Failed to start server', { error: error.message });
          reject(error);
        } else {
          this.logger.info('Server started', { host: HOST, port: PORT });
          resolve();
        }
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.logger.info('Server stopped');
        resolve();
      });
    });
  }

  public getMetrics(): any {
    return this.metricsService.getMetrics();
  }

  public getConfig(): PluginKitConfig {
    return this.config;
  }
}

// Export for programmatic usage
export { BasicExternalPlugin };

// CLI entry point
if (require.main === module) {
  const plugin = new BasicExternalPlugin();
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await plugin.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await plugin.stop();
    process.exit(0);
  });
  
  // Start the server
  plugin.start().catch((error) => {
    console.error('Failed to start plugin:', error);
    process.exit(1);
  });
}