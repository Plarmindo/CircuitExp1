/**
 * Centralized structured logger (CORE-4 phase 1)
 * - Provides leveled logging (debug, info, warn, error)
 * - Emits JSON line objects in production; pretty console in dev.
 * - File sink is handled by main process via IPC
 */
// Note: fs operations removed for renderer security - file logging handled by main process

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

interface LoggerOptions {
  component?: string;
}
interface LogRecord {
  ts: string; // ISO timestamp
  level: LogLevel;
  msg: string;
  component?: string;
  detail?: unknown;
}

let globalLevel: LogLevel = (typeof process !== 'undefined' && process.env?.LOG_LEVEL as LogLevel) || 'info';
const ring: LogRecord[] = [];
const ringMax = 500;
const levelOrder: LogLevel[] = LOG_LEVELS;
function shouldLog(l: LogLevel) {
  return levelOrder.indexOf(l) >= levelOrder.indexOf(globalLevel);
}

export function setLevel(l: LogLevel) {
  globalLevel = l;
}

// File logging is handled by main process - these are now no-ops for renderer
export function enableFile(dir: string, filename = 'app-log.ndjson') {
  // Send to main process via IPC if available (renderer context)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.logToFile) {
    (window as any).electronAPI.logToFile({ dir, filename });
  }
}
export function disableFile() {
  // No-op for renderer - main process handles file logging
}

function write(rec: LogRecord) {
  const line = JSON.stringify(rec);
  // ring buffer (in-memory recent logs)
  ring.push(rec);
  if (ring.length > ringMax) ring.splice(0, ring.length - ringMax);
  
  // Send to main process via IPC if available (renderer context)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.logMessage) {
    (window as any).electronAPI.logMessage(rec);
  }
  
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    // Dev pretty print
    const color =
      rec.level === 'error'
        ? '\x1b[31m'
        : rec.level === 'warn'
          ? '\x1b[33m'
          : rec.level === 'debug'
            ? '\x1b[36m'
            : '\x1b[32m';
    console.log(
      color + `[${rec.level}]` + '\x1b[0m',
      rec.component ? `[${rec.component}]` : '',
      rec.msg,
      rec.detail ? rec.detail : ''
    );
  } else {
    console.log(line);
  }
}

export function createLogger(opts: LoggerOptions = {}) {
  const component = opts.component;
  function base(level: LogLevel, msg: string, detail?: unknown) {
    if (!shouldLog(level)) return;
    write({ ts: new Date().toISOString(), level, msg, component, detail });
  }
  return {
    debug: (m: string, d?: unknown) => base('debug', m, d),
    info: (m: string, d?: unknown) => base('info', m, d),
    warn: (m: string, d?: unknown) => base('warn', m, d),
    error: (m: string, d?: unknown) => base('error', m, d),
  };
}

// Global default logger
export const log = createLogger({ component: 'global' });
export function getRecentLogs(limit = 100) {
  if (limit <= 0) return [];
  return ring.slice(-limit);
}
