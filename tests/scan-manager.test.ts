import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

interface DonePayload { scanId: string; status: string; cancelled: boolean }
interface ScanStateSnapshot { filesProcessed: number; dirsProcessed: number; truncated: boolean }
interface PartialPayload { scanId: string; nodes: Array<{ path: string; depth: number; [k: string]: unknown }>; truncated?: boolean }
interface ProgressPayload { scanId: string; approxCompletion: number | null }
interface ScanAPI {
  startScan(root: string, opts?: { includeMetadata?: boolean; maxDepth?: number; maxEntries?: number }): { scanId: string };
  cancelScan(id: string): boolean;
  getScanState(id: string): ScanStateSnapshot & Record<string, unknown>;
  on(event: 'scan:done', cb: (payload: DonePayload) => void): unknown;
  on(event: 'scan:partial', cb: (payload: PartialPayload) => void): unknown;
  on(event: 'scan:progress', cb: (payload: ProgressPayload) => void): unknown;
  off(event: 'scan:done', cb: (payload: DonePayload) => void): unknown;
  off(event: 'scan:partial', cb: (payload: PartialPayload) => void): unknown;
  off(event: 'scan:progress', cb: (payload: ProgressPayload) => void): unknown;
}
const scanManager: ScanAPI = require('../scan-manager.cjs');

function waitForDone(scanId: string, timeoutMs = 10000): Promise<DonePayload> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const onDone = (payload: DonePayload) => {
      if (payload.scanId === scanId) {
        scanManager.off('scan:done', onDone);
        resolve(payload);
      }
    };
    scanManager.on('scan:done', onDone);
    const t = setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        scanManager.off('scan:done', onDone);
        clearInterval(t);
        reject(new Error('timeout waiting for scan:done'));
      }
    }, 100);
  });
}

function createTempTree(struct: Record<string, string | null>, baseDir: string) {
  for (const rel in struct) {
    const value = struct[rel];
    const full = path.join(baseDir, rel);
    if (value === null) {
      fs.mkdirSync(full, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, value);
    }
  }
}

describe('scan-manager basic', () => {
  it('scans a small tree and produces progress and done events', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-'));
    createTempTree({ 'dirA': null, 'dirA/file1.txt': 'a', 'dirB': null, 'dirB/file2.txt': 'b' }, tmp);
    const { scanId } = scanManager.startScan(tmp, { includeMetadata: false });
    expect(scanId).toBeDefined();
    const done = await waitForDone(scanId);
    expect(done.cancelled).toBe(false);
    const state = scanManager.getScanState(scanId);
    expect(state.filesProcessed).toBeGreaterThanOrEqual(2);
    expect(state.dirsProcessed).toBeGreaterThanOrEqual(3);
  });

  it('can cancel a scan', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-cancel-'));
    for (let i = 0; i < 200; i++) fs.mkdirSync(path.join(tmp, 'd' + i));
    const { scanId } = scanManager.startScan(tmp, { includeMetadata: false });
    expect(scanId).toBeDefined();
    scanManager.cancelScan(scanId);
    const done = await waitForDone(scanId);
    expect(done.cancelled).toBe(true);
  });

  it('respects maxDepth', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-depth-'));
    createTempTree({ 'L0': null, 'L0/L1': null, 'L0/L1/L2': null }, tmp);
    const { scanId } = scanManager.startScan(path.join(tmp, 'L0'), { maxDepth: 1 });
    const done = await waitForDone(scanId);
    expect(done.cancelled).toBe(false);
    const state = scanManager.getScanState(scanId);
    expect(state.dirsProcessed).toBeLessThanOrEqual(2);
  });

  it('respects maxEntries truncation', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-maxentries-'));
    const files: Record<string, string | null> = { 'root': null };
    for (let i = 0; i < 50; i++) files[`root/f${i}.txt`] = 'x';
    createTempTree(files, tmp);
    const { scanId } = scanManager.startScan(path.join(tmp, 'root'), { maxEntries: 10 });
    const done = await waitForDone(scanId);
    expect(done.cancelled).toBe(false);
    const st = scanManager.getScanState(scanId);
    expect(st.truncated).toBe(true);
    expect(st.filesProcessed + st.dirsProcessed).toBeLessThanOrEqual(10);
  });

  it('handles permission error on a directory (simulated if platform supports)', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-perm-'));
    const restrictedDir = path.join(tmp, 'noaccess');
    fs.mkdirSync(restrictedDir);
    try { fs.chmodSync(restrictedDir, 0o000); } catch { /* ignore permission change failure (e.g. Windows) */ }
    const { scanId } = scanManager.startScan(tmp, {});
    const done = await waitForDone(scanId);
    expect(done.cancelled).toBe(false);
    const st = scanManager.getScanState(scanId);
    expect(st.dirsProcessed).toBeGreaterThanOrEqual(1);
  });

  it('emits no duplicate nodes in partial batches', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-nodup-'));
    const struct: Record<string, string | null> = { root: null };
    for (let i = 0; i < 20; i++) struct[`root/dir${i}`] = null;
    for (let i = 0; i < 20; i++) struct[`root/file${i}.txt`] = 'x';
    createTempTree(struct, tmp);
    const { scanId } = scanManager.startScan(path.join(tmp, 'root'));
    const seen = new Set<string>();
    let duplicate = false;
    const onPartial = (p: PartialPayload) => {
      if (p.scanId !== scanId) return;
      for (const n of p.nodes) {
        if (seen.has(n.path)) { duplicate = true; break; }
        seen.add(n.path);
      }
    };
    scanManager.on('scan:partial', onPartial);
    const done = await waitForDone(scanId);
    scanManager.off('scan:partial', onPartial);
    expect(done.cancelled).toBe(false);
    expect(duplicate).toBe(false);
  });

  it('marks depthLimited nodes beyond maxDepth', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-depthflag-'));
    createTempTree({ root: null, 'root/A': null, 'root/A/B': null, 'root/A/B/C': null }, tmp);
    const { scanId } = scanManager.startScan(path.join(tmp, 'root'), { maxDepth: 1 });
    let depthLimitedFound = false;
    const onPartial = (p: PartialPayload) => {
      if (p.scanId !== scanId) return;
      if (p.nodes.some(n => n.depthLimited)) depthLimitedFound = true;
    };
    scanManager.on('scan:partial', onPartial);
    const done = await waitForDone(scanId);
    scanManager.off('scan:partial', onPartial);
    expect(done.cancelled).toBe(false);
    expect(depthLimitedFound).toBe(true);
  });

  it('approxCompletion reaches 1 when maxEntries reached', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-approx-'));
    const struct: Record<string, string | null> = { root: null };
    for (let i = 0; i < 30; i++) struct[`root/f${i}.txt`] = 'x';
    createTempTree(struct, tmp);
    let lastApprox: number | null = null;
    const { scanId } = scanManager.startScan(path.join(tmp, 'root'), { maxEntries: 10 });
    const onProgress = (p: { scanId: string; approxCompletion: number | null }) => {
      if (p.scanId !== scanId) return;
      lastApprox = p.approxCompletion;
    };
    scanManager.on('scan:progress', onProgress);
    const done = await waitForDone(scanId);
    scanManager.off('scan:progress', onProgress);
    expect(done.cancelled).toBe(false);
    expect(lastApprox).not.toBeNull();
    expect(lastApprox).toBe(1);
  });

  it('cancellation stops further progress after done', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-cancel-progress-'));
    const struct: Record<string, string | null> = { root: null };
    for (let i = 0; i < 200; i++) struct[`root/dir${i}`] = null;
    createTempTree(struct, tmp);
    const { scanId } = scanManager.startScan(path.join(tmp, 'root'));
    let progressCount = 0;
    const onProgress = (p: { scanId: string }) => { if (p.scanId === scanId) progressCount++; };
    scanManager.on('scan:progress', onProgress);
    // Cancel soon after start
    setTimeout(() => scanManager.cancelScan(scanId), 10);
    const done = await waitForDone(scanId);
    const countAtDone = progressCount;
    await new Promise(r => setTimeout(r, 150));
    scanManager.off('scan:progress', onProgress);
    expect(done.cancelled).toBe(true);
    expect(progressCount).toBe(countAtDone); // no further increments
  });
});
