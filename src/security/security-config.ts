import { SecurityMiddlewareConfig } from './security-middleware';

const ZIP_FILE_HEADER_PATTERN = '^PK' + String.fromCharCode(0x03, 0x04);

export interface SecurityConfig {
  middleware: SecurityMiddlewareConfig;
  encryption: {
    algorithm: string;
    keyLength: number;
    saltLength: number;
  };
  audit: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    retentionDays: number;
  };
  alerts: {
    enabled: boolean;
    threshold: {
      rateLimit: number;
      failedLogins: number;
      suspiciousActivity: number;
    };
    recipients: string[];
  };
}

export const defaultSecurityConfig: SecurityConfig = {
  middleware: {
    enableCSP: true,
    enableRateLimit: true,
    enableCSRF: true,
    enableInputValidation: true,
    enableFileValidation: true,
    trustedOrigins: ['localhost', '127.0.0.1', 'app://.'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['.json', '.ts', '.js', '.md', '.txt', '.css', '.html'],
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    saltLength: 16,
  },
  audit: {
    enabled: true,
    logLevel: 'info',
    retentionDays: 30,
  },
  alerts: {
    enabled: true,
    threshold: {
      rateLimit: 100,
      failedLogins: 10,
      suspiciousActivity: 5,
    },
    recipients: ['admin@example.com'],
  },
};

export const productionSecurityConfig: SecurityConfig = {
  ...defaultSecurityConfig,
  middleware: {
    ...defaultSecurityConfig.middleware,
    trustedOrigins: [], // Empty in production - must be explicitly configured
    maxFileSize: 5 * 1024 * 1024, // 5MB in production
    allowedFileTypes: ['.json', '.ts', '.js', '.md', '.txt'],
  },
  audit: {
    ...defaultSecurityConfig.audit,
    logLevel: 'warn',
    retentionDays: 90,
  },
  alerts: {
    ...defaultSecurityConfig.alerts,
    threshold: {
      rateLimit: 50,
      failedLogins: 5,
      suspiciousActivity: 3,
    },
  },
};

export const developmentSecurityConfig: SecurityConfig = {
  ...defaultSecurityConfig,
  middleware: {
    ...defaultSecurityConfig.middleware,
    enableRateLimit: false, // Relaxed in development
    trustedOrigins: ['localhost', '127.0.0.1', 'app://.', 'http://localhost:*'],
  },
  audit: {
    ...defaultSecurityConfig.audit,
    logLevel: 'debug',
  },
  alerts: {
    ...defaultSecurityConfig.alerts,
    enabled: false, // Disabled in development
  },
};

// Environment-specific configurations
export const getSecurityConfig = (): SecurityConfig => {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return productionSecurityConfig;
    case 'test':
      return {
        ...developmentSecurityConfig,
        audit: { ...developmentSecurityConfig.audit, enabled: false },
      };
    default:
      return developmentSecurityConfig;
  }
};

// Security policy definitions
export const securityPolicies = {
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    maxAgeDays: 90,
  },
  session: {
    timeoutMinutes: 30,
    concurrentSessions: 3,
    secureCookies: true,
    httpOnly: true,
    sameSite: 'strict' as const,
  },
  api: {
    rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    maxRequestsPerWindow: 100,
    burstLimit: 20,
    whitelist: ['127.0.0.1'],
  },
  cors: {
    allowedOrigins: [] as string[], // Must be configured per deployment
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    maxAge: 86400,
  },
};

// Security headers configuration
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// File upload restrictions
export const fileUploadConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB (matches test expectations)
  allowedMimeTypes: [
    'application/json',
    'text/plain',
    'text/markdown',
    'application/typescript',
    'text/css',
    'text/html',
    'text/xml',
    'application/xml',
    'text/csv'
  ],
  forbiddenExtensions: ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.jar', '.dll', '.sys', '.msi', '.sh', '.php', '.js'],
  malwareSignatures: [
    /^MZ/, // DOS/PE executable header
    new RegExp(ZIP_FILE_HEADER_PATTERN), // ZIP/JAR file header
    /#!\/bin\/(ba)?sh/, // Shell script header
    /This program cannot be run in DOS mode/, // DOS stub message
    /X5O!P%@AP\[4\PZX54/, // EICAR test signature
    /CreateObject\("WScript\.Shell"\)/, // Common malware pattern
    /powershell\.exe -ExecutionPolicy bypass/, // PowerShell execution
    /cmd\.exe \/c/, // Command prompt execution
    /net\.webClient\.downloadFile/, // Suspicious download
    /certutil\.exe -urlcache/, // Certificate utility abuse
  ],
  scanForViruses: true,
  quarantineSuspicious: true,
  maxScanSize: 10 * 1024 * 1024 // 10MB scan limit
};

// Static methods for backward compatibility with tests
export class SecurityConfigUtils {
  static validateFilePath(filename: string): { valid: boolean; error?: string } {
    const extension = '.' + filename.split('.').pop()?.toLowerCase();
    if (fileUploadConfig.forbiddenExtensions.includes(extension)) {
      return { valid: false, error: 'Forbidden file extension - unsafe file type' };
    }
    return { valid: true };
  }

  static validateFileSize(size: number): { valid: boolean; error?: string } {
    if (size > fileUploadConfig.maxFileSize) {
      return { valid: false, error: 'File too large - exceeds size limit' };
    }
    return { valid: true };
  }

  static validateFileContent(content: string, filename: string): { valid: boolean; error?: string } {
    const extension = '.' + filename.split('.').pop()?.toLowerCase();
    
    // Check file extension first
    if (fileUploadConfig.forbiddenExtensions.includes(extension)) {
      return { valid: false, error: 'Forbidden file extension - unsafe file type' };
    }
    
    // For JSON files, validate JSON structure
    if (extension === '.json') {
      try {
        const parsed = JSON.parse(content);
        // Check for circular references and depth
        const stringified = JSON.stringify(parsed);
        if (stringified.length > fileUploadConfig.maxScanSize) {
          return { valid: false, error: 'JSON content too large - exceeds scan limit' };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: 'Invalid JSON format - malformed content' };
      }
    }
    
    // Check for malware signatures
    for (const signature of fileUploadConfig.malwareSignatures) {
      if (signature.test(content)) {
        return { valid: false, error: 'Malware signature detected - unsafe content' };
      }
    }
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
      /<!DOCTYPE[^>]*\[<!ENTITY[^>]*>/gi, // XXE
      /<!ENTITY[^>]*SYSTEM[^>]*>/gi, // XXE
      /<%/gi, // ASP/PHP markers
      /%>/gi,
      /<%=/gi,
      /php\s*:/gi, // PHP tags
      /document\.write\s*\(/gi, // DOM manipulation
      /window\.location\s*=/gi, // Redirection
      /fetch\s*\(/gi, // Network requests
      /localStorage\./gi, // Storage access
      /atob\s*\(/gi, // Base64 decoding
      /new\s+Function\s*\(/gi, // Dynamic function creation
      /setTimeout\s*\(\s*["'`][^"'`]*["'`]/gi, // String-based setTimeout
      /setInterval\s*\(\s*["'`][^"'`]*["'`]/gi, // String-based setInterval
      /require\s*\(\s*["'`][^"'`]*["'`]\s*\)/gi, // Dynamic require
      /process\.mainModule/gi, // Node.js process access
      /child_process/gi, // Child process spawning
      /\bshell\b/gi, // Shell access
    ];
  
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        // Return specific error messages for XXE
        if (pattern.source.includes('ENTITY')) {
          return { valid: false, error: 'XXE/external entity detected - unsafe XML content' };
        }
        return { valid: false, error: 'Suspicious content detected - potentially malicious code' };
      }
    }
  
    // Check content size
    if (content.length > fileUploadConfig.maxScanSize) {
      return { valid: false, error: 'Content too large for scanning - exceeds size limit' };
    }
    
    return { valid: true };
  }

  static validateFileUpload(file: { name: string; size: number; type: string }): { valid: boolean; error?: string } {
    const nameValidation = this.validateFilePath(file.name);
    if (!nameValidation.valid) {
      return nameValidation;
    }
  
    const sizeValidation = this.validateFileSize(file.size);
    if (!sizeValidation.valid) {
      return sizeValidation;
    }
  
    // Validate MIME type
    if (!fileUploadConfig.allowedMimeTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid MIME type - unsafe content type' };
    }
  
    // Additional malware checks for binary files
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (fileUploadConfig.forbiddenExtensions.includes(extension)) {
      return { valid: false, error: 'Forbidden file extension - unsafe file type' };
    }
    if (file.type.includes('application/octet-stream') || 
        file.type.includes('application/x-msdownload') ||
        file.type.includes('application/x-executable')) {
      return { valid: false, error: 'Binary files are not allowed - unsafe file type' };
    }
  
    return { valid: true };
  }

  static getSecurityHeaders(isDevelopment: boolean): Record<string, string> {
    if (isDevelopment) {
      return {
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* ws://localhost:*",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      };
    }

    return {
      ...securityHeaders,
      'Content-Security-Policy': `default-src 'self'; script-src 'self' 'nonce-${Math.random().toString(36).substring(2)}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: https:;`,
    };
  }
}

// Input validation rules
export const validationRules = {
  string: {
    maxLength: 1000,
    minLength: 1,
    pattern: /^[\w\s\-.,!?()@#$%^&*+=]*$/,
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254,
  },
  url: {
    pattern: /^https?:\/\/.+/,
    maxLength: 2048,
  },
  filename: {
    pattern: /^[\w-]+\.[\w]+$/,
    maxLength: 255,
    forbiddenChars: ['<', '>', ':', '"', '|', '?', '*'],
  },
  json: {
    maxDepth: 10,
    maxKeys: 100,
    maxStringLength: 10000,
  },
};

// Security event types
export const securityEventTypes = {
  AUTH_SUCCESS: 'auth.success',
  AUTH_FAILURE: 'auth.failure',
  XSS_ATTEMPT: 'security.xss_attempt',
  SQL_INJECTION: 'security.sql_injection',
  PATH_TRAVERSAL: 'security.path_traversal',
  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
  INVALID_CSRF: 'security.invalid_csrf',
  FILE_UPLOAD_VIOLATION: 'security.file_upload_violation',
  SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
  CONFIG_CHANGE: 'security.config_change',
  PRIVILEGE_ESCALATION: 'security.privilege_escalation',
} as const;

// Security monitoring thresholds
export const monitoringThresholds = {
  failedLogins: {
    warning: 5,
    critical: 10,
    lockout: 15,
    windowMinutes: 15,
  },
  rateLimit: {
    warning: 80,
    critical: 95,
    windowMinutes: 1,
  },
  suspiciousActivity: {
    warning: 3,
    critical: 5,
    windowMinutes: 5,
  },
  fileUpload: {
    warning: 10,
    critical: 20,
    windowMinutes: 60,
  },
};

// Security response actions
export const securityResponses = {
  BLOCK_IP: 'block_ip',
  LOCK_ACCOUNT: 'lock_account',
  RESET_SESSION: 'reset_session',
  REQUIRE_MFA: 'require_mfa',
  NOTIFY_ADMIN: 'notify_admin',
  LOG_EVENT: 'log_event',
  QUARANTINE_FILE: 'quarantine_file',
} as const;

// Export all configurations
export default {
  getSecurityConfig,
  securityPolicies,
  securityHeaders,
  fileUploadConfig,
  validationRules,
  securityEventTypes,
  monitoringThresholds,
  securityResponses,
};
