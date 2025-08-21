# CircuitExp1 API Documentation

## Overview
CircuitExp1 is a secure, high-performance file system visualization tool built with Electron and React. This documentation covers the main APIs, security features, and integration points.

## Architecture

### Frontend Architecture
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **Electron IPC** for secure main/renderer communication
- **Custom Metro Visualization** for interactive file system mapping

### Backend Architecture
- **Electron Main Process** for file system operations
- **Node.js File System APIs** with security hardening
- **Rate Limiting** and **PII Detection** services
- **Performance Monitoring** with real-time metrics

## Core APIs

### 1. Electron IPC API

#### Main Process APIs
```typescript
// File system operations
interface ElectronAPI {
  selectFolder(): Promise<string | null>;
  selectAndScanFolder(): Promise<{ folder: string; scanId: string }>;
  openPath(path: string): Promise<void>;
  renamePath(oldPath: string, newPath: string): Promise<void>;
  
  // Security APIs
  getSecurityConfig(): Promise<SecurityConfig>;
  validatePath(path: string): Promise<boolean>;
  
  // Performance APIs
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
  getSystemHealth(): Promise<SystemHealth>;
}

// Usage
const folder = await window.electronAPI.selectFolder();
```

#### Security Validation
All file operations include built-in security validation:
- Path traversal protection
- File size limits
- Rate limiting
- PII detection and redaction

### 2. Scan Manager API

```typescript
interface ScanManager {
  startScan(rootPath: string, options?: ScanOptions): Promise<string>;
  cancelScan(scanId: string): Promise<void>;
  getScanProgress(scanId: string): Promise<ScanProgress>;
  getScanResults(scanId: string): Promise<ScanResults>;
}

interface ScanOptions {
  maxDepth?: number;
  excludePatterns?: string[];
  includeHidden?: boolean;
  maxFileSize?: number;
}

interface ScanProgress {
  dirsProcessed: number;
  filesProcessed: number;
  totalFiles: number;
  completion: number;
}
```

### 3. Visualization API

#### MetroStage Component
```typescript
interface MetroStageProps {
  nodes: NodeEntry[];
  onNodeClick?: (node: NodeEntry) => void;
  onNodeHover?: (node: NodeEntry) => void;
  theme?: 'light' | 'dark';
  performanceMode?: boolean;
}

interface NodeEntry {
  path: string;
  name: string;
  kind: 'dir' | 'file';
  size?: number;
  children?: NodeEntry[];
}
```

#### Performance Optimization
- Automatic LOD (Level of Detail) based on zoom level
- Efficient batch rendering for large datasets
- Memory management with garbage collection
- Real-time FPS monitoring

## Security Features

### 1. Path Traversal Protection
```typescript
import { validatePath } from '../security/path-validator';

// Automatically sanitizes and validates paths
const safePath = validatePath(userInput);
// Returns null for invalid paths
```

### 2. Content Security Policy (CSP)
- **Development Mode**: Relaxed CSP for debugging
- **Production Mode**: Hardened CSP without 'unsafe-inline'
- **Dynamic CSP**: Runtime policy updates based on environment

### 3. PII Detection Service
```typescript
import { PIIDetector, defaultPIIConfig } from '../services/pii-detector';

const detector = new PIIDetector(defaultPIIConfig);

// Scan file paths for PII
const results = detector.scanPath('/Users/john.doe/Documents/ssn-123-45-6789.txt');
// Returns redacted paths and detection metadata
```

### 4. Rate Limiting
```typescript
import { RateLimiter, defaultRateLimitConfig } from '../services/rate-limiter';

const limiter = new RateLimiter(defaultRateLimitConfig);

// Check rate limits before operations
const allowed = limiter.checkRateLimit('user123', 'scan');
if (!allowed.allowed) {
  console.log(`Rate limit exceeded. Retry after ${allowed.retryAfter}ms`);
}
```

## Performance Monitoring

### 1. Real-time Metrics
```typescript
interface PerformanceMetrics {
  memoryUsage: number;    // Percentage
  cpuUsage: number;       // Percentage
  fileCount: number;      // Files processed
  scanSpeed: number;      // Files per second
  errorCount: number;     // Error count
}

// Access via Electron API
const metrics = await window.electronAPI.getPerformanceMetrics();
```

### 2. Performance Dashboard
- **Live Monitoring**: Real-time performance data
- **Historical Trends**: Performance over time
- **Alert System**: Automatic alerts for performance issues
- **Export Metrics**: JSON export for analysis

### 3. Memory Management
- Automatic garbage collection
- Memory leak detection
- Large dataset handling with pagination
- Efficient data structures for visualization

## Configuration

### 1. User Settings
```typescript
interface UserSettings {
  theme: 'light' | 'dark';
  maxDepth: number;
  showHiddenFiles: boolean;
  performanceMode: boolean;
  autoSave: boolean;
}

// Update settings
await updateUserSettings({ theme: 'dark', maxDepth: 5 });
```

### 2. Security Configuration
```typescript
interface SecurityConfig {
  cspPolicy: string;
  maxFileSize: number;
  allowedExtensions: string[];
  rateLimit: RateLimitConfig;
  piiConfig: PIIConfig;
}
```

## Error Handling

### 1. Error Reporter
```typescript
import { errorReporter } from '../services/error-reporter';

try {
  // File operation
} catch (error) {
  const errorInfo = errorReporter.reportError(error, 'file-operation');
  console.error('Error reported:', errorInfo);
}
```

### 2. Audit Logging
```typescript
import { auditLogger } from '../services/audit-logger';

// Log security events
auditLogger.logSecurityViolation('path-traversal-attempt', '/etc/passwd');

// Log file access
auditLogger.logFileAccess('folder-selection', '/Users/documents');
```

## Testing

### 1. Unit Tests
```bash
npm run test:unit
```

### 2. Integration Tests
```bash
npm run test:e2e
```

### 3. Security Tests
```bash
npm run test:security
```

### 4. Performance Tests
```bash
npm run test:performance
```

## Deployment

### 1. Build Commands
```bash
# Development
npm run dev

# Production build
npm run build

# Platform-specific builds
npm run build:win
npm run build:mac
npm run build:linux
```

### 2. Code Signing
- Windows: EV Code Signing Certificate
- macOS: Apple Developer Certificate
- Linux: GPG signing

### 3. Distribution
- **Auto-updater**: Built-in update mechanism
- **Portable**: No installation required
- **System integration**: Context menu integration

## Examples

### Basic Usage
```typescript
// Initialize application
import { MetroUI } from './components/MetroUI';

// Render visualization
<MetroUI
  scanId="scan-123"
  nodes={fileNodes}
  progress={scanProgress}
  done={scanComplete}
  rootPath="/Users/documents"
/>;
```

### Advanced Configuration
```typescript
// Custom security settings
const securityConfig = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedExtensions: ['.txt', '.pdf', '.doc'],
  rateLimit: {
    maxRequests: 50,
    windowMs: 15 * 60 * 1000 // 15 minutes
  }
};

// Initialize with custom config
const detector = new PIIDetector({
  ...defaultPIIConfig,
  customPatterns: ['\\b[A-Z]{2,}\\d{4}\\b'] // Custom employee ID pattern
});
```

## Support

### 1. Documentation
- [Security Guide](./SECURITY.md)
- [Performance Guide](./PERFORMANCE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

### 2. Community
- [GitHub Issues](https://github.com/your-org/CircuitExp1/issues)
- [Discussions](https://github.com/your-org/CircuitExp1/discussions)

### 3. Security
- [Security Policy](./SECURITY.md)
- [Responsible Disclosure](./SECURITY.md#reporting-vulnerabilities)

---

*Last updated: $(date)*
*Version: 1.0.0*