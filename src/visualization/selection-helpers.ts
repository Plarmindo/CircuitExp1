/**
 * Selection helpers for aggregation expand/collapse (VIS-10B support).
 * Pure logic so we can unit test without Pixi/React.
 */

export interface AggregationToggleInput {
  aggregatedPath: string;
  childPaths: string[];
  expandedBefore: boolean;
  currentSelection: string | null;
}

export interface AggregationToggleResult {
  expandedAfter: boolean;
  newSelection: string | null;
  selectionChanged: boolean;
}

/**
 * Rules (derived from checklist VIS-10B):
 * - Expanding an aggregation keeps existing selection if still visible.
 * - Collapsing: if a selected child becomes hidden, selection is cleared (null), not replaced by aggregated node.
 * - Clicking an aggregated node when collapsed selects it (and expands if user toggles again).
 * - Clicking aggregated node when expanded collapses it; selection cleared if a child was selected; aggregated selection stays.
 */
export function toggleAggregation(input: AggregationToggleInput): AggregationToggleResult {
  const { aggregatedPath, childPaths, expandedBefore, currentSelection } = input;
  const expandedAfter = !expandedBefore;
  let newSelection = currentSelection;

  if (expandedBefore) {
    // Collapsing -> if a child was selected, clear selection.
    if (currentSelection && childPaths.includes(currentSelection)) {
      newSelection = null;
    }
    // Keep aggregated selection if it was selected.
  } else {
    // Expanding: keep selection as-is; if none selected, select aggregated for discoverability
    if (!currentSelection) newSelection = aggregatedPath;
  }
  return { expandedAfter, newSelection, selectionChanged: newSelection !== currentSelection };
}
