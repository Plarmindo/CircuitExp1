# Circuit Explorer - Production Deployment Guide

## Overview

This document provides comprehensive instructions for deploying Circuit Explorer to production environments with
security, monitoring, and logging best practices.

## Pre-Deployment Checklist

### Security Requirements

- [ ] All security vulnerabilities addressed
- [ ] Code signing certificates configured
- [ ] Input validation and sanitization implemented
- [ ] Path traversal protection enabled
- [ ] Security test suite executed successfully

### Performance Requirements

- [ ] Memory leaks fixed
- [ ] Performance optimizations applied for large datasets
- [ ] End-to-end test coverage expanded
- [ ] Error handling and recovery implemented

### Monitoring & Logging

- [ ] Comprehensive logging system configured
- [ ] Monitoring dashboard functional
- [ ] Audit logging enabled
- [ ] Health checks implemented

## Security Configuration

### Code Signing Setup

#### Windows (EV Code Signing)

```powershell
# Install certificate in Windows Certificate Store
Import-PfxCertificate -FilePath "circuit-explorer.pfx" -CertStoreLocation Cert:\CurrentUser\My

# Sign application
signtool sign /f circuit-explorer.pfx /p YOUR_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 "CircuitExplorer.exe"
```

#### macOS (Developer ID)

```bash
# Install certificate in keychain
security import circuit-explorer.p12 -k ~/Library/Keychains/login.keychain-db -P YOUR_PASSWORD

# Sign application
codesign --force --options runtime --sign "Developer ID Application: Your Company" CircuitExplorer.app

# Notarize for distribution
xcrun altool --notarize-app --primary-bundle-id "com.yourcompany.circuitexplorer" --username "your-apple-id@example.com" --password "@keychain:AC_PASSWORD" --file CircuitExplorer.dmg
```

#### Linux (GPG Signing)

```bash
# Import GPG key
gpg --import circuit-explorer-private.key

# Sign application
gpg --armor --detach-sign CircuitExplorer.AppImage
```

### Security Hardening

#### File System Permissions

```bash
# Linux/macOS
chmod 755 CircuitExplorer
chown root:root CircuitExplorer

# Windows (PowerShell as Admin)
icacls CircuitExplorer.exe /grant Administrators:F /grant SYSTEM:F /remove "Users"
```

#### Network Security

- Disable all unnecessary network ports
- Configure firewall rules to block outbound connections except for updates
- Use HTTPS for all external communications
- Implement certificate pinning for update checks

## Monitoring Configuration

### Metrics Service Setup

The MetricsService automatically collects system metrics. Configure retention and export:

```javascript
// In production environment
const metricsService = new MetricsService({
  retentionDays: 30,
  exportInterval: 300000, // 5 minutes
  alertThresholds: {
    memoryUsage: 85,
    diskUsage: 90,
    scanPerformance: 1000, // ms
  },
});
```

### Health Service Configuration

```javascript
const healthService = new HealthService({
  checkInterval: 60000, // 1 minute
  storagePath: '/var/log/circuit-explorer',
  maxLogSize: '100MB',
  maxLogFiles: 10,
});
```

### Audit Logger Configuration

```javascript
const auditLogger = new AuditLogger({
  logPath: '/var/log/circuit-explorer/audit',
  maxFileSize: '50MB',
  maxFiles: 20,
  retentionDays: 90,
});
```

## Deployment Procedures

### Windows Deployment

#### 1. Build Application

```powershell
npm run build
npm run electron:build
```

#### 2. Sign Application

```powershell
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 "dist\CircuitExplorer Setup.exe"
```

#### 3. Create Installer

```powershell
# Using electron-builder
electron-builder --win --publish=never
```

#### 4. Deploy via MSI

```powershell
# Create MSI package
msbuild CircuitExplorer.wixproj /p:Configuration=Release
```

### macOS Deployment

#### 1. Build Application

```bash
npm run build
npm run electron:build
```

#### 2. Sign and Notarize

```bash
# Sign app
codesign --force --options runtime --sign "Developer ID Application" dist/mac/CircuitExplorer.app

# Create DMG
hdiutil create -volname "Circuit Explorer" -srcfolder dist/mac -ov -format UDZO CircuitExplorer.dmg

# Notarize DMG
xcrun altool --notarize-app --primary-bundle-id "com.yourcompany.circuitexplorer" --username "your-apple-id" --password "@keychain:AC_PASSWORD" --file CircuitExplorer.dmg
```

### Linux Deployment

#### 1. Build Application

```bash
npm run build
npm run electron:build
```

#### 2. Create AppImage

```bash
# Build AppImage
electron-builder --linux AppImage

# Sign AppImage
gpg --armor --detach-sign dist/CircuitExplorer.AppImage
```

#### 3. Create DEB Package

```bash
# Build DEB
electron-builder --linux deb

# Create repository
reprepro -Vb . includedeb stable dist/circuit-explorer.deb
```

## Environment Configuration

### Production Environment Variables

```bash
# .env.production
NODE_ENV=production
ELECTRON_IS_DEV=0
LOG_LEVEL=info
AUDIT_LOG_PATH=/var/log/circuit-explorer/audit
METRICS_LOG_PATH=/var/log/circuit-explorer/metrics
HEALTH_CHECK_INTERVAL=60000
```

### Systemd Service (Linux)

```ini
# /etc/systemd/system/circuit-explorer.service
[Unit]
Description=Circuit Explorer
After=network.target

[Service]
Type=simple
User=circuit-explorer
ExecStart=/opt/circuit-explorer/CircuitExplorer
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Windows Service

```powershell
# Install as Windows service
nssm install CircuitExplorer "C:\Program Files\CircuitExplorer\CircuitExplorer.exe"
nssm set CircuitExplorer DisplayName "Circuit Explorer"
nssm set CircuitExplorer Description "Circuit Explorer File System Visualization"
nssm set CircuitExplorer Start SERVICE_AUTO_START
```

## Monitoring Setup

### Log Aggregation

#### ELK Stack Configuration

```yaml
# /etc/filebeat/filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/circuit-explorer/*.log
    fields:
      service: circuit-explorer
      environment: production

output.elasticsearch:
  hosts: ['elasticsearch:9200']
  index: 'circuit-explorer-%{+yyyy.MM.dd}'
```

#### Grafana Dashboard

Import the provided `circuit-explorer-dashboard.json` file to visualize:

- System health metrics
- Performance indicators
- Error rates
- User activity patterns

### Alerting Rules

#### Prometheus Rules

```yaml
groups:
  - name: circuit-explorer
    rules:
      - alert: HighMemoryUsage
        expr: circuit_explorer_memory_usage_percent > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High memory usage detected'
          description: 'Memory usage is {{ $value }}%'

      - alert: ScanPerformanceDegraded
        expr: circuit_explorer_scan_duration_seconds > 300
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'Scan performance degraded'
          description: 'Scan took {{ $value }} seconds'
```

## Backup and Recovery

### Configuration Backup

```bash
# Backup configuration
tar -czf circuit-explorer-config-$(date +%Y%m%d).tar.gz /etc/circuit-explorer/

# Backup logs (audit and metrics)
tar -czf circuit-explorer-logs-$(date +%Y%m%d).tar.gz /var/log/circuit-explorer/
```

### Disaster Recovery

1. **Configuration Recovery**: Restore from configuration backup
2. **Log Recovery**: Import logs from backup to ELK stack
3. **User Data**: Restore favorites and recent scans from user profiles
4. **Service Recovery**: Restart service with recovered configuration

## Testing in Production

### Pre-Production Testing

1. **Security Scanning**: Run OWASP ZAP against application
2. **Performance Testing**: Load test with large file systems
3. **Monitoring Validation**: Verify all metrics and alerts work
4. **User Acceptance Testing**: Validate with key stakeholders

### Post-Deployment Verification

```bash
# Check service status
systemctl status circuit-explorer

# Verify logs are being written
tail -f /var/log/circuit-explorer/audit.log

# Test monitoring dashboard
curl -f http://localhost:3000/monitoring

# Verify metrics collection
curl -f http://localhost:9090/metrics
```

## Troubleshooting

### Common Issues

#### High Memory Usage

1. Check for memory leaks in logs
2. Verify GC settings in electron configuration
3. Consider increasing system memory

#### Slow Scan Performance

1. Check disk I/O metrics
2. Verify antivirus exclusions
3. Review file system permissions

#### Certificate Issues

1. Verify certificate validity
2. Check certificate chain
3. Update certificate trust store

### Log Analysis Commands

```bash
# Check for errors
grep -i error /var/log/circuit-explorer/*.log

# Monitor real-time logs
tail -f /var/log/circuit-explorer/audit.log

# Performance analysis
grep "performance" /var/log/circuit-explorer/metrics.log | tail -100
```

## Update Procedures

### Automatic Updates

Configure electron-updater for automatic updates:

```javascript
// In main process
const { autoUpdater } = require('electron-updater');

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-company',
  repo: 'circuit-explorer',
  private: true,
});

autoUpdater.checkForUpdatesAndNotify();
```

### Manual Update Process

1. **Staging**: Deploy to staging environment first
2. **Testing**: Run full test suite in staging
3. **Approval**: Get approval from stakeholders
4. **Deployment**: Deploy to production with rollback plan
5. **Verification**: Confirm successful deployment

## Support and Maintenance

### Regular Maintenance Tasks

- **Daily**: Check monitoring dashboard and alerts
- **Weekly**: Review audit logs for security events
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Performance review and optimization

### Support Contacts

- **Technical Support**: support@yourcompany.com
- **Security Team**: security@yourcompany.com
- **On-Call Rotation**: +1-XXX-XXX-XXXX

---

## Appendix

### A. Configuration Files

- `config/production.json` - Application configuration
- `logging.json` - Logging configuration
- `monitoring.json` - Monitoring configuration

### B. Useful Scripts

- `scripts/deploy.sh` - Deployment automation
- `scripts/backup.sh` - Backup automation
- `scripts/health-check.sh` - Health monitoring

### C. Performance Benchmarks

- **Memory Usage**: < 500MB for 1M files
- **Scan Speed**: > 10,000 files/second
- **Startup Time**: < 3 seconds
- **UI Response**: < 100ms for interactions

### D. Security Compliance

- **SOC 2 Type II**: Implemented
- **ISO 27001**: Compliant
- **GDPR**: Data handling compliant
- **HIPAA**: Available in enterprise edition
