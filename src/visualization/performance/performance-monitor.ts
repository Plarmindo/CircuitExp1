/**
 * Performance Monitor and Metrics Tracking
 * Comprehensive monitoring system for FPS, memory usage, render times, and performance metrics
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  renderTime: number;
  updateTime: number;
  memoryUsage: {
    jsHeap: number;
    gpuMemory: number;
    textureMemory: number;
    geometryMemory: number;
  };
  drawCalls: number;
  triangles: number;
  activeObjects: number;
  culledObjects: number;
  batchedDrawCalls: number;
  timestamp: number;
}

export interface PerformanceThresholds {
  minFPS: number;
  maxFrameTime: number;
  maxRenderTime: number;
  maxMemoryUsage: number;
  maxDrawCalls: number;
}

export interface PerformanceAlert {
  type: 'fps' | 'memory' | 'render' | 'draw_calls';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface PerformanceStats {
  current: PerformanceMetrics;
  average: PerformanceMetrics;
  peak: PerformanceMetrics;
  history: PerformanceMetrics[];
  alerts: PerformanceAlert[];
}

export interface MonitorOptions {
  enabled: boolean;
  historySize: number;
  alertThresholds: PerformanceThresholds;
  enableAlerts: boolean;
  enableLogging: boolean;
  logInterval: number;
  enableProfiling: boolean;
}

/**
 * Advanced performance monitoring system
 */
export class PerformanceMonitor {
  private options: MonitorOptions;
  private metrics: PerformanceMetrics[];
  private alerts: PerformanceAlert[];
  private frameCount = 0;
  private lastFrameTime = 0;
  private renderStartTime = 0;
  private updateStartTime = 0;
  private isMonitoring = false;
  private logTimer: number | null = null;
  private rafId: number | null = null;
  
  // Performance tracking
  private frameTimeHistory: number[] = [];
  private renderTimeHistory: number[] = [];
  private memoryHistory: number[] = [];
  private fpsHistory: number[] = [];
  
  // Profiling data
  private profilingData: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();
  
  constructor(options: Partial<MonitorOptions> = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      historySize: options.historySize ?? 100,
      alertThresholds: {
        minFPS: 30,
        maxFrameTime: 33.33, // ~30 FPS
        maxRenderTime: 16.67, // ~60 FPS
        maxMemoryUsage: 200 * 1024 * 1024, // 200MB
        maxDrawCalls: 1000,
        ...options.alertThresholds,
      },
      enableAlerts: options.enableAlerts ?? true,
      enableLogging: options.enableLogging ?? false,
      logInterval: options.logInterval ?? 5000, // 5 seconds
      enableProfiling: options.enableProfiling ?? false,
    };
    
    this.metrics = [];
    this.alerts = [];
    
    if (this.options.enabled) {
      this.startMonitoring();
    }
  }
  
  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    
    // Start frame monitoring
    this.monitorFrame();
    
    // Start logging if enabled
    if (this.options.enableLogging) {
      this.startLogging();
    }
    
    console.log('Performance monitoring started');
  }
  
  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    if (this.logTimer) {
      clearInterval(this.logTimer);
      this.logTimer = null;
    }
    
    console.log('Performance monitoring stopped');
  }
  
  /**
   * Mark the start of a render cycle
   */
  startRender(): void {
    if (!this.options.enabled) return;
    this.renderStartTime = performance.now();
  }
  
  /**
   * Mark the end of a render cycle
   */
  endRender(): void {
    if (!this.options.enabled || this.renderStartTime === 0) return;
    
    const renderTime = performance.now() - this.renderStartTime;
    this.renderTimeHistory.push(renderTime);
    
    if (this.renderTimeHistory.length > 60) {
      this.renderTimeHistory.shift();
    }
    
    this.renderStartTime = 0;
  }
  
  /**
   * Mark the start of an update cycle
   */
  startUpdate(): void {
    if (!this.options.enabled) return;
    this.updateStartTime = performance.now();
  }
  
  /**
   * Mark the end of an update cycle
   */
  endUpdate(): void {
    if (!this.options.enabled || this.updateStartTime === 0) return;
    
    const _updateTime = performance.now() - this.updateStartTime;
    this.updateStartTime = 0;
  }
  
  /**
   * Record draw call statistics
   */
  recordDrawCalls(drawCalls: number, triangles: number, batchedCalls: number = 0): void {
    if (!this.options.enabled) return;
    
    // Store for current frame metrics
    this.currentDrawCalls = drawCalls;
    this.currentTriangles = triangles;
    this.currentBatchedCalls = batchedCalls;
  }
  
  private currentDrawCalls = 0;
  private currentTriangles = 0;
  private currentBatchedCalls = 0;
  
  /**
   * Record object statistics
   */
  recordObjects(active: number, culled: number): void {
    if (!this.options.enabled) return;
    
    this.currentActiveObjects = active;
    this.currentCulledObjects = culled;
  }
  
  private currentActiveObjects = 0;
  private currentCulledObjects = 0;
  
  /**
   * Start profiling a named operation
   */
  startProfile(name: string): void {
    if (!this.options.enableProfiling) return;
    
    const data = this.profilingData.get(name) || { count: 0, totalTime: 0, avgTime: 0 };
    data.startTime = performance.now();
    this.profilingData.set(name, data);
  }
  
  /**
   * End profiling a named operation
   */
  endProfile(name: string): void {
    if (!this.options.enableProfiling) return;
    
    const data = this.profilingData.get(name);
    if (!data || !data.startTime) return;
    
    const duration = performance.now() - data.startTime;
    data.count++;
    data.totalTime += duration;
    data.avgTime = data.totalTime / data.count;
    delete data.startTime;
    
    this.profilingData.set(name, data);
  }
  
  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    const fps = frameTime > 0 ? 1000 / frameTime : 0;
    
    // Calculate averages
    const avgRenderTime = this.renderTimeHistory.length > 0 
      ? this.renderTimeHistory.reduce((a, b) => a + b, 0) / this.renderTimeHistory.length 
      : 0;
    
    // Get memory usage
    const memoryUsage = this.getMemoryUsage();
    
    return {
      fps,
      frameTime,
      renderTime: avgRenderTime,
      updateTime: 0, // Will be calculated in real implementation
      memoryUsage,
      drawCalls: this.currentDrawCalls,
      triangles: this.currentTriangles,
      activeObjects: this.currentActiveObjects,
      culledObjects: this.currentCulledObjects,
      batchedDrawCalls: this.currentBatchedCalls,
      timestamp: now,
    };
  }
  
  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    const current = this.getCurrentMetrics();
    
    return {
      current,
      average: this.calculateAverage(),
      peak: this.calculatePeak(),
      history: [...this.metrics],
      alerts: [...this.alerts],
    };
  }
  
  /**
   * Get profiling data
   */
  getProfilingData(): Map<string, { count: number; totalTime: number; avgTime: number }> {
    return new Map(this.profilingData);
  }
  
  /**
   * Clear all metrics and alerts
   */
  clear(): void {
    this.metrics = [];
    this.alerts = [];
    this.frameTimeHistory = [];
    this.renderTimeHistory = [];
    this.memoryHistory = [];
    this.fpsHistory = [];
    this.profilingData.clear();
    this.frameCount = 0;
  }
  
  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      stats: this.getStats(),
      profiling: Object.fromEntries(this.profilingData),
      options: this.options,
      timestamp: Date.now(),
    }, null, 2);
  }
  
  /**
   * Monitor frame performance
   */
  private monitorFrame(): void {
    if (!this.isMonitoring) return;
    
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    
    if (frameTime > 0) {
      const fps = 1000 / frameTime;
      
      // Update histories
      this.frameTimeHistory.push(frameTime);
      this.fpsHistory.push(fps);
      
      if (this.frameTimeHistory.length > 60) {
        this.frameTimeHistory.shift();
        this.fpsHistory.shift();
      }
      
      // Record metrics
      const metrics = this.getCurrentMetrics();
      this.recordMetrics(metrics);
      
      // Check for alerts
      if (this.options.enableAlerts) {
        this.checkAlerts(metrics);
      }
      
      this.frameCount++;
    }
    
    this.lastFrameTime = now;
    this.rafId = requestAnimationFrame(() => this.monitorFrame());
  }
  
  /**
   * Record metrics in history
   */
  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    if (this.metrics.length > this.options.historySize) {
      this.metrics.shift();
    }
  }
  
  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const { alertThresholds } = this.options;
    const now = Date.now();
    
    // FPS alert
    if (metrics.fps < alertThresholds.minFPS) {
      this.addAlert({
        type: 'fps',
        severity: metrics.fps < alertThresholds.minFPS * 0.5 ? 'critical' : 'warning',
        message: `Low FPS detected: ${metrics.fps.toFixed(1)}`,
        value: metrics.fps,
        threshold: alertThresholds.minFPS,
        timestamp: now,
      });
    }
    
    // Frame time alert
    if (metrics.frameTime > alertThresholds.maxFrameTime) {
      this.addAlert({
        type: 'render',
        severity: metrics.frameTime > alertThresholds.maxFrameTime * 2 ? 'critical' : 'warning',
        message: `High frame time: ${metrics.frameTime.toFixed(2)}ms`,
        value: metrics.frameTime,
        threshold: alertThresholds.maxFrameTime,
        timestamp: now,
      });
    }
    
    // Memory alert
    const totalMemory = metrics.memoryUsage.jsHeap + metrics.memoryUsage.gpuMemory;
    if (totalMemory > alertThresholds.maxMemoryUsage) {
      this.addAlert({
        type: 'memory',
        severity: totalMemory > alertThresholds.maxMemoryUsage * 1.5 ? 'critical' : 'warning',
        message: `High memory usage: ${Math.round(totalMemory / 1024 / 1024)}MB`,
        value: totalMemory,
        threshold: alertThresholds.maxMemoryUsage,
        timestamp: now,
      });
    }
    
    // Draw calls alert
    if (metrics.drawCalls > alertThresholds.maxDrawCalls) {
      this.addAlert({
        type: 'draw_calls',
        severity: metrics.drawCalls > alertThresholds.maxDrawCalls * 2 ? 'critical' : 'warning',
        message: `High draw calls: ${metrics.drawCalls}`,
        value: metrics.drawCalls,
        threshold: alertThresholds.maxDrawCalls,
        timestamp: now,
      });
    }
  }
  
  /**
   * Add a performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
    
    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error(`Performance Alert [${alert.type}]: ${alert.message}`);
    } else {
      console.warn(`Performance Warning [${alert.type}]: ${alert.message}`);
    }
    
    // Emit custom event for real-time alerting
    this.emitPerformanceAlert(alert);
  }

  /**
   * Emit performance alert event
   */
  private emitPerformanceAlert(alert: PerformanceAlert): void {
    try {
      const event = new CustomEvent('performance-alert', {
        detail: alert,
        bubbles: true,
        cancelable: true,
      });
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(event);
      }
    } catch {
      console.warn('Failed to emit performance alert:', error);
    }
  }

  /**
   * Subscribe to performance alerts
   */
  onPerformanceAlert(callback: (alert: PerformanceAlert) => void): () => void {
    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('performance-alert', handler as EventListener);
    }
    
    // Return unsubscribe function
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('performance-alert', handler as EventListener);
      }
    };
  }

  /**
   * Get real-time performance summary
   */
  getRealTimeSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const current = this.getCurrentMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check FPS
    if (current.fps < this.options.alertThresholds.minFPS * 0.5) {
      issues.push(`Critical low FPS: ${current.fps.toFixed(1)}`);
      recommendations.push('Reduce scene complexity or optimize rendering');
    } else if (current.fps < this.options.alertThresholds.minFPS) {
      issues.push(`Low FPS: ${current.fps.toFixed(1)}`);
      recommendations.push('Consider batching optimizations');
    }
    
    // Check memory
    const totalMemory = current.memoryUsage.jsHeap + current.memoryUsage.gpuMemory;
    if (totalMemory > this.options.alertThresholds.maxMemoryUsage * 1.5) {
      issues.push(`Critical high memory: ${Math.round(totalMemory / 1024 / 1024)}MB`);
      recommendations.push('Implement memory cleanup or reduce texture sizes');
    } else if (totalMemory > this.options.alertThresholds.maxMemoryUsage) {
      issues.push(`High memory usage: ${Math.round(totalMemory / 1024 / 1024)}MB`);
      recommendations.push('Monitor for memory leaks');
    }
    
    // Check draw calls
    if (current.drawCalls > this.options.alertThresholds.maxDrawCalls * 2) {
      issues.push(`Critical draw calls: ${current.drawCalls}`);
      recommendations.push('Implement aggressive batching or culling');
    } else if (current.drawCalls > this.options.alertThresholds.maxDrawCalls) {
      issues.push(`High draw calls: ${current.drawCalls}`);
      recommendations.push('Use instanced rendering where possible');
    }
    
    const status = issues.length === 0 ? 'healthy' : 
                   issues.some(i => i.includes('Critical')) ? 'critical' : 'warning';
    
    return { status, issues, recommendations };
  }
  
  /**
   * Start performance logging
   */
  private startLogging(): void {
    if (this.logTimer) return;
    
    this.logTimer = window.setInterval(() => {
      const stats = this.getStats();
      console.log('Performance Stats:', {
        fps: stats.current.fps.toFixed(1),
        frameTime: stats.current.frameTime.toFixed(2) + 'ms',
        renderTime: stats.current.renderTime.toFixed(2) + 'ms',
        memory: Math.round((stats.current.memoryUsage.jsHeap + stats.current.memoryUsage.gpuMemory) / 1024 / 1024) + 'MB',
        drawCalls: stats.current.drawCalls,
        objects: `${stats.current.activeObjects} active, ${stats.current.culledObjects} culled`,
        alerts: stats.alerts.length,
      });
    }, this.options.logInterval);
  }
  
  /**
   * Get memory usage information
   */
  private getMemoryUsage() {
    const jsMemory = (performance as any).memory || { usedJSHeapSize: 0 };
    
    // Enhanced GPU memory tracking
    const gpuMemory = this.getGPUMemoryUsage();
    const textureMemory = this.getTextureMemoryUsage();
    const geometryMemory = this.getGeometryMemoryUsage();
    
    return {
      jsHeap: jsMemory.usedJSHeapSize,
      gpuMemory,
      textureMemory,
      geometryMemory,
    };
  }

  /**
   * Get GPU memory usage from WebGL context
   */
  private getGPUMemoryUsage(): number {
    try {
      // Attempt to get GPU memory info from WebGL extensions
      const canvas = document.querySelector('canvas');
      if (!canvas) return 0;

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 0;

      // Try to use WEBGL_debug_renderer_info extension
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        // Note: Most browsers don't expose actual memory usage for security reasons
        // This is a best-effort approach using available extensions
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        
        // Log GPU info for debugging
        if (this.options.enableLogging) {
          console.log('GPU Info:', { vendor, renderer });
        }
      }

      // Return estimated memory based on texture and buffer sizes
      return this.calculateEstimatedGPUMemory();
    } catch {
      console.warn('Failed to get GPU memory usage:', error);
      return 0;
    }
  }

  /**
   * Calculate estimated GPU memory usage
   */
  private calculateEstimatedGPUMemory(): number {
    let estimatedMemory = 0;
    
    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) return 0;

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 0;

      // Estimate based on viewport size and common allocations
      const viewport = gl.getParameter(gl.VIEWPORT);
      const width = viewport[2];
      const height = viewport[3];
      
      // Estimate framebuffer memory (color + depth + stencil)
      const colorBufferSize = width * height * 4 * 4; // RGBA8
      const depthBufferSize = width * height * 4; // 32-bit depth
      estimatedMemory += colorBufferSize + depthBufferSize;
      
      return estimatedMemory;
    } catch {
      return 0;
    }
  }

  /**
   * Get texture memory usage from PIXI.js or WebGL
   */
  private getTextureMemoryUsage(): number {
    try {
      // Check if PIXI is available
      if (typeof window !== 'undefined' && (window as any).PIXI) {
        const PIXI = (window as any).PIXI;
        if (PIXI.utils && PIXI.utils.TextureCache) {
          let textureMemory = 0;
          Object.values(PIXI.utils.TextureCache).forEach((texture: unknown) => {
            if (texture.baseTexture && texture.baseTexture.realWidth && texture.baseTexture.realHeight) {
              // 4 bytes per pixel (RGBA)
              textureMemory += texture.baseTexture.realWidth * texture.baseTexture.realHeight * 4;
            }
          });
          return textureMemory;
        }
      }
      return 0;
    } catch {
      console.warn('Failed to get texture memory usage:', error);
      return 0;
    }
  }

  /**
   * Get geometry memory usage
   */
  private getGeometryMemoryUsage(): number {
    try {
      // Estimate based on active objects and typical geometry sizes
      const avgVertexSize = 3 * 4 + 2 * 4 + 4 * 4; // position + UV + color
      const avgVertexCount = 100; // conservative estimate
      
      return this.currentActiveObjects * avgVertexCount * avgVertexSize;
    } catch {
      return 0;
    }
  }
  
  /**
   * Calculate average metrics
   */
  private calculateAverage(): PerformanceMetrics {
    if (this.metrics.length === 0) {
      return this.getCurrentMetrics();
    }
    
    const sum = this.metrics.reduce((acc, metric) => ({
      fps: acc.fps + metric.fps,
      frameTime: acc.frameTime + metric.frameTime,
      renderTime: acc.renderTime + metric.renderTime,
      updateTime: acc.updateTime + metric.updateTime,
      memoryUsage: {
        jsHeap: acc.memoryUsage.jsHeap + metric.memoryUsage.jsHeap,
        gpuMemory: acc.memoryUsage.gpuMemory + metric.memoryUsage.gpuMemory,
        textureMemory: acc.memoryUsage.textureMemory + metric.memoryUsage.textureMemory,
        geometryMemory: acc.memoryUsage.geometryMemory + metric.memoryUsage.geometryMemory,
      },
      drawCalls: acc.drawCalls + metric.drawCalls,
      triangles: acc.triangles + metric.triangles,
      activeObjects: acc.activeObjects + metric.activeObjects,
      culledObjects: acc.culledObjects + metric.culledObjects,
      batchedDrawCalls: acc.batchedDrawCalls + metric.batchedDrawCalls,
      timestamp: acc.timestamp,
    }), {
      fps: 0, frameTime: 0, renderTime: 0, updateTime: 0,
      memoryUsage: { jsHeap: 0, gpuMemory: 0, textureMemory: 0, geometryMemory: 0 },
      drawCalls: 0, triangles: 0, activeObjects: 0, culledObjects: 0, batchedDrawCalls: 0,
      timestamp: Date.now(),
    });
    
    const count = this.metrics.length;
    return {
      fps: sum.fps / count,
      frameTime: sum.frameTime / count,
      renderTime: sum.renderTime / count,
      updateTime: sum.updateTime / count,
      memoryUsage: {
        jsHeap: sum.memoryUsage.jsHeap / count,
        gpuMemory: sum.memoryUsage.gpuMemory / count,
        textureMemory: sum.memoryUsage.textureMemory / count,
        geometryMemory: sum.memoryUsage.geometryMemory / count,
      },
      drawCalls: sum.drawCalls / count,
      triangles: sum.triangles / count,
      activeObjects: sum.activeObjects / count,
      culledObjects: sum.culledObjects / count,
      batchedDrawCalls: sum.batchedDrawCalls / count,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Calculate peak metrics
   */
  private calculatePeak(): PerformanceMetrics {
    if (this.metrics.length === 0) {
      return this.getCurrentMetrics();
    }
    
    return this.metrics.reduce((peak, metric) => ({
      fps: Math.max(peak.fps, metric.fps),
      frameTime: Math.max(peak.frameTime, metric.frameTime),
      renderTime: Math.max(peak.renderTime, metric.renderTime),
      updateTime: Math.max(peak.updateTime, metric.updateTime),
      memoryUsage: {
        jsHeap: Math.max(peak.memoryUsage.jsHeap, metric.memoryUsage.jsHeap),
        gpuMemory: Math.max(peak.memoryUsage.gpuMemory, metric.memoryUsage.gpuMemory),
        textureMemory: Math.max(peak.memoryUsage.textureMemory, metric.memoryUsage.textureMemory),
        geometryMemory: Math.max(peak.memoryUsage.geometryMemory, metric.memoryUsage.geometryMemory),
      },
      drawCalls: Math.max(peak.drawCalls, metric.drawCalls),
      triangles: Math.max(peak.triangles, metric.triangles),
      activeObjects: Math.max(peak.activeObjects, metric.activeObjects),
      culledObjects: Math.max(peak.culledObjects, metric.culledObjects),
      batchedDrawCalls: Math.max(peak.batchedDrawCalls, metric.batchedDrawCalls),
      timestamp: peak.timestamp,
    }));
  }
  
  /**
   * Destroy the performance monitor
   */
  destroy(): void {
    this.stopMonitoring();
    this.clear();
  }
}

// Global performance monitor instance
let globalMonitor: PerformanceMonitor | null = null;

/**
 * Get or create the global performance monitor
 */
export function getPerformanceMonitor(options?: Partial<MonitorOptions>): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor(options);
  }
  return globalMonitor;
}

/**
 * Destroy the global performance monitor
 */
export function destroyPerformanceMonitor(): void {
  if (globalMonitor) {
    globalMonitor.destroy();
    globalMonitor = null;
  }
}

/**
 * Performance monitoring decorator for methods
 */
export function monitor(name?: string) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const profileName = name || `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = function (...args: unknown[]) {
      const monitor = getPerformanceMonitor();
      monitor.startProfile(profileName);
      
      try {
        const result = originalMethod.apply(this, args);
        
        if (result instanceof Promise) {
          return result.finally(() => {
            monitor.endProfile(profileName);
          });
        }
        
        monitor.endProfile(profileName);
        return result;
      } catch {
        monitor.endProfile(profileName);
        throw error;
      }
    };
    
    return descriptor;
  };
}