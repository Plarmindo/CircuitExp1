import { performance } from 'perf_hooks';

export interface RequestMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

export interface ErrorMetrics {
  type: string;
  endpoint: string;
  message: string;
  timestamp: Date;
}

export interface AIMetrics {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: Date;
}

export class MetricsService {
  private requests: RequestMetrics[] = [];
  private errors: ErrorMetrics[] = [];
  private aiUsage: AIMetrics[] = [];
  private startTime: Date;
  private requestCounts: Map<string, number> = new Map();
  private statusCounts: Map<number, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  constructor() {
    this.startTime = new Date();
  }

  recordRequest(endpoint: string, method: string, statusCode: number, duration: number): void {
    const metric: RequestMetrics = {
      endpoint,
      method,
      statusCode,
      duration,
      timestamp: new Date()
    };

    this.requests.push(metric);
    
    // Update counters
    const key = `${method} ${endpoint}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
    this.statusCounts.set(statusCode, (this.statusCounts.get(statusCode) || 0) + 1);

    // Keep only last 1000 requests
    if (this.requests.length > 1000) {
      this.requests.shift();
    }
  }

  recordError(type: string, endpoint: string, message: string): void {
    const error: ErrorMetrics = {
      type,
      endpoint,
      message,
      timestamp: new Date()
    };

    this.errors.push(error);
    this.errorCounts.set(type, (this.errorCounts.get(type) || 0) + 1);

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors.shift();
    }
  }

  recordAIUsage(model: string, promptTokens: number, completionTokens: number): void {
    const totalTokens = promptTokens + completionTokens;
    const cost = this.calculateCost(model, promptTokens, completionTokens);

    const metric: AIMetrics = {
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
      timestamp: new Date()
    };

    this.aiUsage.push(metric);

    // Keep only last 500 AI usage records
    if (this.aiUsage.length > 500) {
      this.aiUsage.shift();
    }
  }

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = {
      'claude-3-5-sonnet-20241022': {
        prompt: 0.003, // per 1K tokens
        completion: 0.015 // per 1K tokens
      },
      'claude-3-5-haiku-20241022': {
        prompt: 0.0008, // per 1K tokens
        completion: 0.004 // per 1K tokens
      }
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['claude-3-5-sonnet-20241022'];
    
    const promptCost = (promptTokens / 1000) * modelPricing.prompt;
    const completionCost = (completionTokens / 1000) * modelPricing.completion;
    
    return parseFloat((promptCost + completionCost).toFixed(6));
  }

  getRequestMetrics(): {
    totalRequests: number;
    requestsPerEndpoint: Record<string, number>;
    statusCodeDistribution: Record<number, number>;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  } {
    const totalRequests = this.requests.length;
    const requestsPerEndpoint = Object.fromEntries(this.requestCounts);
    const statusCodeDistribution = Object.fromEntries(this.statusCounts);

    const responseTimes = this.requests.map(r => r.duration);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length || 0;
    
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p95Index = Math.ceil(sortedTimes.length * 0.95) - 1;
    const p99Index = Math.ceil(sortedTimes.length * 0.99) - 1;
    
    const p95ResponseTime = sortedTimes[p95Index] || 0;
    const p99ResponseTime = sortedTimes[p99Index] || 0;

    return {
      totalRequests,
      requestsPerEndpoint,
      statusCodeDistribution,
      averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
      p95ResponseTime: parseFloat(p95ResponseTime.toFixed(2)),
      p99ResponseTime: parseFloat(p99ResponseTime.toFixed(2))
    };
  }

  getErrorMetrics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByEndpoint: Record<string, number>;
    recentErrors: ErrorMetrics[];
  } {
    const errorsByEndpoint: Record<string, number> = {};
    this.errors.forEach(error => {
      errorsByEndpoint[error.endpoint] = (errorsByEndpoint[error.endpoint] || 0) + 1;
    });

    return {
      totalErrors: this.errors.length,
      errorsByType: Object.fromEntries(this.errorCounts),
      errorsByEndpoint,
      recentErrors: this.errors.slice(-10)
    };
  }

  getAIMetrics(): {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    tokensByModel: Record<string, { prompt: number; completion: number; total: number }>;
    costByModel: Record<string, number>;
    dailyUsage: Array<{ date: string; tokens: number; cost: number }>;
  } {
    const totalRequests = this.aiUsage.length;
    const totalTokens = this.aiUsage.reduce((sum, usage) => sum + usage.totalTokens, 0);
    const totalCost = this.aiUsage.reduce((sum, usage) => sum + usage.cost, 0);

    const tokensByModel: Record<string, { prompt: number; completion: number; total: number }> = {};
    const costByModel: Record<string, number> = {};

    this.aiUsage.forEach(usage => {
      if (!tokensByModel[usage.model]) {
        tokensByModel[usage.model] = { prompt: 0, completion: 0, total: 0 };
        costByModel[usage.model] = 0;
      }
      
      tokensByModel[usage.model].prompt += usage.promptTokens;
      tokensByModel[usage.model].completion += usage.completionTokens;
      tokensByModel[usage.model].total += usage.totalTokens;
      costByModel[usage.model] += usage.cost;
    });

    // Group by day for daily usage
    const dailyUsageMap = new Map<string, { tokens: number; cost: number }>();
    this.aiUsage.forEach(usage => {
      const date = usage.timestamp.toISOString().split('T')[0];
      const existing = dailyUsageMap.get(date) || { tokens: 0, cost: 0 };
      existing.tokens += usage.totalTokens;
      existing.cost += usage.cost;
      dailyUsageMap.set(date, existing);
    });

    const dailyUsage = Array.from(dailyUsageMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days

    return {
      totalRequests,
      totalTokens,
      totalCost: parseFloat(totalCost.toFixed(6)),
      tokensByModel,
      costByModel: Object.fromEntries(
        Object.entries(costByModel).map(([model, cost]) => [model, parseFloat(cost.toFixed(6))])
      ),
      dailyUsage
    };
  }

  getSystemMetrics(): {
    uptime: number;
    uptimeHuman: string;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    cpuUsage: NodeJS.CpuUsage;
  } {
    const uptime = Date.now() - this.startTime.getTime();
    const uptimeSeconds = Math.floor(uptime / 1000);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    const uptimeHuman = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      uptime: uptimeSeconds,
      uptimeHuman,
      memoryUsage: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      cpuUsage
    };
  }

  getAllMetrics(): {
    requests: ReturnType<MetricsService['getRequestMetrics']>;
    errors: ReturnType<MetricsService['getErrorMetrics']>;
    ai: ReturnType<MetricsService['getAIMetrics']>;
    system: ReturnType<MetricsService['getSystemMetrics']>;
    timestamp: Date;
  } {
    return {
      requests: this.getRequestMetrics(),
      errors: this.getErrorMetrics(),
      ai: this.getAIMetrics(),
      system: this.getSystemMetrics(),
      timestamp: new Date()
    };
  }

  clear(): void {
    this.requests = [];
    this.errors = [];
    this.aiUsage = [];
    this.requestCounts.clear();
    this.statusCounts.clear();
    this.errorCounts.clear();
  }
}