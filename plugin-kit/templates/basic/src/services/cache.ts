export class CacheService {
  private cache: Map<string, { value: any; expiry: number }>;
  private config: any;

  constructor(config: any) {
    this.config = config;
    this.cache = new Map();
    
    if (config.enabled) {
      this.startCleanupInterval();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null;
    
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.config.enabled) return;
    
    const expiry = Date.now() + (ttl || this.config.ttl) * 1000;
    this.cache.set(key, { value, expiry });
    
    // Ensure cache size limit
    if (this.cache.size > this.config.maxSize) {
      this.evictOldest();
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private evictOldest(): void {
    const oldest = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.expiry - b.expiry)[0];
    
    if (oldest) {
      this.cache.delete(oldest[0]);
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiry) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }
}