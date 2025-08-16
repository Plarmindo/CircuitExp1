/**
 * Async Scan Manager
 * Algorithm: iterative breadth-first-ish directory enumeration using a queue to avoid recursion.
 * Non-blocking: slices limited by timeSliceMs and batchSize; scheduling via setImmediate.
 * Partial Emission: delta-only (new nodes since last partial) ensuring unique path emission (Set emittedPaths).
 * Progress Metrics: elapsedMs via hrtime, counts of dirs/files, queue length, optional approxCompletion when maxEntries known.
 * Resource Limits: maxDepth, maxEntries, followSymlinks (default false) enforced inline; if maxEntries reached -> truncated flag.
 * Performance Logging (dev): DEBUG_SCAN env triggers periodic logs (every PERF_LOG_INTERVAL slices) with counts & memory.
 * Error Handling: per-entry errors captured and emitted as nodes with error field; scan continues unless root invalid.
 * Cancellation: flag cancels future work; emits final done with cancelled=true.
 * Complexity: O(N) over total entries visited; memory O(N) for nodeByPath + queue (future optimization could stream to persistent store).
 * TODOs: consider worker threads for metadata-heavy extraction; incremental FS watching for live updates; back-pressure for renderer.
 */

// Asynchronous Scan Manager (Items 2-8 partial)
// NOTE: This implements the lifecycle registry & exported API required by Checklist Item 2.
// It DOES NOT yet implement the non-blocking processing loop (reserved for Item 3).
// No UI integration or IPC wiring is done here.

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * Local mirror of shared type shapes (runtime only).
 * We avoid requiring the TypeScript source directly in Electron main (CJS) context.
 * This keeps the main process free of build-time dependencies.
 */

/**
 * @typedef {Object} ScanOptions
 * @property {number} [maxDepth]
 * @property {number} [maxEntries]
 * @property {boolean} [followSymlinks]
 * @property {number} [batchSize]
 * @property {number} [timeSliceMs]
 * @property {boolean} [includeMetadata]
 */

/**
 * @typedef {Object} ScanState
 * @property {string} scanId
 * @property {string} rootPath
 * @property {ScanOptions} options
 * @property {number} startedAt
 * @property {number} dirsProcessed
 * @property {number} filesProcessed
 * @property {number} errors
 * @property {boolean} cancelled
 * @property {boolean} done
 * @property {boolean} truncated
 * @property {Map<string, any>} nodeByPath  // holds node references (building tree optional)
 * @property {Array<{path:string, depth:number, parentPath:string|null}>} queue
 */

// Re-declare (kept from original)
const DEFAULTS = Object.freeze({
  batchSize: 250,
  timeSliceMs: 12,
  followSymlinks: false
});
const scans = new Map();
const emitter = new EventEmitter();
const fsp = fs.promises;
const PERF_LOG_INTERVAL = 25; // slices
let sliceCounter = 0; // global slice counter for logging

/** Generate a random short id */
function makeId() {
  return crypto.randomBytes(6).toString('hex');
}

/** Normalize options by applying defaults */
function normalizeOptions(opts = {}) {
  return {
    batchSize: typeof opts.batchSize === 'number' && opts.batchSize > 0 ? Math.floor(opts.batchSize) : DEFAULTS.batchSize,
    timeSliceMs: typeof opts.timeSliceMs === 'number' && opts.timeSliceMs > 0 ? Math.floor(opts.timeSliceMs) : DEFAULTS.timeSliceMs,
    followSymlinks: !!opts.followSymlinks,
    maxDepth: typeof opts.maxDepth === 'number' ? opts.maxDepth : undefined,
    maxEntries: typeof opts.maxEntries === 'number' ? opts.maxEntries : undefined,
    includeMetadata: !!opts.includeMetadata
  };
}

/**
 * Create initial ScanState registry entry.
 * (Processing loop to be added in Item 3.)
 * @param {string} rootPath
 * @param {ScanOptions} options
 * @returns {{ scanId: string, options: ReturnType<typeof normalizeOptions>, startedAt: number }}
 */
function startScan(rootPath, options) {
  if (!rootPath || typeof rootPath !== 'string') {
    throw new Error('startScan: rootPath must be a non-empty string');
  }
  let stat;
  try {
    stat = fs.lstatSync(rootPath);
  } catch (e) {
    throw new Error('startScan: rootPath not accessible: ' + e.message);
  }
  if (!stat.isDirectory()) {
    throw new Error('startScan: rootPath is not a directory');
  }
  const norm = normalizeOptions(options);
  const scanId = makeId();
  /** @type {ScanState} */
  const state = {
    scanId,
    rootPath: path.resolve(rootPath),
    options: norm,
    startedAt: Date.now(),
    dirsProcessed: 0, // root will be counted when processed from queue
    filesProcessed: 0,
    errors: 0,
    cancelled: false,
    done: false,
    truncated: false,
    nodeByPath: new Map(),
    queue: [{ path: path.resolve(rootPath), depth: 0, parentPath: null }],
    emittedPaths: new Set(),
    pendingBatchNodes: []
  };
  scans.set(scanId, state);
  // Pre-register root node (do not increment dirsProcessed yet to avoid double count)
  const rootNode = _makeNode(state.rootPath, 0, 'dir', norm.includeMetadata);
  state.nodeByPath.set(state.rootPath, rootNode);
  _addPartialNode(state, rootNode);
  emitter.emit('scan:registered', { scanId, rootPath: state.rootPath, options: norm, startedAt: state.startedAt });
  _scheduleLoop(scanId);
  return { scanId, options: norm, startedAt: state.startedAt };
}

/** Cancel an existing scan (processing loop will respect this flag in Item 3). */
function cancelScan(scanId) {
  const st = scans.get(scanId);
  if (!st) return false;
  if (st.done || st.cancelled) return true;
  st.cancelled = true;
  emitter.emit('scan:cancelled', { scanId });
  // If loop not yet started or queue empty, finish immediately
  if (!st.startedLoop || st.queue.length === 0) {
    _finish(st, 'cancelled');
  }
  return true;
}

/** Get current snapshot of a scan state (for debugging / introspection) */
function getScanState(scanId) {
  const st = scans.get(scanId);
  if (!st) return null;
  // Provide a shallow clone without internal maps/queues fully exposed.
  return {
    scanId: st.scanId,
    rootPath: st.rootPath,
    options: st.options,
    startedAt: st.startedAt,
    dirsProcessed: st.dirsProcessed,
    filesProcessed: st.filesProcessed,
    errors: st.errors,
    cancelled: st.cancelled,
    done: st.done,
    truncated: st.truncated,
    queueLength: st.queue.length
  };
}

/** Simple enumeration of active scan ids */
function listScans() {
  return Array.from(scans.keys());
}

// High-resolution timing
function _hrNow() { return process.hrtime.bigint(); }

// Extend ScanState doc (comment only)
/**
 * ScanState additions for Item 3:
 * @property {bigint} hrStart
 * @property {boolean} startedLoop
 * @property {Array<any>} pendingBatchNodes // nodes accumulated for next partial emission
 */

// Kick off processing loop after registration (non-blocking)
function _scheduleLoop(scanId) {
  const st = scans.get(scanId);
  if (!st || st.startedLoop) return;
  st.startedLoop = true;
  st.hrStart = _hrNow();
  setImmediate(() => _processSlice(st));
}

async function _processSlice(st) {
  if (st.done) return; // allow cancellation to finalize
  if (st.cancelled) { _finish(st, 'cancelled'); return; }
  sliceCounter++;
  const { batchSize, timeSliceMs, maxDepth, maxEntries, includeMetadata, followSymlinks } = st.options;
  const sliceWallStart = Date.now();
  while (st.queue.length && (Date.now() - sliceWallStart) < timeSliceMs) {
    if (st.cancelled) break;
    if (maxEntries && (st.dirsProcessed + st.filesProcessed) >= maxEntries) { st.truncated = true; break; }
    const item = st.queue.shift();
    if (!item) break;
    const { path: dirPath, depth } = item;
    let dirEntries;
    try {
      const lst = await fsp.lstat(dirPath);
      if (!lst.isDirectory()) {
        const { error, errorCode } = _classifyError(new Error('Not a directory (changed during scan)'));
        const node = _makeNode(dirPath, depth, 'file', includeMetadata, error);
        if (errorCode) node.errorCode = errorCode;
        _addPartialNode(st, node);
        st.filesProcessed++;
        _emitProgress(st);
        continue;
      }
      if (maxDepth !== undefined && depth > maxDepth) {
        if (!st.nodeByPath.get(dirPath)) {
          const node = _makeNode(dirPath, depth, 'dir', includeMetadata, 'maxDepth reached');
          node.depthLimited = true;
          st.nodeByPath.set(dirPath, node);
          _addPartialNode(st, node);
        }
        st.dirsProcessed++;
        if (maxEntries && (st.dirsProcessed + st.filesProcessed) >= maxEntries) { st.truncated = true; break; }
        _emitProgress(st);
        continue;
      }
      dirEntries = await fsp.readdir(dirPath);
    } catch (e) {
      st.errors++;
      const { error, errorCode } = _classifyError(e);
      const errNode = _makeNode(dirPath, depth, 'dir', includeMetadata, error);
      if (errorCode) errNode.errorCode = errorCode;
      st.nodeByPath.set(dirPath, errNode);
      _addPartialNode(st, errNode);
      st.dirsProcessed++;
      if (maxEntries && (st.dirsProcessed + st.filesProcessed) >= maxEntries) { st.truncated = true; break; }
      _emitProgress(st);
      continue;
    }
    let dirNode = st.nodeByPath.get(dirPath);
    if (!dirNode) {
      dirNode = _makeNode(dirPath, depth, 'dir', includeMetadata);
      st.nodeByPath.set(dirPath, dirNode);
      _addPartialNode(st, dirNode);
    }
    for (const name of dirEntries) {
      if (st.cancelled) break;
      if (maxEntries && (st.dirsProcessed + st.filesProcessed) >= maxEntries) { st.truncated = true; break; }
      const childPath = path.join(dirPath, name);
      let lst;
      try { lst = await fsp.lstat(childPath); } catch (e) {
        st.errors++;
        const { error, errorCode } = _classifyError(e);
        const errChild = _makeNode(childPath, depth + 1, 'file', includeMetadata, error);
        if (errorCode) errChild.errorCode = errorCode;
        st.nodeByPath.set(childPath, errChild);
        _addPartialNode(st, errChild);
        continue;
      }
      const isSym = lst.isSymbolicLink();
      let isDir = lst.isDirectory();
      if (isSym && !followSymlinks) { isDir = false; }
      if (isDir) {
        // Respect maxDepth when enqueueing next-level directories
        if (maxDepth !== undefined && (depth + 1) > maxDepth) {
          const limitedNode = _makeNode(childPath, depth + 1, 'dir', includeMetadata, 'maxDepth reached');
          limitedNode.depthLimited = true;
          st.nodeByPath.set(childPath, limitedNode);
          _addPartialNode(st, limitedNode);
        } else {
          const childDirNode = _makeNode(childPath, depth + 1, 'dir', includeMetadata);
          st.nodeByPath.set(childPath, childDirNode);
          _addPartialNode(st, childDirNode);
          st.queue.push({ path: childPath, depth: depth + 1, parentPath: dirPath });
        }
      } else {
        const fileNode = _makeNode(childPath, depth + 1, 'file', includeMetadata);
        st.nodeByPath.set(childPath, fileNode);
        _addPartialNode(st, fileNode);
        st.filesProcessed++;
        if (maxEntries && (st.dirsProcessed + st.filesProcessed) >= maxEntries) { st.truncated = true; break; }
      }
      if (st.pendingBatchNodes.length >= batchSize) _emitPartial(st);
    }
    // Only count directory if not already truncated
    if (!st.truncated) {
      st.dirsProcessed++;
    }
    if (maxEntries && (st.dirsProcessed + st.filesProcessed) >= maxEntries) { st.truncated = true; }

    _emitProgress(st);
    if (st.truncated) break;
  }

  if (st.pendingBatchNodes.length && (st.cancelled || !st.queue.length || st.truncated)) { _emitPartial(st); }

  if (st.cancelled) {
    return _finish(st, 'cancelled');
  }
  if (!st.queue.length || st.truncated) {
    return _finish(st, 'done');
  }
  if (process.env.DEBUG_SCAN && (sliceCounter % PERF_LOG_INTERVAL === 0)) {
    const mem = process.memoryUsage();
    console.log('[scan-perf]', st.scanId, 'dirs', st.dirsProcessed, 'files', st.filesProcessed, 'queue', st.queue.length, 'rssMB', (mem.rss/1024/1024).toFixed(1));
  }
  setImmediate(() => _processSlice(st));
}

function _emitProgress(st) {
  const now = _hrNow();
  const elapsedMs = st.hrStart ? Number((now - st.hrStart) / 1000000n) : 0;
  const totalProcessed = st.dirsProcessed + st.filesProcessed;
  const approxCompletion = st.options.maxEntries
    ? Math.min(1, totalProcessed / st.options.maxEntries)
    : null;
  emitter.emit('scan:progress', {
    scanId: st.scanId,
    dirsProcessed: st.dirsProcessed,
    filesProcessed: st.filesProcessed,
    queueLengthRemaining: st.queue.length,
    elapsedMs,
    approxCompletion
  });
}
function _emitPartial(st) {
  if (!st.pendingBatchNodes.length) return;
  emitter.emit('scan:partial', { scanId: st.scanId, nodes: st.pendingBatchNodes.slice(), truncated: st.truncated || undefined });
  st.pendingBatchNodes.length = 0;
}
function _finish(st, status) {
  if (st.done) return;
  st.done = true;
  st.queue.length = 0;
  st.pendingBatchNodes.length = 0;
  emitter.emit('scan:done', { scanId: st.scanId, status, cancelled: st.cancelled });
}

// Item 7 delta emission helper
function _addPartialNode(st, node) {
  if (!st.emittedPaths.has(node.path)) {
    st.emittedPaths.add(node.path);
    st.pendingBatchNodes.push(node);
  }
}

// Utility: create node representation
function _makeNode(fullPath, depth, kind, includeMetadata, errorMsg) {
  const node = { path: fullPath, name: path.basename(fullPath) || fullPath, depth, kind };
  if (includeMetadata) {
    try {
      const stat = fs.statSync(fullPath);
      node.size = stat.size;
      node.birthtimeMs = stat.birthtimeMs;
      node.mtimeMs = stat.mtimeMs;
      node.atimeMs = stat.atimeMs;
      node.ctimeMs = stat.ctimeMs;
      node.fileType = stat.isFile() ? 'file' : stat.isDirectory() ? 'dir' : 'other';
      node.symlink = stat.isSymbolicLink() ? fs.readlinkSync(fullPath) : undefined;
    } catch (e) {
      const { error, errorCode } = _classifyError(e);
      node.error = error;
      if (errorCode) node.errorCode = errorCode;
    }
  }
  return node;
}

// Error classification for special handling (toplevel only)
function _classifyError(err) {
  let code = 'UNKNOWN';
  if (err.code) {
    code = err.code;
  } else if (err.message) {
    const msg = err.message.toLowerCase();
    if (msg.includes('EACCES') || msg.includes('permission denied')) {
      code = 'EACCES';
    } else if (msg.includes('ENOENT') || msg.includes('no such file or directory')) {
      code = 'ENOENT';
    } else if (msg.includes('ENOTDIR') || msg.includes('not a directory')) {
      code = 'ENOTDIR';
    } else if (msg.includes('EEXIST') || msg.includes('file exists')) {
      code = 'EEXIST';
    } else if (msg.includes('EINVAL') || msg.includes('invalid argument')) {
      code = 'EINVAL';
    } else if (msg.includes('ENOSPC') || msg.includes('no space left on device')) {
      code = 'ENOSPC';
    } else if (msg.includes('EMFILE') || msg.includes('too many open files')) {
      code = 'EMFILE';
    }
  }
  return { error: err.message, errorCode: code };
}

// Export public API
module.exports = {
  startScan,
  cancelScan,
  getScanState,
  listScans,
  on: emitter.on.bind(emitter),
  off: (emitter.off ? emitter.off.bind(emitter) : emitter.removeListener.bind(emitter)),
  once: emitter.once.bind(emitter),
  emitter
};
