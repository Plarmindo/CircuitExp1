import { _electron as electron, test, expect } from '@playwright/test';
import path from 'path';

// CORE-4 E2E: verifies scan:start + validation error produce structured log records retrievable via logs:recent.

async function poll<T>(
  fn: () => Promise<T>,
  predicate: (v: T) => boolean,
  timeout = 10000,
  interval = 200
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await fn();
    if (predicate(v)) return v;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('timeout waiting for predicate');
}

test('CORE-4 logs scan:start + validation error (Electron)', async () => {
  const electronMain = path.join(process.cwd(), 'electron-main.cjs');
  const app = await electron.launch({ args: [electronMain] });
  const win = await app.firstWindow();

  // helper exec inside renderer
  async function evalIn<T>(expr: string): Promise<T> {
    return win.evaluate(expr) as Promise<T>;
  }

  // Trigger a scan (use mock-root path which should exist in repo)
  const mockRoot = path.join(process.cwd(), 'mock-root');
  await evalIn(`window.electronAPI.startScan(${JSON.stringify(mockRoot)})`);

  // Trigger an IPC validation failure (open-path with empty string)
  await evalIn(`window.electronAPI.openPath('')`).catch(() => {});

  // Poll recent logs for both entries
  const logs = await poll(
    async () => {
      return evalIn<{
        success: boolean;
        logs: Array<{ level: string; msg: string; detail?: unknown }>;
      }>('window.electronAPI.logsRecent(200)');
    },
    (res) => {
      if (!res?.success) return false;
      const msgs = res.logs.map((l) => l.msg);
      const hasScan =
        msgs.some((m) => m.includes('[scan:start] started')) ||
        msgs.some((m) => m.includes('[scan:start] request'));
      const hasValidation = msgs.some((m) => m.includes('[ipc][open-path] validation fail'));
      return hasScan && hasValidation;
    }
  );

  expect(logs.success).toBe(true);
  const scanLog = logs.logs.find((l) => l.msg.includes('[scan:start]'));
  expect(scanLog).toBeTruthy();
  const validationLog = logs.logs.find((l) => l.msg.includes('[ipc][open-path]'));
  expect(validationLog?.level === 'warn' || validationLog?.level === 'info').toBeTruthy();

  await app.close();
});
