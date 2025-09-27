import { SecurityHardening } from './security-hardening';
import * as electronSecurity from '../../electron/security-config.cjs';

export interface SecurityMiddlewareConfig {
  enableCSP: boolean;
  enableRateLimit: boolean;
  enableCSRF: boolean;
  enableInputValidation: boolean;
  enableFileValidation: boolean;
  trustedOrigins: string[];
  maxFileSize: number;
  allowedFileTypes: string[];
}

export class SecurityMiddleware {
  private security: SecurityHardening;
  private config: SecurityMiddlewareConfig;

  constructor(config: Partial<SecurityMiddlewareConfig> = {}) {
    this.security = SecurityHardening.getInstance();
    this.config = {
      enableCSP: true,
      enableRateLimit: true,
      enableCSRF: true,
      enableInputValidation: true,
      enableFileValidation: true,
      trustedOrigins: ['localhost', '127.0.0.1'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: ['.json', '.ts', '.js', '.md', '.txt'],
      ...config,
    };
  }

  /**
   * Express-style middleware for HTTP security
   */
  public httpSecurity = (req: unknown, res: unknown, next: () => void) => {
    try {
      // Add security headers
      if (this.config.enableCSP) {
        const nonce = electronSecurity.SecurityValidator.generateNonce();
        const csp = electronSecurity.SECURITY_CONSTANTS.CSP_PRODUCTION.replace('{nonce}', nonce);
        res.setHeader('Content-Security-Policy', csp);
        res.setHeader('X-Nonce', nonce);
      }

      // Add additional security headers (avoid overriding CSP set above)
      const headers = electronSecurity.SecurityValidator.getSecurityHeaders();
      Object.entries(headers).forEach(([key, value]) => {
        if (key === 'Content-Security-Policy') return; // preserve nonced CSP
        res.setHeader(key, value as string);
      });

      // Origin validation
      const origin = req.headers.origin || req.headers.referer;
      if (origin && !this.isTrustedOrigin(origin)) {
        this.security.logSecurityEvent('UNTRUSTED_ORIGIN', { origin, ip: req.ip });
        return res.status(403).json({ error: 'Untrusted origin' });
      }

      // Rate limiting
      if (this.config.enableRateLimit) {
        const clientIP = req.ip || req.connection.remoteAddress;
        if (!this.security.checkRateLimit(clientIP, 'http')) {
          this.security.logSecurityEvent('RATE_LIMIT_EXCEEDED', { ip: clientIP });
          return res.status(429).json({ error: 'Rate limit exceeded' });
        }
      }

      return next();
    } catch (error) {
      this.security.logSecurityEvent('HTTP_SECURITY_ERROR', { error: String(error) });
      return res.status(500).json({ error: 'Security middleware error' });
    }
  };

  /**
   * Validate and sanitize input data
   */
  public validateInput = (data: unknown, type: string) => {
    if (!this.config.enableInputValidation) {
      return { valid: true, sanitized: data };
    }

    try {
      const result = this.security.validateInput(JSON.stringify(data), type);
      if (!result.valid) {
        this.security.logSecurityEvent('INVALID_INPUT', { type, error: result.error });
      }
      return result;
    } catch (error) {
      this.security.logSecurityEvent('VALIDATION_ERROR', { type, error: error.message });
      return { valid: false, sanitized: null, error: 'Validation failed' };
    }
  };

  /**
   * Validate file uploads
   */
  public validateFileUpload = (file: Record<string, unknown>) => {
    if (!this.config.enableFileValidation) {
      return { valid: true };
    }

    const validation = electronSecurity.SecurityValidator.validateFileUpload(file);
    if (!validation.valid) {
      this.security.logSecurityEvent('FILE_UPLOAD_REJECTED', { reason: validation.error });
      return { valid: false, error: validation.error };
    }
    return { valid: true };
  };

  /**
   * Validate file content
   */
  public validateFileContent = (content: string, filename: string) => {
    if (!this.config.enableFileValidation) {
      return { valid: true };
    }

    const validation = electronSecurity.SecurityValidator.validateFileContent(content, filename);
    if (!validation.valid) {
      this.security.logSecurityEvent('FILE_CONTENT_REJECTED', { reason: validation.error, filename });
      return { valid: false, error: validation.error };
    }
    return { valid: true };
  };

  /**
   * CSRF token validation middleware
   */
  public validateCSRF = (req: unknown, res: unknown, next: () => void) => {
    if (!this.config.enableCSRF) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken) {
      this.security.logSecurityEvent('MISSING_CSRF_TOKEN', { ip: req.ip });
      return res.status(403).json({ error: 'CSRF token missing' });
    }

    const validation = this.security.validateCSRFToken(token, sessionToken);
    if (!validation.valid) {
      this.security.logSecurityEvent('INVALID_CSRF_TOKEN', { ip: req.ip });
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    next();
  };

  /**
   * WebSocket security handler
   */
  public wsSecurity = (ws: unknown, req: unknown) => {
    const clientIP = req.connection.remoteAddress;

    // Rate limiting for WebSocket connections
    if (this.config.enableRateLimit) {
      if (!this.security.checkRateLimit(clientIP, 'websocket')) {
        this.security.logSecurityEvent('WS_RATE_LIMIT_EXCEEDED', { ip: clientIP });
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
    }

    // IP validation
    if (!this.security.validateIPAddress(clientIP).valid) {
      this.security.logSecurityEvent('INVALID_IP', { ip: clientIP });
      ws.close(1008, 'Invalid IP address');
      return;
    }

    // Message validation
    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        const validation = this.validateInput(message, 'json');

        if (!validation.valid) {
          this.security.logSecurityEvent('INVALID_WS_MESSAGE', {
            ip: clientIP,
            error: validation.error,
          });
          ws.close(1008, 'Invalid message format');
        }
      } catch (error) {
        this.security.logSecurityEvent('WS_MESSAGE_ERROR', {
          ip: clientIP,
          error: error.message,
        });
        ws.close(1008, 'Message parsing error');
      }
    });
  };

  /**
   * File system access security
   */
  public validateFileAccess = (filePath: string, _operation: 'read' | 'write' | 'delete') => {
    const pathValidation = electronSecurity.SecurityValidator.validateFilePath(filePath);
    if (!pathValidation.valid) {
      this.security.logSecurityEvent('INVALID_FILE_PATH', { filePath, error: pathValidation.error });
      return { valid: false, error: pathValidation.error };
    }
    return { valid: true };
  };

  /**
   * Plugin security validation
   */
  public validatePlugin = (pluginCode: string, pluginPath: string) => {
    // Validate file path
    const pathValidation = this.validateFileAccess(pluginPath, 'read');
    if (!pathValidation.valid) {
      return pathValidation;
    }

    // Validate content
    const contentValidation = this.validateFileContent(pluginCode, pluginPath);
    if (!contentValidation.valid) {
      return contentValidation;
    }

    // Additional plugin-specific validations
    const forbiddenPatterns = [
      /eval\s*\(/,
      /new\s+Function\s*\(/,
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /require\s*\(\s*['"]fs['"]\s*\)/,
      /process\.exit/,
      /process\.kill/,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(pluginCode)) {
        this.security.logSecurityEvent('FORBIDDEN_PLUGIN_PATTERN', {
          pattern: pattern.source,
          path: pluginPath,
        });
        return { valid: false, error: 'Forbidden pattern detected in plugin' };
      }
    }

    return { valid: true };
  };

  /**
   * Get security metrics
   */
  public getSecurityMetrics = () => {
    const events = this.security.getSecurityEvents();
    const last24Hours = events.filter(
      (event) => Date.now() - event.timestamp < 24 * 60 * 60 * 1000
    );

    return {
      totalEvents: events.length,
      last24Hours: last24Hours.length,
      blockedRequests: last24Hours.filter((e) => e.type.includes('BLOCKED')).length,
      threatTypes: this.getThreatTypeCounts(last24Hours),
      rateLimitedIPs: this.getRateLimitedIPs(),
    };
  };

  /**
   * Security audit report
   */
  public generateSecurityReport = () => {
    const events = this.security.getSecurityEvents();
    const metrics = this.getSecurityMetrics();

    return {
      timestamp: new Date().toISOString(),
      metrics,
      recentEvents: events.slice(-100),
      recommendations: this.generateRecommendations(events),
      configuration: this.config,
    };
  };

  private isTrustedOrigin = (origin: string): boolean => {
    try {
      const url = new URL(origin);
      return this.config.trustedOrigins.some((trusted) =>
        url.hostname.includes(trusted)
      );
    } catch {
      return false;
    }
  };

  private getThreatTypeCounts = (events: Record<string, unknown>[]) => {
    const counts: Record<string, number> = {};
    events.forEach((event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });
    return counts;
  };

  private getRateLimitedIPs = () => {
    // This would need to be implemented based on the rate limiter
    return [];
  };

  private generateRecommendations = (events: Record<string, unknown>[]) => {
    const recommendations: string[] = [];
    const threatCounts = this.getThreatTypeCounts(events);

    if (threatCounts.XSS_ATTEMPT > 10) {
      recommendations.push('Consider implementing additional XSS protection');
    }

    if (threatCounts.RATE_LIMIT_EXCEEDED > 50) {
      recommendations.push('Review rate limiting configuration');
    }

    if (threatCounts.INVALID_FILE_ACCESS > 5) {
      recommendations.push('Review file access permissions');
    }

    return recommendations;
  };
}

export const securityMiddleware = new SecurityMiddleware();
