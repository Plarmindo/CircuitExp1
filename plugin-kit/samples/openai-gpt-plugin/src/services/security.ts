import crypto from 'crypto';
import { LoggerService } from './logger';
import { CacheService } from './cache';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface ApiKey {
  key: string;
  name: string;
  created: Date;
  lastUsed?: Date;
  usageCount: number;
  permissions: string[];
  active: boolean;
}

export class SecurityService {
  private rateLimits: Map<string, RateLimitConfig> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private logger: LoggerService;
  private cache: CacheService;

  constructor(logger: LoggerService, cache: CacheService) {
    this.logger = logger;
    this.cache = cache;
    this.initializeDefaultRateLimits();
  }

  private initializeDefaultRateLimits(): void {
    this.rateLimits.set('default', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });

    this.rateLimits.set('api', {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 1000,
      message: 'API rate limit exceeded'
    });

    this.rateLimits.set('ai', {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50,
      message: 'AI service rate limit exceeded'
    });
  }

  async checkRateLimit(
    identifier: string,
    endpoint: string = 'default'
  ): Promise<{
    allowed: boolean;
    resetTime?: number;
    remaining?: number;
    total?: number;
  }> {
    const config = this.rateLimits.get(endpoint) || this.rateLimits.get('default')!;
    const key = `rate_limit:${endpoint}:${identifier}`;
    
    try {
      const current = await this.cache.get<number>(key);
      const now = Date.now();
      const windowStart = now - config.windowMs;

      if (!current || current < windowStart) {
        // First request or window expired
        await this.cache.set(key, 1, Math.floor(config.windowMs / 1000));
        return {
          allowed: true,
          resetTime: now + config.windowMs,
          remaining: config.max - 1,
          total: config.max
        };
      }

      const count = current;
      if (count >= config.max) {
        this.logger.warn('Rate limit exceeded', { identifier, endpoint, count, max: config.max });
        return {
          allowed: false,
          resetTime: now + config.windowMs,
          remaining: 0,
          total: config.max
        };
      }

      await this.cache.set(key, count + 1, Math.floor(config.windowMs / 1000));
      return {
        allowed: true,
        resetTime: now + config.windowMs,
        remaining: config.max - count - 1,
        total: config.max
      };
    } catch (error) {
      this.logger.error('Error checking rate limit', error);
      // Fail open - allow request if rate limiting fails
      return { allowed: true };
    }
  }

  async validateApiKey(key: string): Promise<{
    valid: boolean;
    key?: ApiKey;
    error?: string;
  }> {
    if (!key || key.length < 20) {
      return { valid: false, error: 'Invalid API key format' };
    }

    const apiKey = this.apiKeys.get(key);
    if (!apiKey) {
      return { valid: false, error: 'API key not found' };
    }

    if (!apiKey.active) {
      return { valid: false, error: 'API key is inactive' };
    }

    // Update usage
    apiKey.lastUsed = new Date();
    apiKey.usageCount++;
    this.apiKeys.set(key, apiKey);

    return { valid: true, key: apiKey };
  }

  generateApiKey(name: string, permissions: string[] = ['read']): ApiKey {
    const key = this.generateSecureKey();
    const apiKey: ApiKey = {
      key,
      name,
      created: new Date(),
      usageCount: 0,
      permissions,
      active: true
    };

    this.apiKeys.set(key, apiKey);
    this.logger.info('Generated new API key', { name, permissions });
    return apiKey;
  }

  revokeApiKey(key: string): boolean {
    const apiKey = this.apiKeys.get(key);
    if (apiKey) {
      apiKey.active = false;
      this.apiKeys.set(key, apiKey);
      this.logger.info('Revoked API key', { key });
      return true;
    }
    return false;
  }

  listApiKeys(): ApiKey[] {
    return Array.from(this.apiKeys.values());
  }

  sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove potential XSS and injection patterns
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .trim();
  }

  sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeInput(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  hashData(data: string, algorithm: 'sha256' | 'sha512' | 'md5' = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  generateSecureKey(): string {
    return `sk_${this.generateSecureToken(32)}`;
  }

  validateOrigin(origin: string, allowedOrigins: string[]): boolean {
    if (!origin) return false;
    
    return allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      if (allowed === origin) return true;
      
      // Handle wildcard patterns
      if (allowed.includes('*')) {
        const regex = new RegExp(allowed.replace(/\*/g, '.*'));
        return regex.test(origin);
      }
      
      return false;
    });
  }

  maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      if (data.length <= 8) return '***';
      return data.substring(0, 4) + '...' + data.substring(data.length - 4);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    if (data && typeof data === 'object') {
      const masked: any = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (['password', 'token', 'secret', 'key', 'apikey', 'auth'].some(s => lowerKey.includes(s))) {
          masked[key] = this.maskSensitiveData(String(value));
        } else {
          masked[key] = this.maskSensitiveData(value);
        }
      }
      return masked;
    }

    return data;
  }

  setRateLimitConfig(endpoint: string, config: RateLimitConfig): void {
    this.rateLimits.set(endpoint, config);
    this.logger.info('Updated rate limit config', { endpoint, config });
  }

  getRateLimitConfig(endpoint: string): RateLimitConfig | undefined {
    return this.rateLimits.get(endpoint);
  }

  async cleanup(): Promise<void> {
    // Clean up expired rate limit keys
    const keys = await this.cache.keys();
    const rateLimitKeys = keys.filter(key => key.startsWith('rate_limit:'));
    
    for (const key of rateLimitKeys) {
      const ttl = await this.cache.ttl(key);
      if (ttl <= 0) {
        await this.cache.del(key);
      }
    }

    this.logger.info('Security service cleanup completed');
  }
}