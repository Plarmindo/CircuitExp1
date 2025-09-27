import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateSchema, sanitizePath, isSafePath } from '../../ipc-validation.cjs';

describe('Path Traversal Security Tests', () => {
  describe('sanitizePath', () => {
    it('should reject path traversal attempts', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/../../../etc/passwd',
        'C:\\..\\..\\Windows\\System32',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd'
      ];

      maliciousPaths.forEach(path => {
        expect(sanitizePath(path)).toBeNull();
      });
    });

    it('should allow safe paths', () => {
      const safePaths = [
        'Documents/test.txt',
        'Users/john/Documents',
        'project/src/index.js',
        'C:/Users/john/Documents/file.txt'
      ];

      safePaths.forEach(path => {
        expect(sanitizePath(path)).toBeTruthy();
      });
    });

    it('should reject dangerous characters', () => {
      const dangerousPaths = [
        'file|name.txt',
        'file;name.txt', 
        'file&name.txt',
        'file`name.txt',
        'file$name.txt'
      ];

      dangerousPaths.forEach(path => {
        expect(sanitizePath(path)).toBeNull();
      });
    });
  });

  describe('isSafePath', () => {
    it('should detect path traversal in relative paths', () => {
      expect(isSafePath('../etc/passwd')).toBe(false);
      expect(isSafePath('../../windows/system32')).toBe(false);
      expect(isSafePath('./valid/path')).toBe(true);
    });
  });

  describe('validateSchema with path security', () => {
    it('should validate secure path schemas', () => {
      const schema = { type: 'string', securePath: true };
      
      const result1 = validateSchema([schema], ['../../../etc/passwd']);
      expect(result1.ok).toBe(false);
      
      const result2 = validateSchema([schema], ['valid/path/file.txt']);
      expect(result2.ok).toBe(true);
    });
  });
});