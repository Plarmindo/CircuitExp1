import { useEffect, useState, useRef } from 'react';

/**
 * Progressive Loading Optimization
 * RICE Score: 28.0 (Reach: 8, Impact: 3, Confidence: 0.7, Effort: 1.5 weeks)
 * 
 * Manages incremental node rendering as scan results arrive.
 * This hook provides a progressive loading strategy that renders nodes
 * in batches as they arrive from scan:partial events.
 */

export interface ProgressiveLoadingConfig {
  batchSize?: number; // Nodes to render per batch (default: 100)
  batchDelay?: number; // Delay between batches in ms (default: 16ms ~60fps)
  enableSmoothing?: boolean; // Enable smooth animations (default: true)
  maxConcurrentBatches?: number; // Max batches processing simultaneously (default: 3)
}

export interface ProgressiveLoadingState {
  totalNodes: number;
  renderedNodes: number;
  pendingNodes: number;
  isProcessing: boolean;
  progress: number; // 0-100
}

const DEFAULT_CONFIG: Required<ProgressiveLoadingConfig> = {
  batchSize: 100,
  batchDelay: 16, // ~60fps
  enableSmoothing: true,
  maxConcurrentBatches: 3,
};

/**
 * Hook for progressive node loading
 * Batches node rendering to avoid blocking the UI thread
 */
export const useProgressiveLoading = <T,>(
  config: ProgressiveLoadingConfig = {}
) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const [allNodes, setAllNodes] = useState<T[]>([]);
  const [renderedNodes, setRenderedNodes] = useState<T[]>([]);
  const [state, setState] = useState<ProgressiveLoadingState>({
    totalNodes: 0,
    renderedNodes: 0,
    pendingNodes: 0,
    isProcessing: false,
    progress: 0,
  });

  const processingRef = useRef(false);
  const queueRef = useRef<T[]>([]);
  const animationFrameRef = useRef<number>();

  // Process queue in batches
  const processBatch = () => {
    if (!processingRef.current || queueRef.current.length === 0) {
      processingRef.current = false;
      setState(prev => ({ ...prev, isProcessing: false }));
      return;
    }

    const batch = queueRef.current.splice(0, cfg.batchSize);
    
    setRenderedNodes(prev => {
      const updated = [...prev, ...batch];
      
      setState({
        totalNodes: allNodes.length,
        renderedNodes: updated.length,
        pendingNodes: queueRef.current.length,
        isProcessing: queueRef.current.length > 0,
        progress: allNodes.length > 0 
          ? (updated.length / allNodes.length) * 100 
          : 0,
      });
      
      return updated;
    });

    // Schedule next batch
    if (queueRef.current.length > 0) {
      animationFrameRef.current = window.setTimeout(processBatch, cfg.batchDelay);
    } else {
      processingRef.current = false;
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Add nodes to rendering queue
  const addNodes = (nodes: T[]) => {
    setAllNodes(prev => {
      const updated = [...prev, ...nodes];
      
      // Add to queue for progressive rendering
      queueRef.current.push(...nodes);
      
      // Start processing if not already running
      if (!processingRef.current) {
        processingRef.current = true;
        setState(prev => ({ ...prev, isProcessing: true }));
        processBatch();
      }
      
      return updated;
    });
  };

  // Reset all state
  const reset = () => {
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
    }
    processingRef.current = false;
    queueRef.current = [];
    setAllNodes([]);
    setRenderedNodes([]);
    setState({
      totalNodes: 0,
      renderedNodes: 0,
      pendingNodes: 0,
      isProcessing: false,
      progress: 0,
    });
  };

  // Force immediate render of all pending nodes (skip progressive loading)
  const renderAll = () => {
    if (queueRef.current.length > 0) {
      const remaining = [...queueRef.current];
      queueRef.current = [];
      setRenderedNodes(prev => {
        const updated = [...prev, ...remaining];
        setState({
          totalNodes: allNodes.length,
          renderedNodes: updated.length,
          pendingNodes: 0,
          isProcessing: false,
          progress: 100,
        });
        return updated;
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
      }
    };
  }, []);

  return {
    // Node arrays
    allNodes,        // All nodes (received from scan)
    renderedNodes,   // Nodes currently rendered
    
    // State
    state,
    
    // Actions
    addNodes,        // Add new nodes to queue
    reset,           // Reset all state
    renderAll,       // Render all pending immediately
  };
};

/**
 * Hook to wire up progressive loading with scan events
 * Automatically listens to scan:partial events and manages progressive rendering
 */
export const useProgressiveScanLoading = <T = unknown,>(
  config: ProgressiveLoadingConfig = {}
) => {
  const progressive = useProgressiveLoading<T>(config);
  const [scanId, setScanId] = useState<string | null>(null);

  useEffect(() => {
    const handleScanRegistered = (event: CustomEvent) => {
      const { scanId: id } = event.detail;
      setScanId(id);
      progressive.reset();
    };

    const handleScanPartial = (event: CustomEvent) => {
      const { scanId: id, nodes } = event.detail;
      if (id === scanId || !scanId) {
        setScanId(id);
        progressive.addNodes(nodes);
      }
    };

    const handleScanDone = (event: CustomEvent) => {
      const { scanId: id } = event.detail;
      if (id === scanId) {
        // Render any remaining nodes immediately on scan completion
        progressive.renderAll();
      }
    };

    const handleScanCancelled = (event: CustomEvent) => {
      const { scanId: id } = event.detail;
      if (id === scanId) {
        progressive.reset();
        setScanId(null);
      }
    };

    window.addEventListener('scan:registered', handleScanRegistered as EventListener);
    window.addEventListener('scan:partial', handleScanPartial as EventListener);
    window.addEventListener('scan:done', handleScanDone as EventListener);
    window.addEventListener('scan:cancelled', handleScanCancelled as EventListener);

    return () => {
      window.removeEventListener('scan:registered', handleScanRegistered as EventListener);
      window.removeEventListener('scan:partial', handleScanPartial as EventListener);
      window.removeEventListener('scan:done', handleScanDone as EventListener);
      window.removeEventListener('scan:cancelled', handleScanCancelled as EventListener);
    };
  }, [scanId, progressive]);

  return {
    ...progressive,
    scanId,
  };
};

/**
 * Utility: Calculate optimal batch size based on performance
 */
export const calculateOptimalBatchSize = (
  totalNodes: number,
  targetFps: number = 60
): number => {
  const frameTime = 1000 / targetFps; // ms per frame
  const estimatedTimePerNode = 0.1; // ms (conservative estimate)
  const batchSize = Math.floor(frameTime / estimatedTimePerNode);
  
  // Clamp between 50 and 500 nodes per batch
  return Math.max(50, Math.min(500, batchSize));
};

/**
 * Utility: Performance monitor for progressive loading
 */
export class ProgressiveLoadingMonitor {
  private startTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private currentFps: number = 60;

  start() {
    this.startTime = performance.now();
    this.frameCount = 0;
    this.lastFpsUpdate = this.startTime;
  }

  recordFrame() {
    this.frameCount++;
    const now = performance.now();
    
    // Update FPS every second
    if (now - this.lastFpsUpdate >= 1000) {
      const elapsed = now - this.lastFpsUpdate;
      this.currentFps = (this.frameCount / elapsed) * 1000;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  getFps(): number {
    return Math.round(this.currentFps);
  }

  getElapsedTime(): number {
    return performance.now() - this.startTime;
  }

  isPerformanceAcceptable(): boolean {
    return this.currentFps >= 30; // 30 FPS minimum
  }
}
