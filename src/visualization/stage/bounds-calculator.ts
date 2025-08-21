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

  for (const [, entry] of layoutIndex) {
    if (entry.x < minX) minX = entry.x;
    if (entry.y < minY) minY = entry.y;
    if (entry.x > maxX) maxX = entry.x;
    if (entry.y > maxY) maxY = entry.y;
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