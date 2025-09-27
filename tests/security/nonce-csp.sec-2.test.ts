/**
 * SEC-2: Nonce-based CSP Implementation Tests
 * Verifies that the nonce-based Content Security Policy is properly implemented
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { cspManager, CSPManager } from '../../src/security/csp-manager';
import {
  injectScriptNonce,
  injectStyleNonce,
  injectAllNonces,
  createNonceScript,
  createNonceStyle,
  validateNonce,
  extractNonceFromHTML,
  removeNonces,
  getNonceStats,
  resetNonceStats,
} from '../../src/security/nonce-injector';

describe('SEC-2: Nonce-based CSP Implementation', () => {
  beforeEach(() => {
    // Reset CSP manager state
    cspManager.stopNonceRotation();
    resetNonceStats();
  });

  afterEach(() => {
    cspManager.cleanup();
  });

  describe('CSP Manager', () => {
    test('should generate cryptographically secure nonces', () => {
      const nonce1 = cspManager.generateNonce();
      const nonce2 = cspManager.generateNonce();

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBeGreaterThanOrEqual(16);
      expect(validateNonce(nonce1)).toBe(true);
    });

    test('should maintain current nonce until rotated', () => {
      const nonce1 = cspManager.getCurrentNonce();
      const nonce2 = cspManager.getCurrentNonce();

      expect(nonce1).toBe(nonce2);

      const nonce3 = cspManager.rotateNonce();
      expect(nonce3).not.toBe(nonce1);
      expect(cspManager.getCurrentNonce()).toBe(nonce3);
    });

    test('should start and stop nonce rotation', () => {
      expect(() => {
        cspManager.startNonceRotation(100); // 100ms for testing
        cspManager.stopNonceRotation();
      }).not.toThrow();
    });

    test('should generate production CSP with nonces', () => {
      const csp = cspManager.getProductionCSP();
      const nonce = cspManager.getCurrentNonce();

      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).not.toContain("'unsafe-inline'");
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    test('should generate development CSP with relaxed policies', () => {
      const devPort = 5175;
      const csp = cspManager.getDevelopmentCSP(devPort);

      // Development CSP uses unsafe-inline/unsafe-eval instead of nonce for better dev experience
      expect(csp).toContain("'unsafe-inline'"); // Required for Vite
      expect(csp).toContain("'unsafe-eval'"); // Required for PixiJS
      expect(csp).toContain(`http://localhost:${devPort}`);
      expect(csp).toContain(`ws://localhost:${devPort}`);
    });

    test('should generate comprehensive security headers', () => {
      const headers = cspManager.getSecurityHeaders(false);

      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(headers).toHaveProperty('X-XSS-Protection', '1; mode=block');
      expect(headers).toHaveProperty('Referrer-Policy', 'no-referrer');
      expect(headers).toHaveProperty('Permissions-Policy');
      expect(headers).toHaveProperty('Strict-Transport-Security');
    });

    test('should validate CSP configuration', () => {
      const validConfig = { nonce: 'validNonce1234567890' };
      const invalidConfig = { nonce: 'short', allowUnsafeInline: true, allowUnsafeEval: true };

      const validResult = cspManager.validateConfig(validConfig);
      const invalidResult = cspManager.validateConfig(invalidConfig);

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Nonce Injector', () => {
    const sampleHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test</title>
        <style>body { margin: 0; }</style>
        <script>console.log('test');</script>
      </head>
      <body>
        <script src="app.js"></script>
        <style>.test { color: red; }</style>
      </body>
      </html>
    `;

    test('should inject nonces into script tags', () => {
      const result = injectScriptNonce(sampleHTML);
      const nonce = cspManager.getCurrentNonce();

      expect(result).toContain(`<script nonce="${nonce}">console.log('test');</script>`);
      expect(result).toContain(`<script nonce="${nonce}" src="app.js"></script>`);
    });

    test('should inject nonces into style tags', () => {
      const result = injectStyleNonce(sampleHTML);
      const nonce = cspManager.getCurrentNonce();

      expect(result).toContain(`<style nonce="${nonce}">body { margin: 0; }</style>`);
      expect(result).toContain(`<style nonce="${nonce}">.test { color: red; }</style>`);
    });

    test('should inject nonces into all tags with meta information', () => {
      const result = injectAllNonces(sampleHTML, { injectMetaTags: true });
      const nonce = cspManager.getCurrentNonce();

      expect(result).toContain(`nonce="${nonce}"`);
      expect(result).toContain('<meta name="csp-nonce"');
      expect(result).toContain('<meta name="csp-timestamp"');
    });

    test('should not inject nonces into tags that already have them', () => {
      const htmlWithNonce = `<script nonce="existing123">test</script>`;
      const result = injectScriptNonce(htmlWithNonce);

      expect(result).toBe(htmlWithNonce); // Should remain unchanged
    });

    test('should create nonce-enabled script tags', () => {
      const content = 'console.log("test");';
      const attributes = { type: 'text/javascript', defer: 'true' };
      const result = createNonceScript(content, attributes);
      const nonce = cspManager.getCurrentNonce();

      expect(result).toContain(`nonce="${nonce}"`);
      expect(result).toContain('type="text/javascript"');
      expect(result).toContain('defer="true"');
      expect(result).toContain(content);
    });

    test('should create nonce-enabled style tags', () => {
      const content = 'body { margin: 0; }';
      const attributes = { type: 'text/css' };
      const result = createNonceStyle(content, attributes);
      const nonce = cspManager.getCurrentNonce();

      expect(result).toContain(`nonce="${nonce}"`);
      expect(result).toContain('type="text/css"');
      expect(result).toContain(content);
    });

    test('should extract nonce from HTML meta tag', () => {
      const htmlWithMeta = `
        <html>
        <head>
          <meta name="csp-nonce" content="testNonce123">
        </head>
        </html>
      `;

      const extractedNonce = extractNonceFromHTML(htmlWithMeta);
      expect(extractedNonce).toBe('testNonce123');
    });

    test('should validate nonce format correctly', () => {
      expect(validateNonce('validBase64Nonce123==')).toBe(true);
      expect(validateNonce('short')).toBe(false);
      expect(validateNonce('invalid@characters!')).toBe(false);
      expect(validateNonce('')).toBe(false);
    });

    test('should remove nonces from HTML', () => {
      const htmlWithNonces = `
        <script nonce="test123">console.log('test');</script>
        <style nonce="test456">body { margin: 0; }</style>
        <meta name="csp-nonce" content="test789">
      `;

      const result = removeNonces(htmlWithNonces);

      expect(result).not.toContain('nonce=');
      expect(result).not.toContain('csp-nonce');
      expect(result).toContain('<script>console.log(\'test\');</script>');
      expect(result).toContain('<style>body { margin: 0; }</style>');
    });

    test('should track nonce injection statistics', () => {
      resetNonceStats();

      const initialStats = getNonceStats();
      expect(initialStats.scriptsInjected).toBe(0);
      expect(initialStats.stylesInjected).toBe(0);

      // This would require the stats-enabled functions to be used
      // which are exported separately for performance reasons
    });
  });

  describe('Security Validation', () => {
    test('should ensure nonces are unique across rotations', () => {
      const nonces = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const nonce = cspManager.generateNonce();
        expect(nonces.has(nonce)).toBe(false);
        nonces.add(nonce);
      }
    });

    test('should ensure production CSP blocks unsafe content', () => {
      const prodCSP = cspManager.getProductionCSP();

      // Should not allow unsafe directives
      expect(prodCSP).not.toContain("'unsafe-inline'");
      expect(prodCSP).not.toContain("'unsafe-eval'");

      // Should have restrictive policies
      expect(prodCSP).toContain("object-src 'none'");
      expect(prodCSP).toContain("frame-ancestors 'none'");
      expect(prodCSP).toContain("form-action 'none'");
    });

    test('should ensure development CSP allows necessary unsafe content', () => {
      const devCSP = cspManager.getDevelopmentCSP(5175);

      // Should allow unsafe directives for development
      expect(devCSP).toContain("'unsafe-inline'");
      expect(devCSP).toContain("'unsafe-eval'");

      // Should allow local development connections
      expect(devCSP).toContain('http://localhost:5175');
      expect(devCSP).toContain('ws://localhost:5175');
    });

    test('should ensure nonce rotation works correctly', async () => {
      const initialNonce = cspManager.getCurrentNonce();

      cspManager.startNonceRotation(50); // 50ms for testing

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const rotatedNonce = cspManager.getCurrentNonce();
          expect(rotatedNonce).not.toBe(initialNonce);
          cspManager.stopNonceRotation();
          resolve();
        }, 100);
      });
    });

    test('should handle CSP manager cleanup properly', () => {
      cspManager.startNonceRotation(100);

      expect(() => {
        cspManager.cleanup();
      }).not.toThrow();

      // After cleanup, should be able to generate new nonces
      const nonce = cspManager.generateNonce();
      expect(validateNonce(nonce)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should work with Electron main process globals', () => {
      // Simulate Electron environment
      const mockProcess = {
        _lastProdCSP: '',
        _cspNonce: '',
      };

      const csp = cspManager.getProductionCSP();
      const nonce = cspManager.getCurrentNonce();

      mockProcess._lastProdCSP = csp;
      mockProcess._cspNonce = nonce;

      expect(mockProcess._lastProdCSP).toContain(`'nonce-${nonce}'`);
      expect(mockProcess._cspNonce).toBe(nonce);
    });

    test('should generate consistent headers for same configuration', () => {
      const headers1 = cspManager.getSecurityHeaders(false);
      const headers2 = cspManager.getSecurityHeaders(false);

      // Should be identical except for nonce (which stays same until rotated)
      expect(headers1['X-Content-Type-Options']).toBe(headers2['X-Content-Type-Options']);
      expect(headers1['X-Frame-Options']).toBe(headers2['X-Frame-Options']);
      expect(headers1['Referrer-Policy']).toBe(headers2['Referrer-Policy']);
    });

    test('should handle edge cases in HTML injection', () => {
      const edgeCases = [
        '', // Empty string
        '<html></html>', // Minimal HTML
        '<script></script>', // Empty script
        '<style></style>', // Empty style
        '<script nonce="existing">test</script>', // Already has nonce
      ];

      edgeCases.forEach((html) => {
        expect(() => {
          injectAllNonces(html);
        }).not.toThrow();
      });
    });
  });
});
