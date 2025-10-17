import React, { useEffect, useState } from 'react';
import './ScanProgressBar.css';

interface ScanProgressBarProps {
  scanId: string | null;
  progress: number; // 0-100
  processedNodes: number;
  totalNodes?: number;
  elapsedTime: number; // milliseconds
  onCancel?: () => void;
  className?: string;
}

/**
 * Real-time Scan Progress Indicator
 * RICE Score: 35.0 (Reach: 10, Impact: 2, Confidence: 1.0, Effort: 0.5 weeks)
 * 
 * Displays live progress bar with node count, percentage, and estimated time remaining.
 * Wires up existing scan:progress events from scan-manager.cjs
 */
export const ScanProgressBar: React.FC<ScanProgressBarProps> = ({
  scanId,
  progress,
  processedNodes,
  totalNodes,
  elapsedTime,
  onCancel,
  className = '',
}) => {
  const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);
  const [throughput, setThroughput] = useState<number>(0);

  useEffect(() => {
    if (elapsedTime > 0 && processedNodes > 0) {
      // Calculate throughput (nodes per second)
      const throughputValue = (processedNodes / elapsedTime) * 1000;
      setThroughput(throughputValue);

      // Estimate remaining time if we have total nodes
      if (totalNodes && totalNodes > processedNodes) {
        const remainingNodes = totalNodes - processedNodes;
        const estimatedMs = (remainingNodes / throughputValue) * 1000;
        setEstimatedRemaining(estimatedMs);
      } else if (progress > 0 && progress < 100) {
        // Estimate based on progress percentage
        const estimatedTotal = elapsedTime / (progress / 100);
        const remaining = estimatedTotal - elapsedTime;
        setEstimatedRemaining(remaining);
      }
    }
  }, [elapsedTime, processedNodes, totalNodes, progress]);

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const formatNodes = (count: number): string => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  const formatThroughput = (nodesPerSec: number): string => {
    if (nodesPerSec < 1000) return `${nodesPerSec.toFixed(0)} nodes/s`;
    return `${(nodesPerSec / 1000).toFixed(1)}K nodes/s`;
  };

  const getProgressStatus = (): 'starting' | 'active' | 'completing' | 'done' => {
    if (progress === 0) return 'starting';
    if (progress >= 100) return 'done';
    if (progress >= 95) return 'completing';
    return 'active';
  };

  const status = getProgressStatus();

  if (!scanId) {
    return null;
  }

  return (
    <div className={`scan-progress-bar ${className} status-${status}`}>
      <div className="progress-header">
        <div className="progress-info">
          <span className="progress-icon">⚡</span>
          <span className="progress-title">
            {status === 'starting' && 'Starting scan...'}
            {status === 'active' && 'Scanning...'}
            {status === 'completing' && 'Finalizing...'}
            {status === 'done' && 'Scan complete!'}
          </span>
          <span className="progress-percentage">{progress.toFixed(0)}%</span>
        </div>
        {onCancel && status !== 'done' && (
          <button
            onClick={onCancel}
            className="cancel-button"
            title="Cancel scan"
            aria-label="Cancel current scan"
          >
            ✕
          </button>
        )}
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        >
          <div className="progress-bar-glow" />
        </div>
      </div>

      <div className="progress-metrics">
        <div className="metric-group">
          <div className="metric">
            <span className="metric-label">Nodes:</span>
            <span className="metric-value">
              {formatNodes(processedNodes)}
              {totalNodes && ` / ${formatNodes(totalNodes)}`}
            </span>
          </div>
          {throughput > 0 && (
            <div className="metric">
              <span className="metric-label">Speed:</span>
              <span className="metric-value">{formatThroughput(throughput)}</span>
            </div>
          )}
        </div>

        <div className="metric-group">
          <div className="metric">
            <span className="metric-label">Elapsed:</span>
            <span className="metric-value">{formatTime(elapsedTime)}</span>
          </div>
          {estimatedRemaining !== null && status === 'active' && (
            <div className="metric">
              <span className="metric-label">Remaining:</span>
              <span className="metric-value estimate">
                ~{formatTime(estimatedRemaining)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
