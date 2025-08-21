/**
 * Security Configuration and Utilities
 * Production-grade security settings and validation utilities
 */

'use strict';

const path = require('path');
const { noTraversal, isSafePath, sanitizePath } = require('../ipc-validation.cjs');

// Security constants
const SECURITY_CONSTANTS = {
  // Allowed file extensions for file operations
  ALLOWED_EXTENSIONS: [
    '.json', '.txt', '.log', '.csv', '.xml', '.yaml', '.yml',
    '.md', '.rst', '.html', '.css', '.js', '.ts', '.tsx'
  ],
  
  // Maximum file size for uploads (10MB)
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  
  // Maximum path length
  MAX_PATH_LENGTH: 260,
  
  // Forbidden file patterns
  FORBIDDEN_PATTERNS: [
    /\.(exe|dll|bat|cmd|sh|bin)$/i,
    /^\./, // Hidden files
    /node_modules/i,
    /\.git/i
  ],
  
  // Content Security Policy for production
  CSP_PRODUCTION: [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
    "media-src 'none'"
  ].join('; '),
  
  // Development CSP (more permissive)
  CSP_DEVELOPMENT: [
    "default-src 'self' 'unsafe-eval'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' ws://localhost:*",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
    "media-src 'none'"
  ].join('; ')
};

// Security validation utilities
class SecurityValidator {
  static validateFilePath(filePath, basePath = process.cwd()) {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'Invalid file path' };
    }

    // Check path length
    if (filePath.length > SECURITY_CONSTANTS.MAX_PATH_LENGTH) {
      return { valid: false, error: 'Path too long' };
    }

    // Sanitize and validate path
    const sanitized = sanitizePath(filePath);
    if (!sanitized) {
      const traversal = !isSafePath(filePath);
      return { valid: false, error: traversal ? 'path traversal detected' : 'Invalid path format' };
    }

    // Check for path traversal
    if (!isSafePath(sanitized, basePath)) {
      return { valid: false, error: 'Path traversal detected' };
    }

    // Check file extension
    const ext = path.extname(sanitized).toLowerCase();
    if (!SECURITY_CONSTANTS.ALLOWED_EXTENSIONS.includes(ext)) {
      return { valid: false, error: 'File extension not allowed' };
    }

    // Check forbidden patterns
    for (const pattern of SECURITY_CONSTANTS.FORBIDDEN_PATTERNS) {
      if (pattern.test(sanitized)) {
        return { valid: false, error: 'File pattern not allowed' };
      }
    }

    // Return sanitized relative or absolute path unchanged
    return { valid: true, value: sanitized };
  }

  static validateDirectoryPath(dirPath, basePath = process.cwd()) {
    if (!dirPath || typeof dirPath !== 'string') {
      return { valid: false, error: 'Invalid directory path' };
    }

    // Check path length
    if (dirPath.length > SECURITY_CONSTANTS.MAX_PATH_LENGTH) {
      return { valid: false, error: 'Path too long' };
    }

    // Sanitize and validate path
    const sanitized = sanitizePath(dirPath);
    if (!sanitized) {
      const traversal = !isSafePath(dirPath);
      return { valid: false, error: traversal ? 'path traversal detected' : 'Invalid path format' };
    }

    // Check for path traversal
    if (!isSafePath(sanitized, basePath)) {
      return { valid: false, error: 'Path traversal detected' };
    }

    return { valid: true, value: sanitized };
  }

  static sanitizeInput(input, maxLength = 1000) {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Input must be string' };
    }

    if (input.length > maxLength) {
      return { valid: false, error: 'Input too long' };
    }

    // Remove control characters and potential XSS vectors
    let sanitized = input
      .replace(/[<>"'&]/g, '') // Remove HTML/XML dangerous characters
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
      .trim();

    // Strip dangerous URI schemes like javascript:
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Remove common SQL injection keywords
    sanitized = sanitized.replace(/\b(drop\s+table|drop|or)\b/gi, '');

    // If input does not appear to be a path (contains no slash or backslash),
    // apply a stricter whitelist to mitigate injection through unusual symbols.
    if (!/[\\/]/.test(sanitized)) {
      // Allow alphanumerics, whitespace, underscore, hyphen, and dot.
      // Allow forward slash and parentheses as they appear in common sanitized outputs
      sanitized = sanitized.replace(/[^A-Za-z0-9 _.\-/()]/g, '');
      // Collapse multiple spaces
      sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();
    }

    return { valid: true, value: sanitized };
  }

  static getSecurityHeaders(isDevelopment = false) {
    return {
      'Content-Security-Policy': isDevelopment ? SECURITY_CONSTANTS.CSP_DEVELOPMENT : SECURITY_CONSTANTS.CSP_PRODUCTION,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
  }

  static validateFileSize(size) {
    if (typeof size !== 'number' || size < 0) {
      return { valid: false, error: 'Invalid file size' };
    }

    if (size > SECURITY_CONSTANTS.MAX_FILE_SIZE) {
      return { valid: false, error: 'File too large' };
    }

    return { valid: true };
  }
}

// Rate limiting for sensitive operations
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) { // 100 requests per minute
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  check(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const keyRequests = this.requests.get(key);
    const validRequests = keyRequests.filter(time => time > windowStart);
    
    if (validRequests.length >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return { 
      allowed: true, 
      remaining: this.maxRequests - validRequests.length 
    };
  }

  reset(key) {
    this.requests.delete(key);
  }
}

// Security audit logging
class SecurityLogger {
  static logSecurityEvent(event, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event,
      details,
      severity: this.getSeverity(event)
    };
    
    // In production, this would write to a secure log file
    console.log('[SECURITY]', JSON.stringify(logEntry));
  }

  static getSeverity(event) {
    const severityMap = {
      'path_traversal': 'HIGH',
      'invalid_input': 'MEDIUM',
      'rate_limit_exceeded': 'MEDIUM',
      'forbidden_extension': 'HIGH',
      'file_size_exceeded': 'LOW'
    };
    
    return severityMap[event] || 'MEDIUM';
  }
}

module.exports = {
  SECURITY_CONSTANTS,
  SecurityValidator,
  RateLimiter,
  SecurityLogger
};