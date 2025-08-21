/**
 * Audit Logger for security events and compliance
 * Provides tamper-evident logging for security events
 */
import { createLogger } from '../logger/central-logger';
// Note: fs operations removed for renderer security - audit logging handled by main process

const log = createLogger({ component: 'audit' });

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
  result: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogConfig {
  enabled: boolean;
  logPath?: string;
  maxFileSize?: number;
  retentionDays?: number;
  encryptionKey?: string;
}

class AuditLogger {
  private config: AuditLogConfig;
  private sequenceNumber = 0;

  constructor(config: AuditLogConfig = { enabled: true }) {
    this.config = {
      enabled: true,
      ...config,
    };

    if (this.config.enabled) {
      this.initializeAuditLog();
    }
  }

  /**
   * Initialize audit logging system
   */
  private initializeAuditLog(): void {
    log.info('Audit logger initialized for renderer');
    // File operations handled by main process via IPC
  }

  /**
   * Log a security audit event
   */
  logEvent(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): void {
    if (!this.config.enabled) return;

    const auditEvent: AuditEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    this.writeAuditLog(auditEvent);

    // Also log to main logger for correlation
    log.info('Audit event', {
      eventType: auditEvent.eventType,
      severity: auditEvent.severity,
      action: auditEvent.action,
      result: auditEvent.result,
    });
  }

  /**
   * Log file access attempts
   */
  logFileAccess(
    action: 'read' | 'write' | 'delete' | 'create',
    filePath: string,
    result: 'success' | 'failure' | 'blocked',
    details?: Record<string, unknown>
  ): void {
    this.logEvent({
      eventType: 'file_access',
      severity: result === 'blocked' ? 'high' : 'medium',
      action,
      resource: filePath,
      details,
      result,
    });
  }

  /**
   * Log security violations
   */
  logSecurityViolation(
    violationType: string,
    details: Record<string, unknown>,
    blocked: boolean = true
  ): void {
    this.logEvent({
      eventType: 'security_violation',
      severity: 'high',
      action: violationType,
      details,
      result: blocked ? 'blocked' : 'failure',
    });
  }

  /**
   * Log authentication events
   */
  logAuthEvent(
    action: 'login' | 'logout' | 'failed_login',
    userId?: string,
    details?: Record<string, unknown>
  ): void {
    this.logEvent({
      eventType: 'authentication',
      severity: action === 'failed_login' ? 'medium' : 'low',
      action,
      userId,
      details,
      result: action === 'failed_login' ? 'failure' : 'success',
    });
  }

  /**
   * Log permission checks
   */
  logPermissionCheck(
    action: string,
    resource: string,
    granted: boolean,
    details?: Record<string, unknown>
  ): void {
    this.logEvent({
      eventType: 'permission_check',
      severity: granted ? 'low' : 'medium',
      action,
      resource,
      details: { ...details, granted },
      result: granted ? 'success' : 'blocked',
    });
  }

  /**
   * Log system events
   */
  logSystemEvent(eventType: string, action: string, details?: Record<string, unknown>): void {
    this.logEvent({
      eventType,
      severity: 'low',
      action,
      details,
      result: 'success',
    });
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    this.sequenceNumber++;
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${this.sequenceNumber}-${random}`;
  }

  /**
   * Write audit event to log file
   */
  private writeAuditLog(event: AuditEvent): void {
    try {
      // Send to main process via IPC if available
      if (window.electronAPI?.logAuditEvent) {
        window.electronAPI.logAuditEvent(event);
      }
    } catch (error) {
      log.error('Failed to write audit log', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  private rotateLogIfNeeded(): void {
    // Handled by main process
  }

  /**
   * Clean up old audit logs
   */
  cleanupOldLogs(): void {
    // Handled by main process
  }

  /**
   * Get recent audit events
   */
  getRecentEvents(limit = 100): AuditEvent[] {
    // Handled by main process - return empty array for renderer
    return [];
  }

  /**
   * Export audit summary for compliance
   */
  exportAuditSummary(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    recentEvents: AuditEvent[];
    generatedAt: string;
  } {
    // Handled by main process - return empty summary for renderer
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      recentEvents: [],
      generatedAt: new Date().toISOString(),
    };
  }
}

// Default audit logger instance
export const auditLogger = new AuditLogger({
  enabled: true,
});
