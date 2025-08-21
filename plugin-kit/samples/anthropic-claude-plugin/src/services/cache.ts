import NodeCache from 'node-cache';
import { LoggerService } from './logger';

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

export class CacheService {
  private cache: NodeCache;
  private logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger;
    
    const ttl = parseInt(process.env.CACHE_TTL || '3600', 10); // Default 1 hour
    const checkperiod = parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10); // Default 10 minutes

    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod,
      useClones: false,
      deleteOnExpire: true
    });

    // Set up event listeners
    this.cache.on('set', (key, value) => {
      this.logger.debug('Cache key set', { key, size: JSON.stringify(value).length });
    });

    this.cache.on('del', (key, value) => {
      this.logger.debug('Cache key deleted', { key });
    });

    this.cache.on('expired', (key, value) => {
      this.logger.debug('Cache key expired', { key });
    });

    this.cache.on('flush', () => {
      this.logger.info('Cache flushed');
    });
  }

  set(key: string, value: any, ttl?: number): boolean {
    try {
      const ttlValue = ttl !== undefined ? ttl : this.cache.options.stdTTL || 3600;
      return this.cache.set(key, value, ttlValue);
    } catch (error) {
      this.logger.error('Error setting cache key', error, { key });
      return false;
    }
  }

  get<T>(key: string): T | undefined {
    try {
      const value = this.cache.get<T>(key);
      if (value !== undefined) {
        this.logger.debug('Cache hit', { key });
      } else {
        this.logger.debug('Cache miss', { key });
      }
      return value;
    } catch (error) {
      this.logger.error('Error getting cache key', error, { key });
      return undefined;
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  del(key: string): number {
    try {
      return this.cache.del(key);
    } catch (error) {
      this.logger.error('Error deleting cache key', error, { key });
      return 0;
    }
  }

  flushAll(): void {
    try {
      this.cache.flushAll();
    } catch (error) {
      this.logger.error('Error flushing cache', error);
    }
  }

  getStats(): CacheStats {
    const stats = this.cache.getStats();
    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys,
      ksize: stats.ksize,
      vsize: stats.vsize
    };
  }

  keys(): string[] {
    return this.cache.keys();
  }

  ttl(key: string, ttl: number): boolean {
    try {
      return this.cache.ttl(key, ttl);
    } catch (error) {
      this.logger.error('Error setting TTL for cache key', error, { key, ttl });
      return false;
    }
  }

  getTtl(key: string): number | undefined {
    try {
      return this.cache.getTtl(key);
    } catch (error) {
      this.logger.error('Error getting TTL for cache key', error, { key });
      return undefined;
    }
  }
}