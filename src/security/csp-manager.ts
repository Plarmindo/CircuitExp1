/**
 * Content Security Policy Manager
 * Provides nonce-based CSP implementation for enhanced security
 */

import { randomBytes } from 'crypto';
import { createHash } from 'crypto';

export interface CSPConfig {
  nonce?: string;
  allowUnsafeInline?: boolean;
  allowUnsafeEval?: boolean;
  reportUri?: string;
  reportOnly?: boolean;
  trustedDomains?: string[];
}

export interface CSPDirectives {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  fontSrc: string[];
  connectSrc: string[];
  objectSrc: string[];
  mediaSrc: string[];
  childSrc: string[];
  frameAncestors: string[];
  baseUri: string[];
  formAction: string[];
  manifestSrc: string[];
  workerSrc: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
  reportTo?: string;
}

export class CSPManager {
  private static instance: CSPManager;
  private currentNonce: string | null = null;
  private nonceRotationInterval: NodeJS.Timeout | null = null;
  private readonly NONCE_LENGTH = 32; // 256 bits for stronger security
  private readonly NONCE_REGEX = /^[A-Za-z0-9+/=]{16,}$/;

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
    const nonceBuffer = randomBytes(this.NONCE_LENGTH);
    const nonceHash = createHash('sha256').update(nonceBuffer).digest('base64');
    return nonceHash.replace(/[^A-Za-z0-9+/=]/g, '');
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
    const trustedDomains = config.trustedDomains || [];

    const directives: CSPDirectives = {
      defaultSrc: ["'self'", ...trustedDomains],
      scriptSrc: [
        "'self'",
        `'nonce-${_nonce}'`,
        // Remove unsafe-eval and unsafe-inline for production
        ...(config.allowUnsafeEval ? ["'unsafe-eval'"] : []),
        ...trustedDomains
      ],
      styleSrc: [
        "'self'",
        `'nonce-${_nonce}'`,
        // Allow only nonce-based inline styles
        ...(config.allowUnsafeInline ? ["'unsafe-inline'"] : []),
        ...trustedDomains
      ],
      imgSrc: ["'self'", "data:", "blob:", ...trustedDomains],
      fontSrc: ["'self'", "data:", ...trustedDomains],
      connectSrc: ["'self'", "wss:", ...trustedDomains],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", ...trustedDomains],
      childSrc: ["'self'", "blob:", ...trustedDomains],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'none'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: true,
      blockAllMixedContent: true,
    };

    // Add reporting configuration if provided
    if (config.reportUri) {
      directives.reportUri = config.reportUri;
      directives.reportTo = 'csp-endpoint';
    }

    return directives;
  }

  /**
   * Get development CSP directives (relaxed for debugging)
   */
  public getDevelopmentDirectives(devPort: number, config: CSPConfig = {}): CSPDirectives {
    const _nonce = config.nonce || this.getCurrentNonce();
    const trustedDomains = config.trustedDomains || [];

    return {
      defaultSrc: ["'self'", ...trustedDomains],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite HMR
        "'unsafe-eval'", // Required for PixiJS and development
        ...trustedDomains
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite injected styles
        ...trustedDomains
      ],
      imgSrc: ["'self'", "data:", "blob:", ...trustedDomains],
      fontSrc: ["'self'", "data:", ...trustedDomains],
      connectSrc: [
        "'self'",
        `http://localhost:${devPort}`,
        `ws://localhost:${devPort}`,
        ...trustedDomains
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", ...trustedDomains],
      childSrc: ["'self'", "blob:", ...trustedDomains],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'none'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      reportUri: config.reportUri,
      reportTo: config.reportUri ? 'csp-endpoint' : undefined
    };
  }

  /**
   * Convert CSP directives to header string
   */
  public directivesToString(directives: CSPDirectives): string {
    const parts: string[] = [];

    // Add standard directives
    if (directives.defaultSrc?.length) parts.push(`default-src ${directives.defaultSrc.join(' ')}`);
    if (directives.scriptSrc?.length) parts.push(`script-src ${directives.scriptSrc.join(' ')}`);
    if (directives.styleSrc?.length) parts.push(`style-src ${directives.styleSrc.join(' ')}`);
    if (directives.imgSrc?.length) parts.push(`img-src ${directives.imgSrc.join(' ')}`);
    if (directives.fontSrc?.length) parts.push(`font-src ${directives.fontSrc.join(' ')}`);
    if (directives.connectSrc?.length) parts.push(`connect-src ${directives.connectSrc.join(' ')}`);
    if (directives.objectSrc?.length) parts.push(`object-src ${directives.objectSrc.join(' ')}`);
    if (directives.mediaSrc?.length) parts.push(`media-src ${directives.mediaSrc.join(' ')}`);
    if (directives.childSrc?.length) parts.push(`child-src ${directives.childSrc.join(' ')}`);
    if (directives.frameAncestors?.length) parts.push(`frame-ancestors ${directives.frameAncestors.join(' ')}`);
    if (directives.baseUri?.length) parts.push(`base-uri ${directives.baseUri.join(' ')}`);
    if (directives.formAction?.length) parts.push(`form-action ${directives.formAction.join(' ')}`);
    if (directives.manifestSrc?.length) parts.push(`manifest-src ${directives.manifestSrc.join(' ')}`);
    if (directives.workerSrc?.length) parts.push(`worker-src ${directives.workerSrc.join(' ')}`);

    // Add boolean directives
    if (directives.upgradeInsecureRequests) {
      parts.push('upgrade-insecure-requests');
    }
    if (directives.blockAllMixedContent) {
      parts.push('block-all-mixed-content');
    }

    // Add reporting directives
    if (directives.reportUri) {
      parts.push(`report-uri ${directives.reportUri}`);
    }
    if (directives.reportTo) {
      parts.push(`report-to ${directives.reportTo}`);
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
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), screen-wake-lock=(), web-share=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Feature-Policy': 'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()',
      'X-Permitted-Cross-Domain-Policies': 'none',
      'X-DNS-Prefetch-Control': 'off'
    };
  }

  /**
   * Validate CSP configuration
   */
  public validateConfig(config: CSPConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.nonce) {
      if (typeof config.nonce !== 'string' || !this.NONCE_REGEX.test(config.nonce)) {
        errors.push('Nonce must be a valid base64 string of at least 16 characters');
      }
    }

    if (config.reportUri) {
      try {
        const url = new URL(config.reportUri);
        if (url.protocol !== 'https:') {
          errors.push('Report URI must use HTTPS');
        }
      } catch {
        errors.push('Report URI must be a valid URL');
      }
    }

    if (config.trustedDomains) {
      if (!Array.isArray(config.trustedDomains)) {
        errors.push('trustedDomains must be an array');
      } else {
        for (const domain of config.trustedDomains) {
          if (typeof domain !== 'string' || !domain.match(/^[a-zA-Z0-9-_.]+$/)) {
            errors.push(`Invalid trusted domain: ${domain}`);
          }
        }
      }
    }

    if (config.allowUnsafeInline && config.allowUnsafeEval) {
      errors.push('Both unsafe-inline and unsafe-eval should not be enabled in production');
    }

    return {
      valid: errors.length === 0,
      errors
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
