/**
 * Tests for HealthController
 */

import { HealthController } from '../src/controllers/health';
import { MetricsService } from '../src/services/metrics';
import { LoggerService } from '../src/services/logger';

describe('HealthController', () => {
  let controller: HealthController;
  let mockMetricsService: jest.Mocked<MetricsService>;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockMetricsService = {
      getMetrics: jest.fn(),
      increment: jest.fn(),
      timing: jest.fn(),
      gauge: jest.fn()
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    controller = new HealthController(mockMetricsService, mockLoggerService);
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const mockMetrics = {
        uptime: 1000,
        memory: { used: 100, total: 1000 },
        requests: { total: 10, errors: 0 }
      };

      mockMetricsService.getMetrics.mockReturnValue(mockMetrics);

      const result = await controller.healthCheck();

      expect(result).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String)
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Health check performed');
    });
  });

  describe('readinessCheck', () => {
    it('should return ready status when all services are ready', async () => {
      const mockMetrics = {
        services: {
          ai: { status: 'ready', responseTime: 100 },
          cache: { status: 'ready', hitRate: 0.8 }
        }
      };

      mockMetricsService.getMetrics.mockReturnValue(mockMetrics);

      const result = await controller.readinessCheck();

      expect(result).toEqual({
        status: 'ready',
        services: mockMetrics.services,
        timestamp: expect.any(String)
      });
    });

    it('should return not ready when services are unavailable', async () => {
      const mockMetrics = {
        services: {
          ai: { status: 'error', error: 'Connection failed' },
          cache: { status: 'ready', hitRate: 0.8 }
        }
      };

      mockMetricsService.getMetrics.mockReturnValue(mockMetrics);

      const result = await controller.readinessCheck();

      expect(result.status).toBe('not_ready');
      expect(result.services.ai.status).toBe('error');
    });
  });

  describe('livenessCheck', () => {
    it('should return alive status', async () => {
      const result = await controller.livenessCheck();

      expect(result).toEqual({
        status: 'alive',
        timestamp: expect.any(String),
        pid: expect.any(Number)
      });
    });
  });

  describe('getMetrics', () => {
    it('should return detailed metrics', async () => {
      const mockMetrics = {
        uptime: 1000,
        memory: { used: 100, total: 1000 },
        requests: { total: 10, errors: 0, rate: 2.5 },
        responseTime: { avg: 150, p95: 300, p99: 500 },
        services: {
          ai: { status: 'ready', responseTime: 100 },
          cache: { status: 'ready', hitRate: 0.8 }
        }
      };

      mockMetricsService.getMetrics.mockReturnValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(result).toEqual(mockMetrics);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Metrics retrieved');
    });
  });

  describe('getDetailedHealth', () => {
    it('should return comprehensive health information', async () => {
      const mockMetrics = {
        uptime: 1000,
        memory: { used: 100, total: 1000, free: 900 },
        cpu: { usage: 0.25, cores: 4 },
        requests: { total: 10, errors: 0, rate: 2.5 },
        responseTime: { avg: 150, p95: 300, p99: 500 },
        services: {
          ai: { status: 'ready', responseTime: 100, lastCheck: Date.now() },
          cache: { status: 'ready', hitRate: 0.8, size: 1000 }
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };

      mockMetricsService.getMetrics.mockReturnValue(mockMetrics);

      const result = await controller.getDetailedHealth();

      expect(result).toMatchObject({
        status: 'healthy',
        uptime: mockMetrics.uptime,
        memory: mockMetrics.memory,
        cpu: mockMetrics.cpu,
        services: mockMetrics.services,
        environment: mockMetrics.environment
      });

      expect(result.timestamp).toBeDefined();
    });
  });

  describe('ping', () => {
    it('should return pong response', async () => {
      const result = await controller.ping();

      expect(result).toEqual({
        message: 'pong',
        timestamp: expect.any(String)
      });
    });
  });
});