/**
 * Virtual Viewport Manager
 * Implements viewport-based culling and progressive loading for large datasets
 */

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface VirtualNode {
  path: string;
  x: number;
  y: number;
  radius: number;
  visible: boolean;
  priority: number; // 0 = highest priority
}

export interface VirtualViewportOptions {
  /** Buffer zone around viewport for preloading (in pixels) */
  bufferZone: number;
  /** Maximum nodes to render simultaneously */
  maxVisibleNodes: number;
  /** Minimum scale threshold for detail rendering */
  detailThreshold: number;
  /** Progressive loading batch size */
  batchSize: number;
  /** Debounce delay for viewport changes (ms) */
  debounceMs: number;
}

const DEFAULT_OPTIONS: VirtualViewportOptions = {
  bufferZone: 200,
  maxVisibleNodes: 1000,
  detailThreshold: 0.5,
  batchSize: 50,
  debounceMs: 16, // ~60fps
};

export class VirtualViewportManager {
  private nodes: VirtualNode[] = [];
  private visibleNodes: Set<string> = new Set();
  private loadingBatches: Map<number, VirtualNode[]> = new Map();
  private viewport: ViewportBounds = { x: 0, y: 0, width: 800, height: 600, scale: 1 };
  private options: VirtualViewportOptions;
  private debounceTimer: number | null = null;
  private onVisibilityChange?: (visible: VirtualNode[], hidden: VirtualNode[]) => void;
  private onProgressiveLoad?: (batch: VirtualNode[], batchIndex: number) => void;

  constructor(
    options: Partial<VirtualViewportOptions> = {},
    callbacks: {
      onVisibilityChange?: (visible: VirtualNode[], hidden: VirtualNode[]) => void;
      onProgressiveLoad?: (batch: VirtualNode[], batchIndex: number) => void;
    } = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.onVisibilityChange = callbacks.onVisibilityChange;
    this.onProgressiveLoad = callbacks.onProgressiveLoad;
  }

  /**
   * Update the dataset with new nodes
   */
  updateNodes(nodes: VirtualNode[]): void {
    this.nodes = nodes;
    this.calculatePriorities();
    this.updateVisibility();
  }

  /**
   * Update viewport bounds and trigger visibility recalculation
   * Validates viewport dimensions to prevent non-finite values
   */
  updateViewport(viewport: ViewportBounds): void {
    // Validate viewport dimensions to prevent non-finite values
    const validatedViewport: ViewportBounds = {
      x: Number.isFinite(viewport.x) ? viewport.x : 0,
      y: Number.isFinite(viewport.y) ? viewport.y : 0,
      width: Math.max(1, Math.min(16384, Number.isFinite(viewport.width) ? Math.abs(viewport.width) : 800)),
      height: Math.max(1, Math.min(16384, Number.isFinite(viewport.height) ? Math.abs(viewport.height) : 600)),
      scale: Math.max(0.001, Number.isFinite(viewport.scale) ? Math.abs(viewport.scale) : 1),
    };

    // Ensure all dimensions are valid
    if (!Number.isFinite(validatedViewport.x) || isNaN(validatedViewport.x)) validatedViewport.x = 0;
    if (!Number.isFinite(validatedViewport.y) || isNaN(validatedViewport.y)) validatedViewport.y = 0;
    if (!Number.isFinite(validatedViewport.width) || isNaN(validatedViewport.width)) validatedViewport.width = 800;
    if (!Number.isFinite(validatedViewport.height) || isNaN(validatedViewport.height)) validatedViewport.height = 600;
    if (!Number.isFinite(validatedViewport.scale) || isNaN(validatedViewport.scale)) validatedViewport.scale = 1;

    this.viewport = validatedViewport;
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = window.setTimeout(() => {
      this.updateVisibility();
      this.debounceTimer = null;
    }, this.options.debounceMs);
  }

  /**
   * Calculate priority scores for nodes based on viewport distance and importance
   */
  private calculatePriorities(): void {
    const centerX = this.viewport.x + this.viewport.width / 2;
    const centerY = this.viewport.y + this.viewport.height / 2;

    for (const node of this.nodes) {
      const dx = node.x - centerX;
      const dy = node.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Priority based on distance from viewport center and node radius
      // Larger nodes and closer nodes get higher priority (lower number)
      node.priority = distance / (node.radius * this.viewport.scale + 1);
    }

    // Sort nodes by priority for efficient processing
    this.nodes.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if a node is within the extended viewport (including buffer zone)
   */
  private isNodeInViewport(node: VirtualNode, includeBuffer = true): boolean {
    const buffer = includeBuffer ? this.options.bufferZone : 0;
    const projectedRadius = node.radius * this.viewport.scale;
    
    return (
      node.x + projectedRadius >= this.viewport.x - buffer &&
      node.x - projectedRadius <= this.viewport.x + this.viewport.width + buffer &&
      node.y + projectedRadius >= this.viewport.y - buffer &&
      node.y - projectedRadius <= this.viewport.y + this.viewport.height + buffer
    );
  }

  /**
   * Update node visibility based on current viewport
   */
  private updateVisibility(): void {
    const newVisibleNodes = new Set<string>();
    const visibleNodeObjects: VirtualNode[] = [];
    const hiddenNodeObjects: VirtualNode[] = [];
    
    let visibleCount = 0;
    const maxVisible = this.options.maxVisibleNodes;
    
    // Process nodes in priority order
    for (const node of this.nodes) {
      const wasVisible = this.visibleNodes.has(node.path);
      const shouldBeVisible = 
        visibleCount < maxVisible &&
        this.isNodeInViewport(node) &&
        this.viewport.scale >= this.options.detailThreshold;
      
      if (shouldBeVisible) {
        newVisibleNodes.add(node.path);
        visibleNodeObjects.push(node);
        visibleCount++;
        node.visible = true;
      } else {
        node.visible = false;
        if (wasVisible) {
          hiddenNodeObjects.push(node);
        }
      }
    }

    // Update visibility tracking
    this.visibleNodes = newVisibleNodes;
    
    // Notify about visibility changes
    if (this.onVisibilityChange && (visibleNodeObjects.length > 0 || hiddenNodeObjects.length > 0)) {
      this.onVisibilityChange(visibleNodeObjects, hiddenNodeObjects);
    }

    // Trigger progressive loading for newly visible areas
    this.scheduleProgressiveLoading();
  }

  /**
   * Schedule progressive loading of nodes in batches
   */
  private scheduleProgressiveLoading(): void {
    const visibleNodes = this.nodes.filter(node => node.visible);
    const batchSize = this.options.batchSize;
    
    // Clear existing batches
    this.loadingBatches.clear();
    
    // Create batches
    for (let i = 0; i < visibleNodes.length; i += batchSize) {
      const batch = visibleNodes.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);
      this.loadingBatches.set(batchIndex, batch);
    }

    // Load batches progressively
    this.loadNextBatch(0);
  }

  /**
   * Load the next batch of nodes
   */
  private loadNextBatch(batchIndex: number): void {
    const batch = this.loadingBatches.get(batchIndex);
    if (!batch) return;

    if (this.onProgressiveLoad) {
      this.onProgressiveLoad(batch, batchIndex);
    }

    // Schedule next batch with a small delay to prevent blocking
    if (this.loadingBatches.has(batchIndex + 1)) {
      requestAnimationFrame(() => {
        this.loadNextBatch(batchIndex + 1);
      });
    }
  }

  /**
   * Get currently visible nodes
   */
  getVisibleNodes(): VirtualNode[] {
    return this.nodes.filter(node => node.visible);
  }

  /**
   * Get viewport statistics
   */
  getStats(): {
    totalNodes: number;
    visibleNodes: number;
    culledNodes: number;
    loadingBatches: number;
    memoryUsage: number;
  } {
    const visibleCount = this.visibleNodes.size;
    const totalCount = this.nodes.length;
    
    return {
      totalNodes: totalCount,
      visibleNodes: visibleCount,
      culledNodes: totalCount - visibleCount,
      loadingBatches: this.loadingBatches.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate memory usage in bytes
   */
  private estimateMemoryUsage(): number {
    // Rough estimate: each node ~200 bytes (object overhead + properties)
    const nodeMemory = this.nodes.length * 200;
    // Visible set overhead
    const setMemory = this.visibleNodes.size * 50;
    // Batch maps overhead
    const batchMemory = this.loadingBatches.size * 100;
    
    return nodeMemory + setMemory + batchMemory;
  }

  /**
   * Force immediate visibility update (bypass debouncing)
   */
  forceUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.updateVisibility();
  }

  /**
   * Clear all data and reset state
   */
  clear(): void {
    this.nodes = [];
    this.visibleNodes.clear();
    this.loadingBatches.clear();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Update configuration options
   */
  updateOptions(options: Partial<VirtualViewportOptions>): void {
    this.options = { ...this.options, ...options };
    this.forceUpdate();
  }
}