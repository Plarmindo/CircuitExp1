import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { SecurityHardening } from './security-hardening';
import { SecurityConfig, getSecurityConfig } from './security-config';
import { securityAudit } from './security-audit';
import { pluginValidator } from './plugin-validator';

export interface SecurityStatus {
  enabled: boolean;
  level: 'strict' | 'moderate' | 'relaxed';
  lastUpdated: Date;
  violations: number;
  lastViolation: Date | null;
  activeProtections: string[];
  warnings: string[];
}

export interface SecurityReport {
  timestamp: Date;
  config: SecurityConfig;
  status: SecurityStatus;
  auditSummary: {
    totalEvents: number;
    violations: number;
    warnings: number;
    topViolationTypes: string[];
  };
  pluginSummary: {
    totalPlugins: number;
    validPlugins: number;
    averageSecurityScore: number;
    pluginsWithWarnings: number;
  };
  recommendations: string[];
}

export class SecurityManager {
  private security: SecurityHardening;
  private config: SecurityConfig;
  private statusFile: string;
  private pluginsDir: string;

  constructor(configPath?: string) {
    this.security = SecurityHardening.getInstance();
    this.config = getSecurityConfig();
    this.statusFile = configPath || join(process.cwd(), '.security-status.json');
    this.pluginsDir = join(process.cwd(), 'plugins');
  }

  /**
   * Initialize security system
   */
  public async initialize(): Promise<void> {
    try {
      await mkdir(this.pluginsDir, { recursive: true });
      
      const status = await this.getStatus();
      if (!status.enabled) {
        await this.enableSecurity();
      }

      await securityAudit.logSecurityEvent('SECURITY_INIT', {
        level: this.config.level,
        protections: this.config.activeProtections,
      });

    } catch (error) {
      await securityAudit.logSecurityEvent('SECURITY_INIT_FAILED', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Enable all security protections
   */
  public async enableSecurity(): Promise<void> {
    const status: SecurityStatus = {
      enabled: true,
      level: this.config.level,
      lastUpdated: new Date(),
      violations: 0,
      lastViolation: null,
      activeProtections: this.config.activeProtections,
      warnings: [],
    };

    await this.saveStatus(status);
    
    await securityAudit.logSecurityEvent('SECURITY_ENABLED', {
      level: this.config.level,
      protections: this.config.activeProtections,
    });
  }

  /**
   * Disable security protections
   */
  public async disableSecurity(): Promise<void> {
    const status = await this.getStatus();
    status.enabled = false;
    status.lastUpdated = new Date();
    status.warnings.push('Security protections disabled');

    await this.saveStatus(status);
    
    await securityAudit.logSecurityEvent('SECURITY_DISABLED', {
      reason: 'Manual disable',
    });
  }

  /**
   * Update security level
   */
  public async updateSecurityLevel(level: 'strict' | 'moderate' | 'relaxed'): Promise<void> {
    const newConfig = getSecurityConfig(level);
    this.config = newConfig;

    const status = await this.getStatus();
    status.level = level;
    status.activeProtections = newConfig.activeProtections;
    status.lastUpdated = new Date();

    await this.saveStatus(status);
    
    await securityAudit.logSecurityEvent('SECURITY_LEVEL_CHANGED', {
      from: status.level,
      to: level,
      protections: newConfig.activeProtections,
    });
  }

  /**
   * Get current security status
   */
  public async getStatus(): Promise<SecurityStatus> {
    try {
      const content = await readFile(this.statusFile, 'utf-8');
      const status = JSON.parse(content);
      
      return {
        ...status,
        lastUpdated: new Date(status.lastUpdated),
        lastViolation: status.lastViolation ? new Date(status.lastViolation) : null,
      };
    } catch {
      // Return default status if file doesn't exist
      return {
        enabled: true,
        level: this.config.level,
        lastUpdated: new Date(),
        violations: 0,
        lastViolation: null,
        activeProtections: this.config.activeProtections,
        warnings: [],
      };
    }
  }

  /**
   * Record security violation
   */
  public async recordViolation(violation: {
    type: string;
    source: string;
    details: Record<string, unknown>;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    const status = await this.getStatus();
    status.violations++;
    status.lastViolation = new Date();
    
    if (violation.severity === 'critical') {
      status.warnings.push(`Critical violation: ${violation.type}`);
    }

    await this.saveStatus(status);
    
    await securityAudit.logSecurityEvent('SECURITY_VIOLATION', violation);
  }

  /**
   * Validate all plugins
   */
  public async validateAllPlugins(): Promise<{
    valid: number;
    invalid: number;
    averageScore: number;
    plugins: Record<string, unknown>[];
  }> {
    try {
      const _fs = require('fs');
      const files = await require('fs/promises').readdir(this.pluginsDir);
      const pluginFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
      const pluginPaths = pluginFiles.map(f => join(this.pluginsDir, f));

      const results = await pluginValidator.validatePlugins(pluginPaths);
      
      const valid = results.filter(r => r.valid).length;
      const invalid = results.filter(r => !r.valid).length;
      const averageScore = results.reduce((sum, r) => sum + r.securityScore, 0) / results.length || 0;

      await securityAudit.logSecurityEvent('PLUGIN_VALIDATION_BATCH', {
        totalPlugins: results.length,
        validPlugins: valid,
        invalidPlugins: invalid,
        averageScore: Math.round(averageScore),
      });

      return {
        valid,
        invalid,
        averageScore: Math.round(averageScore),
        plugins: results,
      };

    } catch (error) {
      await securityAudit.logSecurityEvent('PLUGIN_VALIDATION_FAILED', {
        error: error.message,
      });
      
      return {
        valid: 0,
        invalid: 0,
        averageScore: 0,
        plugins: [],
      };
    }
  }

  /**
   * Generate comprehensive security report
   */
  public async generateReport(): Promise<SecurityReport> {
    const status = await this.getStatus();
    const pluginSummary = await this.validateAllPlugins();
    
    // Get audit summary
    const auditEvents = await securityAudit.getEvents();
    const violations = auditEvents.filter(e => e.type === 'SECURITY_VIOLATION');
    const warnings = auditEvents.filter(e => e.type === 'SECURITY_WARNING');
    
    const violationTypes = violations.reduce((acc, v) => {
      const type = v.details?.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const topViolationTypes = Object.entries(violationTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);

    // Generate recommendations
    const recommendations = this.generateRecommendations(status, pluginSummary, violations);

    const report: SecurityReport = {
      timestamp: new Date(),
      config: this.config,
      status,
      auditSummary: {
        totalEvents: auditEvents.length,
        violations: violations.length,
        warnings: warnings.length,
        topViolationTypes,
      },
      pluginSummary,
      recommendations,
    };

    await securityAudit.logSecurityEvent('SECURITY_REPORT_GENERATED', {
      violations: violations.length,
      plugins: pluginSummary.totalPlugins,
      averageScore: pluginSummary.averageScore,
    });

    return report;
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(
    status: SecurityStatus,
    pluginSummary: Record<string, unknown>,
    violations: Record<string, unknown>[]
  ): string[] {
    const recommendations: string[] = [];

    if (status.level === 'relaxed') {
      recommendations.push('Consider upgrading to moderate security level for better protection');
    }

    if (pluginSummary.averageScore < 70) {
      recommendations.push('Review and update plugins with low security scores');
    }

    if (violations.length > 0) {
      recommendations.push('Investigate recent security violations and implement fixes');
    }

    if (pluginSummary.invalid > 0) {
      recommendations.push(`Remove or fix ${pluginSummary.invalid} invalid plugins`);
    }

    if (status.warnings.length > 0) {
      recommendations.push('Address security warnings to improve overall security posture');
    }

    if (status.lastUpdated < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      recommendations.push('Security configuration is outdated - review and update settings');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture is good - maintain current practices');
    }

    return recommendations;
  }

  /**
   * Export security report to file
   */
  public async exportReport(format: 'json' | 'html' | 'markdown' = 'json'): Promise<string> {
    const report = await this.generateReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `security-report-${timestamp}.${format}`;
    const filepath = join(process.cwd(), 'reports', filename);

    await mkdir(join(process.cwd(), 'reports'), { recursive: true });

    let content = '';
    switch (format) {
      case 'html':
        content = this.generateHTMLReport(report);
        break;
      case 'markdown':
        content = this.generateMarkdownReport(report);
        break;
      default:
        content = JSON.stringify(report, null, 2);
    }

    await writeFile(filepath, content);
    
    await securityAudit.logSecurityEvent('SECURITY_REPORT_EXPORTED', {
      format,
      filepath,
      timestamp: report.timestamp,
    });

    return filepath;
  }

  /**
   * Generate HTML security report
   */
  private generateHTMLReport(report: SecurityReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Security Report - ${report.timestamp.toISOString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .metric-label { font-size: 12px; color: #666; }
        .recommendation { background: #fff3cd; padding: 10px; margin: 5px 0; border-left: 4px solid #ffc107; }
        .violation { background: #f8d7da; padding: 10px; margin: 5px 0; border-left: 4px solid #dc3545; }
        .warning { background: #fff3cd; padding: 10px; margin: 5px 0; border-left: 4px solid #ffc107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Report</h1>
        <p>Generated: ${report.timestamp.toLocaleString()}</p>
    </div>

    <div class="section">
        <h2>Security Status</h2>
        <div class="metric">
            <div class="metric-value">${report.status.level.toUpperCase()}</div>
            <div class="metric-label">Security Level</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.status.enabled ? 'ON' : 'OFF'}</div>
            <div class="metric-label">Security Enabled</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.status.violations}</div>
            <div class="metric-label">Violations</div>
        </div>
    </div>

    <div class="section">
        <h2>Plugin Summary</h2>
        <div class="metric">
            <div class="metric-value">${report.pluginSummary.totalPlugins}</div>
            <div class="metric-label">Total Plugins</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.pluginSummary.validPlugins}</div>
            <div class="metric-label">Valid Plugins</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.pluginSummary.averageScore}%</div>
            <div class="metric-label">Average Security Score</div>
        </div>
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        ${report.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
    </div>

    <div class="section">
        <h2>Audit Summary</h2>
        <p>Total Events: ${report.auditSummary.totalEvents}</p>
        <p>Violations: ${report.auditSummary.violations}</p>
        <p>Warnings: ${report.auditSummary.warnings}</p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate Markdown security report
   */
  private generateMarkdownReport(report: SecurityReport): string {
    return `# Security Report
Generated: ${report.timestamp.toLocaleString()}

## Security Status
- **Level**: ${report.status.level.toUpperCase()}
- **Enabled**: ${report.status.enabled ? 'Yes' : 'No'}
- **Violations**: ${report.status.violations}
- **Last Updated**: ${report.status.lastUpdated.toLocaleString()}

## Plugin Summary
- **Total Plugins**: ${report.pluginSummary.totalPlugins}
- **Valid Plugins**: ${report.pluginSummary.validPlugins}
- **Invalid Plugins**: ${report.pluginSummary.invalid}
- **Average Security Score**: ${report.pluginSummary.averageScore}%

## Recommendations
${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Audit Summary
- **Total Events**: ${report.auditSummary.totalEvents}
- **Violations**: ${report.auditSummary.violations}
- **Warnings**: ${report.auditSummary.warnings}
- **Top Violation Types**: ${report.auditSummary.topViolationTypes.join(', ')}

## Configuration Details
${Object.entries(report.config).map(([key, value]) => `- **${key}**: ${JSON.stringify(value)}`).join('\n')}
`;
  }

  /**
   * Save security status to file
   */
  private async saveStatus(status: SecurityStatus): Promise<void> {
    await writeFile(this.statusFile, JSON.stringify(status, null, 2));
  }
}

// Export singleton instance
export const securityManager = new SecurityManager();