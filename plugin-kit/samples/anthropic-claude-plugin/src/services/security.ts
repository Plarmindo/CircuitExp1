import crypto from 'crypto';
import { LoggerService } from './logger';
import { CacheService } from './cache';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface ApiKeyInfo {
  key: string;
  name: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  isActive: boolean;
  permissions: string[];
}

export class SecurityService {
  private logger: LoggerService;
  private cache: CacheService;
  private apiKeys: Map<string, ApiKeyInfo> = new Map();
  private rateLimits: Map<string, RateLimitConfig> = new Map();

  constructor(logger: LoggerService, cache: CacheService) {
    this.logger = logger;
    this.cache = cache;
    this.initializeApiKeys();
  }

  private initializeApiKeys(): void {
    const apiKeysEnv = process.env.API_KEYS || '';
    const keys = apiKeysEnv.split(',').filter(key => key.trim());
    
    keys.forEach((key, index) => {
      const trimmedKey = key.trim();
      if (trimmedKey) {
        this.apiKeys.set(trimmedKey, {
          key: trimmedKey,
          name: `Default Key ${index + 1}`,
          createdAt: new Date(),
          usageCount: 0,
          isActive: true,
          permissions: ['read', 'write']
        });
      }
    });

    // Add a default key if none provided
    if (this.apiKeys.size === 0) {
      const defaultKey = this.generateApiKey();
      this.apiKeys.set(defaultKey, {
        key: defaultKey,
        name: 'Default Generated Key',
        createdAt: new Date(),
        usageCount: 0,
        isActive: true,
        permissions: ['read', 'write']
      });
    }
  }

  generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  validateApiKey(apiKey: string): boolean {
    const keyInfo = this.apiKeys.get(apiKey);
    
    if (!keyInfo || !keyInfo.isActive) {
      this.logger.warn('Invalid API key attempt', { apiKey: this.maskApiKey(apiKey) });
      return false;
    }

    // Update usage
    keyInfo.lastUsed = new Date();
    keyInfo.usageCount++;
    
    this.logger.info('API key validated', { 
      keyName: keyInfo.name, 
      key: this.maskApiKey(apiKey) 
    });
    
    return true;
  }

  createApiKey(name: string, permissions: string[] = ['read', 'write']): string {
    const key = this.generateApiKey();
    const keyInfo: ApiKeyInfo = {
      key,
      name,
      createdAt: new Date(),
      usageCount: 0,
      isActive: true,
      permissions
    };

    this.apiKeys.set(key, keyInfo);
    this.logger.info('New API key created', { name, key: this.maskApiKey(key) });
    
    return key;
  }

  revokeApiKey(apiKey: string): boolean {
    const keyInfo = this.apiKeys.get(apiKey);
    if (!keyInfo) {
      return false;
    }

    keyInfo.isActive = false;
    this.logger.info('API key revoked', { keyName: keyInfo.name, key: this.maskApiKey(apiKey) });
    
    return true;
  }

  listApiKeys(): Omit<ApiKeyInfo, 'key'>[] {
    return Array.from(this.apiKeys.values())
      .map(({ key, ...keyInfo }) => ({
        ...keyInfo,
        key: this.maskApiKey(key)
      }));
  }

  getApiKeyInfo(apiKey: string): ApiKeyInfo | undefined {
    return this.apiKeys.get(apiKey);
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '***';
    }
    return apiKey.substring(0, 4) + '***' + apiKey.substring(apiKey.length - 4);
  }

  checkRateLimit(identifier: string, config: RateLimitConfig = { windowMs: 900000, maxRequests: 100 }): {
    allowed: boolean;
    resetTime: Date;
    remaining: number;
  } {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get current requests from cache
    const requests = this.cache.get<number[]>(key) || [];
    
    // Filter out old requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= config.maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const resetTime = new Date(oldestRequest + config.windowMs);
      
      this.logger.warn('Rate limit exceeded', {
        identifier,
        current: validRequests.length,
        max: config.maxRequests,
        resetTime
      });

      return {
        allowed: false,
        resetTime,
        remaining: 0
      };
    }

    // Add current request
    validRequests.push(now);
    this.cache.set(key, validRequests, Math.ceil(config.windowMs / 1000));

    return {
      allowed: true,
      resetTime: new Date(now + config.windowMs),
      remaining: config.maxRequests - validRequests.length
    };
  }

  sanitizeInput(input: string): string {
    // Basic HTML sanitization
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<\s*iframe[^>]*>(.*?)<\/iframe>/gi, '')
      .replace(/<\s*object[^>]*>(.*?)<\/object>/gi, '')
      .replace(/<\s*embed[^>]*>(.*?)<\/embed>/gi, '')
      .replace(/[<>]/g, '') // Remove angle brackets
      .trim();
  }

  hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  validateOrigin(origin: string): boolean {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
    return allowedOrigins.some(allowed => {
      const regex = new RegExp(allowed.replace(/\*/g, '.*'));
      return regex.test(origin);
    });
  }

  maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      // Mask potential sensitive data
      if (data.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)) {
        return '[EMAIL_MASKED]';
      }
      if (data.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/)) {
        return '[CREDIT_CARD_MASKED]';
      }
      if (data.match(/\b(?:password|token|key|secret)\s*[:=]\s*\S+/i)) {
        return '[SENSITIVE_DATA_MASKED]';
      }
    }

    if (typeof data === 'object' && data !== null) {
      const masked = { ...data };
      const sensitiveKeys = ['password', 'token', 'key', 'secret', 'api_key', 'apikey', 'private_key'];
      
      for (const key of sensitiveKeys) {
        if (key in masked) {
          masked[key] = '[REDACTED]';
        }
      }
      
      return masked;
    }

    return data;
  }

  generateRequestId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  validateApiKeyPermissions(apiKey: string, requiredPermission: string): boolean {
    const keyInfo = this.apiKeys.get(apiKey);
    if (!keyInfo || !keyInfo.isActive) {
      return false;
    }

    return keyInfo.permissions.includes(requiredPermission);
  }

  getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    };
  }

  cleanup(): void {
    // Clean up expired rate limit keys
    const rateLimitKeys = this.cache.keys().filter(key => key.startsWith('rate_limit:'));
    rateLimitKeys.forEach(key => {
      const requests = this.cache.get<number[]>(key);
      if (requests && requests.length === 0) {
        this.cache.del(key);
      }
    });

    this.logger.info('Security cleanup completed');
  }

  auditLog(action: string, details: any, userId?: string): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      userId: userId || 'system',
      details: this.maskSensitiveData(details),
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    };

    this.logger.info('AUDIT', auditEntry);
  }
}