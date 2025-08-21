# CircuitExp1 Security Hardening Guide

## Overview
This guide provides comprehensive security hardening procedures for CircuitExp1 production deployments. It covers all security aspects from initial setup to ongoing maintenance.

## 1. Pre-Deployment Security Checklist

### ✅ Security Assessment
- [ ] All dependencies audited with `npm audit`
- [ ] No high/critical vulnerabilities present
- [ ] Security test suite passes 100%
- [ ] Static code analysis completed
- [ ] Penetration testing performed

### ✅ Code Signing
- [ ] EV Code Signing Certificate (Windows)
- [ ] Apple Developer Certificate (macOS)
- [ ] GPG signing configured (Linux)
- [ ] Certificate validity verified
- [ ] Auto-updater signing configured

### ✅ Build Security
- [ ] Production builds from clean environment
- [ ] No debug symbols in production builds
- [ ] Source maps disabled in production
- [ ] Environment variables sanitized
- [ ] Build artifacts integrity verified

## 2. Runtime Security Configuration

### 2.1 Electron Security Hardening

#### WebPreferences Configuration
```javascript
// electron-main.cjs - Production Configuration
const createWindow = () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      // Critical security settings
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webSecurity: true,
      
      // Additional hardening
      allowPopups: false,
      allowRunningInsecureContent: false,
      webgl: false,
      
      // Preload script for secure IPC
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
};
```

#### Content Security Policy (Production)
```javascript
// Strict CSP for production
const CSP_PRODUCTION = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ');
```

### 2.2 File System Security

#### Path Traversal Protection
```typescript
// Path validation implementation
const validatePath = (inputPath: string): string | null => {
  // Normalize path
  const normalized = path.normalize(inputPath);
  
  // Check for traversal attempts
  if (normalized.includes('..')) {
    auditLogger.logSecurityViolation('path-traversal', inputPath);
    return null;
  }
  
  // Check against allowed directories
  const allowedRoots = ['/Users', '/home', 'C:\\Users'];
  const isAllowed = allowedRoots.some(root => normalized.startsWith(root));
  
  if (!isAllowed) {
    auditLogger.logSecurityViolation('unauthorized-path', inputPath);
    return null;
  }
  
  return normalized;
};
```

#### File Size Limits
```typescript
const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024,      // 50MB
  MAX_TOTAL_SIZE: 500 * 1024 * 1024,    // 500MB
  MAX_FILE_COUNT: 10000,                // 10,000 files
  MAX_DEPTH: 10                         // 10 levels deep
};
```

### 2.3 Rate Limiting Configuration

#### Production Rate Limits
```typescript
const PRODUCTION_RATE_LIMITS = {
  // API rate limiting
  api: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxBurst: 20
  },
  
  // File operations
  file: {
    maxRequests: 50,
    windowMs: 5 * 60 * 1000,   // 5 minutes
    maxConcurrent: 3
  },
  
  // Scan operations
  scan: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxConcurrent: 1
  }
};
```

### 2.4 PII Detection Configuration

#### Production PII Rules
```typescript
const PRODUCTION_PII_CONFIG = {
  email: {
    enabled: true,
    redaction: '[EMAIL]',
    allowlist: ['example.com', 'test.com']
  },
  
  phone: {
    enabled: true,
    redaction: '[PHONE]',
    formats: ['US', 'International']
  },
  
  ssn: {
    enabled: true,
    redaction: '[SSN]',
    strict: true
  },
  
  creditCard: {
    enabled: true,
    redaction: '[CARD]',
    luhnCheck: true
  },
  
  ipAddress: {
    enabled: true,
    redaction: '[IP]',
    includePrivate: false
  }
};
```

## 3. Network Security

### 3.1 Network Isolation
- [ ] Application runs in isolated network environment
- [ ] Firewall rules configured for outbound connections only
- [ ] No inbound network access required
- [ ] DNS filtering for malicious domains
- [ ] HTTPS enforcement for all connections

### 3.2 Update Mechanism Security
```javascript
// Auto-updater security configuration
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-org',
  repo: 'CircuitExp1',
  private: true,
  token: process.env.GITHUB_TOKEN
});

// Signature verification
autoUpdater.checkForUpdatesAndNotify().catch(err => {
  logger.error('Auto-updater failed:', err);
});

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Application Update',
    message: process.platform === 'win32' ? releaseNotes : releaseName,
    detail: 'A new version has been downloaded. Restart the application to apply the updates.'
  };

  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall();
  });
});
autoUpdater.checkForUpdatesAndNotify({
  signatureVerification: true,
  certificateCheck: true
});
```

## 4. Data Protection

### 4.1 Encryption at Rest
```typescript
// File encryption for sensitive data
import crypto from 'crypto';

const encryptFile = (data: Buffer, key: string): Buffer => {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
};
```

### 4.2 Secure Storage
- [ ] User preferences encrypted
- [ ] Recent scans history sanitized
- [ ] Temporary files auto-cleanup
- [ ] Secure key storage using OS keychain

## 5. Monitoring and Logging

### 5.1 Security Event Monitoring
```typescript
// Security event types
enum SecurityEvent {
  PATH_TRAVERSAL_ATTEMPT = 'path-traversal-attempt',
  RATE_LIMIT_EXCEEDED = 'rate-limit-exceeded',
  PII_DETECTED = 'pii-detected',
  UNAUTHORIZED_ACCESS = 'unauthorized-access',
  INVALID_SIGNATURE = 'invalid-signature'
}

// Audit logging
const auditLogger = {
  logSecurityViolation: (event: SecurityEvent, details: any) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userId: getCurrentUserId(),
      sessionId: getSessionId()
    };
    
    // Send to security monitoring
    securityMonitor.log(logEntry);
  }
};
```

### 5.2 Performance Monitoring
```typescript
// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  memoryUsage: 80,      // 80%
  cpuUsage: 90,         // 90%
  fileCount: 10000,     // 10,000 files
  scanDuration: 300000  // 5 minutes
};

// Alert system
const performanceMonitor = {
  checkThresholds: (metrics: PerformanceMetrics) => {
    Object.entries(PERFORMANCE_THRESHOLDS).forEach(([key, threshold]) => {
      if (metrics[key] > threshold) {
        alertManager.send(`Performance threshold exceeded: ${key} = ${metrics[key]}`);
      }
    });
  }
};
```

## 6. Incident Response

### 6.1 Security Incident Playbook

#### Immediate Actions (0-15 minutes)
1. **Isolate affected systems**
   - Stop all file operations
   - Disable network access
   - Preserve evidence

2. **Assess impact**
   - Identify affected files/directories
   - Check for data exfiltration
   - Verify system integrity

3. **Notify stakeholders**
   - Security team
   - System administrators
   - Legal/compliance team

#### Investigation (15 minutes - 2 hours)
1. **Gather evidence**
   - System logs
   - Security logs
   - Network traffic
   - File access patterns

2. **Analyze attack vector**
   - Review audit logs
   - Check for vulnerabilities
   - Identify attack timeline

#### Recovery (2-24 hours)
1. **System restoration**
   - Restore from clean backup
   - Rebuild affected systems
   - Reapply security patches

2. **Security improvements**
   - Patch identified vulnerabilities
   - Update security policies
   - Implement additional monitoring

### 6.2 Communication Plan
```typescript
// Incident notification system
const incidentNotification = {
  notifySecurityTeam: (incident: SecurityIncident) => {
    const notification = {
      severity: incident.severity,
      type: incident.type,
      affectedSystems: incident.affectedSystems,
      timeline: incident.timeline,
      actionsTaken: incident.actionsTaken
    };
    
    // Send to security team
    securityTeam.notify(notification);
    
    // Log for compliance
    complianceLogger.log(notification);
  }
};
```

## 7. Compliance and Governance

### 7.1 Compliance Requirements
- [ ] **GDPR**: Data protection and privacy
- [ ] **CCPA**: California Consumer Privacy Act
- [ ] **HIPAA**: Health Insurance Portability and Accountability Act (if applicable)
- [ ] **SOX**: Sarbanes-Oxley Act (if applicable)
- [ ] **PCI-DSS**: Payment Card Industry Data Security Standard

### 7.2 Regular Security Reviews
- [ ] **Weekly**: Security log review
- [ ] **Monthly**: Vulnerability scans
- [ ] **Quarterly**: Penetration testing
- [ ] **Annually**: Full security audit
- [ ] **On-demand**: Incident post-mortems

### 7.3 Security Training
- [ ] **Developer training**: Secure coding practices
- [ ] **User training**: Security awareness
- [ ] **Admin training**: Incident response
- [ ] **Regular updates**: New threat landscape

## 8. Deployment Checklist

### Pre-Production
- [ ] Security review completed
- [ ] All tests passing
- [ ] Code signing configured
- [ ] Monitoring enabled
- [ ] Documentation updated

### Production Deployment
- [ ] Blue-green deployment configured
- [ ] Rollback procedures tested
- [ ] Monitoring dashboards active
- [ ] Security alerts configured
- [ ] Backup verification completed

### Post-Deployment
- [ ] Health checks passing
- [ ] Security monitoring active
- [ ] Performance metrics baseline
- [ ] User acceptance testing
- [ ] Documentation finalized

## 9. Emergency Procedures

### 9.1 Security Breach Response
```bash
# Immediate lockdown script
#!/bin/bash
echo "Initiating security lockdown..."

# Stop all file operations
systemctl stop circuitexp1

# Block network access
iptables -A OUTPUT -j DROP

# Preserve logs
cp -r /var/log/circuitexp1 /var/log/incident-$(date +%Y%m%d-%H%M%S)

# Notify security team
echo "Security incident detected" | mail security@company.com
```

### 9.2 Data Recovery Procedures
```bash
# Restore from backup
#!/bin/bash
echo "Restoring from clean backup..."

# Stop services
systemctl stop circuitexp1

# Restore application
rsync -av /backup/circuitexp1-clean/ /opt/circuitexp1/

# Verify integrity
sha256sum -c /backup/circuitexp1-checksums.txt

# Restart services
systemctl start circuitexp1
```

## 10. Security Contacts

### 10.1 Emergency Contacts
- **Security Team**: security@company.com
- **System Admin**: admin@company.com
- **Legal Team**: legal@company.com
- **On-call**: +1-XXX-XXX-XXXX

### 10.2 Vendor Contacts
- **Certificate Authority**: [Your CA]
- **Security Tools**: [Vendor Support]
- **Cloud Provider**: [Cloud Support]

---

**Remember**: Security is an ongoing process. This guide should be reviewed and updated regularly based on new threats, vulnerabilities, and lessons learned from security incidents.

*Last updated: $(date)*
*Version: 1.0.0*