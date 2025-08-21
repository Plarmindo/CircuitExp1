/**
 * Graph Adapter
 * -------------------------------------------------------------
 * Translates incoming ScanNode delta batches into an internal graph model
 * suitable for incremental layout & rendering.
 *
 * Responsibilities (Checklist Item 1):
 * - Maintain a stable map path -> GraphNode (no duplicates).
 * - Create placeholder parent nodes if a child arrives before the parent.
 * - Preserve parent/children relationships.
 * - Distinguish directory hubs vs file terminals.
 * - Expose an `applyDelta` function returning arrays of {added, updated, placeholderHydrated}.
 * - Mark placeholder nodes with `isPlaceholder=true` until hydrated.
 *
 * This module is PURE DATA TRANSFORMATION (no rendering / Pixi usage).
 */

import type { ScanNode } from '../shared/scan-types';

export type GraphNodeKind = 'dir' | 'file';

export interface GraphNodeMeta {
  sizeBytes?: number;
  mtimeMs?: number;
  error?: string;
}

export interface GraphNode extends GraphNodeMeta {
  readonly path: string;
  name: string; // mutable for placeholder -> real hydration edge case
  kind: GraphNodeKind;
  depth: number;
  parentPath?: string;
  children: string[]; // store child paths for indirection
  isPlaceholder?: boolean; // true when created due to missing parent delta
}

export interface ApplyDeltaResult {
  added: GraphNode[]; // brand new (including placeholders)
  updated: GraphNode[]; // existing nodes with metadata or hydration changes
  placeholderHydrated: GraphNode[]; // subset of updated where isPlaceholder cleared
}

/** Container maintaining adapter state. */
export class GraphAdapter {
  private nodes = new Map<string, GraphNode>();

  /** Get a node (readonly). */
  getNode(path: string): GraphNode | undefined {
    return this.nodes.get(path);
  }
  /** All nodes snapshot (avoid in hot paths). */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }
  /** Count. */
  size(): number {
    return this.nodes.size;
  }

  /** Debug: return number of root nodes (nodes without parentPath). */
  debugRootCount(): number {
    let c = 0;
    for (const n of this.nodes.values()) if (!n.parentPath) c++;
    return c;
  }

  /** Derive parent absolute path; returns undefined for root or invalid. */
  private static parentPathOf(p: string): string | undefined {
    if (!p) return undefined;
    const norm = p.replace(/\\+/g, '/');
    const idx = norm.lastIndexOf('/');
    // If path is like 'C:/something' we DON'T want parent 'C:'; treat drive-root children as roots.
    // idx === 2 for 'C:/...'. If so, return undefined to mark as root.
    if (idx === 2 && /[A-Za-z]:/.test(norm.slice(0, 2))) return undefined;
    if (idx <= 0) return undefined; // other cases (no slash or leading slash only)
    return norm.slice(0, idx);
  }

  /** Create a placeholder directory node for a missing ancestor. */
  private createPlaceholder(path: string, depth: number, parentPath?: string): GraphNode {
    const node: GraphNode = {
      path,
      name: path.split(/[/\\]/).pop() || path,
      kind: 'dir',
      depth,
      parentPath,
      children: [],
      isPlaceholder: true,
    };
    this.nodes.set(path, node);
    if (parentPath) {
      const parent = this.nodes.get(parentPath);
      if (parent && !parent.children.includes(path)) parent.children.push(path);
    }
    return node;
  }

  /** Ensure a full chain of placeholder parents exists for given path. Returns parent path (if any). */
  private ensureParents(
    path: string,
    depth: number,
    addedCollector?: GraphNode[]
  ): string | undefined {
    const parentPath = GraphAdapter.parentPathOf(path);
    if (!parentPath) return undefined;
    // Guard: if parentPath looks like drive letter ('C:'), do not create placeholder — treat as root boundary.
    if (/^[A-Za-z]:$/.test(parentPath)) return undefined;
    if (!this.nodes.has(parentPath)) {
      const grand = this.ensureParents(parentPath, depth - 1, addedCollector);
      const ph = this.createPlaceholder(parentPath, depth - 1, grand);
      if (addedCollector) addedCollector.push(ph);
    }
    return parentPath;
  }

  /** Apply a batch of ScanNode deltas. */
  applyDelta(deltas: ScanNode[]): ApplyDeltaResult {
    const added: GraphNode[] = [];
    const updated: GraphNode[] = [];
    const placeholderHydrated: GraphNode[] = [];
    for (const n of deltas) {
      const existing = this.nodes.get(n.path);
      if (!existing) {
        const parentPath = this.ensureParents(n.path, n.depth, added);
        const g: GraphNode = {
          path: n.path,
          name: n.name,
          kind: n.kind,
          depth: n.depth,
          parentPath,
          children: [],
          sizeBytes: n.sizeBytes,
          mtimeMs: n.mtimeMs,
          error: n.error,
        };
        this.nodes.set(n.path, g);
        added.push(g);
        if (parentPath) {
          const parent = this.nodes.get(parentPath);
          if (parent && !parent.children.includes(n.path)) parent.children.push(n.path);
        }
      } else {
        let changed = false;
        if (existing.isPlaceholder) {
          existing.isPlaceholder = false;
          existing.name = n.name;
          existing.kind = n.kind;
          placeholderHydrated.push(existing);
          changed = true;
        }
        if (n.sizeBytes !== undefined && n.sizeBytes !== existing.sizeBytes) {
          existing.sizeBytes = n.sizeBytes;
          changed = true;
        }
        if (n.mtimeMs !== undefined && n.mtimeMs !== existing.mtimeMs) {
          existing.mtimeMs = n.mtimeMs;
          changed = true;
        }
        if (n.error && n.error !== existing.error) {
          existing.error = n.error;
          changed = true;
        }
        if (changed) updated.push(existing);
      }
    }
    return { added, updated, placeholderHydrated };
  }

  /** INTERNAL DEV: surface minimal snapshot used when diagnosing empty layout. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __debugSnapshot(): any {
    const roots: string[] = [];
    for (const n of this.nodes.values()) if (!n.parentPath) roots.push(n.path);
    return { size: this.nodes.size, roots: roots.slice(0, 5), rootCount: roots.length };
  }
}

export function createGraphAdapter(): GraphAdapter {
  return new GraphAdapter();
}
