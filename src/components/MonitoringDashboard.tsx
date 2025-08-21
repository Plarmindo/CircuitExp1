import React, { useState, useEffect } from 'react';
import { metricsService } from '../services/metrics-service';
import { healthService } from '../services/health-service';
import { auditLogger } from '../services/audit-logger';
import { createLogger } from '../logger/central-logger';

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

      <style jsx>{`
        .monitoring-dashboard {
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8fafc;
          min-height: 100vh;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dashboard-controls {
          display: flex;
          gap: 10px;
        }

        .refresh-btn,
        .export-btn {
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 14px;
        }

        .refresh-btn:hover:not(:disabled),
        .export-btn:hover {
          background: #f3f4f6;
        }

        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .last-updated {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .metric-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .metric-card.full-width {
          grid-column: 1 / -1;
        }

        .metric-card h3 {
          margin: 0 0 15px 0;
          color: #1f2937;
          font-size: 16px;
          font-weight: 600;
        }

        .metric-item {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .metric-item label {
          min-width: 120px;
          font-size: 14px;
          color: #4b5563;
        }

        .progress-bar {
          flex: 1;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .metric-value {
          font-weight: 600;
          color: #1f2937;
        }

        .health-status {
          text-align: center;
        }

        .health-indicator {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 15px;
        }

        .health-checks {
          text-align: left;
        }

        .health-check {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .check-status {
          font-weight: 600;
          min-width: 40px;
        }

        .check-name {
          font-weight: 500;
          min-width: 120px;
        }

        .check-message {
          color: #6b7280;
          flex: 1;
        }

        .audit-events {
          max-height: 300px;
          overflow-y: auto;
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .audit-table th,
        .audit-table td {
          padding: 8px 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        .audit-table th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
        }

        .severity-badge {
          padding: 2px 8px;
          border-radius: 12px;
          color: white;
          font-size: 12px;
          font-weight: 600;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #6b7280;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
