import { describe, test, expect } from 'vitest';
import {
  noTraversal,
  isSafePath,
  sanitizePath,
  validatePathSecurity,
} from '../../ipc-validation.cjs';

// SEC-4: Comprehensive path traversal protection tests

describe('SEC-4 Path Traversal Protection', () => {
  describe('noTraversal', () => {
    test('should reject basic path traversal attempts', () => {
      expect(noTraversal('../secret')).toBe(false);
      expect(noTraversal('..\\windows\\system32')).toBe(false);
      expect(noTraversal('subdir/../../etc/passwd')).toBe(false);
    });

    test('should reject absolute path traversal', () => {
      expect(noTraversal('/etc/passwd')).toBe(false);
      expect(noTraversal('C:\\Windows\\System32')).toBe(false);
      expect(noTraversal('\\server\\share')).toBe(false);
    });

    test('should reject null byte injection', () => {
      expect(noTraversal('subdir\0/../../../etc/passwd')).toBe(false);
      expect(noTraversal('file.txt\0')).toBe(false);
    });

    test('should accept safe relative paths', () => {
      expect(noTraversal('subdir/file.txt')).toBe(true);
      expect(noTraversal('valid/path/to/file')).toBe(true);
      expect(noTraversal('file.txt')).toBe(true);
    });

    test('should reject empty or invalid inputs', () => {
      expect(noTraversal('')).toBe(false);
      expect(noTraversal('   ')).toBe(false);
      expect(noTraversal(null)).toBe(false);
      expect(noTraversal(undefined)).toBe(false);
      expect(noTraversal(123)).toBe(false);
    });

    test('should handle complex traversal attempts', () => {
      expect(noTraversal('.../...//../../../')).toBe(false);
      expect(noTraversal('subdir/..//../file')).toBe(false);
      expect(noTraversal('a/b/c/../../../d')).toBe(false);
    });
  });

  describe('isSafePath', () => {
    test('should validate paths within base directory', () => {
      const basePath = '/home/user/app';
      expect(isSafePath('subdir/file.txt', basePath)).toBe(true);
      expect(isSafePath('data/config.json', basePath)).toBe(true);
    });

    test('should reject paths escaping base directory', () => {
      const basePath = '/home/user/app';
      expect(isSafePath('../outside', basePath)).toBe(false);
      expect(isSafePath('subdir/../../../etc/passwd', basePath)).toBe(false);
    });

    test('should handle edge cases', () => {
      const basePath = process.cwd();
      expect(isSafePath('.', basePath)).toBe(true);
      expect(isSafePath('./subdir', basePath)).toBe(true);
    });
  });

  describe('sanitizePath', () => {
    test('should remove dangerous characters', () => {
      expect(sanitizePath('file<>.txt')).toBe('file.txt');
      expect(sanitizePath('path:with:colons')).toBe('pathwithcolons');
      expect(sanitizePath('file|pipe.txt')).toBe('filepipe.txt');
    });

    test('should normalize path separators', () => {
      expect(sanitizePath('subdir\\\\file.txt')).toBe('subdir/file.txt');
      expect(sanitizePath('a//b//c')).toBe('a/b/c');
    });

    test('should return null for unsafe paths', () => {
      expect(sanitizePath('../unsafe')).toBe(null);
      expect(sanitizePath('')).toBe(null);
      expect(sanitizePath('   ')).toBe(null);
    });

    test('should trim whitespace', () => {
      expect(sanitizePath('  file.txt  ')).toBe('file.txt');
    });
  });

  describe('validatePathSecurity', () => {
    test('should validate secure path schema', () => {
      const schema = { type: 'string', securePath: true };

      const validResult = validatePathSecurity(schema, 'safe/file.txt');
      expect(validResult.valid).toBe(true);
      expect(validResult.value).toBe('safe/file.txt');

      const invalidResult = validatePathSecurity(schema, '../unsafe');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('path traversal');
    });

    test('should skip non-secure path schemas', () => {
      const schema = { type: 'string' };
      const result = validatePathSecurity(schema, '../unsafe');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('../unsafe');
    });

    test('should handle non-string inputs', () => {
      const schema = { type: 'string', securePath: true };
      const result = validatePathSecurity(schema, 123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('expected string for secure path');
    });
  });

  describe('production security scenarios', () => {
    test('should prevent common attack vectors', () => {
      const attacks = [
        '../../../etc/passwd',
        '..\\..\\..\\Windows\\System32\\config\\SAM',
        'subdir/../../../etc/hosts',
        '..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\etc\\passwd',
        '.\\./.\\./.\\./etc/passwd',
        'file.txt\\0/../../../etc/passwd',
      ];

      attacks.forEach((attack) => {
        expect(noTraversal(attack)).toBe(false);
        expect(isSafePath(attack)).toBe(false);
        expect(sanitizePath(attack)).toBe(null);
      });
    });

    test('should allow legitimate application paths', () => {
      const safePaths = [
        'data/config.json',
        'logs/app.log',
        'cache/temp.tmp',
        'user-data/settings.json',
        'exports/report.csv',
      ];

      safePaths.forEach((safePath) => {
        expect(noTraversal(safePath)).toBe(true);
        expect(sanitizePath(safePath)).toBe(safePath);
      });
    });
  });
});
