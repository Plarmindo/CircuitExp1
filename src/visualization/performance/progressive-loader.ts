/**
 * Progressive Data Loader
 * Handles large dataset loading with chunking, prioritization, and memory management
 */

import type { ScanNode } from '../../shared/scan-types';
import type { GraphAdapter } from '../graph-adapter';
import type { LayoutPointV2 } from '../layout-v2';

export interface LoaderChunk {
  id: string;
  nodes: ScanNode[];
  priority: number;
  estimatedMemory: number;
  loadedAt?: number;
}

export interface LoaderStats {
  totalChunks: number;
  loadedChunks: number;
  pendingChunks: number;
  totalNodes: number;
  loadedNodes: number;
  memoryUsage: number;
  avgLoadTime: number;
  throughput: number; // nodes per second
}

export interface ProgressiveLoaderOptions {
  /** Maximum chunk size in number of nodes */
  maxChunkSize: number;
  /** Maximum memory usage in MB before triggering cleanup */
  maxMemoryMB: number;
  /** Maximum concurrent loading operations */
  maxConcurrency: number;
  /** Delay between chunk loads (ms) to prevent blocking */
  loadDelay: number;
  /** Enable automatic memory cleanup */
  autoCleanup: boolean;
  /** Chunk priority calculation strategy */
  priorityStrategy: 'depth' | 'size' | 'viewport' | 'hybrid';
}

const DEFAULT_OPTIONS: ProgressiveLoaderOptions = {
  maxChunkSize: 500,
  maxMemoryMB: 100,
  maxConcurrency: 3,
  loadDelay: 10,
  autoCleanup: true,
  priorityStrategy: 'hybrid',
};

export class ProgressiveDataLoader {
  private chunks: Map<string, LoaderChunk> = new Map();
  private loadQueue: string[] = [];
  private loadingChunks: Set<string> = new Set();
  private loadedChunks: Set<string> = new Set();
  private loadTimes: number[] = [];
  private options: ProgressiveLoaderOptions;
  private adapter: GraphAdapter;
  private onChunkLoaded?: (chunk: LoaderChunk, layoutNodes: LayoutPointV2[]) => void;
  private onProgress?: (stats: LoaderStats) => void;
  private onMemoryPressure?: (usage: number, limit: number) => void;
  private abortController: AbortController | null = null;

  constructor(
    adapter: GraphAdapter,
    options: Partial<ProgressiveLoaderOptions> = {},
    callbacks: {
      onChunkLoaded?: (chunk: LoaderChunk, layoutNodes: LayoutPointV2[]) => void;
      onProgress?: (stats: LoaderStats) => void;
      onMemoryPressure?: (usage: number, limit: number) => void;
    } = {}
  ) {
    this.adapter = adapter;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.onChunkLoaded = callbacks.onChunkLoaded;
    this.onProgress = callbacks.onProgress;
    this.onMemoryPressure = callbacks.onMemoryPressure;
  }

  /**
   * Load dataset progressively from scan nodes
   */
  async loadDataset(nodes: ScanNode[], viewport?: { x: number; y: number; width: number; height: number }): Promise<void> {
    // Cancel any existing loading operation
    this.abort();
    this.abortController = new AbortController();

    // Clear previous state
    this.clear();

    // Create chunks from nodes
    const chunks = this.createChunks(nodes, viewport);

    // Add chunks to queue in priority order
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
      this.loadQueue.push(chunk.id);
    }

    // Sort queue by priority
    this.loadQueue.sort((a, b) => {
      const chunkA = this.chunks.get(a)!;
      const chunkB = this.chunks.get(b)!;
      return chunkA.priority - chunkB.priority;
    });

    // Start loading process
    await this.processLoadQueue();
  }

  /**
   * Create chunks from scan nodes with priority calculation
   */
  private createChunks(nodes: ScanNode[], viewport?: { x: number; y: number; width: number; height: number }): LoaderChunk[] {
    const chunks: LoaderChunk[] = [];
    const chunkSize = this.options.maxChunkSize;

    // Group nodes by depth and parent for better locality
    const nodesByDepth = new Map<number, ScanNode[]>();
    for (const node of nodes) {
      const depth = node.path.split(/[/\\]/).length;
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth)!.push(node);
    }

    // Create chunks from each depth level
    let chunkIndex = 0;
    for (const [depth, depthNodes] of nodesByDepth) {
      for (let i = 0; i < depthNodes.length; i += chunkSize) {
        const chunkNodes = depthNodes.slice(i, i + chunkSize);
        const chunkId = `chunk_${chunkIndex++}_depth_${depth}`;

        const chunk: LoaderChunk = {
          id: chunkId,
          nodes: chunkNodes,
          priority: this.calculatePriority(chunkNodes, depth, viewport),
          estimatedMemory: this.estimateChunkMemory(chunkNodes),
        };

        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Calculate chunk priority based on strategy
   */
  private calculatePriority(nodes: ScanNode[], depth: number, viewport?: { x: number; y: number; width: number; height: number }): number {
    switch (this.options.priorityStrategy) {
      case 'depth': {
        return depth; // Lower depth = higher priority
      }
      case 'size': {
        return 1000 - nodes.length; // More nodes = higher priority
      }
      case 'viewport': {
        if (!viewport) return depth;
        // Calculate average distance from viewport center
        let totalDistance = 0;
        let validNodes = 0;
        for (const node of nodes) {
          // Estimate position based on path depth and hash
          const x = (node.path.length * 140) % 2000;
          const y = depth * 90;
          const dx = x - (viewport.x + viewport.width / 2);
          const dy = y - (viewport.y + viewport.height / 2);
          totalDistance += Math.sqrt(dx * dx + dy * dy);
          validNodes++;
        }
        return validNodes > 0 ? totalDistance / validNodes : depth * 1000;
      }
      case 'hybrid':
      default: {
        // Combine depth, size, and viewport distance
        const depthScore = depth * 100;
        const sizeScore = (1000 - nodes.length) * 0.1;
        let viewportScore = 0;

        if (viewport) {
          let totalDistance = 0;
          for (const node of nodes) {
            const x = (node.path.length * 140) % 2000;
            const y = depth * 90;
            const dx = x - (viewport.x + viewport.width / 2);
            const dy = y - (viewport.y + viewport.height / 2);
            totalDistance += Math.sqrt(dx * dx + dy * dy);
          }
          viewportScore = (totalDistance / nodes.length) * 0.01;
        }

        return depthScore + sizeScore + viewportScore;
      }
    }
  }

  /**
   * Estimate memory usage for a chunk
   */
  private estimateChunkMemory(nodes: ScanNode[]): number {
    // Rough estimate: each node ~300 bytes (including adapter overhead)
    return nodes.length * 300;
  }

  /**
   * Process the load queue with concurrency control
   */
  private async processLoadQueue(): Promise<void> {
    const promises: Promise<void>[] = [];

    while (this.loadQueue.length > 0 && !this.abortController?.signal.aborted) {
      // Check memory pressure
      if (this.options.autoCleanup) {
        await this.checkMemoryPressure();
      }

      // Limit concurrency
      if (this.loadingChunks.size >= this.options.maxConcurrency) {
        await Promise.race(promises);
        continue;
      }

      const chunkId = this.loadQueue.shift()!;
      const promise = this.loadChunk(chunkId);
      promises.push(promise);

      // Add delay to prevent blocking
      if (this.options.loadDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.options.loadDelay));
      }
    }

    // Wait for all remaining chunks to complete
    await Promise.all(promises);
  }

  /**
   * Load a single chunk
   */
  private async loadChunk(chunkId: string): Promise<void> {
    if (this.abortController?.signal.aborted) return;

    const chunk = this.chunks.get(chunkId);
    if (!chunk || this.loadedChunks.has(chunkId)) return;

    this.loadingChunks.add(chunkId);
    const startTime = performance.now();

    try {
      // Apply chunk nodes to adapter
      const result = this.adapter.applyDelta(chunk.nodes);

      // Generate layout for new nodes (simplified)
      const layoutNodes: LayoutPointV2[] = result.added.map((node, index) => ({
        path: node.path,
        x: index * 140, // Simplified positioning
        y: node.depth * 90,
        depth: node.depth,
      }));

      // Mark as loaded
      chunk.loadedAt = Date.now();
      this.loadedChunks.add(chunkId);

      // Track performance
      const loadTime = performance.now() - startTime;
      this.loadTimes.push(loadTime);
      if (this.loadTimes.length > 100) {
        this.loadTimes.shift(); // Keep only recent measurements
      }

      // Notify callback
      if (this.onChunkLoaded) {
        this.onChunkLoaded(chunk, layoutNodes);
      }

      // Update progress
      if (this.onProgress) {
        this.onProgress(this.getStats());
      }

    } catch (error) {
      console.warn(`[ProgressiveLoader] Failed to load chunk ${chunkId}:`, error);
    } finally {
      this.loadingChunks.delete(chunkId);
    }
  }

  /**
   * Check memory pressure and trigger cleanup if needed
   */
  private async checkMemoryPressure(): Promise<void> {
    const stats = this.getStats();
    const memoryLimitBytes = this.options.maxMemoryMB * 1024 * 1024;

    if (stats.memoryUsage > memoryLimitBytes) {
      if (this.onMemoryPressure) {
        this.onMemoryPressure(stats.memoryUsage, memoryLimitBytes);
      }

      // Trigger cleanup of oldest chunks
      await this.cleanupOldChunks();
    }
  }

  /**
   * Clean up oldest loaded chunks to free memory
   */
  private async cleanupOldChunks(): Promise<void> {
    const loadedChunks = Array.from(this.loadedChunks)
      .map(id => this.chunks.get(id)!)
      .filter(chunk => chunk.loadedAt)
      .sort((a, b) => a.loadedAt! - b.loadedAt!);

    // Remove oldest 25% of chunks
    const toRemove = Math.ceil(loadedChunks.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      const chunk = loadedChunks[i];
      this.loadedChunks.delete(chunk.id);
      // Note: We don't remove from adapter as that would break references
      // Instead, we just mark as unloaded for memory tracking
    }
  }

  /**
   * Get loading statistics
   */
  getStats(): LoaderStats {
    const totalNodes = Array.from(this.chunks.values())
      .reduce((sum, chunk) => sum + chunk.nodes.length, 0);

    const loadedNodes = Array.from(this.loadedChunks)
      .map(id => this.chunks.get(id)!)
      .reduce((sum, chunk) => sum + chunk.nodes.length, 0);

    const memoryUsage = Array.from(this.loadedChunks)
      .map(id => this.chunks.get(id)!)
      .reduce((sum, chunk) => sum + chunk.estimatedMemory, 0);

    const avgLoadTime = this.loadTimes.length > 0
      ? this.loadTimes.reduce((sum, time) => sum + time, 0) / this.loadTimes.length
      : 0;

    const throughput = avgLoadTime > 0
      ? (this.options.maxChunkSize / avgLoadTime) * 1000 // nodes per second
      : 0;

    return {
      totalChunks: this.chunks.size,
      loadedChunks: this.loadedChunks.size,
      pendingChunks: this.loadQueue.length + this.loadingChunks.size,
      totalNodes,
      loadedNodes,
      memoryUsage,
      avgLoadTime,
      throughput,
    };
  }

  /**
   * Abort current loading operation
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.loadQueue = [];
    this.loadingChunks.clear();
  }

  /**
   * Clear all data and reset state
   */
  clear(): void {
    this.abort();
    this.chunks.clear();
    this.loadedChunks.clear();
    this.loadTimes = [];
  }

  /**
   * Update loader options
   */
  updateOptions(options: Partial<ProgressiveLoaderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get chunk by ID
   */
  getChunk(id: string): LoaderChunk | undefined {
    return this.chunks.get(id);
  }

  /**
   * Check if chunk is loaded
   */
  isChunkLoaded(id: string): boolean {
    return this.loadedChunks.has(id);
  }

  /**
   * Get all loaded chunks
   */
  getLoadedChunks(): LoaderChunk[] {
    return Array.from(this.loadedChunks)
      .map(id => this.chunks.get(id)!)
      .filter(Boolean);
  }
}
