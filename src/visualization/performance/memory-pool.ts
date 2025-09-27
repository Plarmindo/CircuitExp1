/**
 * Memory Pool Manager
 * Optimizes object allocation and reduces garbage collection pressure for large datasets
 */

import type { LayoutPointV2 } from '../layout-v2';
import type { ScanNode } from '../../shared/scan-types';

export interface PoolStats {
  totalAllocated: number;
  totalReleased: number;
  currentInUse: number;
  poolSize: number;
  hitRate: number;
  memoryUsage: number;
}

export interface PoolOptions {
  /** Initial pool size */
  initialSize: number;
  /** Maximum pool size */
  maxSize: number;
  /** Enable automatic pool growth */
  autoGrow: boolean;
  /** Growth factor when expanding pool */
  growthFactor: number;
  /** Enable pool shrinking when usage is low */
  autoShrink: boolean;
  /** Shrink threshold (percentage of pool unused) */
  shrinkThreshold: number;
}

const DEFAULT_POOL_OPTIONS: PoolOptions = {
  initialSize: 100,
  maxSize: 10000,
  autoGrow: true,
  growthFactor: 1.5,
  autoShrink: true,
  shrinkThreshold: 0.75,
};

/**
 * Generic object pool for reusing objects
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private reset: (obj: T) => void;
  private options: PoolOptions;
  private stats = {
    allocated: 0,
    released: 0,
    hits: 0,
    misses: 0,
  };

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    options: Partial<PoolOptions> = {}
  ) {
    this.factory = factory;
    this.reset = reset;
    this.options = { ...DEFAULT_POOL_OPTIONS, ...options };
    
    // Pre-populate pool
    this.grow(this.options.initialSize);
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    let obj: T;
    
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
      this.stats.hits++;
    } else {
      // Pool is empty, create new object
      if (this.options.autoGrow && this.getTotalSize() < this.options.maxSize) {
        this.grow(Math.min(
          Math.ceil(this.getTotalSize() * (this.options.growthFactor - 1)),
          this.options.maxSize - this.getTotalSize()
        ));
        obj = this.pool.pop() || this.factory();
      } else {
        obj = this.factory();
      }
      this.stats.misses++;
    }
    
    this.inUse.add(obj);
    this.stats.allocated++;
    return obj;
  }

  /**
   * Release an object back to the pool
   */
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      console.warn('[ObjectPool] Attempting to release object not acquired from pool');
      return;
    }
    
    this.inUse.delete(obj);
    this.reset(obj);
    
    if (this.pool.length < this.options.maxSize) {
      this.pool.push(obj);
    }
    
    this.stats.released++;
    
    // Auto-shrink if enabled
    if (this.options.autoShrink) {
      this.checkShrink();
    }
  }

  /**
   * Release multiple objects
   */
  releaseAll(objects: T[]): void {
    for (const obj of objects) {
      this.release(obj);
    }
  }

  /**
   * Grow the pool by adding new objects
   */
  private grow(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.getTotalSize() >= this.options.maxSize) break;
      this.pool.push(this.factory());
    }
  }

  /**
   * Check if pool should be shrunk
   */
  private checkShrink(): void {
    const totalSize = this.getTotalSize();
    const unusedRatio = this.pool.length / totalSize;
    
    if (unusedRatio > this.options.shrinkThreshold && totalSize > this.options.initialSize) {
      const targetSize = Math.max(
        this.options.initialSize,
        Math.ceil(totalSize * (1 - this.options.shrinkThreshold))
      );
      const toRemove = totalSize - targetSize;
      this.pool.splice(0, Math.min(toRemove, this.pool.length));
    }
  }

  /**
   * Get total pool size (available + in use)
   */
  private getTotalSize(): number {
    return this.pool.length + this.inUse.size;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    
    return {
      totalAllocated: this.stats.allocated,
      totalReleased: this.stats.released,
      currentInUse: this.inUse.size,
      poolSize: this.pool.length,
      hitRate,
      memoryUsage: this.getTotalSize() * 64, // Rough estimate
    };
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.pool = [];
    this.inUse.clear();
    this.stats = { allocated: 0, released: 0, hits: 0, misses: 0 };
  }
}

/**
 * Memory pool manager for visualization objects
 */
export class MemoryPoolManager {
  private layoutPointPool: ObjectPool<LayoutPointV2>;
  private nodeArrayPool: ObjectPool<ScanNode[]>;
  private coordinatePool: ObjectPool<{ x: number; y: number }>;
  private boundingBoxPool: ObjectPool<{ x: number; y: number; width: number; height: number }>;
  private transformPool: ObjectPool<{ scale: number; translateX: number; translateY: number }>;

  constructor() {
    // Layout point pool
    this.layoutPointPool = new ObjectPool<LayoutPointV2>(
      () => ({ path: '', x: 0, y: 0, depth: 0 }),
      (obj) => {
        obj.path = '';
        obj.x = 0;
        obj.y = 0;
        obj.depth = 0;
      },
      { initialSize: 1000, maxSize: 50000 }
    );

    // Node array pool for batching
    this.nodeArrayPool = new ObjectPool<ScanNode[]>(
      () => [],
      (arr) => arr.length = 0,
      { initialSize: 50, maxSize: 500 }
    );

    // Coordinate pool for calculations
    this.coordinatePool = new ObjectPool<{ x: number; y: number }>(
      () => ({ x: 0, y: 0 }),
      (obj) => {
        obj.x = 0;
        obj.y = 0;
      },
      { initialSize: 200, maxSize: 2000 }
    );

    // Bounding box pool
    this.boundingBoxPool = new ObjectPool<{ x: number; y: number; width: number; height: number }>(
      () => ({ x: 0, y: 0, width: 0, height: 0 }),
      (obj) => {
        obj.x = 0;
        obj.y = 0;
        obj.width = 0;
        obj.height = 0;
      },
      { initialSize: 100, maxSize: 1000 }
    );

    // Transform pool for viewport calculations
    this.transformPool = new ObjectPool<{ scale: number; translateX: number; translateY: number }>(
      () => ({ scale: 1, translateX: 0, translateY: 0 }),
      (obj) => {
        obj.scale = 1;
        obj.translateX = 0;
        obj.translateY = 0;
      },
      { initialSize: 50, maxSize: 200 }
    );
  }

  /**
   * Acquire a layout point from the pool
   */
  acquireLayoutPoint(): LayoutPointV2 {
    return this.layoutPointPool.acquire();
  }

  /**
   * Release a layout point back to the pool
   */
  releaseLayoutPoint(point: LayoutPointV2): void {
    this.layoutPointPool.release(point);
  }

  /**
   * Release multiple layout points
   */
  releaseLayoutPoints(points: LayoutPointV2[]): void {
    this.layoutPointPool.releaseAll(points);
  }

  /**
   * Acquire a node array from the pool
   */
  acquireNodeArray(): ScanNode[] {
    return this.nodeArrayPool.acquire();
  }

  /**
   * Release a node array back to the pool
   */
  releaseNodeArray(array: ScanNode[]): void {
    this.nodeArrayPool.release(array);
  }

  /**
   * Acquire a coordinate object from the pool
   */
  acquireCoordinate(): { x: number; y: number } {
    return this.coordinatePool.acquire();
  }

  /**
   * Release a coordinate object back to the pool
   */
  releaseCoordinate(coord: { x: number; y: number }): void {
    this.coordinatePool.release(coord);
  }

  /**
   * Acquire a bounding box from the pool
   */
  acquireBoundingBox(): { x: number; y: number; width: number; height: number } {
    return this.boundingBoxPool.acquire();
  }

  /**
   * Release a bounding box back to the pool
   */
  releaseBoundingBox(box: { x: number; y: number; width: number; height: number }): void {
    this.boundingBoxPool.release(box);
  }

  /**
   * Acquire a transform object from the pool
   */
  acquireTransform(): { scale: number; translateX: number; translateY: number } {
    return this.transformPool.acquire();
  }

  /**
   * Release a transform object back to the pool
   */
  releaseTransform(transform: { scale: number; translateX: number; translateY: number }): void {
    this.transformPool.release(transform);
  }

  /**
   * Create multiple layout points efficiently
   */
  createLayoutPoints(count: number): LayoutPointV2[] {
    const points: LayoutPointV2[] = [];
    for (let i = 0; i < count; i++) {
      points.push(this.acquireLayoutPoint());
    }
    return points;
  }

  /**
   * Batch process layout points with automatic pooling
   */
  batchProcessLayoutPoints<R>(
    count: number,
    processor: (points: LayoutPointV2[]) => R
  ): R {
    const points = this.createLayoutPoints(count);
    try {
      return processor(points);
    } finally {
      this.releaseLayoutPoints(points);
    }
  }

  /**
   * Get comprehensive statistics for all pools
   */
  getStats(): Record<string, PoolStats> {
    return {
      layoutPoints: this.layoutPointPool.getStats(),
      nodeArrays: this.nodeArrayPool.getStats(),
      coordinates: this.coordinatePool.getStats(),
      boundingBoxes: this.boundingBoxPool.getStats(),
      transforms: this.transformPool.getStats(),
    };
  }

  /**
   * Get total memory usage across all pools
   */
  getTotalMemoryUsage(): number {
    const stats = this.getStats();
    return Object.values(stats).reduce((total, stat) => total + stat.memoryUsage, 0);
  }

  /**
   * Get overall hit rate across all pools
   */
  getOverallHitRate(): number {
    const stats = this.getStats();
    const pools = Object.values(stats);
    const totalRequests = pools.reduce((sum, stat) => 
      sum + stat.totalAllocated, 0);
    const totalHits = pools.reduce((sum, stat) => 
      sum + (stat.totalAllocated * stat.hitRate), 0);
    
    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.layoutPointPool.clear();
    this.nodeArrayPool.clear();
    this.coordinatePool.clear();
    this.boundingBoxPool.clear();
    this.transformPool.clear();
  }

  /**
   * Optimize all pools (trigger shrinking if needed)
   */
  optimize(): void {
    // Force a check for shrinking on all pools
    // This is done by temporarily acquiring and releasing objects
    const tempObjects = [
      this.layoutPointPool.acquire(),
      this.nodeArrayPool.acquire(),
      this.coordinatePool.acquire(),
      this.boundingBoxPool.acquire(),
      this.transformPool.acquire(),
    ];
    
    this.layoutPointPool.release(tempObjects[0]);
    this.nodeArrayPool.release(tempObjects[1]);
    this.coordinatePool.release(tempObjects[2]);
    this.boundingBoxPool.release(tempObjects[3]);
    this.transformPool.release(tempObjects[4]);
  }
}

// Global memory pool manager instance
export const memoryPoolManager = new MemoryPoolManager();