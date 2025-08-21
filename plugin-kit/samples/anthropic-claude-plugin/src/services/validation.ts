import Joi from 'joi';

export class ValidationService {
  private schemas = {
    completion: Joi.object({
      code: Joi.string().required().min(1).max(50000),
      language: Joi.string().optional().min(1).max(50),
      context: Joi.string().optional().min(0).max(10000),
      maxTokens: Joi.number().optional().min(10).max(4000),
      temperature: Joi.number().optional().min(0).max(2)
    }),

    review: Joi.object({
      code: Joi.string().required().min(1).max(50000),
      language: Joi.string().optional().min(1).max(50),
      context: Joi.string().optional().min(0).max(10000),
      reviewType: Joi.string().optional().valid('detailed', 'quick').default('detailed')
    }),

    analysis: Joi.object({
      code: Joi.string().required().min(1).max(50000),
      language: Joi.string().optional().min(1).max(50),
      context: Joi.string().optional().min(0).max(10000),
      analysisType: Joi.string().required().valid('performance', 'security', 'complexity', 'maintainability')
    }),

    bugDetection: Joi.object({
      code: Joi.string().required().min(1).max(50000),
      language: Joi.string().optional().min(1).max(50),
      context: Joi.string().optional().min(0).max(10000),
      severity: Joi.string().optional().valid('low', 'medium', 'high', 'all').default('all')
    }),

    testGeneration: Joi.object({
      code: Joi.string().required().min(1).max(50000),
      language: Joi.string().optional().min(1).max(50),
      context: Joi.string().optional().min(0).max(10000),
      testFramework: Joi.string().optional().min(1).max(50),
      coverageTarget: Joi.number().optional().min(0).max(100)
    }),

    documentation: Joi.object({
      code: Joi.string().required().min(1).max(50000),
      language: Joi.string().optional().min(1).max(50),
      context: Joi.string().optional().min(0).max(10000),
      docType: Joi.string().optional().valid('inline', 'summary', 'api').default('summary')
    }),

    chat: Joi.object({
      message: Joi.string().required().min(1).max(10000),
      context: Joi.string().optional().min(0).max(5000),
      history: Joi.array().optional().items(
        Joi.object({
          role: Joi.string().required().valid('user', 'assistant'),
          content: Joi.string().required().min(1).max(10000)
        })
      ).max(50),
      maxTokens: Joi.number().optional().min(10).max(4000),
      temperature: Joi.number().optional().min(0).max(2)
    }),

    apiKey: Joi.string().required().min(10).max(100).pattern(/^[a-zA-Z0-9_-]+$/),

    rateLimit: Joi.object({
      identifier: Joi.string().required().min(1).max(255),
      limit: Joi.number().required().min(1).max(1000),
      windowMs: Joi.number().required().min(1000).max(3600000)
    }),

    healthCheck: Joi.object({
      includeMetrics: Joi.boolean().optional().default(true),
      includeSystem: Joi.boolean().optional().default(true)
    })
  };

  validate(data: any, schemaName: keyof ValidationService['schemas']): { valid: boolean; errors?: string[] } {
    const schema = this.schemas[schemaName];
    if (!schema) {
      return {
        valid: false,
        errors: [`Unknown validation schema: ${schemaName}`]
      };
    }

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return {
        valid: false,
        errors: error.details.map(detail => detail.message)
      };
    }

    return {
      valid: true,
      errors: undefined
    };
  }

  validateAsync(data: any, schemaName: keyof ValidationService['schemas']): Promise<{ valid: boolean; errors?: string[] }> {
    return new Promise((resolve) => {
      const result = this.validate(data, schemaName);
      resolve(result);
    });
  }

  sanitizeInput(input: string): string {
    // Basic sanitization to prevent XSS and injection attacks
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<\s*iframe[^>]*>(.*?)<\/iframe>/gi, '')
      .replace(/<\s*object[^>]*>(.*?)<\/object>/gi, '')
      .replace(/<\s*embed[^>]*>(.*?)<\/embed>/gi, '')
      .trim();
  }

  isValidLanguage(language: string): boolean {
    const validLanguages = [
      'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'go',
      'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'html', 'css',
      'sql', 'bash', 'powershell', 'yaml', 'json', 'xml', 'markdown'
    ];
    
    return validLanguages.includes(language.toLowerCase());
  }

  validateCodeLength(code: string, maxLength: number = 50000): boolean {
    return code.length <= maxLength;
  }

  validateContextLength(context: string, maxLength: number = 10000): boolean {
    return context.length <= maxLength;
  }

  validateApiKeyFormat(apiKey: string): boolean {
    const apiKeySchema = this.schemas.apiKey;
    const { error } = apiKeySchema.validate(apiKey);
    return !error;
  }

  validateRateLimitConfig(config: any): { valid: boolean; errors?: string[] } {
    return this.validate(config, 'rateLimit');
  }

  validateTemperature(temp: number): boolean {
    return temp >= 0 && temp <= 2;
  }

  validateMaxTokens(tokens: number): boolean {
    return tokens >= 10 && tokens <= 4000;
  }

  validateLanguage(language: string): boolean {
    return this.isValidLanguage(language);
  }

  getValidationRules(): Record<string, any> {
    return {
      maxCodeLength: 50000,
      maxContextLength: 10000,
      maxMessageLength: 10000,
      maxHistoryLength: 50,
      temperatureRange: { min: 0, max: 2 },
      maxTokensRange: { min: 10, max: 4000 },
      validLanguages: [
        'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'go',
        'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'html', 'css',
        'sql', 'bash', 'powershell', 'yaml', 'json', 'xml', 'markdown'
      ]
    };
  }

  createValidationError(errors: string[]): { success: false; error: string; details: string[] } {
    return {
      success: false,
      error: 'Validation failed',
      details: errors
    };
  }

  sanitizeAndValidate<T>(
    data: any,
    schemaName: keyof ValidationService['schemas'],
    options: { sanitize?: boolean; maxLength?: number } = {}
  ): { valid: boolean; data?: T; errors?: string[] } {
    const { sanitize = true, maxLength = 50000 } = options;

    // Sanitize string fields
    if (sanitize && typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      
      if (typeof sanitized.code === 'string') {
        sanitized.code = this.sanitizeInput(sanitized.code);
        if (!this.validateCodeLength(sanitized.code, maxLength)) {
          return {
            valid: false,
            errors: [`Code exceeds maximum length of ${maxLength} characters`]
          };
        }
      }
      
      if (typeof sanitized.context === 'string') {
        sanitized.context = this.sanitizeInput(sanitized.context);
        if (!this.validateContextLength(sanitized.context)) {
          return {
            valid: false,
            errors: ['Context exceeds maximum length of 10000 characters']
          };
        }
      }
      
      if (typeof sanitized.message === 'string') {
        sanitized.message = this.sanitizeInput(sanitized.message);
      }

      data = sanitized;
    }

    const validation = this.validate(data, schemaName);
    if (!validation.valid) {
      return validation;
    }

    return {
      valid: true,
      data: data as T
    };
  }
}