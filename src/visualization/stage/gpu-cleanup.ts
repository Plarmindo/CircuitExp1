/**
 * GPU Resource Cleanup Utilities
 * Provides comprehensive cleanup for WebGL contexts, textures, and buffers
 */

import { Application, Container } from 'pixi.js';

export interface GPUCleanupOptions {
  clearTextures?: boolean;
  clearBuffers?: boolean;
  clearPrograms?: boolean;
  forceFinish?: boolean;
}

/**
 * Comprehensive WebGL context cleanup
 * Clears all GPU resources to prevent memory leaks
 */
export function cleanupWebGLResources(
  canvas: HTMLCanvasElement | null,
  options: GPUCleanupOptions = {}
): void {
  if (!canvas) return;

  const {
    clearTextures = true,
    clearBuffers = true,
    clearPrograms: _clearPrograms = true,
    forceFinish = true,
  } = options;

  try {
    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
    if (!gl) return;

    // Force completion of all pending operations
    if (forceFinish) {
      gl.finish();
    }

    if (clearTextures) {
      // Clear all texture units
      const numTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 8;
      for (let i = 0; i < numTextureUnits; i++) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        if (gl.bindTexture && gl.TEXTURE_3D) {
          gl.bindTexture(gl.TEXTURE_3D, null);
        }
      }
    }

    if (clearBuffers) {
      // Clear all buffer bindings
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

      // WebGL2 additional buffer types
      if (gl.bindBuffer && gl.UNIFORM_BUFFER) {
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
      }
      if (gl.bindBuffer && gl.TRANSFORM_FEEDBACK_BUFFER) {
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
      }
    }

    // Clear framebuffer and renderbuffer bindings
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Clear vertex array bindings (WebGL2)
    if (gl.bindVertexArray) {
      gl.bindVertexArray(null);
    }

    // Use default program
    gl.useProgram(null);

    console.log('[GPU Cleanup] WebGL resources cleared successfully');
  } catch (error) {
    console.warn('[GPU Cleanup] Error during WebGL cleanup:', error);
  }
}

/**
 * Enhanced PixiJS application cleanup
 * Ensures complete disposal of all GPU resources
 */
export function cleanupPixiApplication(app: Application): void {
  if (!app) return;

  try {
    // Clean up stage and all children
    if (app.stage) {
      // Recursively destroy all children with their textures
      const destroyChildren = (container: Container) => {
        if (!container || !container.children) return;

        for (const child of [...container.children]) {
          if (child.children && child.children.length > 0) {
            destroyChildren(child);
          }

          // Destroy with full cleanup
          if (child.destroy) {
            child.destroy({
              children: true,
              texture: true,
              baseTexture: true,
            });
          }
        }

        container.removeChildren();
      };

      destroyChildren(app.stage);
      app.stage.children = [];
    }

    // Clean up renderer
    if (app.renderer) {
      // Clean up WebGL context if available
      if (app.renderer.gl && app.view) {
        cleanupWebGLResources(app.view as HTMLCanvasElement);
      }

      // Destroy renderer
      if (app.renderer.destroy) {
        app.renderer.destroy(true);
      }
    }

    // Clean up ticker
    if (app.ticker) {
      app.ticker.stop();
      if (app.ticker.destroy) {
        app.ticker.destroy();
      }
    }

    // Remove canvas from DOM
    if (app.canvas || app.view) {
      const canvas = app.canvas || app.view;
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }

    // Final app destruction
    if (app.destroy) {
      app.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true,
      });
    }

    console.log('[GPU Cleanup] PixiJS application cleaned up successfully');
  } catch (error) {
    console.error('[GPU Cleanup] Error during PixiJS cleanup:', error);
  }
}

/**
 * Memory pressure detection and cleanup
 * Monitors memory usage and triggers cleanup when needed
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private cleanupCallbacks: Array<() => void> = [];
  private memoryCheckInterval: number | null = null;
  private readonly MEMORY_THRESHOLD_MB = 500;
  private readonly CHECK_INTERVAL_MS = 30000; // 30 seconds

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  startMonitoring(): void {
    if (this.memoryCheckInterval) return;

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.warn('[Memory Manager] Not in browser environment, skipping monitoring');
      return;
    }

    this.memoryCheckInterval = window.setInterval(() => {
      this.checkMemoryPressure();
    }, this.CHECK_INTERVAL_MS);

    console.log('[Memory Manager] Started memory monitoring');
  }

  stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      if (typeof window !== 'undefined') {
        clearInterval(this.memoryCheckInterval);
      }
      this.memoryCheckInterval = null;
      console.log('[Memory Manager] Stopped memory monitoring');
    }
  }

  registerCleanupCallback(callback: () => void): () => void {
    this.cleanupCallbacks.push(callback);
    return () => {
      const index = this.cleanupCallbacks.indexOf(callback);
      if (index > -1) {
        this.cleanupCallbacks.splice(index, 1);
      }
    };
  }

  private checkMemoryPressure(): void {
    try {
      const performance = globalThis.performance as any;
      if (!performance?.memory?.usedJSHeapSize) return;

      const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024);

      if (usedMB > this.MEMORY_THRESHOLD_MB) {
        console.warn(`[Memory Manager] High memory usage detected: ${usedMB.toFixed(1)}MB`);
        this.triggerCleanup();
      }
    } catch (error) {
      console.warn('[Memory Manager] Error checking memory pressure:', error);
    }
  }

  private triggerCleanup(): void {
    console.log('[Memory Manager] Triggering cleanup callbacks');

    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[Memory Manager] Error in cleanup callback:', error);
      }
    }

    // Force garbage collection if available
    if (typeof globalThis !== 'undefined' && (globalThis as any).gc) {
      try {
        (globalThis as any).gc();
        console.log('[Memory Manager] Forced garbage collection');
      } catch {
        // Ignore if gc is not available
      }
    }
  }

  cleanup(): void {
    this.stopMonitoring();
    this.cleanupCallbacks = [];
  }
}
