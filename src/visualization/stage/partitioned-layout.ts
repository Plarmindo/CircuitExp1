/**
 * PERF-2 Partitioned Layout (Scaffold)
 * ------------------------------------
 * Goal: Recompute layout only for dirty subtrees instead of full traversal.
 * CURRENT STATUS: Algorithm not yet implemented (always returns null) but
 * instrumentation + guard analysis scaffolding are provided so we can iterate
 * without touching main redraw logic repeatedly.
 *
 * Strategy (planned):
 * 1. Collect minimal set of ancestor roots for all dirty node paths.
 * 2. If more than one top-level (root depth) group or if any dirty ancestor
 *    changes sibling counts before its siblings (ordering impact), abort.
 * 3. For a single affected subtree (all dirty nodes share an ancestor A and
 *    no siblings to the right depend on its node-count width change) we
 *    recompute that subtree in isolation using a local cursor model while
 *    preserving global x offsets for unaffected nodes.
 * 4. Merge new subtree node coordinates with previous layout arrays, updating
 *    nodeIndex; update global bbox by diffing replaced ranges.
 *
 * NOTE: The current v2 layout allocates x using a global cursor across a DFS
 * order. This makes true isolated recompute non-trivial because subtree width
 * (node visit count) affects subsequent siblings' x positions. To safely apply
 * a partitioned recompute we must guarantee subtree visit cardinality is
 * unchanged OR the subtree is the right-most (tail) among siblings so shifts do
 * not cascade into later siblings. Initial implementation will therefore ONLY
 * attempt partitioning when the dirty subtree is a tail subtree and only adds
 * or updates occur within it that do not change total node count outside the
 * subtree root's descendant set.
 *
 * FUTURE: A revised layout algorithm that assigns local indices within sibling
 * groups (instead of a single global cursor) will enable more flexible partial
 * recomputes. That redesign is outside this first PERF-2 iteration.
 */
import type { LayoutPointV2 } from '../layout-v2';
import type { GraphAdapter, GraphNode } from '../graph-adapter';
import { siblingComparator } from '../id-sorting';

export interface PartitionAttemptContext {
  reason?: string;
  dirtyRoots?: string[];
  tailSubtree?: boolean;
  subtreeNodeCount?: number;
  subtreeOriginalCount?: number;
}

export interface PartitionParams {
  adapter: GraphAdapter;
  previousNodes: LayoutPointV2[];
  previousIndex: Map<string, LayoutPointV2>;
  dirtyPaths: string[]; // absolute paths of nodes whose metadata/children changed
  options: { aggregationThreshold: number }; // future additional layout opts
  debug?: (stage: string, ctx?: Record<string, unknown>) => void;
}

export interface PartitionResult {
  nodes: LayoutPointV2[]; // merged final list (reused array or shallow copy)
  index: Map<string, LayoutPointV2>;
  attempt: PartitionAttemptContext & { applied: boolean };
}

/**
 * Attempt partitioned (subtree) recompute. Returns null when conditions are not met.
 * CURRENT: Always returns null after emitting diagnostic (scaffold only).
 */
export function tryPartitionedLayout(params: PartitionParams): PartitionResult | null {
  const { dirtyPaths, debug, adapter, previousIndex, previousNodes, options } = params;
  if (!dirtyPaths.length) return null;

  // Helper: deepest common ancestor (simple path prefix intersection).
  const norm = (p: string) => p.replace(/\\+/g, '/');
  const partsArr = dirtyPaths.map(p => norm(p).split('/').filter(Boolean));
  const ancestorParts: string[] = [];
  for (let i = 0; ; i++) {
    const seg = partsArr[0][i];
    if (seg === undefined) break;
    if (partsArr.every(a => a[i] === seg)) ancestorParts.push(seg); else break;
  }
  if (!ancestorParts.length) {
    debug?.('partition:skip:multi-root', { dirty: dirtyPaths.length });
    return null;
  }
  const ancestorPath = '/' + ancestorParts.join('/');
  const rootNode = adapter.getNode(ancestorPath);
  if (!rootNode) {
    debug?.('partition:skip:no-root-node', { ancestorPath });
    return null;
  }
  const rootLayout = previousIndex.get(ancestorPath);
  if (!rootLayout) {
    debug?.('partition:skip:not-in-previous-layout', { ancestorPath });
    return null;
  }

  // Ensure all dirty paths are under this subtree (excluding possibly the root itself)
  const prefix = ancestorPath + '/';
  const allWithin = dirtyPaths.every(p => p === ancestorPath || p.startsWith(prefix));
  if (!allWithin) {
    debug?.('partition:skip:outside-subtree', { ancestorPath });
    return null;
  }

  const ancestorPrefix = ancestorPath + '/';

  // Collect dirty node objects
  const allDirtyNodes = dirtyPaths.map(p => adapter.getNode(p)).filter(Boolean) as GraphNode[];
  const pureMeta = allDirtyNodes.length === dirtyPaths.length && allDirtyNodes.every(n => n.children.length === 0);

  // If pure metadata (leaf) updates only, we can bypass tail requirement provided subtree structural width is unchanged.
  if (pureMeta) {
    // Compare descendant counts prev vs current
    const prevDescCount = previousNodes.filter(n => n.path.startsWith(ancestorPrefix) && n.path !== ancestorPath).length;
    const currentDescCount = adapter.getAllNodes().filter(n => n.path.startsWith(ancestorPrefix) && n.path !== ancestorPath).length;
    if (prevDescCount === currentDescCount) {
      debug?.('partition:applied:meta-only', { ancestorPath, dirty: dirtyPaths.length });
      const attempt: PartitionAttemptContext & { applied: boolean } = {
        applied: true,
        dirtyRoots: [ancestorPath],
        tailSubtree: false, // not necessarily tail; safe due to unchanged width
        subtreeOriginalCount: prevDescCount,
        subtreeNodeCount: currentDescCount,
      };
      const newIndex = new Map(previousIndex); // shallow clone for potential external mutation safety
      return { nodes: previousNodes, index: newIndex, attempt };
    } else {
      debug?.('partition:meta-only-width-changed-bail', { ancestorPath, prevDescCount, currentDescCount });
      // fall through to normal tail-subtree guarded path
    }
  }

  // Tail subtree requirement: root must be the last among its siblings (or be a sole / top-level tail).
  const parentPath = rootNode.parentPath;
  if (parentPath) {
    const parent = adapter.getNode(parentPath);
    if (!parent) { debug?.('partition:skip:no-parent'); return null; }
    const siblings: GraphNode[] = parent.children.map(c => adapter.getNode(c)!).filter(Boolean);
    siblings.sort(siblingComparator);
    const last = siblings[siblings.length - 1];
    if (!last || last.path !== rootNode.path) {
      debug?.('partition:skip:not-tail', { ancestorPath });
      return null;
    }
  } else {
    // Top-level: ensure it is last among top-level roots
    const roots = adapter.getAllNodes().filter(n => !n.parentPath).sort(siblingComparator);
    const lastRoot = roots[roots.length - 1];
    if (!lastRoot || lastRoot.path !== rootNode.path) {
      debug?.('partition:skip:not-tail-root', { ancestorPath });
      return null;
    }
  }

  // Bail if any aggregated set would be required inside subtree (we don't handle synthetic regeneration here yet).
  const aggregationThreshold = options.aggregationThreshold;
  const subtreeNodes = adapter.getAllNodes().filter(n => n.path === ancestorPath || n.path.startsWith(prefix));
  // quick sibling count scan
  for (const n of subtreeNodes) {
    if (n.children.length > aggregationThreshold) {
      debug?.('partition:skip:aggregation-needed', { node: n.path, children: n.children.length });
      return null;
    }
  }

  // Optimization: If all dirty paths are leaf file nodes (no children) and no child set sizes changed
  // we can treat this as a pure metadata update. Coordinates remain valid; we only rebuild index entries
  // (which are identical) and mark attempt applied with zero structural changes.
  // (pureMeta already handled earlier)

  // Recompute subtree (excluding the root itself) using a local DFS replicating spacing logic.
  let cursor = (rootLayout.__cursor ?? 0) + 1; // start AFTER root's cursor
  const newDescPoints: LayoutPointV2[] = [];

  const horizontalSpacing = 140; // mirror defaults (could be parametrised later)
  const verticalSpacing = 90;
  const spacingThreshold = 6;
  const spacingGrowthRate = 0.5;
  const maxSpacingFactor = 3;

  const placeChildren = (parent: GraphNode) => {
    if (!parent.children.length) return;
    const childNodes: GraphNode[] = parent.children.map(c => adapter.getNode(c)!).filter(Boolean);
    childNodes.sort(siblingComparator);
    const count = childNodes.length;
    let effSpacing = horizontalSpacing;
    if (count > spacingThreshold) {
      const factor = 1 + ((count - spacingThreshold) / spacingThreshold) * spacingGrowthRate;
      effSpacing = horizontalSpacing * Math.min(maxSpacingFactor, factor);
    }
    for (const c of childNodes) {
      const lp: LayoutPointV2 = {
        path: c.path,
        x: cursor * effSpacing,
        y: c.depth * verticalSpacing,
        depth: c.depth,
        parentPath: c.parentPath,
        __cursor: cursor,
        __effSpacing: effSpacing,
      };
      newDescPoints.push(lp);
      cursor++;
      placeChildren(c);
    }
  };
  placeChildren(rootNode);

  // Merge into previous arrays (remove old descendants first)
  const newNodesArray: LayoutPointV2[] = [];
  for (const n of previousNodes) {
    if (n.path === ancestorPath) newNodesArray.push(n); // keep root
    else if (!n.path.startsWith(ancestorPrefix)) newNodesArray.push(n); // keep unaffected
    // else skip (old descendant removed)
  }
  // Append new descendants
  for (const np of newDescPoints) newNodesArray.push(np);

  // Rebuild index map (clone previous then overwrite descendant entries)
  const newIndex = new Map(previousIndex);
  for (const n of previousNodes) { if (n.path.startsWith(ancestorPrefix) && n.path !== ancestorPath) newIndex.delete(n.path); }
  for (const np of newDescPoints) newIndex.set(np.path, np);

  const attempt: PartitionAttemptContext & { applied: boolean } = {
    applied: true,
    dirtyRoots: [ancestorPath],
    tailSubtree: true,
    subtreeOriginalCount: previousNodes.filter(n => n.path.startsWith(ancestorPrefix)).length - 1,
    subtreeNodeCount: newDescPoints.length,
  };
  debug?.('partition:applied', { ancestorPath, added: newDescPoints.length });
  return { nodes: newNodesArray, index: newIndex, attempt };
}
