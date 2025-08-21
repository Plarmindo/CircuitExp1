import { describe, it, expect } from 'vitest';
import { createLogger, getRecentLogs, setLevel } from '../../src/logger/central-logger';

describe('CORE-4 logger basic', () => {
  it('emits records into ring buffer with level filtering', () => {
    setLevel('debug');
    const log = createLogger({ component: 'test' });
    log.debug('hello-debug', { a: 1 });
    log.info('hello-info');
    log.warn('warn-msg');
    log.error('error-msg', { e: true });
    const recent = getRecentLogs(10);
    // ensure last 4 messages exist in order
    const msgs = recent.slice(-4).map((r) => r.msg);
    expect(msgs).toEqual(['hello-debug', 'hello-info', 'warn-msg', 'error-msg']);
    const last = recent[recent.length - 1];
    expect(last.level).toBe('error');
    expect(last.component).toBe('test');
    expect(typeof last.ts).toBe('string');
  });
  it('respects level filtering (info hides debug)', () => {
    setLevel('info');
    const log = createLogger({ component: 'lvl' });
    log.debug('should-not');
    log.info('should');
    const msgs = getRecentLogs(5).map((r) => r.msg);
    expect(msgs.includes('should')).toBe(true);
    expect(msgs.includes('should-not')).toBe(false);
  });
});
