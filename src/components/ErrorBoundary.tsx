import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorReporter } from '../services/error-reporter';
import './styles/ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    errorReporter.reportError(error, 'ErrorBoundary');
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2 className="error-message">Something went wrong</h2>
          <details className="error-details">
            {this.state.error && (
              <>
                <summary>Error details</summary>
                <div className="error-stack">
                  {this.state.error.toString()}
                </div>
              </>
            )}
          </details>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            title="Reload application and try again"
            aria-label="Try again"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}