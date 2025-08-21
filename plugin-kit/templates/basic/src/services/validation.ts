import Joi from 'joi';

export class ValidationService {
  private schemas: Map<string, Joi.Schema>;

  constructor() {
    this.schemas = new Map();
    this.initializeSchemas();
  }

  private initializeSchemas(): void {
    this.schemas.set('completion', Joi.object({
      prompt: Joi.string().required().min(1).max(10000),
      provider: Joi.string().valid('openai', 'anthropic', 'google', 'custom').optional(),
      model: Joi.string().optional(),
      temperature: Joi.number().min(0).max(2).optional(),
      maxTokens: Joi.number().min(1).max(4000).optional()
    }));

    this.schemas.set('review', Joi.object({
      code: Joi.string().required().min(1).max(50000),
      language: Joi.string().optional(),
      rules: Joi.array().items(Joi.string()).optional()
    }));

    this.schemas.set('analysis', Joi.object({
      code: Joi.string().required().min(1).max(50000),
      type: Joi.string().valid('performance', 'security', 'complexity').optional(),
      language: Joi.string().optional()
    }));

    this.schemas.set('chat', Joi.object({
      message: Joi.string().required().min(1).max(1000),
      context: Joi.object().optional(),
      sessionId: Joi.string().uuid().optional()
    }));
  }

  validate(data: any, schemaName: string): { valid: boolean; errors?: string[] } {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      return { valid: false, errors: [`Schema '${schemaName}' not found`] };
    }

    const result = schema.validate(data);
    if (result.error) {
      return {
        valid: false,
        errors: result.error.details.map(detail => detail.message)
      };
    }

    return { valid: true };
  }

  addSchema(name: string, schema: Joi.Schema): void {
    this.schemas.set(name, schema);
  }

  removeSchema(name: string): boolean {
    return this.schemas.delete(name);
  }
}