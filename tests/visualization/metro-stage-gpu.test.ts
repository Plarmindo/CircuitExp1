import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkGPUSupport, safeResize } from '../../src/visualization/metro-stage';

// Mock PIXI.js
vi.mock('pixi.js', () => ({
  Application: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    canvas: {
      width: 800,
      height: 600,
    },
    renderer: {
      resize: vi.fn(),
      width: 800,
      height: 600,
    },
    stage: {
      addChild: vi.fn(),
    },
  })),
}));

describe('MetroStage GPU Tests', () => {
  let mockDocument: any;
  let mockNavigator: any;

  beforeEach(() => {
    // Setup DOM mocks
    mockDocument = {
      createElement: vi.fn(),
    };

    mockNavigator = {
      gpu: {
        requestAdapter: vi.fn(),
      },
    };

    Object.defineProperty(global, 'document', {
      value: mockDocument,
      writable: true,
    });

    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
    });
  });

  describe('checkGPUSupport', () => {
    it('should be defined and return a promise', async () => {
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(null),
      };
      mockDocument.createElement.mockReturnValue(mockCanvas);

      const result = checkGPUSupport();
      expect(result).toBeInstanceOf(Promise);

      const gpuMode = await result;
      expect(typeof gpuMode).toBe('string');
    });
  });

  describe('safeResize', () => {
    it('should be defined as a function', () => {
      expect(typeof safeResize).toBe('function');
    });

    it('should handle null container gracefully', () => {
      const mockApp = {
        renderer: {
          resize: vi.fn(),
          width: 800,
          height: 600,
        },
      };

      expect(() => safeResize(null, mockApp)).not.toThrow();
    });
  });
});
