/**
 * Delta Update System
 * Efficiently handles incremental updates to minimize full redraws
 */

export interface DeltaChange {
  id: string;
  type: 'add' | 'remove' | 'update' | 'move';
  data?: Record<string, unknown>;
  previousData?: Record<string, unknown>;
  timestamp: number;
  priority: number;
}

export interface UpdateBatch {
  changes: DeltaChange[];
  batchId: string;
  timestamp: number;
  frameTarget: number;
}

export interface DeltaUpdateOptions {
  /** Maximum changes to process per frame */
  maxChangesPerFrame: number;
  /** Batch changes within this time window (ms) */
  batchWindow: number;
  /** Enable change deduplication */
  enableDeduplication: boolean;
  /** Priority threshold for immediate updates */
  immediateUpdateThreshold: number;
  /** Enable change compression */
  enableCompression: boolean;
}

export interface UpdateStats {
  totalChanges: number;
  processedChanges: number;
  batchesProcessed: number;
  averageProcessingTime: number;
  droppedChanges: number;
  compressionRatio: number;
}

const DEFAULT_OPTIONS: DeltaUpdateOptions = {
  maxChangesPerFrame: 100,
  batchWindow: 16, // ~60fps
  enableDeduplication: true,
  immediateUpdateThreshold: 8, // High priority changes
  enableCompression: true,
};

type BatchProcessedListener = (changes: DeltaChange[]) => void;

export class DeltaUpdateManager {
  private pendingChanges: Map<string, DeltaChange> = new Map();
  private processingQueue: UpdateBatch[] = [];
  private options: DeltaUpdateOptions;
  private stats: UpdateStats = {
    totalChanges: 0,
    processedChanges: 0,
    batchesProcessed: 0,
    averageProcessingTime: 0,
    droppedChanges: 0,
    compressionRatio: 1,
  };
  private lastBatchTime = 0;
  private currentBatchId = 0;
  private isProcessing = false;
  private frameRequestId: number | null = null;
  private processingTimes: number[] = [];

  constructor(options: Partial<DeltaUpdateOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Add a change to the update queue
   */
  addChange(change: Omit<DeltaChange, 'timestamp'>): void {
    const fullChange: DeltaChange = {
      ...change,
      timestamp: performance.now(),
    };

    this.stats.totalChanges++;

    // Handle immediate updates for high priority changes
    if (change.priority >= this.options.immediateUpdateThreshold) {
      this.processImmediateChange(fullChange);
      return;
    }

    // Add to pending changes with deduplication
    if (this.options.enableDeduplication) {
      this.deduplicateChange(fullChange);
    } else {
      this.pendingChanges.set(change.id, fullChange);
    }

    // Schedule batch processing
    this.scheduleBatchProcessing();
  }

  /**
   * Process immediate high-priority changes
   */
  private processImmediateChange(change: DeltaChange): void {
    const batch: UpdateBatch = {
      changes: [change],
      batchId: `immediate-${this.currentBatchId++}`,
      timestamp: change.timestamp,
      frameTarget: performance.now(),
    };

    this.processingQueue.unshift(batch); // Add to front of queue
    this.processNextBatch();
  }

  /**
   * Deduplicate changes to avoid redundant updates
   */
  private deduplicateChange(change: DeltaChange): void {
    const existingChange = this.pendingChanges.get(change.id);

    if (existingChange) {
      // Merge changes based on type
      if (change.type === 'remove') {
        // Remove always takes precedence
        this.pendingChanges.set(change.id, change);
      } else if (existingChange.type === 'add' && change.type === 'update') {
        // Merge add + update into single add with updated data
        this.pendingChanges.set(change.id, {
          ...existingChange,
          data: change.data,
          timestamp: change.timestamp,
        });
      } else if (existingChange.type === 'update' && change.type === 'update') {
        // Merge multiple updates
        this.pendingChanges.set(change.id, {
          ...change,
          previousData: existingChange.previousData, // Keep original previous data
        });
      } else {
        // Default: replace with newer change
        this.pendingChanges.set(change.id, change);
      }
    } else {
      this.pendingChanges.set(change.id, change);
    }
  }

  /**
   * Schedule batch processing using requestAnimationFrame
   */
  private scheduleBatchProcessing(): void {
    if (this.frameRequestId !== null) return;

    const now = performance.now();
    const timeSinceLastBatch = now - this.lastBatchTime;

    if (timeSinceLastBatch >= this.options.batchWindow) {
      // Process immediately if batch window has elapsed
      this.frameRequestId = requestAnimationFrame(() => {
        this.createAndProcessBatch();
        this.frameRequestId = null;
      });
    } else {
      // Wait for batch window to complete
      const delay = this.options.batchWindow - timeSinceLastBatch;
      setTimeout(() => {
        this.frameRequestId = requestAnimationFrame(() => {
          this.createAndProcessBatch();
          this.frameRequestId = null;
        });
      }, delay);
    }
  }

  /**
   * Create a batch from pending changes
   */
  private createAndProcessBatch(): void {
    if (this.pendingChanges.size === 0) return;

    const changes = Array.from(this.pendingChanges.values());

    // Sort by priority and timestamp
    changes.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp - b.timestamp; // Earlier timestamp first
    });

    // Apply compression if enabled
    const compressedChanges = this.options.enableCompression
      ? this.compressChanges(changes)
      : changes;

    const batch: UpdateBatch = {
      changes: compressedChanges,
      batchId: `batch-${this.currentBatchId++}`,
      timestamp: performance.now(),
      frameTarget: performance.now() + 16, // Target next frame
    };

    this.processingQueue.push(batch);
    this.pendingChanges.clear();
    this.lastBatchTime = performance.now();

    // Update compression stats
    if (this.options.enableCompression && changes.length > 0) {
      this.stats.compressionRatio = compressedChanges.length / changes.length;
    }

    this.processNextBatch();
  }

  /**
   * Compress changes by removing redundant operations
   */
  private compressChanges(changes: DeltaChange[]): DeltaChange[] {
    const compressed: DeltaChange[] = [];
    const processed = new Set<string>();

    // Process in reverse order to keep latest changes
    for (let i = changes.length - 1; i >= 0; i--) {
      const change = changes[i];

      if (!processed.has(change.id)) {
        compressed.unshift(change); // Add to beginning to maintain order
        processed.add(change.id);
      }
    }

    return compressed;
  }

  /**
   * Process the next batch in the queue
   */
  private async processNextBatch(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;
    const batch = this.processingQueue.shift()!;
    const startTime = performance.now();

    try {
      // Limit changes per frame
      const changesToProcess = batch.changes.slice(0, this.options.maxChangesPerFrame);
      const remainingChanges = batch.changes.slice(this.options.maxChangesPerFrame);

      // Process changes
      await this.processBatch(changesToProcess);

      // If there are remaining changes, create a new batch
      if (remainingChanges.length > 0) {
        const remainingBatch: UpdateBatch = {
          ...batch,
          changes: remainingChanges,
          batchId: `${batch.batchId}-cont`,
        };
        this.processingQueue.unshift(remainingBatch);
      }

      // Update stats
      const processingTime = performance.now() - startTime;
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift(); // Keep only recent measurements
      }

      this.stats.processedChanges += changesToProcess.length;
      this.stats.batchesProcessed++;
      this.stats.averageProcessingTime =
        this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;

      if (remainingChanges.length > 0) {
        this.stats.droppedChanges += remainingChanges.length;
      }

    } catch (error) {
      console.error('Error processing batch:', error);
    } finally {
      this.isProcessing = false;

      // Process next batch if available
      if (this.processingQueue.length > 0) {
        requestAnimationFrame(() => this.processNextBatch());
      }
    }
  }

  /**
   * Process a batch of changes (to be implemented by consumers)
   */
  private async processBatch(changes: DeltaChange[]): Promise<void> {
    // This method should be overridden or use event listeners
    // For now, we'll emit an event that consumers can listen to
    this.emitBatchProcessed(changes);
  }

  /**
   * Event emitter for batch processing
   */
  private listeners: Map<string, BatchProcessedListener[]> = new Map();

  on(event: 'batchProcessed', callback: BatchProcessedListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: 'batchProcessed', callback: BatchProcessedListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emitBatchProcessed(changes: DeltaChange[]): void {
    const listeners = this.listeners.get('batchProcessed') || [];
    listeners.forEach(callback => {
      try {
        callback(changes);
      } catch (error) {
        console.error('Error in batch processed callback:', error);
      }
    });
  }

  /**
   * Get current statistics
   */
  getStats(): UpdateStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalChanges: 0,
      processedChanges: 0,
      batchesProcessed: 0,
      averageProcessingTime: 0,
      droppedChanges: 0,
      compressionRatio: 1,
    };
    this.processingTimes = [];
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<DeltaUpdateOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Clear all pending changes and processing queue
   */
  clear(): void {
    this.pendingChanges.clear();
    this.processingQueue = [];
    if (this.frameRequestId !== null) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }
    this.isProcessing = false;
  }

  /**
   * Get pending changes count
   */
  getPendingCount(): number {
    return this.pendingChanges.size +
           this.processingQueue.reduce((sum, batch) => sum + batch.changes.length, 0);
  }

  /**
   * Force process all pending changes immediately
   */
  flush(): void {
    if (this.pendingChanges.size > 0) {
      this.createAndProcessBatch();
    }

    // Process all queued batches
    while (this.processingQueue.length > 0 && !this.isProcessing) {
      this.processNextBatch();
    }
  }

  /**
   * Destroy the delta updater
   */
  destroy(): void {
    this.clear();
    this.listeners.clear();
  }
}
