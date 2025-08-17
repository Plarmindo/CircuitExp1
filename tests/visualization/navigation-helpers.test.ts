import { describe, it, expect } from 'vitest';
import { findNextDirectional, NavNodeEntry } from '../../src/visualization/navigation-helpers';

// Synthetic small layout (grid-ish)
//    E(0,-90)
// D(-80,0) A(0,0) B(100,0) F(80,80)
//    C(0,100)

const nodes: NavNodeEntry[] = [
  { path: 'A', x: 0, y: 0 },
  { path: 'B', x: 100, y: 0 },
  { path: 'C', x: 0, y: 100 },
  { path: 'D', x: -80, y: 0 },
  { path: 'E', x: 0, y: -90 },
  { path: 'F', x: 80, y: 80 }, // 45° down-right from A (within window)
];

describe('navigation-helpers findNextDirectional', () => {
  it('defaults to first non-aggregated when no current selection', () => {
    expect(findNextDirectional(null, 'right', nodes)).toBe('A');
  });

  it('moves right from A to B', () => {
    expect(findNextDirectional('A', 'right', nodes)).toBe('B');
  });

  it('moves left from A to D', () => {
    expect(findNextDirectional('A', 'left', nodes)).toBe('D');
  });

  it('moves up from A to E', () => {
    expect(findNextDirectional('A', 'up', nodes)).toBe('E');
  });

  it('moves down from A to C', () => {
    expect(findNextDirectional('A', 'down', nodes)).toBe('C');
  });

  it('down-right 45° preference: from A right selects B not F because B is closer', () => {
    expect(findNextDirectional('A', 'right', nodes)).toBe('B');
  });

  it('down from A selects C not F (F outside cone for down)', () => {
    expect(findNextDirectional('A', 'down', nodes)).toBe('C');
  });

  it('when no candidate in direction stays on current', () => {
    // From E going up: none
    expect(findNextDirectional('E', 'up', nodes)).toBe('E');
  });
});
