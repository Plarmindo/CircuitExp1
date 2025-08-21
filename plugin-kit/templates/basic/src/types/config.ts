export interface PluginKitConfig {
  name: string;
  version: string;
  description: string;
  integration: {
    type: string;
    entryPoint: string;
    runtime: string;
  };
  ai: {
    providers: {
      [key: string]: {
        enabled: boolean;
        models: string[];
        defaultModel: string;
      };
    };
    features: {
      codeCompletion: boolean;
      codeReview: boolean;
      bugDetection: boolean;
      documentation: boolean;
      testGeneration: boolean;
      performanceAnalysis: boolean;
      securityScanning: boolean;
    };
    limits: {
      maxTokens: number;
      maxRequestsPerMinute: number;
      maxContextLength: number;
    };
  };
  api: {
    endpoints: {
      [key: string]: string;
    };
    authentication: {
      type: string;
      header: string;
      required: boolean;
    };
    cors: {
      enabled: boolean;
      origins: string[];
      methods: string[];
      headers: string[];
    };
    rateLimit: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
    };
  };
  logging: {
    level: string;
    format: string;
    file: {
      enabled: boolean;
      path: string;
      maxSize: string;
      maxFiles: number;
    };
    console: {
      enabled: boolean;
      colorize: boolean;
    };
  };
  storage: {
    type: string;
    cache: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
    };
    persistence: {
      enabled: boolean;
      path: string;
    };
  };
  security: {
    inputValidation: boolean;
    outputSanitization: boolean;
    apiKeyRotation: boolean;
    encryption: {
      enabled: boolean;
      algorithm: string;
    };
  };
  monitoring: {
    enabled: boolean;
    metrics: {
      requests: boolean;
      errors: boolean;
      performance: boolean;
      usage: boolean;
    };
    healthChecks: {
      enabled: boolean;
      interval: number;
    };
  };
  deployment: {
    docker: {
      enabled: boolean;
      image: string;
      tag: string;
    };
    kubernetes: {
      enabled: boolean;
      namespace: string;
      replicas: number;
    };
    serverless: {
      enabled: boolean;
      platform: string;
    };
  };
}

export interface AIProviderConfig {
  enabled: boolean;
  models: string[];
  defaultModel: string;
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
}

export interface SecurityConfig {
  inputValidation: boolean;
  outputSanitization: boolean;
  apiKeyRotation: boolean;
  encryption: {
    enabled: boolean;
    algorithm: string;
  };
}