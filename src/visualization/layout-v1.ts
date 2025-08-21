/**
 * Layout Engine v1 (Checklist Item 3)
 * -----------------------------------
 * Deterministic hierarchical layout assigning (x,y) coordinates:
 *  - y = depth * verticalSpacing.
 *  - x = global traversal index * horizontalSpacing (pre-order, sibling order via siblingComparator).
 * This is intentionally simple and stable; no attempts at centering parents above child spans yet.
 * Complexity: O(n log k) where k is max siblings due to per-level sort (comparator is stable).
 */
import { GraphAdapter } from './graph-adapter';
import type { GraphNode } from './graph-adapter';
import { assignStationId, siblingComparator } from './id-sorting';

export interface LayoutPoint {
  path: string;
  x: number;
  y: number;
  depth: number;
}
export interface LayoutBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}
export interface LayoutResult {
  nodes: LayoutPoint[];
  bbox: LayoutBBox;
  nodeIndex: Map<string, LayoutPoint>;
}

export interface LayoutOptionsV1 {
  horizontalSpacing?: number;
  verticalSpacing?: number;
}
const DEFAULTS: Required<LayoutOptionsV1> = { horizontalSpacing: 140, verticalSpacing: 90 };

export function layoutHierarchical(
  adapter: GraphAdapter,
  opts: LayoutOptionsV1 = {}
): LayoutResult {
  const { horizontalSpacing, verticalSpacing } = { ...DEFAULTS, ...opts };
  const all = adapter.getAllNodes();
  // Identify roots (no parentPath)
  const roots = all.filter((n) => !n.parentPath).sort(siblingComparator);
  const placed: LayoutPoint[] = [];
  const nodeIndex = new Map<string, LayoutPoint>();
  let cursor = 0; // global ordering for x axis

  const placeNode = (node: GraphNode) => {
    assignStationId(node);
    const x = cursor * horizontalSpacing;
    const y = node.depth * verticalSpacing;
    const lp: LayoutPoint = { path: node.path, x, y, depth: node.depth };
    placed.push(lp);
    nodeIndex.set(node.path, lp);
    cursor++;
    // children
    const children = node.children.map((p) => adapter.getNode(p)!).filter(Boolean);
    children.sort(siblingComparator);
    for (const ch of children) placeNode(ch);
  };

  for (const r of roots) placeNode(r);

  let minX = Infinity,
    maxX = -Infinity;
  const minY = 0;
  let maxY = -Infinity;
  for (const p of placed) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!placed.length) {
    minX = 0;
    maxX = 0;
    maxY = 0;
  }
  const bbox: LayoutBBox = {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + horizontalSpacing,
    height: maxY - minY + verticalSpacing,
  };
  return { nodes: placed, bbox, nodeIndex };
}
