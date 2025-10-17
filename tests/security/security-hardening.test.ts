import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecurityHardening } from '../../src/security/security-hardening';
import { SecurityConfigUtils } from '../../src/security/security-config';

describe('SecurityHardening', () => {
  let security: SecurityHardening;

  beforeEach(() => {
    security = new SecurityHardening();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should validate safe strings', () => {
      const result = security.validateInput('Hello World', 'text');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Hello World');
    });

    it('should detect XSS attempts', () => {
      const malicious = '<script>alert("XSS")</script>';
      const result = security.validateInput(malicious, 'html');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('XSS');
    });

    it('should detect SQL injection attempts', () => {
      const malicious = "'; DROP TABLE users; --";
      const result = security.validateInput(malicious, 'sql');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SQL injection');
    });

    it('should sanitize HTML content', () => {
      const html = '<p>Hello <b>World</b><script>alert("XSS")</script></p>';
      const result = security.sanitizeHtml(html);
      expect(result).toBe('<p>Hello <b>World</b></p>');
    });
  });

  describe('Path Traversal Protection', () => {
    it('should block path traversal attempts', () => {
      const malicious = '../../../etc/passwd';
      const result = security.validatePath(malicious);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path traversal');
    });

    it('should allow safe paths', () => {
      const safe = 'data/users/config.json';
      const result = security.validatePath(safe);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('data/users/config.json');
    });

    it('should normalize paths', () => {
      const path = 'data/../users/./config.json';
      const result = security.validatePath(path);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('users/config.json');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limits', () => {
      const key = 'test-ip';
      for (let i = 0; i < 100; i++) {
        const result = security.checkRateLimit(key);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests exceeding limits', () => {
      const key = 'test-ip';
      for (let i = 0; i < 110; i++) {
        security.checkRateLimit(key);
      }
      const result = security.checkRateLimit(key);
      expect(result.allowed).toBe(false);
    });
  });

  describe('CSRF Protection', () => {
    it('should generate valid CSRF tokens', () => {
      const token = security.generateCSRFToken();
      expect(token).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
      expect(token.length).toBeGreaterThan(20);
    });

    it('should validate matching tokens', () => {
      const token = security.generateCSRFToken();
      const result = security.validateCSRFToken(token, token);
      expect(result.valid).toBe(true);
    });

    it('should reject mismatched tokens', () => {
      const token1 = security.generateCSRFToken();
      const token2 = security.generateCSRFToken();
      const result = security.validateCSRFToken(token1, token2);
      expect(result.valid).toBe(false);
    });
  });

  describe('IP Validation', () => {
    it('should validate IPv4 addresses', () => {
      expect(security.validateIP('192.168.1.1').valid).toBe(true);
      expect(security.validateIP('256.256.256.256').valid).toBe(false);
      expect(security.validateIP('192.168.1').valid).toBe(false);
    });

    it('should validate IPv6 addresses', () => {
      expect(security.validateIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334').valid).toBe(true);
      expect(security.validateIP('2001:0db8:85a3::8a2e:370g').valid).toBe(false);
    });

    it('should check private IP ranges', () => {
      expect(security.isPrivateIP('192.168.1.1')).toBe(true);
      expect(security.isPrivateIP('10.0.0.1')).toBe(true);
      expect(security.isPrivateIP('172.16.0.1')).toBe(true);
      expect(security.isPrivateIP('8.8.8.8')).toBe(false);
    });
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt data', () => {
      const data = 'Sensitive information';
      const encrypted = security.encrypt(data);
      expect(encrypted).not.toBe(data);
      expect(typeof encrypted).toBe('string');

      const decrypted = security.decrypt(encrypted);
      expect(decrypted).toBe(data);
    });

    it('should handle encryption errors gracefully', () => {
      const result = security.encrypt('');
      expect(result).toBe('');
    });

    it('should handle decryption errors gracefully', () => {
      const result = security.decrypt('invalid-data');
      expect(result).toBe('');
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      security.logSecurityEvent('XSS_ATTEMPT', {
        ip: '192.168.1.1',
        userAgent: 'test-agent'
      });

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY_EVENT'),
        expect.objectContaining({
          type: 'XSS_ATTEMPT',
          ip: '192.168.1.1'
        })
      );
    });
  });
});

describe('SecurityConfigUtils', () => {
  describe('File Validation', () => {
    it('should validate allowed file extensions', () => {
      const result = SecurityConfigUtils.validateFilePath('document.json');
      expect(result.valid).toBe(true);
    });

    it('should reject forbidden extensions', () => {
      const result = SecurityConfigUtils.validateFilePath('malicious.exe');
      expect(result.valid).toBe(false);
    });

    it('should validate file sizes', () => {
      const result = SecurityConfigUtils.validateFileSize(1024 * 1024); // 1MB
      expect(result.valid).toBe(true);
    });

    it('should reject oversized files', () => {
      const result = SecurityConfigUtils.validateFileSize(50 * 1024 * 1024); // 50MB
      expect(result.valid).toBe(false);
    });
  });

  describe('Content Validation', () => {
    it('should validate safe content', () => {
      const content = '{"name": "test", "value": 123}';
      const result = SecurityConfigUtils.validateFileContent(content, 'test.json');
      expect(result.valid).toBe(true);
    });

    it('should detect malicious scripts', () => {
      const content = '<script>alert("XSS")</script>';
      const result = SecurityConfigUtils.validateFileContent(content, 'test.html');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Suspicious content detected - potentially malicious code');
    });
  });

  describe('Security Headers', () => {
    it('should provide security headers for development', () => {
      const headers = SecurityConfigUtils.getSecurityHeaders(true);
      expect(headers['Content-Security-Policy']).toContain('localhost');
      expect(headers).not.toHaveProperty('Strict-Transport-Security');
    });

    it('should provide security headers for production', () => {
      const headers = SecurityConfigUtils.getSecurityHeaders(false);
      expect(headers['Content-Security-Policy']).toContain('nonce-');
      expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains; preload');
    });
  });

  describe('File Upload Validation', () => {
    it('should validate file uploads', () => {
      const file = {
        name: 'document.json',
        size: 1024,
        type: 'application/json'
      };
      const result = SecurityConfigUtils.validateFileUpload(file);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid file types', () => {
      const file = {
        name: 'malicious.exe',
        size: 1024,
        type: 'application/x-msdownload'
      };
      const result = SecurityConfigUtils.validateFileUpload(file);
      expect(result.valid).toBe(false);
    });
  });
});
