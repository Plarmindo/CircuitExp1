/**
 * Directional navigation helpers (VIS-16).
 * Pure functions so we can unit test without Pixi/DOM.
 */

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface NavNodeEntry {
  path: string;
  x: number;
  y: number;
  aggregated?: boolean;
}

/**
 * Returns the next node in the given direction from currentPath applying:
 * - Candidate must lie in forward half-plane (dot > 0).
 * - Angular window: vector angle to direction <= 45° (cos >= ~0.7071).
 * - Chooses smallest distance; tie broken by smaller angle then lexical path.
 */
export function findNextDirectional(
  currentPath: string | null,
  direction: NavDirection,
  entries: NavNodeEntry[]
): string | null {
  if (!entries.length) return null;
  const dirVec =
    direction === 'up'
      ? { x: 0, y: -1 }
      : direction === 'down'
        ? { x: 0, y: 1 }
        : direction === 'left'
          ? { x: -1, y: 0 }
          : { x: 1, y: 0 };
  let origin: NavNodeEntry | null = null;
  if (currentPath) origin = entries.find((e) => e.path === currentPath) || null;
  if (!origin) {
    // Default: pick first non-aggregated else first.
    const firstNonAgg = entries.find((e) => !e.aggregated);
    return firstNonAgg ? firstNonAgg.path : entries[0].path;
  }
  const cosThreshold = Math.SQRT1_2; // cos 45° ≈ 0.7071
  let best: { path: string; dist: number; cos: number } | null = null;
  for (const e of entries) {
    if (e.path === origin.path) continue;
    const vx = e.x - origin.x;
    const vy = e.y - origin.y;
    const distSq = vx * vx + vy * vy;
    if (distSq === 0) continue;
    const len = Math.sqrt(distSq);
    const cos = (vx * dirVec.x + vy * dirVec.y) / len;
    if (cos <= 0) continue; // wrong half-plane
    if (cos < cosThreshold) continue; // outside angular window
    const dist = len;
    if (
      !best ||
      dist < best.dist - 1e-6 ||
      (Math.abs(dist - best.dist) < 1e-6 &&
        (cos > best.cos + 1e-6 || (Math.abs(cos - best.cos) < 1e-6 && e.path < best.path)))
    ) {
      best = { path: e.path, dist, cos };
    }
  }
  return best ? best.path : origin.path; // stay if none found
}
