import crypto from 'crypto';

export class SecurityService {
  private apiKeys: Set<string>;
  private rateLimits: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.apiKeys = new Set();
    this.rateLimits = new Map();
  }

  addApiKey(key: string): void {
    this.apiKeys.add(key);
  }

  removeApiKey(key: string): boolean {
    return this.apiKeys.delete(key);
  }

  validateApiKey(key: string): boolean {
    return this.apiKeys.has(key);
  }

  checkRateLimit(key: string, limit: number = 100, window: number = 60000): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const limitData = this.rateLimits.get(key);

    if (!limitData || now > limitData.resetTime) {
      this.rateLimits.set(key, { count: 1, resetTime: now + window });
      return { allowed: true, remaining: limit - 1, resetTime: now + window };
    }

    if (limitData.count >= limit) {
      return { allowed: false, remaining: 0, resetTime: limitData.resetTime };
    }

    limitData.count++;
    return { allowed: true, remaining: limit - limitData.count, resetTime: limitData.resetTime };
  }

  sanitizeInput(input: string): string {
    // Basic sanitization - replace potential script tags and dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  validateOrigin(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
  }
}