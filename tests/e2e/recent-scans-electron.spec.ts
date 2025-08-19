import { _electron as electron, test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// CORE-2 Automated Electron E2E: validates MRU ordering, pruning, and clear functionality

async function waitFor(condition: () => Promise<boolean>, timeout = 15000, interval = 200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error('timeout waiting for condition');
}

test('CORE-2 recent scans MRU + pruning + clear (Electron)', async () => {
  const electronMain = path.join(process.cwd(), 'electron-main.cjs');
  const app = await electron.launch({ args: [electronMain] });
  const win = await app.firstWindow();

  // Helper to invoke renderer electronAPI functions
  async function call<T>(expr: string): Promise<T> {
    return win.evaluate(expr) as Promise<T>;
  }

  // Create temporary folders for test (simulate scans)
  const tmpBase = path.join(process.cwd(), 'test-results', 'recent-e2e');
  fs.rmSync(tmpBase, { recursive: true, force: true });
  fs.mkdirSync(tmpBase, { recursive: true });
  const dirA = path.join(tmpBase, 'dirA');
  const dirB = path.join(tmpBase, 'dirB');
  fs.mkdirSync(dirA); fs.mkdirSync(dirB);

  // Start scans via IPC (uses startScan handler => touch recent)
  await call(`window.electronAPI.startScan(${JSON.stringify(dirA)})`);
  await call(`window.electronAPI.startScan(${JSON.stringify(dirB)})`);

  // Wait until dirB is first (MRU)
  await waitFor(async () => {
    const list = await call<{ recent: string[] }>('window.electronAPI.recentList()');
  return list.recent[0] === dirB;
  });

  let recent = await call<{ recent: string[] }>('window.electronAPI.recentList()');
  expect(recent.recent[0]).toBe(dirB);
  expect(recent.recent[1]).toBe(dirA);

  // Re-scan dirA -> should move to front
  await call(`window.electronAPI.startScan(${JSON.stringify(dirA)})`);
  await waitFor(async () => {
    const list = await call<{ recent: string[] }>('window.electronAPI.recentList()');
  return list.recent[0] === dirA;
  });
  recent = await call<{ recent: string[] }>('window.electronAPI.recentList()');
  expect(recent.recent[0]).toBe(dirA);

  // Pruning test: delete dirB then trigger another scan (dirA again) and ensure dirB pruned
  fs.rmSync(dirB, { recursive: true, force: true });
  await call(`window.electronAPI.startScan(${JSON.stringify(dirA)})`);
  await waitFor(async () => {
    const list = await call<{ recent: string[] }>('window.electronAPI.recentList()');
  return !list.recent.includes(dirB);
  });
  recent = await call<{ recent: string[] }>('window.electronAPI.recentList()');
  expect(recent.recent.includes(dirB)).toBe(false);

  // Clear
  await call('window.electronAPI.recentClear()');
  recent = await call<{ recent: string[] }>('window.electronAPI.recentList()');
  expect(recent.recent.length).toBe(0);

  await app.close();
});
