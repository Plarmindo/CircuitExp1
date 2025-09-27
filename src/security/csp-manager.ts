/**
 * Content Security Policy Manager
 * Provides nonce-based CSP implementation for enhanced security
 */

import { randomBytes } from 'crypto';

export interface CSPConfig {
  nonce?: string;
  allowUnsafeInline?: boolean;
  allowUnsafeEval?: boolean;
  reportUri?: string;
  reportOnly?: boolean;
}

export interface CSPDirectives {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  fontSrc: string[];
  connectSrc: string[];
  objectSrc: string[];
  frameAncestors: string[];
  baseUri: string[];
  formAction: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
}

export class CSPManager {
  private static instance: CSPManager;
  private currentNonce: string | null = null;
  private nonceRotationInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): CSPManager {
    if (!CSPManager.instance) {
      CSPManager.instance = new CSPManager();
    }
    return CSPManager.instance;
  }

  /**
   * Generate a cryptographically secure nonce
   */
  public generateNonce(): string {
    return randomBytes(16).toString('base64');
  }

  /**
   * Get the current nonce (generates one if none exists)
   */
  public getCurrentNonce(): string {
    if (!this.currentNonce) {
      this.currentNonce = this.generateNonce();
    }
    return this.currentNonce;
  }

  /**
   * Rotate the nonce (for enhanced security)
   */
  public rotateNonce(): string {
    this.currentNonce = this.generateNonce();
    return this.currentNonce;
  }

  /**
   * Start automatic nonce rotation
   */
  public startNonceRotation(intervalMs: number = 300000): void { // 5 minutes default
    if (this.nonceRotationInterval) {
      clearInterval(this.nonceRotationInterval);
    }

    this.nonceRotationInterval = setInterval(() => {
      this.rotateNonce();
    }, intervalMs);
  }

  /**
   * Stop automatic nonce rotation
   */
  public stopNonceRotation(): void {
    if (this.nonceRotationInterval) {
      clearInterval(this.nonceRotationInterval);
      this.nonceRotationInterval = null;
    }
  }

  /**
   * Get production CSP directives (hardened)
   */
  public getProductionDirectives(config: CSPConfig = {}): CSPDirectives {
    const _nonce = config.nonce || this.getCurrentNonce();

    return {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        `'nonce-${_nonce}'`,
        // Remove unsafe-eval and unsafe-inline for production
        ...(config.allowUnsafeEval ? ["'unsafe-eval'"] : []),
      ],
      styleSrc: [
        "'self'",
        `'nonce-${_nonce}'`,
        // Allow only nonce-based inline styles
        ...(config.allowUnsafeInline ? ["'unsafe-inline'"] : []),
      ],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'none'"],
      upgradeInsecureRequests: true,
      blockAllMixedContent: true,
    };
  }

  /**
   * Get development CSP directives (relaxed for debugging)
   */
  public getDevelopmentDirectives(devPort: number, config: CSPConfig = {}): CSPDirectives {
    const _nonce = config.nonce || this.getCurrentNonce();

    return {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite HMR
        "'unsafe-eval'", // Required for PixiJS and development
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite injected styles
      ],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: [
        "'self'",
        `http://localhost:${devPort}`,
        `ws://localhost:${devPort}`,
      ],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'none'"],
    };
  }

  /**
   * Convert CSP directives to header string
   */
  public directivesToString(directives: CSPDirectives): string {
    const parts: string[] = [];

    // Add standard directives
    parts.push(`default-src ${directives.defaultSrc.join(' ')}`);
    parts.push(`script-src ${directives.scriptSrc.join(' ')}`);
    parts.push(`style-src ${directives.styleSrc.join(' ')}`);
    parts.push(`img-src ${directives.imgSrc.join(' ')}`);
    parts.push(`font-src ${directives.fontSrc.join(' ')}`);
    parts.push(`connect-src ${directives.connectSrc.join(' ')}`);
    parts.push(`object-src ${directives.objectSrc.join(' ')}`);
    parts.push(`frame-ancestors ${directives.frameAncestors.join(' ')}`);
    parts.push(`base-uri ${directives.baseUri.join(' ')}`);
    parts.push(`form-action ${directives.formAction.join(' ')}`);

    // Add boolean directives
    if (directives.upgradeInsecureRequests) {
      parts.push('upgrade-insecure-requests');
    }
    if (directives.blockAllMixedContent) {
      parts.push('block-all-mixed-content');
    }

    return parts.join('; ');
  }

  /**
   * Get complete CSP header string for production
   */
  public getProductionCSP(config: CSPConfig = {}): string {
    const directives = this.getProductionDirectives(config);
    return this.directivesToString(directives);
  }

  /**
   * Get complete CSP header string for development
   */
  public getDevelopmentCSP(devPort: number, config: CSPConfig = {}): string {
    const directives = this.getDevelopmentDirectives(devPort, config);
    return this.directivesToString(directives);
  }

  /**
   * Get security headers bundle
   */
  public getSecurityHeaders(isDevelopment: boolean = false, devPort?: number): Record<string, string> {
    const csp = isDevelopment && devPort
      ? this.getDevelopmentCSP(devPort)
      : this.getProductionCSP();

    return {
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    };
  }

  /**
   * Validate CSP configuration
   */
  public validateConfig(config: CSPConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.nonce && config.nonce.length < 16) {
      errors.push('Nonce should be at least 16 characters long');
    }

    if (config.allowUnsafeInline && config.allowUnsafeEval) {
      errors.push('Both unsafe-inline and unsafe-eval should not be enabled in production');
    }

    if (config.reportUri && !config.reportUri.startsWith('https://')) {
      errors.push('Report URI should use HTTPS');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopNonceRotation();
    this.currentNonce = null;
  }
}

// Export singleton instance
export const cspManager = CSPManager.getInstance();

// Export utility functions
export function createNonceScript(content: string, nonce?: string): string {
  const nonceAttr = nonce || cspManager.getCurrentNonce();
  return `<script nonce="${nonceAttr}">${content}</script>`;
}

export function createNonceStyle(content: string, nonce?: string): string {
  const nonceAttr = nonce || cspManager.getCurrentNonce();
  return `<style nonce="${nonceAttr}">${content}</style>`;
}

// CSP violation reporting
export interface CSPViolationReport {
  'document-uri': string;
  referrer: string;
  'violated-directive': string;
  'effective-directive': string;
  'original-policy': string;
  disposition: string;
  'blocked-uri': string;
  'line-number': number;
  'column-number': number;
  'source-file': string;
  'status-code': number;
  'script-sample': string;
}

export function handleCSPViolation(report: CSPViolationReport): void {
  console.warn('[CSP Violation]', {
    directive: report['violated-directive'],
    blockedUri: report['blocked-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
    columnNumber: report['column-number'],
    sample: report['script-sample'],
  });

  // In production, you might want to send this to a logging service
  // logService.warn('CSP Violation', report);
}
