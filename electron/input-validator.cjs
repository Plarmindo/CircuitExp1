/**
 * Comprehensive Input Validation and Sanitization
 * Production-grade validation for all user inputs and IPC payloads
 */

'use strict';

const { SecurityValidator, SecurityLogger } = require('./security-config.cjs');
const { isSafePath } = require('../ipc-validation.cjs');

// Validation schemas for different input types
const INPUT_SCHEMAS = {
  // File system operations
  FILE_PATH: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 260,
    securePath: true,
    sanitize: true
  },
  
  DIRECTORY_PATH: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 260,
    securePath: true,
    sanitize: true,
    isDirectory: true
  },
  
  // Scan operations
  SCAN_DEPTH: {
    type: 'number',
    required: true,
    min: 1,
    max: 50,
    integer: true
  },
  
  SCAN_ROOT: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 260,
    securePath: true,
    sanitize: true,
    isDirectory: true
  },
  
  // Settings and configuration
  SETTING_KEY: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_-]+$/,
    sanitize: true,
    errorLabel: 'Invalid key'
  },
  
  SETTING_VALUE: {
    type: 'string',
    required: true,
    maxLength: 10000,
    sanitize: true
  },
  
  // Favorites and bookmarks
  FAVORITE_NAME: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 255,
    sanitize: true,
    trim: true,
    pattern: null,
    errorLabel: 'Invalid name'
  },
  
  FAVORITE_PATH: {
    type: 'string',
    isDirectory: true,
    required: true,
    minLength: 1,
    maxLength: 260,
    securePath: true,
    sanitize: true
  },
  
  // UI and display
  WINDOW_SIZE: {
    type: 'object',
    required: true,
    properties: {
      width: { type: 'number', min: 400, max: 4000 },
      height: { type: 'number', min: 300, max: 3000 }
    }
  },
  
  // Search and filtering
  SEARCH_QUERY: {
    type: 'string',
    required: false,
    maxLength: 500,
    sanitize: true,
    trim: true
  },
  
  FILTER_PATTERN: {
    type: 'string',
    required: false,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9*?._-]+$/,
    sanitize: false
  }
};

// Input validation class
class InputValidator {
  static validate(input, schema) {
    const errors = [];
    const sanitized = {};

    if (!schema || typeof schema !== 'object') {
      return { valid: false, errors: ['Invalid schema'] };
    }

    // Check required fields (treat empty string/array as missing)
    if (schema.required && (
        input === undefined || input === null ||
        (typeof input === 'string' && input.trim() === '') ||
        (Array.isArray(input) && input.length === 0)
      )) {
      return { valid: false, errors: [`${schema.field || 'field'} is required`] };
    }

    // Skip validation for optional empty values
    if (!schema.required && (input === undefined || input === null || input === '')) {
      return { valid: true, value: input };
    }

    // Type validation
    if (schema.type) {
      if (schema.type === 'array') {
        if (!Array.isArray(input)) {
          errors.push('Expected array');
        }
      } else if (typeof input !== schema.type) {
        // Allow type coercion for numbers and booleans
        if (schema.type === 'number') {
          const num = Number(input);
          if (isNaN(num)) {
            errors.push(`Expected number, got ${typeof input}`);
          } else {
            input = num;
          }
        } else if (schema.type === 'boolean') {
          if (typeof input === 'string') {
            input = input.toLowerCase() === 'true';
          } else {
            errors.push(`Expected boolean, got ${typeof input}`);
          }
        } else {
          errors.push(`Expected ${schema.type}, got ${typeof input}`);
        }
      }
    }

    // String validations
    if (schema.type === 'string') {
      // Length validation
      if (schema.minLength && input.length < schema.minLength) {
        errors.push(`Minimum length is ${schema.minLength}`);
      }
      if (schema.maxLength && input.length > schema.maxLength) {
        errors.push(`Maximum length is ${schema.maxLength}`);
      }

      // Sanitization
      if (schema.sanitize) {
        const sanitized = SecurityValidator.sanitizeInput(input, schema.maxLength);
        if (!sanitized.valid) {
          errors.push(sanitized.error);
        } else {
          input = sanitized.value;
        }
      }

      // Pattern validation (apply after sanitization to allow cleaning invalid characters before checking format)
      if (schema.pattern && !schema.pattern.test(input)) {
        errors.push(schema.errorLabel || 'Invalid format');
      }

      // Secure path validation
      if (schema.securePath) {
        const pathValidation = schema.isDirectory 
          ? SecurityValidator.validateDirectoryPath(input)
          : SecurityValidator.validateFilePath(input);
        
        if (!pathValidation.valid) {
          errors.push(pathValidation.error);
        } else {
          input = pathValidation.value;
        }
      } else if (schema.noTraversal) {
        const traversalOk = isSafePath(input);
        if (!traversalOk) {
          errors.push('path traversal detected');
        }
      }

      // Trim whitespace
      if (schema.trim) {
        input = input.trim();
      }
    }

    // Number validations
    if (schema.type === 'number') {
      if (schema.min !== undefined && input < schema.min) {
        errors.push(`Minimum value is ${schema.min}`);
      }
      if (schema.max !== undefined && input > schema.max) {
        errors.push(`Maximum value is ${schema.max}`);
      }
      if (schema.integer && !Number.isInteger(input)) {
        errors.push('Must be an integer');
      }
    }

    // Object validations
    if (schema.type === 'object' && schema.properties) {
      if (typeof input !== 'object' || Array.isArray(input)) {
        errors.push('Expected object');
      } else {
        const result = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const value = input[key];
          const validation = this.validate(value, propSchema);
          
          if (!validation.valid) {
            errors.push(`${key}: ${validation.errors.join(', ')}`);
          } else {
            result[key] = validation.value;
          }
        }
        input = result;
      }
    }

    // Array validations
    if (schema.type === 'array') {
      if (!Array.isArray(input)) {
        errors.push('Expected array');
      } else if (schema.items) {
        const result = [];
        for (let i = 0; i < input.length; i++) {
          const validation = this.validate(input[i], schema.items);
          if (!validation.valid) {
            errors.push(`[${i}]: ${validation.errors.join(', ')}`);
          } else {
            result.push(validation.value);
          }
        }
        input = result;
      }
    }

    if (errors.length > 0) {
      SecurityLogger.logSecurityEvent('validation_failed', {
        errors,
        input: typeof input === 'string' ? input.substring(0, 100) : JSON.stringify(input).substring(0, 100)
      });
      return { valid: false, errors, error: errors[0] };
    }

    return { valid: true, value: input };
  }

  static validateIPCCall(method, params) {
    const schemas = {
      'scanDirectory': {
        directory: INPUT_SCHEMAS.DIRECTORY_PATH,
        depth: INPUT_SCHEMAS.SCAN_DEPTH,
        filters: { ...INPUT_SCHEMAS.FILTER_PATTERN, required: false, type: 'array', items: INPUT_SCHEMAS.FILTER_PATTERN }
      },
      'getFileInfo': {
        path: INPUT_SCHEMAS.FILE_PATH
      },
      'addFavorite': {
        name: INPUT_SCHEMAS.FAVORITE_NAME,
        path: INPUT_SCHEMAS.FAVORITE_PATH
      },
      'removeFavorite': {
        name: INPUT_SCHEMAS.FAVORITE_NAME
      },
      'updateSetting': {
        key: INPUT_SCHEMAS.SETTING_KEY,
        value: INPUT_SCHEMAS.SETTING_VALUE
      },
      'getSetting': {
        key: INPUT_SCHEMAS.SETTING_KEY
      },
      'exportData': {
        path: INPUT_SCHEMAS.FILE_PATH,
        format: { type: 'string', required: true, pattern: /^(json|csv|xml)$/ }
      }
    };

    const schema = schemas[method];
    if (!schema) {
      return { valid: false, errors: [`Unknown method: ${method}`] };
    }

    const errors = [];
    const sanitized = {};

    for (const [key, paramSchema] of Object.entries(schema)) {
      const value = params[key];
      const validation = this.validate(value, paramSchema);
      
      if (!validation.valid) {
        errors.push(`${key}: ${validation.errors.join(', ')}`);
      } else {
        sanitized[key] = validation.value;
      }
    }

    if (errors.length > 0) {
      SecurityLogger.logSecurityEvent('ipc_validation_failed', {
        method,
        errors
      });
      return { valid: false, errors };
    }

    return { valid: true, value: sanitized };
  }

  static sanitizeObject(obj, schema) {
    if (typeof obj !== 'object' || obj === null) {
      return { valid: false, errors: ['Expected object'] };
    }

    const sanitized = {};
    const errors = [];

    for (const [key, value] of Object.entries(obj)) {
      const keyValidation = this.validate(key, INPUT_SCHEMAS.SETTING_KEY);
      if (!keyValidation.valid) {
        errors.push(`Invalid key: ${key}`);
        continue;
      }

      const sanitizedKey = keyValidation.value;
      // Determine appropriate schema for this property
      let propSchema;
      if (schema && schema.properties) {
        propSchema = schema.properties[key] || schema.additionalProperties || INPUT_SCHEMAS.SETTING_VALUE;
      } else {
        propSchema = schema || INPUT_SCHEMAS.SETTING_VALUE;
      }
      const valueValidation = this.validate(value, propSchema);
      
      if (!valueValidation.valid) {
        errors.push(`Invalid value for ${key}: ${valueValidation.errors.join(', ')}`);
      } else {
        sanitized[sanitizedKey] = valueValidation.value;
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, value: sanitized };
  }
}

module.exports = {
  InputValidator,
  INPUT_SCHEMAS
};