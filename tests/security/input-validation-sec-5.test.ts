import { describe, test, expect } from 'vitest';
import { InputValidator, INPUT_SCHEMAS } from '../../electron/input-validator.cjs';

// SEC-5: Comprehensive input validation and sanitization tests

describe('SEC-5 Input Validation and Sanitization', () => {
  describe('InputValidator.validate', () => {
    test('should validate string inputs', () => {
      const schema = INPUT_SCHEMAS.FILE_PATH;
      const result = InputValidator.validate('test/file.txt', schema);
      expect(result.valid).toBe(true);
      expect(result.value).toBe('test/file.txt');
    });

    test('should reject invalid string lengths', () => {
      const schema = INPUT_SCHEMAS.FILE_PATH;
      const longString = 'a'.repeat(300);
      const result = InputValidator.validate(longString, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Maximum length');
    });

    test('should validate number inputs', () => {
      const schema = INPUT_SCHEMAS.SCAN_DEPTH;
      const result = InputValidator.validate(5, schema);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(5);
    });

    test('should coerce string numbers to numbers', () => {
      const schema = INPUT_SCHEMAS.SCAN_DEPTH;
      const result = InputValidator.validate('10', schema);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(10);
    });

    test('should reject invalid numbers', () => {
      const schema = INPUT_SCHEMAS.SCAN_DEPTH;
      const result = InputValidator.validate('invalid', schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Expected number');
    });

    test('should validate object inputs', () => {
      const schema = INPUT_SCHEMAS.WINDOW_SIZE;
      const input = { width: 800, height: 600 };
      const result = InputValidator.validate(input, schema);
      expect(result.valid).toBe(true);
      expect(result.value).toEqual(input);
    });

    test('should validate object properties', () => {
      const schema = INPUT_SCHEMAS.WINDOW_SIZE;
      const input = { width: 100, height: 600 }; // width too small
      const result = InputValidator.validate(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('width');
    });

    test('should sanitize dangerous input', () => {
      const schema = INPUT_SCHEMAS.FAVORITE_NAME;
      const dangerous = 'name<script>alert("xss")</script>';
      const result = InputValidator.validate(dangerous, schema);
      expect(result.valid).toBe(true);
      expect(result.value).toBe('namescriptalert(xss)/script');
    });

    test('should validate secure paths', () => {
      const schema = INPUT_SCHEMAS.FILE_PATH;
      const result = InputValidator.validate('subdir/file.txt', schema);
      expect(result.valid).toBe(true);
      expect(result.value).toBeTruthy();
    });

    test('should reject path traversal', () => {
      const schema = INPUT_SCHEMAS.FILE_PATH;
      const result = InputValidator.validate('../../../etc/passwd', schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('path traversal');
    });

    test('should handle empty required fields', () => {
      const schema = INPUT_SCHEMAS.FILE_PATH;
      const result = InputValidator.validate('', schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('required');
    });

    test('should handle optional empty fields', () => {
      const schema = { ...INPUT_SCHEMAS.SEARCH_QUERY, required: false };
      const result = InputValidator.validate('', schema);
      expect(result.valid).toBe(true);
      expect(result.value).toBe('');
    });

    test('should validate array inputs', () => {
      const schema = {
        type: 'array',
        items: INPUT_SCHEMAS.FILTER_PATTERN,
        required: true,
      };
      const result = InputValidator.validate(['*.js', '*.ts'], schema);
      expect(result.valid).toBe(true);
      expect(result.value).toEqual(['*.js', '*.ts']);
    });

    test('should validate array items', () => {
      const schema = {
        type: 'array',
        items: INPUT_SCHEMAS.FILTER_PATTERN,
        required: true,
      };
      const result = InputValidator.validate(['*.js', 'invalid<>pattern'], schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid format');
    });
  });

  describe('InputValidator.validateIPCCall', () => {
    test('should validate scanDirectory call', () => {
      const params = {
        directory: 'test/path',
        depth: 3,
        filters: ['*.js', '*.ts'],
      };
      const result = InputValidator.validateIPCCall('scanDirectory', params);
      expect(result.valid).toBe(true);
      expect(result.value.directory).toBeTruthy();
    });

    test('should reject scanDirectory with traversal', () => {
      const params = {
        directory: '../../../etc',
        depth: 3,
      };
      const result = InputValidator.validateIPCCall('scanDirectory', params);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('path traversal');
    });

    test('should validate addFavorite call', () => {
      const params = {
        name: 'My Project',
        path: 'projects/my-project',
      };
      const result = InputValidator.validateIPCCall('addFavorite', params);
      expect(result.valid).toBe(true);
      expect(result.value.name).toBe('My Project');
    });

    test('should reject addFavorite with invalid name', () => {
      const params = {
        name: 'invalid<name>',
        path: 'valid/path',
      };
      const result = InputValidator.validateIPCCall('addFavorite', params);
      expect(result.valid).toBe(true); // Should sanitize, not reject
      expect(result.value.name).toBe('invalidname');
    });

    test('should validate updateSetting call', () => {
      const params = {
        key: 'theme',
        value: 'dark',
      };
      const result = InputValidator.validateIPCCall('updateSetting', params);
      expect(result.valid).toBe(true);
    });

    test('should reject updateSetting with invalid key', () => {
      const params = {
        key: 'invalid key!',
        value: 'value',
      };
      const result = InputValidator.validateIPCCall('updateSetting', params);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid key');
    });

    test('should validate exportData call', () => {
      const params = {
        path: 'exports/data.json',
        format: 'json',
      };
      const result = InputValidator.validateIPCCall('exportData', params);
      expect(result.valid).toBe(true);
    });

    test('should reject unknown method', () => {
      const params = { path: 'test' };
      const result = InputValidator.validateIPCCall('unknownMethod', params);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unknown method');
    });
  });

  describe('InputValidator.sanitizeObject', () => {
    test('should sanitize object keys and values', () => {
      const input = {
        'key<script>': 'value<script>alert("xss")</script>',
        normal_key: 'normal value',
      };
      const result = InputValidator.sanitizeObject(input);
      expect(result.valid).toBe(true);
      expect(result.value).toEqual({
        keyscript: 'valuescriptalert(xss)/script',
        normal_key: 'normal value',
      });
    });

    test('should reject invalid keys', () => {
      const input = {
        '': 'empty key',
        'key with spaces': 'value',
      };
      const result = InputValidator.sanitizeObject(input);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid key');
    });

    test('should handle nested objects', () => {
      const input = {
        config: {
          theme: 'dark',
          path: '../../../etc/passwd',
        },
      };
      const schema = {
        type: 'object',
        properties: {
          theme: { type: 'string', sanitize: true },
          path: { type: 'string', securePath: true },
        },
      };
      const result = InputValidator.sanitizeObject(input.config, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('path traversal');
    });
  });

  describe('production security scenarios', () => {
    test('should prevent XSS attacks', () => {
      const attacks = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<svg onload=alert(1)>',
        'data:text/html,<script>alert(1)</script>',
      ];

      attacks.forEach((attack) => {
        const schema = INPUT_SCHEMAS.FAVORITE_NAME;
        const result = InputValidator.validate(attack, schema);
        expect(result.valid).toBe(true);
        expect(result.value).not.toContain('<script>');
        expect(result.value).not.toContain('javascript:');
      });
    });

    test('should prevent SQL injection attempts', () => {
      const attacks = ["'; DROP TABLE users; --", "1' OR '1'='1", "admin'--", "1' OR 1=1--"];

      attacks.forEach((attack) => {
        const schema = INPUT_SCHEMAS.FAVORITE_NAME;
        const result = InputValidator.validate(attack, schema);
        expect(result.valid).toBe(true);
        expect(result.value).not.toContain('DROP');
        expect(result.value).not.toContain('OR');
      });
    });

    test('should prevent command injection', () => {
      const attacks = [
        'file.txt; rm -rf /',
        'file.txt && del /q /f *',
        'file.txt | format C:',
        'file.txt `whoami`',
        'file.txt $(whoami)',
      ];

      attacks.forEach((attack) => {
        const schema = INPUT_SCHEMAS.FILE_PATH;
        const result = InputValidator.validate(attack, schema);
        expect(result.valid).toBe(false);
      });
    });

    test('should handle edge cases gracefully', () => {
      const edgeCases = [null, undefined, '', '   ', '\0', '\x00', '\\', '//', '..', '.'];

      edgeCases.forEach((testCase) => {
        const schema = INPUT_SCHEMAS.FILE_PATH;
        const result = InputValidator.validate(testCase, schema);
        expect(result).toBeDefined();
        expect(result.valid === true || result.valid === false).toBe(true);
      });
    });

    test('should validate realistic user inputs', () => {
      const validInputs = [
        { type: 'file', value: 'src/components/App.tsx' },
        { type: 'directory', value: 'C:\\Users\\User\\Documents\\Project' },
        { type: 'name', value: 'My Important Project' },
        { type: 'depth', value: 5 },
        { type: 'filter', value: '*.js' },
      ];

      validInputs.forEach((input) => {
        let schema;
        switch (input.type) {
          case 'file':
            schema = INPUT_SCHEMAS.FILE_PATH;
            break;
          case 'directory':
            schema = INPUT_SCHEMAS.DIRECTORY_PATH;
            break;
          case 'name':
            schema = INPUT_SCHEMAS.FAVORITE_NAME;
            break;
          case 'depth':
            schema = INPUT_SCHEMAS.SCAN_DEPTH;
            break;
          case 'filter':
            schema = INPUT_SCHEMAS.FILTER_PATTERN;
            break;
        }

        const result = InputValidator.validate(input.value, schema);
        expect(result.valid).toBe(true);
      });
    });
  });
});
