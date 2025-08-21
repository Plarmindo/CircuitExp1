import { useState, useEffect } from 'react';
import './ErrorHandler.css';

export interface ErrorInfo {
  id: string;
  title: string;
  message: string;
  details?: string;
  errorCode?: string;
  severity: 'error' | 'warning' | 'info';
  recoverable: boolean;
  retryAction?: () => Promise<void>;
  dismissible: boolean;
  timestamp: number;
}

interface ErrorHandlerProps {
  children: React.ReactNode;
}

export function ErrorHandler({ children }: ErrorHandlerProps) {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Listen for global errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const errorInfo: ErrorInfo = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: 'Unexpected Error',
        message: event.message || 'An unexpected error occurred',
        details: event.error?.stack || event.filename,
        severity: 'error',
        recoverable: false,
        dismissible: true,
        timestamp: Date.now(),
      };
      setErrors((prev) => [...prev, errorInfo]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorInfo: ErrorInfo = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: 'Unhandled Promise Rejection',
        message: event.reason?.message || 'A promise was rejected without handling',
        details: event.reason?.stack || String(event.reason),
        severity: 'error',
        recoverable: false,
        dismissible: true,
        timestamp: Date.now(),
      };
      setErrors((prev) => [...prev, errorInfo]);
    };

    // Listen for custom scan errors
    const handleScanError = (event: CustomEvent) => {
      const { error, code, path } = event.detail;
      const errorInfo = createScanErrorInfo(error, code, path);
      setErrors((prev) => [...prev, errorInfo]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('metro:scanError', handleScanError as any);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('metro:scanError', handleScanError as any);
    };
  }, []);

  const dismissError = (id: string) => {
    setErrors((prev) => prev.filter((error) => error.id !== id));
    setShowDetails(null);
  };

  const retryError = async (error: ErrorInfo) => {
    if (error.retryAction) {
      try {
        await error.retryAction();
        dismissError(error.id);
      } catch (retryError) {
        // Create new error for retry failure
        const newError: ErrorInfo = {
          id: `retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: 'Retry Failed',
          message: 'The retry operation failed',
          details: retryError instanceof Error ? retryError.stack : String(retryError),
          severity: 'error',
          recoverable: false,
          dismissible: true,
          timestamp: Date.now(),
        };
        setErrors((prev) => [...prev.filter((e) => e.id !== error.id), newError]);
      }
    }
  };

  const getIconForSeverity = (severity: ErrorInfo['severity']) => {
    switch (severity) {
      case 'error':
        return '⚠️';
      case 'warning':
        return '⚡';
      case 'info':
        return 'ℹ️';
    }
  };

  const getClassForSeverity = (severity: ErrorInfo['severity']) => {
    switch (severity) {
      case 'error':
        return 'error-banner error';
      case 'warning':
        return 'error-banner warning';
      case 'info':
        return 'error-banner info';
    }
  };

  return (
    <>
      {children}

      {/* Error Notifications Container */}
      <div className="error-notifications" role="region" aria-label="Error notifications">
        {errors.map((error) => (
          <div
            key={error.id}
            className={getClassForSeverity(error.severity)}
            role="alert"
            aria-live="polite"
          >
            <div className="error-header">
              <span className="error-icon" aria-hidden="true">
                {getIconForSeverity(error.severity)}
              </span>
              <h3 className="error-title">{error.title}</h3>
              <button
                className="error-dismiss"
                onClick={() => dismissError(error.id)}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>

            <p className="error-message">{error.message}</p>

            {error.details && (
              <div className="error-details-section">
                <button
                  className="error-details-toggle"
                  onClick={() => setShowDetails(showDetails === error.id ? null : error.id)}
                  aria-expanded={showDetails === error.id}
                >
                  {showDetails === error.id ? 'Hide Details' : 'Show Details'}
                </button>
                {showDetails === error.id && (
                  <pre className="error-details" role="log">
                    {error.details}
                  </pre>
                )}
              </div>
            )}

            <div className="error-actions">
              {error.recoverable && error.retryAction && (
                <button className="error-retry-button" onClick={() => retryError(error)}>
                  Retry
                </button>
              )}
              {error.dismissible && (
                <button className="error-dismiss-button" onClick={() => dismissError(error.id)}>
                  Dismiss
                </button>
              )}
            </div>

            <div className="error-timestamp">{new Date(error.timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function createScanErrorInfo(error: string, code?: string, path?: string): ErrorInfo {
  const errorMap: Record<
    string,
    { title: string; message: string; recoverable: boolean; retryAction?: () => Promise<void> }
  > = {
    EACCES: {
      title: 'Permission Denied',
      message: `Cannot access ${path || 'the selected directory'} due to insufficient permissions.`,
      recoverable: true,
      retryAction: async () => {
        // Dispatch retry event
        window.dispatchEvent(new CustomEvent('metro:retryScan'));
      },
    },
    ENOENT: {
      title: 'Directory Not Found',
      message: `The directory ${path || 'you selected'} no longer exists.`,
      recoverable: true,
      retryAction: async () => {
        window.dispatchEvent(new CustomEvent('metro:selectNewDirectory'));
      },
    },
    ENOTDIR: {
      title: 'Invalid Directory',
      message: `The path ${path || 'you selected'} is not a directory.`,
      recoverable: true,
      retryAction: async () => {
        window.dispatchEvent(new CustomEvent('metro:selectNewDirectory'));
      },
    },
    ENOSPC: {
      title: 'Disk Space Low',
      message: 'Your disk is running low on space. Free up some space and try again.',
      recoverable: true,
      retryAction: async () => {
        window.dispatchEvent(new CustomEvent('metro:retryScan'));
      },
    },
    EMFILE: {
      title: 'Too Many Open Files',
      message: 'The system has too many open files. Close some applications and try again.',
      recoverable: true,
      retryAction: async () => {
        window.dispatchEvent(new CustomEvent('metro:retryScan'));
      },
    },
  };

  const mapped = code && errorMap[code];
  if (mapped) {
    return {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: mapped.title,
      message: mapped.message,
      details: error,
      errorCode: code,
      severity: 'error',
      recoverable: mapped.recoverable,
      retryAction: mapped.retryAction,
      dismissible: true,
      timestamp: Date.now(),
    };
  }

  return {
    id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Scan Error',
    message: `An error occurred while scanning: ${error}`,
    details: error,
    errorCode: code,
    severity: 'error',
    recoverable: false,
    dismissible: true,
    timestamp: Date.now(),
  };
}

// Global error reporting function
export function reportError(error: string | Error, context?: Record<string, unknown>) {
  const errorInfo: ErrorInfo = {
    id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Application Error',
    message: typeof error === 'string' ? error : error.message,
    details: typeof error === 'string' ? undefined : error.stack,
    severity: 'error',
    recoverable: false,
    dismissible: true,
    timestamp: Date.now(),
  };

  // Dispatch custom event for ErrorHandler
  window.dispatchEvent(new CustomEvent('metro:errorReported', { detail: errorInfo }));

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('[ErrorHandler]', error, context);
  }
}
