import type { Bounds } from './types';

export interface LayoutEntry {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface BoundsCalculator {
  computeBounds: (layoutIndex: Map<string, LayoutEntry>) => Bounds | null;
}

/**
 * Calculates the bounding box for all nodes in the layout
 * @param layoutIndex Map of path to layout coordinates
 * @returns Bounds object or null if no nodes
 */
export function computeBounds(layoutIndex: Map<string, LayoutEntry>): Bounds | null {
  if (!layoutIndex || layoutIndex.size === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  let hasValidCoordinates = false;

  for (const [, entry] of layoutIndex) {
    // Only process entries with valid, finite coordinates
    if (Number.isFinite(entry.x) && Number.isFinite(entry.y)) {
      if (entry.x < minX) minX = entry.x;
      if (entry.y < minY) minY = entry.y;
      if (entry.x > maxX) maxX = entry.x;
      if (entry.y > maxY) maxY = entry.y;
      hasValidCoordinates = true;
    }
  }

  // Return null if no valid coordinates found, preventing non-finite bounds
  if (
    !hasValidCoordinates ||
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Creates a bounds calculator instance
 * @returns BoundsCalculator with computeBounds method
 */
export function createBoundsCalculator(): BoundsCalculator {
  return {
    computeBounds,
  };
}
