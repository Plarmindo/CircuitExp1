import { Application } from 'pixi.js';

// GPU capability detection utility
export const checkGPUSupport = async (): Promise<'webgpu' | 'webgl' | 'fallback'> => {
  // Check for forced software rendering
  const forceSoftware = (import.meta as any)?.env?.FORCE_SOFTWARE_RENDERING === '1' ||
                       (typeof process !== 'undefined' && (process as any).env?.FORCE_SOFTWARE_RENDERING === '1');

  if (forceSoftware) {
    console.warn('Software rendering forced via environment variable');
    return 'fallback';
  }

  try {
    // Check for WebGPU support with timeout
    if ('gpu' in navigator && (navigator as any).gpu) {
      try {
        const adapter = await Promise.race([
          (navigator as any).gpu.requestAdapter(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('WebGPU adapter request timeout')), 3000)
          )
        ]);
        if (adapter) {
          console.log('WebGPU adapter found');
          return 'webgpu';
        }
      } catch (e) {
        console.warn('WebGPU adapter request failed:', e);
      }
    }

    // Check for WebGL2 support with better error handling
    const canvas = document.createElement('canvas');
    try {
      const gl2 = canvas.getContext('webgl2', {
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'high-performance'
      } as WebGLContextAttributes);
      if (gl2 && !(gl2 as any).isContextLost?.()) {
        // Test basic WebGL2 functionality
        (gl2 as any).getExtension?.('EXT_color_buffer_float');
        console.log('WebGL2 context created successfully');
        return 'webgl';
      }
    } catch (webgl2Error) {
      console.warn('WebGL2 context creation failed:', webgl2Error);
    }

    // Check for WebGL support with fallback options
    try {
      const webgl = (canvas.getContext('webgl', {
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'default'
      } as WebGLContextAttributes) as WebGLRenderingContext | null) || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;

      if (webgl && !(webgl as any).isContextLost?.()) {
        console.log('WebGL context created successfully');
        return 'webgl';
      }
    } catch (webglError) {
      console.warn('WebGL context creation failed:', webglError);
    }

    console.warn('No GPU acceleration available, using fallback renderer');
    return 'fallback';
  } catch (error) {
    console.warn('GPU support check failed:', error);
    return 'fallback';
  }
};

// Safe resize helper for Pixi Application
export const safeResize = (
  container: HTMLElement | null,
  app: Application | null,
  _fallbackWidth = 800,
  _fallbackHeight = 600
): { width: number; height: number } | null => {
  if (!container || !app) {
    return null;
  }

  try {
    const { clientWidth: cw, clientHeight: ch } = container;

    // Enhanced validation for non-finite values
    if (!Number.isFinite(cw) || !Number.isFinite(ch) || cw <= 0 || ch <= 0) {
      console.warn('[safeResize] Invalid container dimensions:', { cw, ch });
      return null;
    }

    // Ensure dimensions are integers and within reasonable bounds
    const width = Math.max(2, Math.min(8192, Math.floor(cw)));
    const height = Math.max(2, Math.min(8192, Math.floor(ch)));

    // Final validation
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      console.warn('[safeResize] Final dimensions validation failed:', { width, height });
      return null;
    }

    // Skip resize if dimensions are the same
    if (width === (app.renderer as any).width && height === (app.renderer as any).height) {
      return { width, height };
    }

    // Use the PixiJS resize API format
    (app.renderer as any).resize(width, height);
    return { width, height };
  } catch (error) {
    console.error('[safeResize] Failed to resize renderer:', error);
    return null;
  }
};
