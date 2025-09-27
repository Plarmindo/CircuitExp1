/**
 * Nonce Injector Utility
 * Provides utilities for injecting nonces into HTML templates and scripts
 */

import { cspManager } from './csp-manager';

export interface NonceInjectionOptions {
  nonce?: string;
  autoRotate?: boolean;
  injectMetaTags?: boolean;
}

/**
 * Inject nonce into script tags
 */
export function injectScriptNonce(html: string, options: NonceInjectionOptions = {}): string {
  const nonce = options.nonce || cspManager.getCurrentNonce();

  // Replace script tags without nonce attribute
  return html.replace(
    /<script(?![^>]*nonce=)([^>]*)>/gi,
    `<script nonce="${nonce}"$1>`
  );
}

/**
 * Inject nonce into style tags
 */
export function injectStyleNonce(html: string, options: NonceInjectionOptions = {}): string {
  const nonce = options.nonce || cspManager.getCurrentNonce();

  // Replace style tags without nonce attribute
  return html.replace(
    /<style(?![^>]*nonce=)([^>]*)>/gi,
    `<style nonce="${nonce}"$1>`
  );
}

/**
 * Inject nonce into both script and style tags
 */
export function injectAllNonces(html: string, options: NonceInjectionOptions = {}): string {
  let result = html;

  // Inject script nonces
  result = injectScriptNonce(result, options);

  // Inject style nonces
  result = injectStyleNonce(result, options);

  // Optionally inject meta tags with nonce information
  if (options.injectMetaTags) {
    const nonce = options.nonce || cspManager.getCurrentNonce();
    const metaTags = `
    <meta name="csp-nonce" content="${nonce}">
    <meta name="csp-timestamp" content="${Date.now()}">`;

    // Insert after <head> tag
    result = result.replace(
      /(<head[^>]*>)/i,
      `$1${metaTags}`
    );
  }

  return result;
}

/**
 * Create a nonce-enabled script tag
 */
export function createNonceScript(content: string, attributes: Record<string, string> = {}): string {
  const nonce = cspManager.getCurrentNonce();
  const attrs = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

  return `<script nonce="${nonce}" ${attrs}>${content}</script>`;
}

/**
 * Create a nonce-enabled style tag
 */
export function createNonceStyle(content: string, attributes: Record<string, string> = {}): string {
  const nonce = cspManager.getCurrentNonce();
  const attrs = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

  return `<style nonce="${nonce}" ${attrs}>${content}</style>`;
}

/**
 * Create inline event handler with nonce (for emergency use only)
 */
export function createNonceEventHandler(eventName: string, handler: string): string {
  const nonce = cspManager.getCurrentNonce();
  return `${eventName}="/* nonce:${nonce} */ ${handler}"`;
}

/**
 * Middleware for Express.js to inject nonces into responses
 */
export function nonceMiddleware() {
  return (req: any, res: any, next: any) => {
    // Store original send method
    const originalSend = res.send;

    // Override send method to inject nonces
    res.send = function(body: any) {
      if (typeof body === 'string' && body.includes('<html')) {
        // Rotate nonce for each request
        if (cspManager) {
          cspManager.rotateNonce();
        }

        // Inject nonces into HTML response
        body = injectAllNonces(body, { injectMetaTags: true });
      }

      // Call original send method
      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Vite plugin for nonce injection during development
 */
export function viteNoncePlugin() {
  return {
    name: 'nonce-injector',
    transformIndexHtml: {
      enforce: 'pre' as const,
      transform(html: string) {
        // Only inject nonces in development mode
        if (process.env.NODE_ENV === 'development') {
          return injectAllNonces(html, { injectMetaTags: true });
        }
        return html;
      },
    },
  };
}

/**
 * Extract nonce from HTML meta tag
 */
export function extractNonceFromHTML(html: string): string | null {
  const match = html.match(/<meta\s+name=["']csp-nonce["']\s+content=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/**
 * Validate nonce format
 */
export function validateNonce(nonce: string): boolean {
  // Nonce should be base64 encoded and at least 16 characters
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return nonce.length >= 16 && base64Regex.test(nonce);
}

/**
 * Generate CSP-compatible nonce attribute
 */
export function getNonceAttribute(nonce?: string): string {
  const nonceValue = nonce || cspManager.getCurrentNonce();
  return `nonce="${nonceValue}"`;
}

/**
 * Remove all nonces from HTML (for testing purposes)
 */
export function removeNonces(html: string): string {
  return html
    .replace(/\s*nonce=["'][^"']*["']/gi, '')
    .replace(/<meta\s+name=["']csp-nonce["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']csp-timestamp["'][^>]*>/gi, '');
}

/**
 * Nonce injection statistics
 */
export interface NonceStats {
  scriptsInjected: number;
  stylesInjected: number;
  totalNonces: number;
  lastInjection: Date;
}

let nonceStats: NonceStats = {
  scriptsInjected: 0,
  stylesInjected: 0,
  totalNonces: 0,
  lastInjection: new Date(),
};

/**
 * Get nonce injection statistics
 */
export function getNonceStats(): NonceStats {
  return { ...nonceStats };
}

/**
 * Reset nonce injection statistics
 */
export function resetNonceStats(): void {
  nonceStats = {
    scriptsInjected: 0,
    stylesInjected: 0,
    totalNonces: 0,
    lastInjection: new Date(),
  };
}

/**
 * Update nonce statistics
 */
function updateStats(type: 'script' | 'style'): void {
  if (type === 'script') {
    nonceStats.scriptsInjected++;
  } else if (type === 'style') {
    nonceStats.stylesInjected++;
  }
  nonceStats.totalNonces++;
  nonceStats.lastInjection = new Date();
}

// Export enhanced functions with statistics
export const injectScriptNonceWithStats = (html: string, options: NonceInjectionOptions = {}): string => {
  const result = injectScriptNonce(html, options);
  const scriptCount = (result.match(/<script[^>]*nonce=/gi) || []).length;
  for (let i = 0; i < scriptCount; i++) {
    updateStats('script');
  }
  return result;
};

export const injectStyleNonceWithStats = (html: string, options: NonceInjectionOptions = {}): string => {
  const result = injectStyleNonce(html, options);
  const styleCount = (result.match(/<style[^>]*nonce=/gi) || []).length;
  for (let i = 0; i < styleCount; i++) {
    updateStats('style');
  }
  return result;
};
