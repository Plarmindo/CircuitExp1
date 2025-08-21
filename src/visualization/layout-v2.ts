/**
 * Layout Engine v2 (VIS series)
 * =============================
 * Deterministic hierarchical (top‑down) layout that augments v1 with adaptive horizontal
 * spacing and sibling aggregation. It produces a stable (order‑independent except for
 * explicit sibling sort) set of (x,y,depth) coordinates for all visible (real + synthetic) nodes.
 *
 * Core Features
 * 1. Adaptive horizontal spacing once a sibling set grows beyond a threshold.
 * 2. Aggregation / clustering of very wide sibling sets into a single synthetic expandable node.
 * 3. Deterministic hashing for synthetic aggregation node path ids (stable across runs / deltas).
 *
 * Complexity & Performance
 * - Each node is visited exactly once => O(n) traversal work.
 * - For every sibling set we sort: O(s * log s). Let k = max sibling set size actually laid out.
 *   Worst case: O(n log k). (If many large sibling sets exist this dominates.)
 * - Aggregated sets short‑circuit recursion for hidden children lowering effective cost.
 *
 * Adaptive Spacing Formula
 * Let:
 *   base = horizontalSpacing
 *   t = spacingThreshold
 *   g = spacingGrowthRate
 *   m = maxSpacingFactor
 *   s = siblingCount
 * If s <= t: effectiveSpacing = base
 * Else:      effectiveSpacing = base * min( m, 1 + ((s - t) / t) * g )
 * This linear growth (clamped by m) prevents extreme overlap while avoiding exponential expansion.
 *
 * Aggregation Semantics
 * - Trigger: s > aggregationThreshold (o.aggregationThreshold)
 * - Replacement: one synthetic node with flags { aggregated:true, aggregatedCount, aggregatedChildrenPaths[] }
 * - Synthetic path format: parentPath + '/*__agg__' + hash(count + firstChildPath)
 * - Expansion (handled externally by MetroStage via expandedAggregations set) optionally lays out real children immediately after the synthetic placeholder maintaining order stability.
 *
 * Limitations (CURRENT)
 * - No edge crossing minimization: purely orders siblings by stable comparator, so long horizontal runs may cross visually when rendered with routing (handled later by orthogonal routing in `metro-stage.tsx`).
 * - No force / physics refinement: overlapping large subtrees are not automatically repelled.
 * - Global left‑to‑right cursor; wide early sibling sets push later columns (no re‑centering of parents after adaptive expansion).
 * - Aggregated synthetic node occupies single horizontal slot regardless of hidden children width distribution.
 * - Vertical spacing fixed (no adaptive density vertical compaction yet).
 *
 * Planned / Future Enhancements
 * - Subtree incremental recompute (dirty partition) to avoid full traversal (see PERF items).
 * - Overlap / lateral jitter mitigation for dense sibling clusters (VIS-23 follow‑up).
 * - Label collision avoidance & lane reservation.
 * - Optional edge routing pre‑pass to reserve orthogonal channels.
 *
 * Culling & LOD Rationale Link
 * - Downstream rendering may hide (cull) nodes whose projected radius < threshold (VIS-13) – this layout deliberately does not pre‑cull; it supplies full coordinates then stage decides visibility. See `metro-stage.tsx` (culling logic lines ~700+ in current version) for rationale & reuse metrics.
 *
 * Determinism Guarantees
 * - Given identical adapter state + options the result (ordering, coordinates, synthetic ids) is stable.
 * - Hash function for synthetic paths uses child path seed to avoid collisions across sibling sets.
 *
 * @param adapter GraphAdapter providing hierarchical nodes (must have stable children arrays).
 * @param opts LayoutOptionsV2 overriding defaults (spacing, aggregation, expansion state).
 * @returns {LayoutResultV2} positioned nodes + bounding box + index map.
 */
import { GraphAdapter } from './graph-adapter';
import type { GraphNode } from './graph-adapter';
import { assignStationId, siblingComparator, hashPathToId } from './id-sorting';

export interface LayoutPointV2 {
  path: string;
  x: number;
  y: number;
  depth: number;
  aggregated?: boolean;
  aggregatedCount?: number;
  aggregatedChildrenPaths?: string[];
  aggregatedExpanded?: boolean;
  /** internal: global cursor column */ __cursor?: number;
  /** internal: effective spacing of its sibling set */ __effSpacing?: number;
  /** parent path (explicit so incremental path doesn't need adapter lookup) */ parentPath?: string;
}
export interface LayoutBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}
export interface LayoutResultV2 {
  nodes: LayoutPointV2[];
  bbox: LayoutBBox;
  nodeIndex: Map<string, LayoutPointV2>;
}

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
  aggregationThreshold: 200, // increased default to ensure small trees are fully expanded by default (avoid early aggregation hiding nodes)
  expandedAggregations: new Set<string>(),
};

export function layoutHierarchicalV2(
  adapter: GraphAdapter,
  opts: LayoutOptionsV2 = {}
): LayoutResultV2 {
  const o = { ...DEFAULTS, ...opts };
  const all = adapter.getAllNodes();
  const roots = all.filter((n) => !n.parentPath).sort(siblingComparator);
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
      const syntheticPath =
        (parentPath || '') + '/*__agg__' + hashPathToId(String(count) + nodes[0].path);
      const y = (depthAdjusted ? first.depth : first.depth) * o.verticalSpacing; // depth consistent
      const expanded = !!o.expandedAggregations && o.expandedAggregations.has(syntheticPath);
      const lp: LayoutPointV2 = {
        path: syntheticPath,
        x: cursor * effSpacing,
        y,
        depth: first.depth,
        aggregated: true,
        aggregatedCount: count,
        aggregatedChildrenPaths: nodes.map((n) => n.path),
        aggregatedExpanded: expanded,
        __cursor: cursor,
        __effSpacing: effSpacing,
        parentPath: parentPath || undefined,
      };
      placed.push(lp);
      nodeIndex.set(lp.path, lp);
      cursor++;
      if (expanded) {
        // When expanded we still place children (toggle visibility strategy)
        // Children consume subsequent cursor slots with same horizontal spacing context
        for (const n of nodes) {
          assignStationId(n);
          const childLp: LayoutPointV2 = {
            path: n.path,
            x: cursor * effSpacing,
            y: n.depth * o.verticalSpacing,
            depth: n.depth,
            __cursor: cursor,
            __effSpacing: effSpacing,
            parentPath: n.parentPath,
          };
          placed.push(childLp);
          nodeIndex.set(n.path, childLp);
          cursor++;
          if (n.children.length) {
            const childNodes = n.children.map((p) => adapter.getNode(p)!).filter(Boolean);
            placeNodeSet(childNodes);
          }
        }
      }
      return; // aggregated branch handled
    }
    for (const n of nodes) {
      assignStationId(n);
      const lp: LayoutPointV2 = {
        path: n.path,
        x: cursor * effSpacing,
        y: n.depth * o.verticalSpacing,
        depth: n.depth,
        __cursor: cursor,
        __effSpacing: effSpacing,
        parentPath: n.parentPath,
      };
      placed.push(lp);
      nodeIndex.set(n.path, lp);
      cursor++;
      // Recurse children set
      if (n.children.length) {
        const childNodes = n.children.map((p) => adapter.getNode(p)!).filter(Boolean);
        placeNodeSet(childNodes);
      }
    }
  };

  placeNodeSet(roots);

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
    width: maxX - minX + o.horizontalSpacing,
    height: maxY - minY + o.verticalSpacing,
  };
  return { nodes: placed, bbox, nodeIndex };
}
