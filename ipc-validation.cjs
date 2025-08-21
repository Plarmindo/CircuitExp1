/**
 * Minimal IPC validation utility used by tests and main handlers.
 * Exports:
 *  - validateSchema(schema, value) -> { success: boolean, errors?: Array<{path,msg}> }
 *  - noTraversal(path) -> boolean
 *
 * The schema DSL supported here is intentionally small and pragmatic for tests:
 *  - { type: 'string', nonEmpty?: true }
 *  - { type: 'number' }
 *  - { type: 'boolean' }
 *  - { type: 'object', props: { key: schema, ... }, allowUnknown?: boolean }
 *  - { type: 'array', items: schema }
 *  - { type: 'enum', values: [...] }
 *  - { type: 'tuple', items: [schema,...] }
 *  - { type: 'record', values: schema } // map of string->schema
 */
'use strict';

function addError(errors, path, msg) {
  errors.push({ path: path.join('.') || '<root>', msg });
}

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function validateInner(schema, value, path, errors) {
  if (!schema) return true;
  if (typeof schema === 'string') {
    // shorthand type name
    schema = { type: schema };
  }

  const t = schema.type;
  if (t === 'string') {
    if (typeof value !== 'string') {
      addError(errors, path, 'expected string');
      return false;
    }
    if (schema.nonEmpty && value.length === 0) {
      addError(errors, path, 'string must not be empty');
      return false;
    }
    return true;
  }

  if (t === 'number') {
    if (typeof value !== 'number') {
      addError(errors, path, 'expected number');
      return false;
    }
    return true;
  }

  if (t === 'boolean') {
    if (typeof value !== 'boolean') {
      addError(errors, path, 'expected boolean');
      return false;
    }
    return true;
  }

  if (t === 'enum') {
    if (!schema.values || !Array.isArray(schema.values)) {
      addError(errors, path, 'enum schema missing values array');
      return false;
    }
    if (!schema.values.includes(value)) {
      addError(errors, path, `value not in enum (${schema.values.join(',')})`);
      return false;
    }
    return true;
  }

  if (t === 'array') {
    if (!Array.isArray(value)) {
      addError(errors, path, 'expected array');
      return false;
    }
    for (let i = 0; i < value.length; i++) {
      validateInner(schema.items, value[i], path.concat(String(i)), errors);
    }
    return errors.length === 0;
  }

  if (t === 'tuple') {
    if (!Array.isArray(value)) {
      addError(errors, path, 'expected tuple (array)');
      return false;
    }
    const items = schema.items || [];
    if (value.length !== items.length) {
      addError(errors, path, `tuple length mismatch expected ${items.length}`);
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      validateInner(items[i], value[i], path.concat(String(i)), errors);
    }
    return errors.length === 0;
  }

  if (t === 'record') {
    if (!isPlainObject(value)) {
      addError(errors, path, 'expected record/object');
      return false;
    }
    for (const k of Object.keys(value)) {
      validateInner(schema.values, value[k], path.concat(k), errors);
    }
    return errors.length === 0;
  }

  if (t === 'object') {
    if (!isPlainObject(value)) {
      addError(errors, path, 'expected object');
      return false;
    }
    const props = schema.props || {};
    for (const key of Object.keys(props)) {
      validateInner(props[key], value[key], path.concat(key), errors);
    }
    if (!schema.allowUnknown) {
      for (const k of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(props, k)) {
          addError(errors, path.concat(k), 'unexpected property');
        }
      }
    }
    return errors.length === 0;
  }

  // Unknown schema type: treat as pass
  return true;
}

const { InputValidator } = require('./electron/input-validator.cjs');
const { SecurityLogger } = require('./electron/security-config.cjs');

function validateSchema(schemas, values) {
  // Expect arrays: schemas: Array<schema>, values: Array<any>
  const errors = [];
  try {
    const sArr = Array.isArray(schemas) ? schemas : [schemas];
    const vArr = Array.isArray(values) ? values : [values];
    
    for (let i = 0; i < sArr.length; i++) {
      const schema = sArr[i];
      const val = vArr[i];
      
      // optional short-circuit
      if (schema && schema.optional && (val === undefined)) continue;
      // If schema absent, skip
      if (!schema) continue;

      // Handle explicit non-empty string requirement
      if (schema.nonEmpty && typeof val === 'string' && val.trim().length === 0) {
        addError(errors, [String(i)], 'value must be non-empty');
        continue;
      }

      // Delegate complex schema types back to internal validator
      if (schema.type === 'tuple' || schema.type === 'record') {
        validateInner(schema, val, [String(i)], errors);
        continue;
      }

      // Use comprehensive input validation for enhanced security
      const result = InputValidator.validate(val, schema);
      if (!result.valid) {
        addError(errors, [String(i)], result.error);
        continue;
      }

      // Apply path security validation for securePath schemas
      if (schema.type === 'string' && schema.securePath) {
        const securityResult = validatePathSecurity(schema, result.value);
        if (!securityResult.valid) {
          addError(errors, [String(i)], securityResult.error);
          continue;
        }
      }
    }
  } catch (err) {
    SecurityLogger.logSecurityEvent('validation_error', { error: err.message });
    errors.push({ path: '<internal>', msg: String(err && err.stack ? err.stack : err) });
  }
  
  if (errors.length === 0) return { ok: true };
  // Return errors as strings for simple consumption by callers/tests
  return { ok: false, errors: errors.map(e => (typeof e === 'string' ? e : (e && e.msg) ? e.msg : String(e))) };
}

const path = require('path');
const fs = require('fs');

function noTraversal(p) {
  // Robust path traversal guard without filesystem dependency
  if (typeof p !== 'string') return false;

  // Basic sanity checks
  const trimmed = p.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.includes('\0')) return false; // null-byte injection

  // Reject absolute paths (handled by higher-level validation functions)
  if (path.isAbsolute(trimmed) || trimmed.startsWith('/')) return false;

  // Standardise separators (convert backslashes to forward slashes, collapse repeats)
  const uniform = trimmed.replace(/[\\/]+/g, '/');
  
  // Reject lingering single-dot traversal patterns like '/./'
  if (uniform.includes('/./')) return false;

  // Reject directory traversal segments containing ".." before normalisation.
  if (/(^|\/)\.\.(?:\/|$)/.test(uniform)) return false;

  // Normalise to collapse '.', '..' tokens
  const normalised = path.posix.normalize(uniform);

  // Reject if normalised path still contains traversal patterns
  if (normalised.includes('..')) return false;

  // Reject any parent directory references or double-slash artefacts
  const segments = normalised.split('/');
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === '..') return false;
    // Allow single '.' only when it is the entire path
    if (seg === '.' && normalised !== '.') return false;
    if (seg.length === 0 && segments.length > 1) return false; // prevents '//'
  }

  return true;
}

function isSafePath(p, basePath = process.cwd()) {
  // Allow absolute paths. They will be further sanitised by higher-level validators.
  if (path.isAbsolute(p)) {
    return true;
  }

  // For relative paths, ensure no traversal sequences
  if (!noTraversal(p)) return false;
  
  try {

    // Resolve relative to base path for further validation
    const resolvedPath = path.resolve(basePath, p);
    const resolvedBase = path.resolve(basePath);
    
    // Ensure the resolved path is within the base path
    return resolvedPath.startsWith(resolvedBase);
  } catch (e) {
    return false;
  }
}

function sanitizePath(p) {
  if (typeof p !== 'string') return null;

  // Detect and preserve Windows drive letter prefix (e.g., "C:\" or "C:/")
  let drivePrefix = '';
  const driveMatch = p.match(/^[a-zA-Z]:[\\/]/);
  if (driveMatch) {
    // Keep the drive (e.g., "C:") but drop the separator for uniform processing later
    drivePrefix = driveMatch[0].slice(0, 2); // "C:"
    p = p.slice(2); // remove drive part from the remaining path for sanitisation
  }
  
  // Remove potentially dangerous characters (colon already handled)
  let sanitized = p.replace(/[<>:"|?*\x00-\x1f]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Reject dangerous shell metacharacters that could enable command injection
  // Characters like ; & | ` $ ( ) are not permissible in sanitized paths
  if (/[;&|`$()]/.test(sanitized)) return null;
  
  // Ensure no double slashes or backslashes, convert to forward slashes for consistency
  sanitized = sanitized.replace(/[\\/]+/g, '/');
  
  // Reattach drive prefix if present, ensuring a leading slash after the drive (e.g., "C:/path")
  if (drivePrefix) {
    sanitized = `${drivePrefix}/${sanitized.replace(/^\/+/, '')}`;
  }
  
  // Apply path traversal protection (ignore drive for traversal check)
  let traversalCheckPath = drivePrefix ? sanitized.slice(2) : sanitized; // remove "C:" when checking
  // Remove leading slash for Windows absolute paths to treat as relative during traversal check
  if (drivePrefix && traversalCheckPath.startsWith('/')) {
    traversalCheckPath = traversalCheckPath.slice(1);
  }
  if (!noTraversal(traversalCheckPath)) return null;
  
  return sanitized;
}

// Enhanced validation schema support for path security
function validatePathSecurity(schema, value) {
  if (schema.type === 'string' && schema.securePath) {
    if (typeof value !== 'string') {
      return { valid: false, error: 'expected string for secure path' };
    }
    
    // Apply comprehensive path validation
    const sanitized = sanitizePath(value);
    if (sanitized === null) {
      return { valid: false, error: 'path traversal detected' };
    }
    
    if (!isSafePath(sanitized)) {
      return { valid: false, error: 'path traversal detected' };
    }
    
    return { valid: true, value: sanitized };
  }
  
  return { valid: true, value };
}

// CommonJS exports with named properties for interop
module.exports.validateSchema = validateSchema;
module.exports.noTraversal = noTraversal;
module.exports.isSafePath = isSafePath;
module.exports.sanitizePath = sanitizePath;
module.exports.validatePathSecurity = validatePathSecurity;
module.exports.default = { 
  validateSchema, 
  noTraversal, 
  isSafePath, 
  sanitizePath, 
  validatePathSecurity 
};
