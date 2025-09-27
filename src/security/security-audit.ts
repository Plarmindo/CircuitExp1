import { EventEmitter } from 'events';
import { writeFile as _writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { app } from 'electron';
import { SecurityHardening } from './security-hardening';
import { securityEventTypes, monitoringThresholds } from './security-config';

export interface SecurityAuditEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  ip?: string;
  userId?: string;
  sessionId?: string;
  details: Record<string, any>;
  actionTaken?: string;
  resolved: boolean;
}

export interface SecurityAuditConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  retentionDays: number;
  maxLogSize: number; // in bytes
  rotationCount: number;
  alertThresholds: typeof monitoringThresholds;
}

export class SecurityAuditLogger extends EventEmitter {
  private config: SecurityAuditConfig;
  private events: SecurityAuditEvent[] = [];
  private currentLogFile: string;
  private logDirectory: string;
  private security: SecurityHardening;
  private thresholds: Map<string, number> = new Map();

  constructor(config: Partial<SecurityAuditConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      logLevel: 'info',
      retentionDays: 30,
      maxLogSize: 50 * 1024 * 1024, // 50MB
      rotationCount: 5,
      alertThresholds: monitoringThresholds,
      ...config,
    };

    this.security = SecurityHardening.getInstance();
    this.logDirectory = join(app?.getPath('userData') || './logs', 'security');
    this.currentLogFile = join(this.logDirectory, `security-${new Date().toISOString().split('T')[0]}.log`);

    this.initialize();
  }

  private async initialize() {
    try {
      await mkdir(this.logDirectory, { recursive: true });
      await this.loadExistingEvents();
      this.startPeriodicCleanup();
    } catch (error) {
      console.error('Failed to initialize security audit logger:', error);
    }
  }

  /**
   * Log a security event
   */
  public async logEvent(event: Omit<SecurityAuditEvent, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    if (!this.config.enabled) return;

    const auditEvent: SecurityAuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      resolved: false,
      ...event,
    };

    this.events.push(auditEvent);
    await this.writeEvent(auditEvent);

    // Check for threshold violations
    await this.checkThresholds(auditEvent);

    // Emit event for real-time monitoring
    this.emit('security-event', auditEvent);

    // Keep in-memory events limited
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }
  }

  /**
   * Log authentication events
   */
  public async logAuthEvent(type: 'success' | 'failure', details: {
    ip: string;
    userId?: string;
    username?: string;
    reason?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.logEvent({
      type: type === 'success' ? securityEventTypes.AUTH_SUCCESS : securityEventTypes.AUTH_FAILURE,
      severity: type === 'success' ? 'low' : 'medium',
      source: 'auth',
      ip: details.ip,
      userId: details.userId,
      details: {
        username: details.username,
        reason: details.reason,
        userAgent: details.userAgent,
      },
      actionTaken: type === 'failure' ? 'logged' : undefined,
    });
  }

  /**
   * Log security violations
   */
  public async logSecurityViolation(type: string, details: {
    ip: string;
    violation: string;
    payload?: Record<string, unknown>;
    userId?: string;
  }): Promise<void> {
    const severityMap: Record<string, 'medium' | 'high' | 'critical'> = {
      [securityEventTypes.XSS_ATTEMPT]: 'high',
      [securityEventTypes.SQL_INJECTION]: 'critical',
      [securityEventTypes.PATH_TRAVERSAL]: 'high',
      [securityEventTypes.INVALID_CSRF]: 'medium',
      [securityEventTypes.FILE_UPLOAD_VIOLATION]: 'medium',
      [securityEventTypes.SUSPICIOUS_ACTIVITY]: 'medium',
    };

    await this.logEvent({
      type,
      severity: severityMap[type] || 'medium',
      source: 'security',
      ip: details.ip,
      userId: details.userId,
      details: {
        violation: details.violation,
        payload: details.payload,
      },
      actionTaken: 'logged',
    });
  }

  /**
   * Compatibility wrapper: log a generic security event with type and details
   * Many call sites use `securityAudit.logSecurityEvent(type, details)`
   */
  public async logSecurityEvent(type: string, details: Record<string, unknown> = {}): Promise<void> {
    // Choose a default severity based on known types, otherwise low
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      RATE_LIMIT_EXCEEDED: 'medium',
      PATH_TRAVERSAL: 'high',
      SQL_INJECTION: 'critical',
      XSS_ATTEMPT: 'high',
      SECURITY_INIT: 'low',
      SECURITY_INIT_FAILED: 'medium',
      SECURITY_ENABLED: 'low',
      SECURITY_DISABLED: 'medium',
      SECURITY_LEVEL_CHANGED: 'low',
      SECURITY_VIOLATION: 'high',
      PLUGIN_VALIDATION: 'low',
      BATCH_PLUGIN_VALIDATION: 'low',
    };

    const severity = severityMap[type] || 'low';

    await this.logEvent({
      type,
      severity,
      source: 'system',
      details: { ...details },
    });
  }

  /**
   * Get security events with filtering
   */
  public getEvents(filter: {
    type?: string;
    severity?: string;
    source?: string;
    ip?: string;
    userId?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  } = {}): SecurityAuditEvent[] {
    let filtered = this.events;

    if (filter.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }
    if (filter.severity) {
      filtered = filtered.filter(e => e.severity === filter.severity);
    }
    if (filter.source) {
      filtered = filtered.filter(e => e.source === filter.source);
    }
    if (filter.ip) {
      filtered = filtered.filter(e => e.ip === filter.ip);
    }
    if (filter.userId) {
      filtered = filtered.filter(e => e.userId === filter.userId);
    }
    if (filter.startTime) {
      filtered = filtered.filter(e => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      filtered = filtered.filter(e => e.timestamp <= filter.endTime!);
    }

    return filtered.slice(0, filter.limit || 1000);
  }

  /**
   * Get security statistics
   */
  public getStatistics(timeRange: number = 24 * 60 * 60 * 1000): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    eventsBySource: Record<string, number>;
    topIPs: Array<{ ip: string; count: number }>;
    topUsers: Array<{ userId: string; count: number }>;
    trend: Array<{ time: number; count: number }>;
  } {
    const now = Date.now();
    const startTime = now - timeRange;
    const events = this.getEvents({ startTime, endTime: now });

    const stats = {
      totalEvents: events.length,
      eventsByType: this.groupBy(events, 'type'),
      eventsBySeverity: this.groupBy(events, 'severity'),
      eventsBySource: this.groupBy(events, 'source'),
      topIPs: this.getTopItems(events, 'ip'),
      topUsers: this.getTopItems(events, 'userId'),
      trend: this.getTrend(events, startTime, now),
    };

    return stats;
  }

  /**
   * Generate security report
   */
  public async generateReport(options: {
    format: 'json' | 'html' | 'markdown';
    timeRange: number;
    includeDetails: boolean;
  } = {
    format: 'json',
    timeRange: 7 * 24 * 60 * 60 * 1000, // 7 days
    includeDetails: false,
  }): Promise<string> {
    const stats = this.getStatistics(options.timeRange);
    const events = this.getEvents({
      startTime: Date.now() - options.timeRange,
      limit: options.includeDetails ? 1000 : 100,
    });

    const report = {
      generatedAt: new Date().toISOString(),
      timeRange: options.timeRange,
      summary: stats,
      recentEvents: events,
      recommendations: this.generateRecommendations(stats),
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    switch (options.format) {
      case 'html':
        return this.generateHtmlReport(report);
      case 'markdown':
        return this.generateMarkdownReport(report);
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Clear old events based on retention policy
   */
  public async cleanup(): Promise<void> {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

    this.events = this.events.filter(e => e.timestamp > cutoffTime);

    // Clean up old log files
    const files = await this.getLogFiles();
    for (const file of files) {
      const fileDate = new Date(file.name.split('-')[1]?.split('.')[0] || '');
      if (fileDate.getTime() < cutoffTime) {
        try {
          await require('fs/promises').unlink(file.path);
        } catch {
          console.warn('Failed to delete old log file:', file.path);
        }
      }
    }
  }

  private async checkThresholds(event: SecurityAuditEvent): Promise<void> {
    const key = `${event.type}:${event.ip || 'unknown'}`;
    const count = (this.thresholds.get(key) || 0) + 1;
    this.thresholds.set(key, count);

    // Check if threshold is exceeded
    const thresholdConfig = this.config.alertThresholds;
    let threshold = 0;

    switch (event.type) {
      case securityEventTypes.AUTH_FAILURE:
        threshold = thresholdConfig.failedLogins.warning;
        break;
      case securityEventTypes.RATE_LIMIT_EXCEEDED:
        threshold = thresholdConfig.rateLimit.warning;
        break;
      case securityEventTypes.SUSPICIOUS_ACTIVITY:
        threshold = thresholdConfig.suspiciousActivity.warning;
        break;
    }

    if (count >= threshold && threshold > 0) {
      this.emit('threshold-exceeded', {
        event,
        count,
        threshold,
      });
    }
  }

  private async writeEvent(event: SecurityAuditEvent): Promise<void> {
    try {
      const logEntry = JSON.stringify(event) + '\n';
      await require('fs/promises').appendFile(this.currentLogFile, logEntry);

      // Check log rotation
      await this.rotateLogIfNeeded();
    } catch (error) {
      console.error('Failed to write security event:', error);
    }
  }

  private async rotateLogIfNeeded(): Promise<void> {
    try {
      const stats = await require('fs/promises').stat(this.currentLogFile);
      if (stats.size > this.config.maxLogSize) {
        const newFileName = `security-${new Date().toISOString().split('T')[0]}-${Date.now()}.log`;
        this.currentLogFile = join(this.logDirectory, newFileName);
      }
    } catch {
      // File doesn't exist yet, ignore
    }
  }

  private async loadExistingEvents(): Promise<void> {
    try {
      const files = await this.getLogFiles();
      for (const file of files.slice(-5)) { // Load last 5 files
        const content = await readFile(file.path, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            this.events.push(event);
          } catch {
            // Skip invalid lines
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load existing security events:', error);
    }
  }

  private async getLogFiles(): Promise<Array<{ name: string; path: string }>> {
    try {
      const files = await require('fs/promises').readdir(this.logDirectory);
      return files
        .filter(f => f.startsWith('security-') && f.endsWith('.log'))
        .map(f => ({ name: f, path: join(this.logDirectory, f) }))
        .sort((a, b) => b.name.localeCompare(a.name));
    } catch {
      return [];
    }
  }

  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup().catch(console.error);
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private groupBy(events: SecurityAuditEvent[], key: keyof SecurityAuditEvent): Record<string, number> {
    const groups: Record<string, number> = {};
    events.forEach(event => {
      const value = event[key] as string;
      groups[value] = (groups[value] || 0) + 1;
    });
    return groups;
  }

  private getTopItems(events: SecurityAuditEvent[], key: keyof SecurityAuditEvent): Array<{ [key: string]: string; count: number }> {
    const items = this.groupBy(events, key);
    return Object.entries(items)
      .map(([value, count]) => ({ [key]: value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getTrend(events: SecurityAuditEvent[], startTime: number, endTime: number): Array<{ time: number; count: number }> {
    const interval = (endTime - startTime) / 24; // 24 intervals
    const trend: Array<{ time: number; count: number }> = [];

    for (let i = 0; i < 24; i++) {
      const intervalStart = startTime + (i * interval);
      const intervalEnd = startTime + ((i + 1) * interval);
      const count = events.filter(e => e.timestamp >= intervalStart && e.timestamp < intervalEnd).length;
      trend.push({ time: intervalStart, count });
    }

    return trend;
  }

  private generateRecommendations(stats: Record<string, unknown>): string[] {
    const recommendations: string[] = [];

    if (stats.eventsByType[securityEventTypes.AUTH_FAILURE] > 50) {
      recommendations.push('Consider implementing account lockout policies');
    }

    if (stats.eventsByType[securityEventTypes.XSS_ATTEMPT] > 10) {
      recommendations.push('Review input validation and sanitization');
    }

    if (stats.eventsByType[securityEventTypes.RATE_LIMIT_EXCEEDED] > 100) {
      recommendations.push('Consider stricter rate limiting');
    }

    if (stats.topIPs.some((ip: any) => ip.count > 100)) {
      recommendations.push('Consider IP-based blocking for high-volume sources');
    }

    return recommendations;
  }

  private generateHtmlReport(report: Record<string, unknown>): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Security Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .event { border: 1px solid #ddd; margin: 10px 0; padding: 10px; border-radius: 3px; }
        .critical { border-color: #d32f2f; background: #ffebee; }
        .high { border-color: #f57c00; background: #fff3e0; }
        .medium { border-color: #fbc02d; background: #fffde7; }
        .low { border-color: #388e3c; background: #e8f5e8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Audit Report</h1>
        <p>Generated: ${report.generatedAt}</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <pre>${JSON.stringify(report.summary, null, 2)}</pre>
    </div>

    <div class="section">
        <h2>Recent Events</h2>
        ${report.recentEvents.map((event: SecurityAuditEvent) => `
            <div class="event ${event.severity}">
                <strong>${event.type}</strong> - ${new Date(event.timestamp).toISOString()}
                <pre>${JSON.stringify(event.details, null, 2)}</pre>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }

  private generateMarkdownReport(report: Record<string, unknown>): string {
    return `# Security Audit Report

Generated: ${report.generatedAt}

## Summary
\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Recent Events
${report.recentEvents.map((event: SecurityAuditEvent) => `
### ${event.type} (${event.severity})
- **Time**: ${new Date(event.timestamp).toISOString()}
- **Details**: \`\`\`json
${JSON.stringify(event.details, null, 2)}
\`\`\`
`).join('\n')}

## Recommendations
${report.recommendations.map((rec: string) => `- ${rec}`).join('\n')}
`;
  }
}

// Export singleton instance
export const securityAudit = new SecurityAuditLogger();


// Remove misplaced wrapper appended after export
