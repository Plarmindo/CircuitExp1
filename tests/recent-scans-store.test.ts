import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import CommonJS module via dynamic import for lint compatibility.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import createRecentScansStoreModule from '../recent-scans-store.cjs';
// Some bundlers treat CJS default export differently; handle both.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { createRecentScansStore } = (createRecentScansStoreModule as any);

function tempFile(name: string) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'recent-scans-test-')), name);
}

describe('recent-scans-store (CORE-2)', () => {
  it('adds new paths to front and moves existing to front (MRU ordering)', () => {
    const file = tempFile('recent.json');
  const store = createRecentScansStore(() => file, { max: 5, prune: false });
    store.touch('A');
    store.touch('B');
    store.touch('C');
    expect(store.list()).toEqual(['C', 'B', 'A']);
    store.touch('B'); // move existing B to front
    expect(store.list()).toEqual(['B', 'C', 'A']);
  });

  it('trims list to max size when exceeding capacity', () => {
    const file = tempFile('recent.json');
  const store = createRecentScansStore(() => file, { max: 3, prune: false });
    store.touch('P1');
    store.touch('P2');
    store.touch('P3');
    store.touch('P4'); // should evict oldest (P1)
    expect(store.list()).toEqual(['P4', 'P3', 'P2']);
  });

  it('clear empties the list', () => {
    const file = tempFile('recent.json');
  const store = createRecentScansStore(() => file, { max: 4, prune: false });
    store.touch('X');
    expect(store.list().length).toBe(1);
    store.clear();
    expect(store.list()).toEqual([]);
  });

  it('recovers from corrupted file and backs it up', () => {
    const file = tempFile('recent.json');
    fs.writeFileSync(file, '{not valid json');
    const store = createRecentScansStore(() => file, { max: 4 });
    // corrupt file should have been backed up and list starts empty
    expect(store.list()).toEqual([]);
    const dir = path.dirname(file);
    const backups = fs.readdirSync(dir).filter(f => f.startsWith('recent.json.corrupt-'));
    expect(backups.length).toBe(1);
  });

  it('prunes non-existing entries when pruning enabled', () => {
    const file = tempFile('recent.json');
    const existing = new Set(['keep1', 'keep2']);
    const store = createRecentScansStore(() => file, { max: 5, existsFn: (p: string) => existing.has(p) });
    store.touch('keep1');
    store.touch('gone');
    store.touch('keep2'); // order now ['keep2','gone','keep1']
    const listed = store.list();
    expect(listed).toEqual(['keep2','keep1']);
  });
});
