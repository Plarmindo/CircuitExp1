/**
 * Shared type definitions for the asynchronous folder scanning feature.
 * These types MUST remain free of `any` so that both main (Electron) and renderer
 * can rely on strict structural contracts when exchanging IPC payloads.
 *
 * NOTE: Keep this file side-effect free to allow usage in both ESM & CJS contexts.
 */

/** Represents a node in the scanned filesystem tree. */
export interface ScanNode {
  /** Base name (no path separators). */
  readonly name: string;
  /** Absolute path on disk. */
  readonly path: string;
  /** 'file' or 'dir'. */
  readonly kind: 'file' | 'dir';
  /** Child nodes (only for kind === 'dir'). Omitted / empty until explored. */
  readonly children?: ScanNode[];
  /** Depth relative to the root (root = 0). */
  readonly depth: number;
  /** Optional size in bytes (may be omitted for performance initially). */
  readonly sizeBytes?: number;
  /** Last modified epoch ms (optional to avoid excessive stat calls). */
  readonly mtimeMs?: number;
  /** Error message if reading this node failed (children likely undefined). */
  readonly error?: string;
}

/** Options controlling a scan lifecycle. */
export interface ScanOptions {
  /** Maximum depth to descend (root = 0). Undefined = no limit. */
  readonly maxDepth?: number;
  /** Maximum total entries (files + dirs). If exceeded, scan ends truncated. */
  readonly maxEntries?: number;
  /** Whether to follow symbolic links (default false). */
  readonly followSymlinks?: boolean;
  /** Directory batch size (entries processed before yielding event loop). */
  readonly batchSize?: number;
  /** Milliseconds time slice target; implementation may yield after this. */
  readonly timeSliceMs?: number;
  /** Include size/mtime metadata (slower). */
  readonly includeMetadata?: boolean;
}

/** Internal status of a scan lifecycle. */
export type ScanStatus = 'running' | 'done' | 'cancelled' | 'error';

/** Progress event payload (lightweight, high-frequency). */
export interface ScanProgress {
  readonly scanId: string;
  /** Number of directory nodes fully processed (children enumerated). */
  readonly dirsProcessed: number;
  /** Number of file nodes discovered. */
  readonly filesProcessed: number;
  /** Number of directory entries still queued for enumeration. */
  readonly queueLengthRemaining: number;
  /** High-resolution elapsed milliseconds since start. */
  readonly elapsedMs: number;
  /** Approximate completion ratio (0..1) or null if not yet estimable. */
  readonly approxCompletion: number | null;
}

/** Incremental batch of newly discovered nodes. */
export interface ScanPartialBatch {
  readonly scanId: string;
  /** Newly discovered nodes since last partial emission. */
  readonly nodes: ScanNode[];
  /** True if this batch caused a truncation due to limits. */
  readonly truncated?: boolean;
}

/** Final completion / termination event payload. */
export interface ScanDonePayload {
  readonly scanId: string;
  readonly status: Exclude<ScanStatus, 'running'>; // done | cancelled | error
  /** Root node if the full tree was assembled (optional in delta strategy). */
  readonly root?: ScanNode;
  /** Total counters at termination. */
  readonly totalDirs: number;
  readonly totalFiles: number;
  /** True if stopped because limits (maxEntries / maxDepth) were hit. */
  readonly truncated: boolean;
  /** Present if status === 'error'. */
  readonly error?: string;
  /** Milliseconds elapsed. */
  readonly elapsedMs: number;
}

/** Public API result returned immediately when starting a scan. */
export interface ScanStartResult {
  readonly scanId: string;
  /** Echo of normalized options actually used (with defaults applied). */
  readonly options: Required<Pick<ScanOptions, 'batchSize' | 'timeSliceMs' | 'followSymlinks'>> &
    Omit<ScanOptions, 'batchSize' | 'timeSliceMs' | 'followSymlinks'>;
  /** Timestamp epoch ms when scanning began. */
  readonly startedAt: number;
}

/** Internal queue item (not exported to renderer in events). */
export interface InternalQueueItem {
  path: string;
  depth: number;
  parent?: ScanNode; // link used if building nested hierarchy
}

/** Lightweight guard utilities (optional use). */
export const isScanNode = (v: unknown): v is ScanNode =>
  !!v &&
  typeof v === 'object' &&
  'path' in (v as Record<string, unknown>) &&
  'kind' in (v as Record<string, unknown>);

/** Default values to apply when options omit them. */
export const DEFAULT_SCAN_OPTION_NORMALIZED = {
  batchSize: 250,
  timeSliceMs: 12,
  followSymlinks: false,
} satisfies Required<Pick<ScanOptions, 'batchSize' | 'timeSliceMs' | 'followSymlinks'>>;
