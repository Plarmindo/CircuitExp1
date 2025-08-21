import type { ErrorInfo } from '../components/ErrorHandler';
import { createLogger } from '../logger/central-logger';
import { auditLogger } from './audit-logger';

const log = createLogger({ component: 'error-reporter' });

export interface ErrorReport {
  id: string;
  timestamp: number;
  error: Error;
  context: string;
  userAgent: string;
  platform: string;
  electronVersion?: string;
  appVersion?: string;
}

export interface RecoveryAction {
  type: 'retry' | 'select_new' | 'restart' | 'report';
  label: string;
  handler: () => Promise<boolean>;
}

class ErrorReporterService {
  private static instance: ErrorReporterService;
  private errorHistory: ErrorReport[] = [];
  private maxHistorySize = 50;
  private listeners: ((error: ErrorReport) => void)[] = [];

  static getInstance(): ErrorReporterService {
    if (!ErrorReporterService.instance) {
      ErrorReporterService.instance = new ErrorReporterService();
    }
    return ErrorReporterService.instance;
  }

  reportError(error: Error, context: string = 'general'): ErrorInfo {
    const report: ErrorReport = {
      id: this.generateId(),
      timestamp: Date.now(),
      error,
      context,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      electronVersion: (window as any).electronAPI?.getVersion?.(),
      appVersion: (window as any).electronAPI?.getAppVersion?.(),
    };

    this.addToHistory(report);
    this.notifyListeners(report);

    // Audit log for security-related errors
    const classified = this.classifyError(error);
    if (classified.errorCode === 'EACCES') {
      auditLogger.logSecurityViolation('error_reported', {
        errorType: classified.errorCode,
        context,
        message: error.message,
        stack: error.stack,
      });
    }

    // Convert to ErrorInfo format
    return this.createErrorInfo(report);
  }

  private createErrorInfo(report: ErrorReport): ErrorInfo {
    const classified = this.classifyError(report.error);

    return {
      id: report.id,
      title: this.getErrorTitle(classified.errorCode),
      message: classified.userMessage,
      type: this.getErrorType(classified.errorCode),
      details: report.error.stack || report.error.message,
      recoverable: classified.recoverable,
      actions: this.createRecoveryActions(classified.suggestedAction),
      timestamp: report.timestamp,
    };
  }

  private classifyError(error: Error) {
    let code = 'UNKNOWN';
    let userMessage = error.message;
    let recoverable = false;
    let suggestedAction = null;

    const msg = error.message.toLowerCase();

    // Scan-specific error classification
    if (msg.includes('permission') || msg.includes('eacces')) {
      code = 'EACCES';
      userMessage = 'Access denied. Please check folder permissions or run as administrator.';
      recoverable = true;
      suggestedAction = 'retry';
    } else if (msg.includes('no such file') || msg.includes('enoent')) {
      code = 'ENOENT';
      userMessage =
        'The specified directory no longer exists. Please select a different directory.';
      recoverable = true;
      suggestedAction = 'select_new';
    } else if (msg.includes('no space left') || msg.includes('enospc')) {
      code = 'ENOSPC';
      userMessage = 'Your disk is running low on space. Please free up some space and try again.';
      recoverable = true;
      suggestedAction = 'retry';
    } else if (msg.includes('too many files') || msg.includes('emfile')) {
      code = 'EMFILE';
      userMessage = 'Too many files are open. Please close some applications and try again.';
      recoverable = true;
      suggestedAction = 'retry';
    } else if (msg.includes('network') || msg.includes('connection')) {
      code = 'NETWORK_ERROR';
      userMessage = 'Network connection issue. Please check your internet connection.';
      recoverable = true;
      suggestedAction = 'retry';
    } else if (msg.includes('memory') || msg.includes('out of memory')) {
      code = 'MEMORY_ERROR';
      userMessage = 'Out of memory. Please close some applications and try again.';
      recoverable = true;
      suggestedAction = 'retry';
    } else if (msg.includes('timeout')) {
      code = 'TIMEOUT_ERROR';
      userMessage = 'Operation timed out. Please try again.';
      recoverable = true;
      suggestedAction = 'retry';
    }

    return { errorCode: code, userMessage, recoverable, suggestedAction };
  }

  private getErrorTitle(errorCode: string): string {
    const titles: Record<string, string> = {
      EACCES: 'Access Denied',
      ENOENT: 'Directory Not Found',
      ENOSPC: 'Disk Space Low',
      EMFILE: 'Too Many Files',
      NETWORK_ERROR: 'Network Issue',
      MEMORY_ERROR: 'Memory Issue',
      TIMEOUT_ERROR: 'Operation Timeout',
      UNKNOWN: 'Unexpected Error',
    };
    return titles[errorCode] || 'Error';
  }

  private getErrorType(errorCode: string): 'error' | 'warning' | 'info' {
    const types: Record<string, 'error' | 'warning' | 'info'> = {
      EACCES: 'error',
      ENOENT: 'error',
      ENOSPC: 'warning',
      EMFILE: 'warning',
      NETWORK_ERROR: 'warning',
      MEMORY_ERROR: 'warning',
      TIMEOUT_ERROR: 'warning',
      UNKNOWN: 'error',
    };
    return types[errorCode] || 'error';
  }

  private createRecoveryActions(suggestedAction: string | null): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (suggestedAction) {
      case 'retry':
        actions.push({
          type: 'retry',
          label: 'Retry',
          handler: async () => true,
        });
        break;
      case 'select_new':
        actions.push({
          type: 'select_new',
          label: 'Select New Folder',
          handler: async () => true,
        });
        break;
    }

    actions.push({
      type: 'report',
      label: 'Report Issue',
      handler: async () => {
        this.openIssueReport();
        return false;
      },
    });

    return actions;
  }

  private generateId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToHistory(report: ErrorReport) {
    this.errorHistory.unshift(report);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  private notifyListeners(report: ErrorReport) {
    this.listeners.forEach((listener) => listener(report));
  }

  addErrorListener(listener: (error: ErrorReport) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getErrorHistory(): ErrorReport[] {
    return [...this.errorHistory];
  }

  clearHistory() {
    this.errorHistory = [];
  }

  private openIssueReport() {
    const repoUrl = 'https://github.com/your-org/CircuitExp1/issues/new';
    const body = this.generateIssueTemplate();
    const url = `${repoUrl}?body=${encodeURIComponent(body)}`;

    if ((window as any).electronAPI) {
      (window as any).electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }

  private generateIssueTemplate(): string {
    const recentErrors = this.errorHistory.slice(0, 5);

    return `## Bug Report

**Describe the bug**
A clear and concise description of what the bug is.

**Error Details**
${recentErrors
  .map(
    (report) => `\`\`\`
${report.error.stack || report.error.message}
\`\`\``
  )
  .join('\n\n')}

**Environment**
- OS: ${navigator.platform}
- Browser: ${navigator.userAgent}
- App Version: ${(window as any).electronAPI?.getAppVersion?.() || 'web'}

**Steps to reproduce**
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Additional context**
Add any other context about the problem here.`;
  }
}

export const errorReporter = ErrorReporterService.getInstance();
