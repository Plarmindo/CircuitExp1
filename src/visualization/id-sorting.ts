/**
 * Station ID & Sibling Sorting Strategy (Checklist Item 2)
 * -------------------------------------------------------
 * Deterministic station IDs are derived from the absolute path using a stable
 * non-cryptographic hash (FNV-1a 32-bit) encoded in base36 for compactness.
 * This guarantees:
 *  - Same path => same id across sessions.
 *  - Different paths => extremely low collision probability for UI purposes.
 *
 * Sibling ordering rule:
 *  - Primary: alphabetical ascending by name (case-insensitive).
 *  - Secondary tie-breaker: by sizeBytes descending if both defined.
 *  - Final tie-breaker: by stationId to ensure total order stability.
 *
 * Rationale: Alphabetical gives user predictable grouping; size tie-break gives
 * clustering of larger files when names equal; stationId provides deterministic
 * fallback avoiding engine-dependent sort instability.
 */

import type { GraphNode } from './graph-adapter';

// FNV-1a 32-bit hash
export function hashPathToId(path: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Convert to unsigned and base36
  return (h >>> 0).toString(36);
}

export function assignStationId(node: GraphNode): void {
  // @ts-expect-error augment dynamic field (not in interface yet at import time to avoid circular)
  if (!node.stationId) node.stationId = hashPathToId(node.path);
}

export function siblingComparator(a: GraphNode, b: GraphNode): number {
  const an = a.name.toLowerCase();
  const bn = b.name.toLowerCase();
  if (an < bn) return -1;
  if (an > bn) return 1;
  if (a.sizeBytes !== undefined && b.sizeBytes !== undefined && a.sizeBytes !== b.sizeBytes) {
    return b.sizeBytes - a.sizeBytes; // larger first
  }
  // @ts-expect-error dynamic field added by assignStationId
  const aid = a.stationId as string;
  // @ts-expect-error dynamic field added by assignStationId
  const bid = b.stationId as string;
  if (aid < bid) return -1;
  if (aid > bid) return 1;
  return 0;
}

export function sortChildrenInPlace(nodes: GraphNode[]): string[] {
  const resolved = nodes;
  resolved.sort(siblingComparator);
  return resolved.map((n) => n.path);
}
