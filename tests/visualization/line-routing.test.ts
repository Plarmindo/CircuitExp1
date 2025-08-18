import { describe, it, expect } from 'vitest';
import { computeOrthogonalRoute } from '../../src/visualization/line-routing';

// Basic unit tests for VIS-23 routing compute function.
describe('computeOrthogonalRoute (VIS-23)', () => {
  it('produces orthogonal + rounded corner path when both dx, dy large', () => {
    const r = computeOrthogonalRoute({
      parentX: 0, parentY: 0, childX: 140, childY: 120,
      parentRadius: 12, childRadius: 10, lineThickness: 2, color: 0xffffff,
      gridSize: 20
    });
    // Expect: M then (optional L offset=none) then vertical L, Q, horizontal L
    const types = r.commands.map(c => c.type);
    expect(types[0]).toBe('M');
    expect(types.includes('Q')).toBe(true); // corner smoothing
    // Termination X should be less than snapped child center when dx>0
    const last = r.commands[r.commands.length-1];
    if (last.type === 'L') {
      expect(last.x).toBeLessThan(r.snappedChild.x); // stops before child center
    }
  });

  it('omits rounded corner only when either dx or dy very small (post-snap)', () => {
    // Choose child near parent so after snapping at 20px grid one dimension collapses
    const r = computeOrthogonalRoute({
      parentX: 0, parentY: 0, childX: 3, childY: 42,
      parentRadius: 8, childRadius: 6, lineThickness: 2, color: 0xffffff,
      gridSize: 20
    });
    const types = r.commands.map(c => c.type);
    expect(types.includes('Q')).toBe(false); // no corner because snapped dx == 0
  });

  it('applies sibling offset when provided', () => {
    const r = computeOrthogonalRoute({
      parentX: 0, parentY: 0, childX: 100, childY: 60,
      parentRadius: 10, childRadius: 8, lineThickness: 2, color: 0xffffff,
      siblingOffsetX: 8, gridSize: 20
    });
    // Expect second command to reflect offset horizontal segment
    const second = r.commands[1];
    expect(second.type).toBe('L');
    expect(second.x).toBeGreaterThan(r.snappedParent.x); // moved right by offset
  });

  it('detours around child circle when horizontal separation very small (no direct pass-through)', () => {
    const r = computeOrthogonalRoute({
      parentX: 0, parentY: 0, childX: 5, childY: 140,
      parentRadius: 12, childRadius: 12, lineThickness: 2, color: 0xffffff,
      gridSize: 20
    });
    // Should have multiple segments (detour) and final x not equal snapped child center (perimeter offset)
    expect(r.commands.length).toBeGreaterThan(4);
    const last = r.commands[r.commands.length - 1];
    if (last.type === 'L') {
      expect(last.x).not.toBe(r.snappedChild.x); // stops at perimeter offset
    }
  });

  it('vertical leg of large dx/dy route remains outside child circle interior', () => {
    const childRadius = 10;
    const r = computeOrthogonalRoute({
      parentX: 0, parentY: 0, childX: 160, childY: 120,
      parentRadius: 14, childRadius, lineThickness: 2, color: 0xffffff,
      gridSize: 20
    });
    // Find first vertical segment (L) whose x stays constant
    const verticalSeg = (() => {
      for (let i = 1; i < r.commands.length; i++) {
        const prev = r.commands[i-1]; const cur = r.commands[i];
        if (prev.type !== 'M' && prev.type !== 'L') continue;
        if (cur.type !== 'L') continue;
        if (prev.x !== undefined && cur.x !== undefined && prev.x === cur.x && prev.y !== cur.y) return { x: cur.x };
      }
      return null;
    })();
    expect(verticalSeg).not.toBeNull();
    if (verticalSeg) {
      const dist = Math.abs(verticalSeg.x - r.snappedChild.x);
      expect(dist).toBeGreaterThanOrEqual(childRadius + 1); // at least 1px clearance past perimeter
    }
  });

  it('starts route at parent perimeter (no interior crossing)', () => {
    const parentRadius = 16;
    const r = computeOrthogonalRoute({
      parentX: 40, parentY: 80, childX: 180, childY: 200,
      parentRadius, childRadius: 12, lineThickness: 2, color: 0xffffff,
      gridSize: 20
    });
    const first = r.commands[0];
    expect(first.type).toBe('M');
    const offset = Math.abs(first.y - r.snappedParent.y);
    // Exit point must be exactly at parentRadius distance (tolerance 0.01 for rounding)
    expect(Math.abs(offset - parentRadius)).toBeLessThanOrEqual(0.01);
  });
});
