/**
 * Layout Engine v2 (Checklist Item 4)
 * -----------------------------------
 * Extends v1 hierarchical deterministic layout with:
 * 1. Dynamic horizontal spacing when sibling count exceeds spacingThreshold.
 * 2. Aggregation: if sibling count > aggregationThreshold we collapse them into
 *    a single aggregated placeholder node that is expandable later (future UI).
 *
 * Spacing Logic:
 *  - Base horizontalSpacing (default 140).
 *  - If siblings > spacingThreshold: effectiveSpacing = base * min(maxSpacingFactor,
 *    1 + (siblings - spacingThreshold) / spacingThreshold * spacingGrowthRate)
 *  - This spreads wide clusters without recomputing parent centering.
 *
 * Aggregation Logic:
 *  - If siblings > aggregationThreshold: create one synthetic node with:
 *      aggregated=true, aggregatedCount, aggregatedChildrenPaths[]
 *    Real children are NOT individually positioned (saves perf / clutter).
 *  - Synthetic path pattern: parentPath + '/*__agg__' + hash(count + firstChildPath)
 *  - Deterministic so repeated runs stable.
 *
 * Trade-offs Documented:
 *  - Loss of individual visibility of collapsed children; mitigated by future
 *    expand-on-click behavior (not implemented yet).
 *  - Aggregation sacrifices exact horizontal span; simplifies first pass.
 *
 * Complexity: O(n log k) where k is max siblings (sort cost) on non-aggregated sets.
 */
import { GraphAdapter } from './graph-adapter';
import type { GraphNode } from './graph-adapter';
import { assignStationId, siblingComparator, hashPathToId } from './id-sorting';

export interface LayoutPointV2 { path: string; x: number; y: number; depth: number; aggregated?: boolean; aggregatedCount?: number; aggregatedChildrenPaths?: string[]; aggregatedExpanded?: boolean; }
export interface LayoutBBox { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; }
export interface LayoutResultV2 { nodes: LayoutPointV2[]; bbox: LayoutBBox; nodeIndex: Map<string, LayoutPointV2>; }

export interface LayoutOptionsV2 {
  horizontalSpacing?: number;
  verticalSpacing?: number;
  spacingThreshold?: number; // start scaling spacing after this many siblings
  spacingGrowthRate?: number; // multiplier growth slope fraction
  maxSpacingFactor?: number; // cap on spacing growth
  aggregationThreshold?: number; // collapse siblings after this count
  expandedAggregations?: Set<string>; // synthetic aggregation node paths currently expanded (toggle visibility strategy)
}

const DEFAULTS: Required<LayoutOptionsV2> = {
  horizontalSpacing: 140,
  verticalSpacing: 90,
  spacingThreshold: 6,
  spacingGrowthRate: 0.5,
  maxSpacingFactor: 3,
  aggregationThreshold: 28,
};

export function layoutHierarchicalV2(adapter: GraphAdapter, opts: LayoutOptionsV2 = {}): LayoutResultV2 {
  const o = { ...DEFAULTS, ...opts };
  const all = adapter.getAllNodes();
  const roots = all.filter(n => !n.parentPath).sort(siblingComparator);
  const placed: LayoutPointV2[] = [];
  const nodeIndex = new Map<string, LayoutPointV2>();
  let cursor = 0;

  const placeNodeSet = (nodes: GraphNode[], depthAdjusted = false) => {
    nodes.sort(siblingComparator);
    const count = nodes.length;
    let effSpacing = o.horizontalSpacing;
    if (count > o.spacingThreshold) {
      const factor = 1 + ((count - o.spacingThreshold) / o.spacingThreshold) * o.spacingGrowthRate;
      effSpacing = o.horizontalSpacing * Math.min(o.maxSpacingFactor, factor);
    }
    // Aggregation check
    if (count > o.aggregationThreshold) {
      const first = nodes[0];
      const parentPath = first.parentPath; // all share same parent in this set
      const syntheticPath = (parentPath || '') + '/*__agg__' + hashPathToId(String(count) + nodes[0].path);
      const y = (depthAdjusted ? first.depth : first.depth) * o.verticalSpacing; // depth consistent
      const expanded = !!o.expandedAggregations && o.expandedAggregations.has(syntheticPath);
      const lp: LayoutPointV2 = {
        path: syntheticPath,
        x: cursor * effSpacing,
        y,
        depth: first.depth,
        aggregated: true,
        aggregatedCount: count,
        aggregatedChildrenPaths: nodes.map(n => n.path),
        aggregatedExpanded: expanded,
      };
      placed.push(lp); nodeIndex.set(lp.path, lp);
      cursor++;
      if (expanded) {
        // When expanded we still place children (toggle visibility strategy)
        // Children consume subsequent cursor slots with same horizontal spacing context
        for (const n of nodes) {
          assignStationId(n);
          const childLp: LayoutPointV2 = { path: n.path, x: cursor * effSpacing, y: n.depth * o.verticalSpacing, depth: n.depth };
            placed.push(childLp); nodeIndex.set(n.path, childLp); cursor++;
          if (n.children.length) {
            const childNodes = n.children.map(p => adapter.getNode(p)!).filter(Boolean);
            placeNodeSet(childNodes);
          }
        }
      }
      return; // aggregated branch handled
    }
    for (const n of nodes) {
      assignStationId(n);
      const lp: LayoutPointV2 = { path: n.path, x: cursor * effSpacing, y: n.depth * o.verticalSpacing, depth: n.depth };
      placed.push(lp); nodeIndex.set(n.path, lp); cursor++;
      // Recurse children set
      if (n.children.length) {
        const childNodes = n.children.map(p => adapter.getNode(p)!).filter(Boolean);
        placeNodeSet(childNodes);
      }
    }
  };

  placeNodeSet(roots);

  let minX = Infinity, maxX = -Infinity; const minY = 0; let maxY = -Infinity;
  for (const p of placed) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
  if (!placed.length) { minX = 0; maxX = 0; maxY = 0; }
  const bbox: LayoutBBox = { minX, minY, maxX, maxY, width: (maxX - minX) + o.horizontalSpacing, height: (maxY - minY) + o.verticalSpacing };
  return { nodes: placed, bbox, nodeIndex };
}
