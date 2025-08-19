import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const sm = require('../scan-manager.cjs');

// These tests intentionally hit internal helpers to exercise error classification branches.

describe('scan-manager internals (_test hooks)', () => {
  it('classifies known error codes directly', () => {
    const codes = ['EACCES','ENOENT','ENOTDIR','EEXIST','EINVAL','ENOSPC','EMFILE'];
    for (const c of codes) {
      const { errorCode } = sm._test._classifyError({ code: c, message: c+' message' });
      expect(errorCode).toBe(c);
    }
  });
  it('falls back to UNKNOWN for unrecognized error', () => {
    const { errorCode } = sm._test._classifyError({ message: 'some random failure' });
    expect(errorCode).toBe('UNKNOWN');
  });
  it('classifies known message substrings without code', () => {
    const messages = [
      'permission denied reading file',
      'no such file or directory occurred',
      'not a directory encountered',
      'file exists already',
      'invalid argument passed somewhere',
      'no space left on device error',
      'too many open files warning'
    ];
    const expected = ['EACCES','ENOENT','ENOTDIR','EEXIST','EINVAL','ENOSPC','EMFILE'];
    messages.forEach((m,i) => {
      const { errorCode } = sm._test._classifyError({ message: m });
      expect(errorCode).toBe(expected[i]);
    });
  });
  it('makeNode populates metadata when includeMetadata true (existing file)', () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-node-meta-'));
    const f = path.join(tmp, 'a.txt');
    fs.writeFileSync(f, 'data');
    const node = sm._test._makeNode(f, 0, 'file', true);
    expect(node.size).toBe(4);
    expect(node.mtimeMs || node.birthtimeMs).toBeTruthy();
  });
  it('normalizeOptions applies defaults and sanitizes invalid values', () => {
    const norm = sm._test._normalizeOptions({ batchSize: -5, timeSliceMs: 0, followSymlinks: 1, includeMetadata: 0 });
    expect(norm.batchSize).toBe(250); // default
    expect(norm.timeSliceMs).toBe(12); // default
    expect(norm.followSymlinks).toBe(true); // coerced truthy
    expect(norm.includeMetadata).toBe(false); // coerced boolean
  });
  it('makeNode captures error for nonexistent path with metadata', () => {
    const bogus = path.join(process.cwd(), 'definitely-does-not-exist-' + Date.now());
    const node = sm._test._makeNode(bogus, 0, 'file', true);
    expect(node.error).toBeTruthy();
    expect(node.errorCode).toBeDefined();
  });
  it('makeNode captures symlink target info', () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'scan-test-symlink-meta-'));
    const target = path.join(tmp, 'real');
    fs.mkdirSync(target);
    const link = path.join(tmp, 'lnk');
    let created = true; try { fs.symlinkSync(target, link, 'dir'); } catch { created = false; }
    if (!created) { expect(true).toBe(true); return; }
    const node = sm._test._makeNode(link, 0, 'dir', true);
    expect(node.symlink).toBeTruthy();
  });
});
