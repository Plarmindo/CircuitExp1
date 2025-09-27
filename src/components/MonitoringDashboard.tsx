import React, { useState, useEffect } from 'react';
import { metricsService } from '../services/metrics-service';
import { healthService } from '../services/health-service';
import { auditLogger } from '../services/audit-logger';
import { createLogger } from '../logger/central-logger';
import './MonitoringDashboard.css';

const log = createLogger({ component: 'monitoring-dashboard' });

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  disk: {
    free: number;
    total: number;
    percentage: number;
  };
  scan: {
    totalScans: number;
    averageScanTime: number;
    errors: number;
  };
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    lastCheck: string;
  }>;
}

interface AuditEvent {
  eventId: string;
  timestamp: string;
  eventType: string;
  severity: string;
  action: string;
  result: string;
}

export const MonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setIsRefreshing(true);

      const [metricsData, healthData, auditData] = await Promise.all([
        metricsService.getSystemMetrics(),
        healthService.getHealthStatus(),
        auditLogger.getRecentEvents(20),
      ]);

      setMetrics(metricsData);
      setHealth(healthData);
      setAuditEvents(auditData);
      setLastUpdate(new Date());
    } catch (error) {
      log.error('Failed to load monitoring data', { error });
    } finally {
      setIsRefreshing(false);
    }
  };

  const exportMetrics = async () => {
    try {
      const data = await metricsService.exportMetrics();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metrics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      log.info('Metrics exported successfully');
    } catch (error) {
      log.error('Failed to export metrics', { error });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return '#22c55e';
      case 'degraded':
      case 'warn':
        return '#f59e0b';
      case 'unhealthy':
      case 'fail':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#d97706';
      case 'low':
        return '#65a30d';
      default:
        return '#6b7280';
    }
  };

  if (!metrics || !health) {
    return (
      <div className="monitoring-dashboard">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="monitoring-dashboard">
      <div className="dashboard-header">
        <h2>System Monitoring Dashboard</h2>
        <div className="dashboard-controls">
          <button onClick={loadData} disabled={isRefreshing} className="refresh-btn">
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={exportMetrics} className="export-btn">
            Export Metrics
          </button>
        </div>
      </div>

      <div className="last-updated">Last updated: {lastUpdate.toLocaleTimeString()}</div>

      <div className="metrics-grid">
        {/* System Resources */}
        <div className="metric-card">
          <h3>System Resources</h3>
          <div className="metric-item">
            <label>Memory Usage:</label>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${metrics.memory.percentage}%`,
                  backgroundColor: getStatusColor(
                    metrics.memory.percentage > 90
                      ? 'unhealthy'
                      : metrics.memory.percentage > 75
                        ? 'degraded'
                        : 'healthy'
                  ),
                }}
              />
            </div>
            <span>
              {(metrics.memory.used / 1024 / 1024 / 1024).toFixed(1)} GB /{' '}
              {(metrics.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB
            </span>
          </div>

          <div className="metric-item">
            <label>Disk Usage:</label>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${metrics.disk.percentage}%`,
                  backgroundColor: getStatusColor(
                    metrics.disk.percentage > 90
                      ? 'unhealthy'
                      : metrics.disk.percentage > 75
                        ? 'degraded'
                        : 'healthy'
                  ),
                }}
              />
            </div>
            <span>
              {(metrics.disk.total - metrics.disk.free).toFixed(1)} GB /{' '}
              {metrics.disk.total.toFixed(1)} GB
            </span>
          </div>
        </div>

        {/* Scan Metrics */}
        <div className="metric-card">
          <h3>Scan Performance</h3>
          <div className="metric-item">
            <label>Total Scans:</label>
            <span className="metric-value">{metrics.scan.totalScans}</span>
          </div>
          <div className="metric-item">
            <label>Average Scan Time:</label>
            <span className="metric-value">{metrics.scan.averageScanTime.toFixed(1)}s</span>
          </div>
          <div className="metric-item">
            <label>Scan Errors:</label>
            <span
              className="metric-value"
              style={{ color: metrics.scan.errors > 0 ? '#ef4444' : '#22c55e' }}
            >
              {metrics.scan.errors}
            </span>
          </div>
        </div>

        {/* Health Status */}
        <div className="metric-card">
          <h3>System Health</h3>
          <div className="health-status">
            <div
              className="health-indicator"
              style={{ backgroundColor: getStatusColor(health.status) }}
            >
              {health.status.toUpperCase()}
            </div>
            <div className="health-checks">
              {health.checks.map((check, index) => (
                <div key={index} className="health-check">
                  <div className="check-status" style={{ color: getStatusColor(check.status) }}>
                    {check.status.toUpperCase()}
                  </div>
                  <div className="check-name">{check.name}</div>
                  <div className="check-message">{check.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Audit Events */}
        <div className="metric-card full-width">
          <h3>Recent Security Events</h3>
          <div className="audit-events">
            {auditEvents.length === 0 ? (
              <p>No recent security events</p>
            ) : (
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Action</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.slice(0, 10).map((event) => (
                    <tr key={event.eventId}>
                      <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                      <td>{event.eventType}</td>
                      <td>
                        <span
                          className="severity-badge"
                          style={{ backgroundColor: getSeverityColor(event.severity) }}
                        >
                          {event.severity}
                        </span>
                      </td>
                      <td>{event.action}</td>
                      <td>{event.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};