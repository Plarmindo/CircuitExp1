import Joi from 'joi';
import { LoggerService } from './logger';

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: string[];
}

export class ValidationService {
  private schemas: Map<string, Joi.Schema> = new Map();
  private logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.initializeSchemas();
  }

  private initializeSchemas(): void {
    // Code completion schema
    this.schemas.set('codeCompletion', Joi.object({
      prompt: Joi.string().min(1).max(10000).required(),
      language: Joi.string().optional(),
      maxTokens: Joi.number().integer().min(1).max(2048).optional(),
      temperature: Joi.number().min(0).max(2).optional(),
      model: Joi.string().optional()
    }));

    // Code review schema
    this.schemas.set('codeReview', Joi.object({
      code: Joi.string().min(1).max(50000).required(),
      language: Joi.string().optional(),
      rules: Joi.array().items(Joi.string()).optional(),
      context: Joi.string().max(5000).optional()
    }));

    // Code analysis schema
    this.schemas.set('codeAnalysis', Joi.object({
      code: Joi.string().min(1).max(50000).required(),
      type: Joi.string().valid('performance', 'security', 'complexity', 'maintainability').required(),
      language: Joi.string().optional(),
      context: Joi.string().max(5000).optional()
    }));

    // Bug detection schema
    this.schemas.set('bugDetection', Joi.object({
      code: Joi.string().min(1).max(50000).required(),
      language: Joi.string().optional(),
      context: Joi.string().max(5000).optional()
    }));

    // Test generation schema
    this.schemas.set('testGeneration', Joi.object({
      code: Joi.string().min(1).max(50000).required(),
      framework: Joi.string().optional(),
      language: Joi.string().optional(),
      testType: Joi.string().valid('unit', 'integration', 'e2e').optional(),
      coverageTarget: Joi.number().min(0).max(100).optional()
    }));

    // Documentation generation schema
    this.schemas.set('documentation', Joi.object({
      code: Joi.string().min(1).max(50000).required(),
      format: Joi.string().valid('jsdoc', 'markdown', 'docstring', 'rst').required(),
      language: Joi.string().optional(),
      style: Joi.string().valid('concise', 'detailed', 'api').optional()
    }));

    // Chat schema
    this.schemas.set('chat', Joi.object({
      message: Joi.string().min(1).max(10000).required(),
      context: Joi.object().optional(),
      sessionId: Joi.string().optional(),
      model: Joi.string().optional(),
      temperature: Joi.number().min(0).max(2).optional()
    }));

    // Health check schema
    this.schemas.set('health', Joi.object({
      detailed: Joi.boolean().optional()
    }));

    // Configuration update schema
    this.schemas.set('configUpdate', Joi.object({
      openai: Joi.object({
        apiKey: Joi.string().min(10).optional(),
        model: Joi.string().optional(),
        temperature: Joi.number().min(0).max(2).optional(),
        maxTokens: Joi.number().integer().min(1).max(2048).optional()
      }).optional(),
      cache: Joi.object({
        ttl: Joi.number().integer().min(60).max(86400).optional(),
        maxKeys: Joi.number().integer().min(100).max(10000).optional()
      }).optional(),
      security: Joi.object({
        rateLimit: Joi.object({
          windowMs: Joi.number().integer().min(1000).max(3600000).optional(),
          max: Joi.number().integer().min(1).max(1000).optional()
        }).optional(),
        cors: Joi.object({
          origins: Joi.array().items(Joi.string().uri()).optional(),
          credentials: Joi.boolean().optional()
        }).optional()
      }).optional()
    }));

    // API key validation schema
    this.schemas.set('apiKey', Joi.object({
      key: Joi.string().min(20).max(100).required()
    }));

    // Rate limit check schema
    this.schemas.set('rateLimit', Joi.object({
      endpoint: Joi.string().required(),
      clientId: Joi.string().required()
    }));
  }

  validate<T>(schemaName: string, data: any): ValidationResult<T> {
    const schema = this.schemas.get(schemaName);
    
    if (!schema) {
      this.logger.error(`Validation schema not found: ${schemaName}`);
      return {
        valid: false,
        errors: [`Validation schema '${schemaName}' not found`]
      };
    }

    const { error, value } = schema.validate(data, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      this.logger.warn(`Validation failed for schema ${schemaName}`, { errors, data });
      
      return {
        valid: false,
        errors
      };
    }

    this.logger.debug(`Validation passed for schema ${schemaName}`, { data });
    return {
      valid: true,
      data: value as T
    };
  }

  addSchema(name: string, schema: Joi.Schema): void {
    this.schemas.set(name, schema);
    this.logger.info(`Added validation schema: ${name}`);
  }

  removeSchema(name: string): boolean {
    const removed = this.schemas.delete(name);
    if (removed) {
      this.logger.info(`Removed validation schema: ${name}`);
    }
    return removed;
  }

  hasSchema(name: string): boolean {
    return this.schemas.has(name);
  }

  getSchema(name: string): Joi.Schema | undefined {
    return this.schemas.get(name);
  }

  getAllSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  validateApiKey(key: string): ValidationResult<{ key: string }> {
    return this.validate('apiKey', { key });
  }

  validateRateLimit(endpoint: string, clientId: string): ValidationResult<{ endpoint: string; clientId: string }> {
    return this.validate('rateLimit', { endpoint, clientId });
  }

  validateConfigUpdate(config: any): ValidationResult<any> {
    return this.validate('configUpdate', config);
  }
}