import NodeCache from 'node-cache';
import { LoggerService } from './logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  maxKeys?: number;
  checkPeriod?: number;
}

export class CacheService {
  private cache: NodeCache;
  private logger: LoggerService;

  constructor(logger: LoggerService, options: CacheOptions = {}) {
    this.logger = logger;
    this.cache = new NodeCache({
      stdTTL: options.ttl || 3600, // 1 hour default
      maxKeys: options.maxKeys || 1000,
      checkperiod: options.checkPeriod || 600, // 10 minutes
      useClones: false
    });

    this.cache.on('set', (key, value) => {
      this.logger.debug(`Cache set: ${key}`, { keys: this.cache.keys().length });
    });

    this.cache.on('del', (key, value) => {
      this.logger.debug(`Cache deleted: ${key}`);
    });

    this.cache.on('expired', (key, value) => {
      this.logger.debug(`Cache expired: ${key}`);
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = this.cache.get<T>(key);
      if (value) {
        this.logger.debug(`Cache hit: ${key}`);
      } else {
        this.logger.debug(`Cache miss: ${key}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}`, error);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const result = this.cache.set(key, value, ttl);
      return result;
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}`, error);
      return false;
    }
  }

  async del(key: string): Promise<number> {
    try {
      const result = this.cache.del(key);
      return result;
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}`, error);
      return 0;
    }
  }

  async flush(): Promise<void> {
    try {
      this.cache.flushAll();
      this.logger.info('Cache flushed');
    } catch (error) {
      this.logger.error('Error flushing cache', error);
    }
  }

  async getStats(): Promise<{
    keys: number;
    hits: number;
    misses: number;
    ksize: number;
    vsize: number;
  }> {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      ksize: stats.ksize,
      vsize: stats.vsize
    };
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async keys(): Promise<string[]> {
    return this.cache.keys();
  }

  async ttl(key: string): Promise<number> {
    return this.cache.getTtl(key) || 0;
  }

  async mget<T>(keys: string[]): Promise<Array<T | undefined>> {
    try {
      const values = this.cache.mget<T>(keys);
      return keys.map(key => values[key]);
    } catch (error) {
      this.logger.error('Error getting multiple cache keys', error);
      return keys.map(() => undefined);
    }
  }

  async mset<T>(data: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean> {
    try {
      const cacheData = data.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, T>);

      const result = this.cache.mset(cacheData);
      return result;
    } catch (error) {
      this.logger.error('Error setting multiple cache keys', error);
      return false;
    }
  }
}