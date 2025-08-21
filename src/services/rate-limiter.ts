/**
 * Rate Limiting Service
 * 
 * Implements rate limiting for file operations to prevent system abuse
 * and ensure stable performance under high load conditions.
 */

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  maxFileSize: number;
  maxConcurrentScans: number;
  burstLimit: number;
  cooldownMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  reason?: string;
}

export interface UsageStats {
  totalRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
  peakConcurrent: number;
  lastReset: number;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private concurrentScans: Map<string, number> = new Map();
  private fileSizeTracker: Map<string, number> = new Map();
  private stats: UsageStats = {
    totalRequests: 0,
    rejectedRequests: 0,
    averageResponseTime: 0,
    peakConcurrent: 0,
    lastReset: Date.now()
  };
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, this.config.windowMs / 2);
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.config.windowMs;
    
    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(t => t > cutoff);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }

    // Reset stats periodically
    if (Date.now() - this.stats.lastReset >= this.config.windowMs * 10) {
      this.stats = {
        totalRequests: 0,
        rejectedRequests: 0,
        averageResponseTime: 0,
        peakConcurrent: 0,
        lastReset: Date.now()
      };
    }
  }

  public checkRateLimit(identifier: string, operation: string, metadata?: any): RateLimitResult {
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs
      };
    }

    this.stats.totalRequests++;

    // Check concurrent scan limit
    if (operation === 'scan') {
      const currentConcurrent = this.getCurrentConcurrentScans(identifier);
      if (currentConcurrent >= this.config.maxConcurrentScans) {
        this.stats.rejectedRequests++;
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + this.config.cooldownMs,
          retryAfter: this.config.cooldownMs,
          reason: 'Maximum concurrent scans exceeded'
        };
      }
    }

    // Check file size limit
    if (metadata?.fileSize && metadata.fileSize > this.config.maxFileSize) {
      this.stats.rejectedRequests++;
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + this.config.cooldownMs,
        retryAfter: this.config.cooldownMs,
        reason: 'File size exceeds limit'
      };
    }

    // Check rate limit
    const key = `${identifier}:${operation}`;
    const timestamps = this.requests.get(key) || [];
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    const validRequests = timestamps.filter(t => t > cutoff);

    // Burst protection
    const burstKey = `${identifier}:burst`;
    const burstTimestamps = this.requests.get(burstKey) || [];
    const validBurst = burstTimestamps.filter(t => t > now - 1000); // 1 second window

    if (validBurst.length >= this.config.burstLimit) {
      this.stats.rejectedRequests++;
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + 1000,
        retryAfter: 1000,
        reason: 'Burst limit exceeded'
      };
    }

    if (validRequests.length >= this.config.maxRequests) {
      this.stats.rejectedRequests++;
      const oldestRequest = Math.min(...validRequests);
      const resetTime = oldestRequest + this.config.windowMs;
      const retryAfter = Math.max(0, resetTime - now);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter,
        reason: 'Rate limit exceeded'
      };
    }

    // Record the request
    validRequests.push(now);
    validBurst.push(now);
    this.requests.set(key, validRequests);
    this.requests.set(burstKey, validBurst);

    return {
      allowed: true,
      remaining: this.config.maxRequests - validRequests.length,
      resetTime: now + this.config.windowMs
    };
  }

  public startScan(identifier: string): boolean {
    const check = this.checkRateLimit(identifier, 'scan');
    if (check.allowed) {
      const current = this.concurrentScans.get(identifier) || 0;
      this.concurrentScans.set(identifier, current + 1);
      
      // Update peak concurrent
      if (current + 1 > this.stats.peakConcurrent) {
        this.stats.peakConcurrent = current + 1;
      }
    }
    return check.allowed;
  }

  public endScan(identifier: string): void {
    const current = this.concurrentScans.get(identifier) || 0;
    if (current > 0) {
      this.concurrentScans.set(identifier, current - 1);
    }
    if (current - 1 === 0) {
      this.concurrentScans.delete(identifier);
    }
  }

  public checkFileSize(identifier: string, fileSize: number): RateLimitResult {
    return this.checkRateLimit(identifier, 'file_upload', { fileSize });
  }

  public getUsageStats(): UsageStats {
    return { ...this.stats };
  }

  private getCurrentConcurrentScans(identifier: string): number {
    return this.concurrentScans.get(identifier) || 0;
  }

  public getRateLimitStatus(identifier: string, operation: string): RateLimitResult {
    return this.checkRateLimit(identifier, operation);
  }

  public resetRateLimit(identifier: string, operation: string): void {
    const key = `${identifier}:${operation}`;
    this.requests.delete(key);
    this.concurrentScans.delete(identifier);
  }

  public updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  public exportMetrics(): any {
    return {
      config: this.config,
      stats: this.stats,
      activeRequests: Object.fromEntries(this.requests),
      concurrentScans: Object.fromEntries(this.concurrentScans),
      timestamp: Date.now()
    };
  }
}

// Default configuration
export const defaultRateLimitConfig: RateLimitConfig = {
  enabled: true,
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxConcurrentScans: 3,
  burstLimit: 10,
  cooldownMs: 60 * 1000 // 1 minute
};

// Predefined rate limit profiles
export const rateLimitProfiles = {
  strict: {
    maxRequests: 50,
    maxFileSize: 50 * 1024 * 1024,
    maxConcurrentScans: 2,
    burstLimit: 5
  },
  moderate: {
    maxRequests: 100,
    maxFileSize: 100 * 1024 * 1024,
    maxConcurrentScans: 3,
    burstLimit: 10
  },
  relaxed: {
    maxRequests: 200,
    maxFileSize: 500 * 1024 * 1024,
    maxConcurrentScans: 5,
    burstLimit: 20
  }
};