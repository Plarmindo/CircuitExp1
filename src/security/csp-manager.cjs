/**
 * Content Security Policy Manager (CommonJS version for Electron)
 * Provides nonce-based CSP implementation for enhanced security
 *
 * SECURITY NOTE: This CSP includes 'unsafe-eval' which is required for PixiJS WebGL
 * shader compilation. This is a known security trade-off for graphics performance.
 * Alternative: Use SVG-based rendering (metro-stage-svg.tsx) for maximum security.
 */

const { randomBytes } = require('crypto');

class CSPManager {
  static instance = null;
  currentNonce = null;
  nonceRotationInterval = null;

  constructor() {}

  static getInstance() {
    if (!CSPManager.instance) {
      CSPManager.instance = new CSPManager();
    }
    return CSPManager.instance;
  }

  /**
   * Generate a cryptographically secure nonce
   */
  generateNonce() {
    return randomBytes(16).toString('base64');
  }

  /**
   * Get the current nonce (generates one if none exists)
   */
  getCurrentNonce() {
    if (!this.currentNonce) {
      this.currentNonce = this.generateNonce();
    }
    return this.currentNonce;
  }

  /**
   * Rotate the nonce (for enhanced security)
   */
  rotateNonce() {
    this.currentNonce = this.generateNonce();
    return this.currentNonce;
  }

  /**
   * Start automatic nonce rotation
   */
  startNonceRotation(intervalMs = 300000) { // 5 minutes default
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
  stopNonceRotation() {
    if (this.nonceRotationInterval) {
      clearInterval(this.nonceRotationInterval);
      this.nonceRotationInterval = null;
    }
  }

  /**
   * Get production CSP directives (hardened)
   * Note: unsafe-eval is required for PixiJS WebGL shader compilation
   */
  getProductionDirectives(config = {}) {
    const nonce = config.nonce || this.getCurrentNonce();

    return {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        `'nonce-${nonce}'`,
        "'unsafe-eval'" // Required for PixiJS WebGL shader compilation
      ],
      styleSrc: [
        "'self'",
        `'nonce-${nonce}'`
        // No unsafe-inline in production
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
      // Add violation reporting
      reportUri: ['/csp-violation-report']
    };
  }

  /**
   * Get development CSP directives (relaxed for debugging)
   */
  getDevelopmentDirectives(devPort, config = {}) {
    const nonce = config.nonce || this.getCurrentNonce();

    return {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite HMR
        "'unsafe-eval'", // Required for PixiJS WebGL shader compilation - security risk acknowledged
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
  directivesToString(directives) {
    const parts = [];

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
  getProductionCSP(config = {}) {
    const directives = this.getProductionDirectives(config);
    return this.directivesToString(directives);
  }

  /**
   * Get complete CSP header string for development
   */
  getDevelopmentCSP(devPort, config = {}) {
    const directives = this.getDevelopmentDirectives(devPort, config);
    return this.directivesToString(directives);
  }

  /**
   * Get security headers object for development
   */
  getSecurityHeaders(isDev = false, devPort = null) {
    const headers = {};

    if (isDev && devPort) {
      headers['Content-Security-Policy'] = this.getDevelopmentCSP(devPort);
    } else {
      headers['Content-Security-Policy'] = this.getProductionCSP();
    }

    // Additional security headers
    headers['X-Content-Type-Options'] = 'nosniff';
    headers['X-Frame-Options'] = 'DENY';
    headers['X-XSS-Protection'] = '1; mode=block';
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()';

    return headers;
  }
}

module.exports = { CSPManager };
