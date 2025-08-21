export class MetricsService {
  private metrics: {
    requests: number;
    errors: number;
    performance: { [key: string]: number };
    usage: { [key: string]: number };
  };

  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      performance: {},
      usage: {}
    };
  }

  recordRequest(data: { method: string; path: string; statusCode: number; duration: number }): void {
    this.metrics.requests++;
    
    if (data.statusCode >= 400) {
      this.metrics.errors++;
    }
    
    const key = `${data.method}:${data.path}`;
    if (!this.metrics.performance[key]) {
      this.metrics.performance[key] = 0;
    }
    this.metrics.performance[key] += data.duration;
  }

  recordUsage(provider: string, tokens: number): void {
    if (!this.metrics.usage[provider]) {
      this.metrics.usage[provider] = 0;
    }
    this.metrics.usage[provider] += tokens;
  }

  getMetrics(): any {
    return {
      ...this.metrics,
      errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) * 100 : 0,
      uptime: process.uptime()
    };
  }

  reset(): void {
    this.metrics = {
      requests: 0,
      errors: 0,
      performance: {},
      usage: {}
    };
  }
}