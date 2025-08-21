import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

interface DonePayload {
  scanId: string;
  status: string;
  cancelled: boolean;
}
interface PartialPayload {
  scanId: string;
  nodes: Array<{ path: string; depth: number; [k: string]: unknown }>;
  truncated?: boolean;
}
interface ScanAPI {
  startScan(root: string, opts?: Record<string, unknown>): { scanId: string };
  cancelScan(id: string): boolean;
  on(event: 'scan:done', cb: (payload: DonePayload) => void): unknown;
  on(event: 'scan:partial', cb: (payload: PartialPayload) => void): unknown;
  off(event: 'scan:done', cb: (payload: DonePayload) => void): unknown;
  off(event: 'scan:partial', cb: (payload: PartialPayload) => void): unknown;
}
const scanManager: ScanAPI = require('../scan-manager.cjs');

function waitForDone(scanId: string, timeoutMs = 8000): Promise<DonePayload> {
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

describe('scan-manager extended coverage', () => {
  it('includeMetadata populates size/mtime fields', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-meta-'));
    fs.writeFileSync(path.join(tmp, 'f.txt'), 'hello');
    const { scanId } = scanManager.startScan(tmp, { includeMetadata: true });
    const partials: PartialPayload[] = [];
    const onPartial = (p: PartialPayload) => {
      if (p.scanId === scanId) partials.push(p);
    };
    scanManager.on('scan:partial', onPartial);
    const done = await waitForDone(scanId);
    scanManager.off('scan:partial', onPartial);
    expect(done.cancelled).toBe(false);
    const allNodes = partials.flatMap((p) => p.nodes);
    const fileNode = allNodes.find((n) => n.path.endsWith('f.txt')) as any;
    expect(fileNode).toBeTruthy();
    expect(typeof fileNode.size).toBe('number');
    expect(typeof fileNode.mtimeMs === 'number' || typeof fileNode.birthtimeMs === 'number').toBe(
      true
    );
  });

  it('symlink is not traversed when followSymlinks=false', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-symlink-off-'));
    const targetDir = path.join(tmp, 'real');
    const linkDir = path.join(tmp, 'link');
    fs.mkdirSync(targetDir);
    let symlinkCreated = true;
    try {
      fs.symlinkSync(targetDir, linkDir, 'dir');
    } catch {
      symlinkCreated = false;
    }
    if (!symlinkCreated) {
      expect(true).toBe(true);
      return;
    }
    const { scanId } = scanManager.startScan(tmp, { followSymlinks: false });
    const partials: PartialPayload[] = [];
    const onPartial = (p: PartialPayload) => {
      if (p.scanId === scanId) partials.push(p);
    };
    scanManager.on('scan:partial', onPartial);
    await waitForDone(scanId);
    scanManager.off('scan:partial', onPartial);
    const allNodes = partials.flatMap((p) => p.nodes);
    const linkNode = allNodes.find((n) => n.path === linkDir) as any;
    expect(linkNode).toBeTruthy();
    const hasChildUnderLink = allNodes.some(
      (n) => n.path.startsWith(linkDir + path.sep) && n.path !== linkDir
    );
    expect(hasChildUnderLink).toBe(false);
  });

  it('symlink directory is traversed when followSymlinks=true', async () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-symlink-on-'));
    const targetDir = path.join(tmp, 'real');
    const subDir = path.join(targetDir, 'sub');
    const linkDir = path.join(tmp, 'link');
    fs.mkdirSync(subDir, { recursive: true });
    let symlinkCreated = true;
    try {
      fs.symlinkSync(targetDir, linkDir, 'dir');
    } catch {
      symlinkCreated = false;
    }
    if (!symlinkCreated) {
      expect(true).toBe(true);
      return;
    }
    const { scanId } = scanManager.startScan(tmp, { followSymlinks: true });
    const partials: PartialPayload[] = [];
    const onPartial = (p: PartialPayload) => {
      if (p.scanId === scanId) partials.push(p);
    };
    scanManager.on('scan:partial', onPartial);
    await waitForDone(scanId);
    scanManager.off('scan:partial', onPartial);
    const allNodes = partials.flatMap((p) => p.nodes);
    const viaLinkChild = allNodes.find((n) => n.path.startsWith(path.join(linkDir, 'sub')));
    expect(viaLinkChild).toBeTruthy();
  });
});
