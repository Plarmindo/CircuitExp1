import { LoggerService } from './logger';

export interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricsData {
  requests: {
    total: number;
    byEndpoint: Record<string, number>;
    byStatus: Record<string, number>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
  };
  performance: {
    responseTime: MetricPoint[];
    avgResponseTime: number;
    p95: number;
    p99: number;
  };
  aiUsage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    byModel: Record<string, { prompt: number; completion: number; total: number }>;
    cost: number;
  };
  uptime: {
    startTime: number;
    currentTime: number;
    uptime: number;
    availability: number;
  };
}

export class MetricsService {
  private data: MetricsData;
  private logger: LoggerService;
  private responseTimeWindow: MetricPoint[] = [];
  private readonly WINDOW_SIZE = 1000; // Keep last 1000 points

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.data = {
      requests: { total: 0, byEndpoint: {}, byStatus: {} },
      errors: { total: 0, byType: {}, byEndpoint: {} },
      performance: { responseTime: [], avgResponseTime: 0, p95: 0, p99: 0 },
      aiUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, byModel: {}, cost: 0 },
      uptime: {
        startTime: Date.now(),
        currentTime: Date.now(),
        uptime: 0,
        availability: 100
      }
    };
  }

  recordRequest(endpoint: string, statusCode: number, responseTime: number): void {
    this.data.requests.total++;
    this.data.requests.byEndpoint[endpoint] = (this.data.requests.byEndpoint[endpoint] || 0) + 1;
    this.data.requests.byStatus[statusCode.toString()] = (this.data.requests.byStatus[statusCode.toString()] || 0) + 1;

    this.recordResponseTime(responseTime);
    this.updateUptime();
  }

  recordError(type: string, endpoint?: string): void {
    this.data.errors.total++;
    this.data.errors.byType[type] = (this.data.errors.byType[type] || 0) + 1;
    
    if (endpoint) {
      this.data.errors.byEndpoint[endpoint] = (this.data.errors.byEndpoint[endpoint] || 0) + 1;
    }

    this.updateUptime();
  }

  recordAIUsage(model: string, promptTokens: number, completionTokens: number, cost?: number): void {
    this.data.aiUsage.totalTokens += promptTokens + completionTokens;
    this.data.aiUsage.promptTokens += promptTokens;
    this.data.aiUsage.completionTokens += completionTokens;

    if (!this.data.aiUsage.byModel[model]) {
      this.data.aiUsage.byModel[model] = { prompt: 0, completion: 0, total: 0 };
    }

    this.data.aiUsage.byModel[model].prompt += promptTokens;
    this.data.aiUsage.byModel[model].completion += completionTokens;
    this.data.aiUsage.byModel[model].total += promptTokens + completionTokens;

    if (cost) {
      this.data.aiUsage.cost += cost;
    }
  }

  private recordResponseTime(responseTime: number): void {
    const point: MetricPoint = {
      timestamp: Date.now(),
      value: responseTime
    };

    this.responseTimeWindow.push(point);
    
    // Trim to window size
    if (this.responseTimeWindow.length > this.WINDOW_SIZE) {
      this.responseTimeWindow = this.responseTimeWindow.slice(-this.WINDOW_SIZE);
    }

    this.calculatePerformanceMetrics();
  }

  private calculatePerformanceMetrics(): void {
    const times = this.responseTimeWindow.map(p => p.value).sort((a, b) => a - b);
    
    if (times.length === 0) {
      this.data.performance = {
        responseTime: this.responseTimeWindow,
        avgResponseTime: 0,
        p95: 0,
        p99: 0
      };
      return;
    }

    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)] || times[times.length - 1];
    const p99 = times[Math.floor(times.length * 0.99)] || times[times.length - 1];

    this.data.performance = {
      responseTime: this.responseTimeWindow,
      avgResponseTime: Math.round(avg * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100
    };
  }

  private updateUptime(): void {
    this.data.uptime.currentTime = Date.now();
    this.data.uptime.uptime = this.data.uptime.currentTime - this.data.uptime.startTime;
    
    // Calculate availability based on error rate
    const totalRequests = this.data.requests.total;
    const totalErrors = this.data.errors.total;
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    this.data.uptime.availability = Math.round((1 - errorRate) * 10000) / 100;
  }

  getMetrics(): MetricsData {
    this.updateUptime();
    return JSON.parse(JSON.stringify(this.data)); // Deep clone
  }

  getSummary(): {
    requests: number;
    errors: number;
    avgResponseTime: number;
    uptime: string;
    availability: number;
    totalTokens: number;
    estimatedCost: number;
  } {
    this.updateUptime();
    
    const uptime = this.formatUptime(this.data.uptime.uptime);
    
    return {
      requests: this.data.requests.total,
      errors: this.data.errors.total,
      avgResponseTime: this.data.performance.avgResponseTime,
      uptime,
      availability: this.data.uptime.availability,
      totalTokens: this.data.aiUsage.totalTokens,
      estimatedCost: this.data.aiUsage.cost
    };
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  reset(): void {
    this.data = {
      requests: { total: 0, byEndpoint: {}, byStatus: {} },
      errors: { total: 0, byType: {}, byEndpoint: {} },
      performance: { responseTime: [], avgResponseTime: 0, p95: 0, p99: 0 },
      aiUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, byModel: {}, cost: 0 },
      uptime: {
        startTime: Date.now(),
        currentTime: Date.now(),
        uptime: 0,
        availability: 100
      }
    };
    this.responseTimeWindow = [];
    this.logger.info('Metrics reset');
  }
}