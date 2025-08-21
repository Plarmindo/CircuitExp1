/**
 * TypeScript type definitions for CircuitExp1 AI LLM Plugin Kit API
 * These types align with the OpenAPI specification
 */

// Base types
export interface BaseResponse<T = any> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  details?: string[];
  timestamp: string;
}

// Health and configuration types
export interface HealthData {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

export interface ConfigData {
  name: string;
  version: string;
  ai: {
    providers: string[];
    features: string[];
  };
  api: {
    port: number;
    host: string;
    endpoints: string[];
  };
  logging: {
    level: string;
    file: string;
  };
}

// AI Provider types
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'custom';

export interface AIProviderConfig {
  name: string;
  apiKey: string;
  baseUrl?: string;
  models: string[];
  defaultModel: string;
  rateLimit?: {
    requests: number;
    window: number;
  };
}

// Completion types
export interface CompletionRequest {
  prompt: string;
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export interface CompletionData {
  completion: string;
  provider: string;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason?: string;
}

// Review types
export interface ReviewRequest {
  code: string;
  language?: string;
  rules?: string[];
  context?: string;
}

export interface ReviewItem {
  line: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
  category?: string;
  suggestion?: string;
}

export interface ReviewData {
  review: ReviewItem[];
  score: number;
  summary: string;
  recommendations: string[];
}

// Analysis types
export interface AnalysisRequest {
  code: string;
  type: 'performance' | 'security' | 'complexity' | 'maintainability';
  language?: string;
  context?: string;
}

export interface AnalysisMetric {
  name: string;
  value: number | string;
  threshold?: number;
  status: 'good' | 'warning' | 'critical';
}

export interface AnalysisData {
  complexity?: {
    cyclomatic: number;
    cognitive: number;
    maintainability: number;
  };
  security?: {
    vulnerabilities: SecurityIssue[];
    riskScore: number;
  };
  performance?: {
    bottlenecks: PerformanceIssue[];
    recommendations: string[];
  };
  metrics: AnalysisMetric[];
  suggestions: string[];
}

export interface SecurityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  line?: number;
  fix?: string;
}

export interface PerformanceIssue {
  type: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  line?: number;
  suggestion?: string;
}

// Bug detection types
export interface BugDetectionRequest {
  code: string;
  language?: string;
  context?: string;
}

export interface BugDetectionData {
  bugs: BugReport[];
  confidence: number;
  analysisTime: number;
}

export interface BugReport {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  line?: number;
  fix?: string;
  category: 'logic' | 'syntax' | 'performance' | 'security';
}

// Test generation types
export interface TestGenerationRequest {
  code: string;
  framework?: string;
  language?: string;
  testType?: 'unit' | 'integration' | 'e2e';
  coverageTarget?: number;
}

export interface TestGenerationData {
  tests: GeneratedTest[];
  framework: string;
  coverageEstimate: number;
  dependencies: string[];
}

export interface GeneratedTest {
  name: string;
  code: string;
  description: string;
  assertions: number;
  mocks?: string[];
}

// Documentation types
export interface DocumentationRequest {
  code: string;
  format: 'jsdoc' | 'markdown' | 'docstring' | 'rst';
  language?: string;
  style?: 'concise' | 'detailed' | 'api';
}

export interface DocumentationData {
  documentation: string;
  format: string;
  sections: DocumentationSection[];
  examples?: CodeExample[];
}

export interface DocumentationSection {
  type: 'overview' | 'parameters' | 'returns' | 'examples' | 'notes';
  content: string;
}

export interface CodeExample {
  title: string;
  code: string;
  description: string;
}

// Chat types
export interface ChatRequest {
  message: string;
  context?: Record<string, any>;
  sessionId?: string;
  provider?: AIProvider;
  model?: string;
  temperature?: number;
}

export interface ChatData {
  response: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  sessionId?: string;
  context?: Record<string, any>;
}

// Streaming types
export interface StreamChunk {
  type: 'content' | 'error' | 'done';
  data: string;
  metadata?: Record<string, any>;
}

// Plugin configuration types
export interface PluginConfig {
  name: string;
  version: string;
  description?: string;
  
  ai: {
    providers: Record<string, AIProviderConfig>;
    features: {
      completion: boolean;
      review: boolean;
      analysis: boolean;
      bugDetection: boolean;
      testGeneration: boolean;
      documentation: boolean;
      chat: boolean;
    };
    defaultProvider: AIProvider;
    rateLimits: {
      requests: number;
      window: number;
    };
  };

  api: {
    port: number;
    host: string;
    endpoints: string[];
    cors: {
      enabled: boolean;
      origins: string[];
    };
    rateLimit: {
      windowMs: number;
      max: number;
    };
  };

  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
    console: boolean;
    format: 'json' | 'simple' | 'combined';
  };

  storage: {
    type: 'memory' | 'redis' | 'file';
    ttl: number;
    maxSize: number;
  };

  security: {
    apiKeys: string[];
    jwtSecret?: string;
    cors: {
      enabled: boolean;
      origins: string[];
    };
  };

  monitoring: {
    enabled: boolean;
    metrics: boolean;
    health: boolean;
    endpoint: string;
  };
}

// WebSocket types
export interface WebSocketMessage {
  type: 'request' | 'response' | 'error' | 'ping' | 'pong';
  id?: string;
  data?: any;
  error?: string;
}

export interface WebSocketRequest extends WebSocketMessage {
  type: 'request';
  method: string;
  params?: any;
}

export interface WebSocketResponse extends WebSocketMessage {
  type: 'response';
  result: any;
}

// Error types
export interface APIError extends Error {
  statusCode: number;
  code: string;
  details?: any;
}

export interface ValidationError extends APIError {
  validationErrors: string[];
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  window: number;
}

// Cache types
export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  refresh?: boolean;
}

// Metrics types
export interface MetricsData {
  requests: {
    total: number;
    success: number;
    error: number;
    rate: number;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  ai: {
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    providers: Record<string, {
      requests: number;
      errors: number;
      avgTokens: number;
    }>;
  };
  uptime: number;
}

// SDK types for client libraries
export interface SDKConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface SDKOptions {
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

// Event types for real-time updates
export interface PluginEvent {
  type: 'completion' | 'review' | 'analysis' | 'error' | 'config';
  action: 'start' | 'complete' | 'error';
  data?: any;
  timestamp: string;
  sessionId?: string;
}

// Plugin metadata for marketplace/registry
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  capabilities: string[];
  dependencies: string[];
  repository?: string;
  documentation?: string;
  homepage?: string;
  support?: string;
}

// Response types
export type HealthResponse = BaseResponse<HealthData>;
export type ConfigResponse = BaseResponse<ConfigData>;
export type CompletionResponse = BaseResponse<CompletionData>;
export type ReviewResponse = BaseResponse<ReviewData>;
export type AnalysisResponse = BaseResponse<AnalysisData>;
export type BugDetectionResponse = BaseResponse<BugDetectionData>;
export type TestGenerationResponse = BaseResponse<TestGenerationData>;
export type DocumentationResponse = BaseResponse<DocumentationData>;
export type ChatResponse = BaseResponse<ChatData>;
export type MetricsResponse = BaseResponse<MetricsData>;

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type APIResponse<T> = BaseResponse<T> | ErrorResponse;

// Webhook types
export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
}

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: string;
  signature?: string;
}