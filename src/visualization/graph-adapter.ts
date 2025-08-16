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
  getNode(path: string): GraphNode | undefined { return this.nodes.get(path); }
  /** All nodes snapshot (avoid in hot paths). */
  getAllNodes(): GraphNode[] { return Array.from(this.nodes.values()); }
  /** Count. */
  size(): number { return this.nodes.size; }

  /** Derive parent absolute path; returns undefined for root or invalid. */
  private static parentPathOf(p: string): string | undefined {
    if (!p) return undefined;
    const norm = p.replace(/\\+/g, '/');
    const idx = norm.lastIndexOf('/');
    if (idx <= 0) return undefined; // treat drive root like C:/ (no parent tracked)
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
  private ensureParents(path: string, depth: number, addedCollector?: GraphNode[]): string | undefined {
    const parentPath = GraphAdapter.parentPathOf(path);
    if (!parentPath) return undefined;
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
        if (n.sizeBytes !== undefined && n.sizeBytes !== existing.sizeBytes) { existing.sizeBytes = n.sizeBytes; changed = true; }
        if (n.mtimeMs !== undefined && n.mtimeMs !== existing.mtimeMs) { existing.mtimeMs = n.mtimeMs; changed = true; }
        if (n.error && n.error !== existing.error) { existing.error = n.error; changed = true; }
        if (changed) updated.push(existing);
      }
    }
    return { added, updated, placeholderHydrated };
  }
}

export function createGraphAdapter(): GraphAdapter { return new GraphAdapter(); }
