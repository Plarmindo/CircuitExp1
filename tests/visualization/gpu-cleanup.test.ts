import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupWebGLResources, cleanupPixiApplication, MemoryManager } from '../../src/visualization/stage/gpu-cleanup';

// Mock WebGL context
const createMockWebGLContext = () => ({
  getParameter: vi.fn((param) => {
    if (param === 'MAX_TEXTURE_IMAGE_UNITS') return 8;
    return null;
  }),
  activeTexture: vi.fn(),
  bindTexture: vi.fn(),
  bindBuffer: vi.fn(),
  bindRenderbuffer: vi.fn(),
  bindFramebuffer: vi.fn(),
  bindVertexArray: vi.fn(),
  useProgram: vi.fn(),
  finish: vi.fn(),
  TEXTURE0: 33984,
  TEXTURE_2D: 3553,
  TEXTURE_CUBE_MAP: 34067,
  TEXTURE_3D: 32879,
  ARRAY_BUFFER: 34962,
  ELEMENT_ARRAY_BUFFER: 34963,
  UNIFORM_BUFFER: 35345,
  TRANSFORM_FEEDBACK_BUFFER: 35982,
  RENDERBUFFER: 36161,
  FRAMEBUFFER: 36160,
});

// Mock canvas
const createMockCanvas = (withWebGL = true) => {
  const mockContext = withWebGL ? createMockWebGLContext() : null;
  return {
    getContext: vi.fn((type) => {
      if (type === 'webgl' || type === 'webgl2') return mockContext;
      return null;
    }),
    parentNode: {
      removeChild: vi.fn(),
    },
  } as any;
};

// Mock PixiJS application
const createMockPixiApp = () => {
  const mockChild = {
    children: [],
    destroy: vi.fn(),
    removeChildren: vi.fn(),
  };

  const mockCanvas = createMockCanvas();
  mockCanvas.parentNode = {
    removeChild: vi.fn(),
  };

  return {
    stage: {
      children: [mockChild],
      removeChildren: vi.fn(),
    },
    renderer: {
      gl: createMockWebGLContext(),
      destroy: vi.fn(),
      texture: {
        gc: {
          run: vi.fn(),
        },
      },
    },
    ticker: {
      stop: vi.fn(),
      destroy: vi.fn(),
    },
    view: mockCanvas,
    canvas: mockCanvas,
    destroy: vi.fn(),
  };
};

describe('GPU Cleanup', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cleanupWebGLResources', () => {
    it('should handle null canvas gracefully', () => {
      expect(() => cleanupWebGLResources(null)).not.toThrow();
    });

    it('should handle canvas without WebGL context', () => {
      const canvas = createMockCanvas(false);
      expect(() => cleanupWebGLResources(canvas)).not.toThrow();
    });

    it('should clean up WebGL resources properly', () => {
      const canvas = createMockCanvas(true);
      const gl = canvas.getContext('webgl');

      cleanupWebGLResources(canvas);

      // Verify texture cleanup
      expect(gl.activeTexture).toHaveBeenCalledTimes(8); // MAX_TEXTURE_IMAGE_UNITS
      expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D, null);
      expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_CUBE_MAP, null);

      // Verify buffer cleanup
      expect(gl.bindBuffer).toHaveBeenCalledWith(gl.ARRAY_BUFFER, null);
      expect(gl.bindBuffer).toHaveBeenCalledWith(gl.ELEMENT_ARRAY_BUFFER, null);

      // Verify other bindings
      expect(gl.bindRenderbuffer).toHaveBeenCalledWith(gl.RENDERBUFFER, null);
      expect(gl.bindFramebuffer).toHaveBeenCalledWith(gl.FRAMEBUFFER, null);
      expect(gl.useProgram).toHaveBeenCalledWith(null);
      expect(gl.finish).toHaveBeenCalled();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '[GPU Cleanup] WebGL resources cleared successfully'
      );
    });

    it('should handle WebGL errors gracefully', () => {
      const canvas = createMockCanvas(true);
      const gl = canvas.getContext('webgl');
      gl.finish.mockImplementation(() => {
        throw new Error('WebGL error');
      });

      expect(() => cleanupWebGLResources(canvas)).not.toThrow();
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[GPU Cleanup] Error during WebGL cleanup:',
        expect.any(Error)
      );
    });

    it('should respect cleanup options', () => {
      const canvas = createMockCanvas(true);
      const gl = canvas.getContext('webgl');

      cleanupWebGLResources(canvas, {
        clearTextures: false,
        clearBuffers: false,
        forceFinish: false,
      });

      expect(gl.activeTexture).not.toHaveBeenCalled();
      expect(gl.bindBuffer).not.toHaveBeenCalled();
      expect(gl.finish).not.toHaveBeenCalled();
    });
  });

  describe('cleanupPixiApplication', () => {
    it('should handle null app gracefully', () => {
      expect(() => cleanupPixiApplication(null)).not.toThrow();
    });

    it('should clean up PixiJS application properly', () => {
      const app = createMockPixiApp();

      cleanupPixiApplication(app);

      // Verify stage cleanup - check if children exist
      if (app.stage.children && app.stage.children.length > 0) {
        expect(app.stage.children[0].destroy).toHaveBeenCalledWith({
          children: true,
          texture: true,
          baseTexture: true,
        });
      }
      expect(app.stage.removeChildren).toHaveBeenCalled();

      // Verify renderer cleanup
      expect(app.renderer.destroy).toHaveBeenCalledWith(true);

      // Verify ticker cleanup
      expect(app.ticker.stop).toHaveBeenCalled();
      expect(app.ticker.destroy).toHaveBeenCalled();

      // Verify canvas removal
      expect(app.view.parentNode.removeChild).toHaveBeenCalledWith(app.view);

      // Verify app destruction
      expect(app.destroy).toHaveBeenCalledWith(true, {
        children: true,
        texture: true,
        baseTexture: true,
      });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '[GPU Cleanup] PixiJS application cleaned up successfully'
      );
    });

    it('should handle cleanup errors gracefully', () => {
      const app = createMockPixiApp();
      app.destroy.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      expect(() => cleanupPixiApplication(app)).not.toThrow();
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[GPU Cleanup] Error during PixiJS cleanup:',
        expect.any(Error)
      );
    });
  });

  describe('MemoryManager', () => {
    let memoryManager: MemoryManager;

    beforeEach(() => {
      memoryManager = MemoryManager.getInstance();
      vi.useFakeTimers();
    });

    afterEach(() => {
      memoryManager.cleanup();
      vi.useRealTimers();
    });

    it('should be a singleton', () => {
      const instance1 = MemoryManager.getInstance();
      const instance2 = MemoryManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should handle Node.js environment gracefully', () => {
      // In Node.js environment, monitoring should be skipped
      memoryManager.startMonitoring();
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Memory Manager] Not in browser environment, skipping monitoring'
      );

      memoryManager.stopMonitoring();
      // Should not throw when no interval is set
    });

    it('should register and unregister cleanup callbacks', () => {
      const callback = vi.fn();
      const unregister = memoryManager.registerCleanupCallback(callback);

      expect(typeof unregister).toBe('function');

      // Trigger cleanup (would normally be called by memory pressure detection)
      (memoryManager as any).triggerCleanup();
      expect(callback).toHaveBeenCalled();

      // Unregister and verify callback is not called again
      callback.mockClear();
      unregister();
      (memoryManager as any).triggerCleanup();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle cleanup callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      memoryManager.registerCleanupCallback(errorCallback);
      memoryManager.registerCleanupCallback(normalCallback);

      (memoryManager as any).triggerCleanup();

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[Memory Manager] Error in cleanup callback:',
        expect.any(Error)
      );
    });

    it('should clean up properly', () => {
      const callback = vi.fn();
      memoryManager.registerCleanupCallback(callback);
      memoryManager.startMonitoring();

      memoryManager.cleanup();

      // Verify monitoring stopped and callbacks cleared
      (memoryManager as any).triggerCleanup();
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
