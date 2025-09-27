import { describe, it, expect } from 'vitest';
import { validateSchema } from '../../ipc-validation.cjs';

describe('IPC Validation Security Tests', () => {
  describe('Schema Validation', () => {
    it('should reject malformed scan options', () => {
      const scanSchema = {
        type: 'object',
        props: {
          maxDepth: { type: 'number' },
          maxEntries: { type: 'number' },
          followSymlinks: { type: 'boolean' }
        }
      };

      // Test injection attempts
      const maliciousInputs = [
        { maxDepth: 'delete * from users', maxEntries: 1000 },
        { maxDepth: -1, maxEntries: Number.MAX_SAFE_INTEGER },
        { followSymlinks: 'true', maxDepth: 999999 },
        { __proto__: { malicious: true }, maxDepth: 5 }
      ];

      maliciousInputs.forEach(input => {
        const result = validateSchema([scanSchema], [input]);
        expect(result.ok).toBe(false);
      });
    });

    it('should accept valid scan options', () => {
      const scanSchema = {
        type: 'object',
        props: {
          maxDepth: { type: 'number' },
          maxEntries: { type: 'number' },
          followSymlinks: { type: 'boolean' }
        }
      };

      const validInput = {
        maxDepth: 10,
        maxEntries: 50000,
        followSymlinks: false
      };

      const result = validateSchema([scanSchema], [validInput]);
      expect(result.ok).toBe(true);
    });

    it('should validate string inputs with proper sanitization', () => {
      const stringSchema = { type: 'string', nonEmpty: true };
      
      // Test various attack vectors
      const attacks = [
        '', // empty
        '   ', // whitespace only
        '\x00malicious', // null byte injection
        '<script>alert(1)</script>', // XSS
        'DROP TABLE users;', // SQL injection style
      ];

      attacks.forEach(attack => {
        const result = validateSchema([stringSchema], [attack]);
        expect(result.ok).toBe(false);
      });
    });
  });

  describe('Input Fuzzing', () => {
    it('should handle extreme inputs gracefully', () => {
      const schema = { type: 'string' };
      
      const extremeInputs = [
        'A'.repeat(100000), // Very long string
        null,
        undefined,
        {},
        [],
        () => {},
        Symbol('test')
      ];

      extremeInputs.forEach(input => {
        expect(() => {
          validateSchema([schema], [input]);
        }).not.toThrow();
      });
    });
  });
});