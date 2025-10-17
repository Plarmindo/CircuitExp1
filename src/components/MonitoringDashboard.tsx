import React, { useState, useEffect } from 'react';
import { metricsService } from '../services/metrics-service';
import { healthService } from '../services/health-service';
import { auditLogger } from '../services/audit-logger';
import { createLogger } from '../logger/central-logger';
import './styles/MonitoringDashboard.css';

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

interface MetricData {
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
}

interface HealthCheck {
  name: string;
  status: 'passed' | 'failed';
  message: string;
  timestamp: string;
}

interface Event {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

interface MonitoringDashboardProps {
  metrics: MetricData[];
  healthChecks: HealthCheck[];
  events: Event[];
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  metrics: _metrics,
  healthChecks: _healthChecks,
  events: _events,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [systemMetrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

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

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (!systemMetrics || !health) {
    return (
      <div className="monitoring-dashboard">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return 'status-healthy';
      case 'degraded':
      case 'warn':
        return 'status-warning';
      case 'unhealthy':
      case 'fail':
        return 'status-error';
      default:
        return 'status-default';
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'severity-critical';
      case 'high':
        return 'severity-high';
      case 'medium':
        return 'severity-medium';
      case 'low':
        return 'severity-low';
      default:
        return 'severity-default';
    }
  };

  return (
    <div className="monitoring-dashboard">
      <div className="dashboard-header">
        <h2>System Monitoring Dashboard</h2>
        <div className="dashboard-controls">
          <button 
            onClick={loadData} 
            disabled={isRefreshing} 
            className="refresh-btn"
            title="Refresh monitoring data"
            aria-label="Refresh data"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            onClick={() => {}} 
            className="export-btn"
            title="Export metrics to file"
            aria-label="Export metrics"
          >
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
                className={`progress-fill ${getStatusClass(
                  systemMetrics.memory.percentage > 90
                    ? 'unhealthy'
                    : systemMetrics.memory.percentage > 75
                    ? 'degraded'
                    : 'healthy'
                )}`}
                style={{ width: `${systemMetrics.memory.percentage}%` }}
              />
            </div>
            <span>
              {(systemMetrics.memory.used / 1024 / 1024 / 1024).toFixed(1)} GB /{' '}
              {(systemMetrics.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB
            </span>
          </div>

          <div className="metric-item">
            <label>Disk Usage:</label>
            <div className="progress-bar">
              <div
                className={`progress-fill ${getStatusClass(
                  systemMetrics.disk.percentage > 90
                    ? 'unhealthy'
                    : systemMetrics.disk.percentage > 75
                    ? 'degraded'
                    : 'healthy'
                )}`}
                style={{ width: `${systemMetrics.disk.percentage}%` }}
              />
            </div>
            <span>
              {(systemMetrics.disk.total - systemMetrics.disk.free).toFixed(1)} GB /{' '}
              {systemMetrics.disk.total.toFixed(1)} GB
            </span>
          </div>
        </div>

        {/* Scan Metrics */}
        <div className="metric-card">
          <h3>Scan Performance</h3>
          <div className="metric-item">
            <label>Total Scans:</label>
            <span className="metric-value">{systemMetrics.scan.totalScans}</span>
          </div>
          <div className="metric-item">
            <label>Average Scan Time:</label>
            <span className="metric-value">{systemMetrics.scan.averageScanTime.toFixed(1)}s</span>
          </div>
          <div className="metric-item">
            <label>Scan Errors:</label>
            <span className={`metric-value ${systemMetrics.scan.errors > 0 ? 'error' : 'success'}`}>
              {systemMetrics.scan.errors}
            </span>
          </div>
        </div>

        {/* Health Status */}
        <div className="metric-card">
          <h3>System Health</h3>
          <div className="health-status">
            <div className={`health-indicator ${getStatusClass(health.status)}`}>
              {health.status.toUpperCase()}
            </div>
            <div className="health-checks">
              {health.checks.map((check, index) => (
                <div key={index} className="health-check">
                  <div className={`check-status ${getStatusClass(check.status)}`}>
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
                        <span className={`severity-badge ${getSeverityClass(event.severity)}`}>
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

export default MonitoringDashboard;