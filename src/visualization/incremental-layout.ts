/**
 * Incremental layout helpers (PERF-1 groundwork)
 * ---------------------------------------------
 * Narrow optimization: append-only addition of new leaf nodes (no children yet) under a parent
 * whose subtree currently ends at the end of the global layout order. In that case the original
 * layout algorithm would have placed the new siblings at the end of the global node list without
 * affecting any existing node's (x,y) coordinate. We can therefore synthesize coordinates for the
 * new nodes without traversing the whole graph.
 *
 * Limitations:
 * - Does NOT handle insertions in the middle (would require shifting subsequent nodes since the
 *   current layout algorithm derives x from a global cursor).
 * - Falls back (returns null) if aggregation threshold would be crossed, spacing factor would
 *   change, or if parent subtree is not already the global tail.
 * - Only supports nodes with no children yet (new scan entries); if a new directory already has
 *   children in the same batch we bail out.
 */
import { GraphAdapter } from './graph-adapter';
import type { LayoutPointV2 } from './layout-v2';
import { siblingComparator } from './id-sorting';

export interface IncrementalAppendInput {
  adapter: GraphAdapter;
  addedPaths: string[]; // paths reported by adapter.applyDelta
  parentPath: string; // common parent path
  previousNodes: LayoutPointV2[]; // last full layout ordered list
  previousIndex: Map<string, LayoutPointV2>;
  options: {
    horizontalSpacing: number;
    spacingThreshold: number;
    spacingGrowthRate: number;
    maxSpacingFactor: number;
    aggregationThreshold: number;
    verticalSpacing: number;
  };
  /** Optional debug tap to trace decision & bail out reasons (PERF-1 instrumentation). */
  debug?: (stage: string, ctx?: Record<string, unknown>) => void;
}

export interface IncrementalAppendResult {
  nodes: LayoutPointV2[]; // new full ordered list (previous + appended)
  index: Map<string, LayoutPointV2>;
  appended: LayoutPointV2[];
}

function effectiveSpacing(
  count: number,
  base: number,
  opts: IncrementalAppendInput['options']
): number {
  if (count <= opts.spacingThreshold) return base;
  const factor =
    1 + ((count - opts.spacingThreshold) / opts.spacingThreshold) * opts.spacingGrowthRate;
  return base * Math.min(opts.maxSpacingFactor, factor);
}

export function tryIncrementalAppend(
  input: IncrementalAppendInput
): IncrementalAppendResult | null {
  const { adapter, addedPaths, parentPath, previousNodes, previousIndex, options, debug } = input;
  debug?.('enter', { added: addedPaths.length, parentPath, prevCount: previousNodes.length });
  if (!addedPaths.length) {
    debug?.('bail:no-added-paths');
    return null;
  }
  // Verify all added share same parent & are leaf nodes (no children yet)
  const parentNode = parentPath ? adapter.getNode(parentPath) : undefined;
  if (parentPath && !parentNode) {
    debug?.('bail:missing-parent', { parentPath });
    return null;
  }
  for (const p of addedPaths) {
    const n = adapter.getNode(p);
    if (!n) {
      debug?.('bail:missing-node', { path: p });
      return null;
    }
    if (n.parentPath !== parentPath) {
      debug?.('bail:parent-mismatch', { path: p, expected: parentPath, actual: n.parentPath });
      return null;
    }
    if (n.children.length) {
      debug?.('bail:has-children', { path: p });
      return null;
    } // new node already has children -> bail
  }
  // Determine previous sibling set (before addition). We reconstruct by taking current children minus added.
  const allChildren = parentPath
    ? parentNode!.children.slice()
    : adapter
        .getAllNodes()
        .filter((n) => !n.parentPath)
        .map((n) => n.path);
  const addedSet = new Set(addedPaths);
  const prevSiblingPaths = allChildren.filter((p) => !addedSet.has(p));
  // Determine if parent subtree ended the global list previously -> find parent index and forward scan.
  let subtreeTailOk = false;
  if (parentPath) {
    const parentLayoutPoint = previousIndex.get(parentPath);
    if (!parentLayoutPoint) {
      debug?.('bail:parent-not-in-previous-layout', { parentPath });
      return null;
    }
    const parentIndex = previousNodes.findIndex((n) => n.path === parentPath);
    if (parentIndex === -1) {
      debug?.('bail:parent-index-negative', { parentPath });
      return null;
    }
    const parentDepth = parentLayoutPoint.depth;
    let subtreeEnd = parentIndex;
    for (let i = parentIndex + 1; i < previousNodes.length; i++) {
      const d = previousNodes[i].depth;
      if (d <= parentDepth) {
        break;
      }
      subtreeEnd = i;
    }
    subtreeTailOk = subtreeEnd === previousNodes.length - 1;
  } else {
    // Root case: ensure last existing node is depth 0 (so new root siblings would append at tail)
    const last = previousNodes[previousNodes.length - 1];
    subtreeTailOk = last.depth === 0;
  }
  if (!subtreeTailOk) {
    debug?.('bail:not-tail-subtree', { parentPath });
    return null;
  }
  const newTotal = prevSiblingPaths.length + addedPaths.length;
  if (newTotal > options.aggregationThreshold) {
    debug?.('bail:aggregation-threshold', { newTotal, threshold: options.aggregationThreshold });
    return null;
  } // would aggregate -> must full recompute
  const spacingBefore = effectiveSpacing(
    prevSiblingPaths.length,
    options.horizontalSpacing,
    options
  );
  const spacingAfter = effectiveSpacing(newTotal, options.horizontalSpacing, options);
  if (spacingBefore !== spacingAfter) {
    debug?.('bail:spacing-shift', { before: spacingBefore, after: spacingAfter });
    return null;
  } // spacing shift would reposition existing siblings
  // Sort siblings to ensure comparator order maintained and new nodes appended
  const sortedPrev = prevSiblingPaths
    .slice()
    .sort((a, b) => siblingComparator(adapter.getNode(a)!, adapter.getNode(b)!));
  const sortedAdded = addedPaths
    .slice()
    .sort((a, b) => siblingComparator(adapter.getNode(a)!, adapter.getNode(b)!));
  const lastPrev = sortedPrev.length ? sortedPrev[sortedPrev.length - 1] : null;
  if (lastPrev) {
    const lastNode = adapter.getNode(lastPrev)!;
    for (const ap of sortedAdded) {
      const an = adapter.getNode(ap)!;
      if (siblingComparator(lastNode, an) > 0) {
        debug?.('bail:ordering-would-insert', { lastPrev, offending: ap });
        return null;
      } // needs insertion
    }
  }
  const lastGlobal = previousNodes[previousNodes.length - 1];
  const effSpacing = spacingBefore; // unchanged
  const nextCursor = Math.round(lastGlobal.x / effSpacing) + 1;
  const appended: LayoutPointV2[] = [];
  let cursor = nextCursor;
  for (const ap of sortedAdded) {
    const node = adapter.getNode(ap)!;
    const lp: LayoutPointV2 = {
      path: ap,
      x: cursor * effSpacing,
      y: node.depth * options.verticalSpacing,
      depth: node.depth,
    };
    appended.push(lp);
    cursor++;
  }
  const newIndex = new Map(previousIndex);
  for (const lp of appended) newIndex.set(lp.path, lp);
  debug?.('success', { appended: appended.length });
  return { nodes: previousNodes.concat(appended), index: newIndex, appended };
}
