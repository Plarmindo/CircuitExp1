import { describe, it, expect } from 'vitest';
import { toggleAggregation } from '../../src/visualization/selection-helpers';

describe('selection-helpers toggleAggregation', () => {
  const agg = '/root/*__agg__abc';
  const children = ['/root/a','/root/b','/root/c'];

  it('expanding selects aggregated when nothing selected', () => {
    const res = toggleAggregation({ aggregatedPath: agg, childPaths: children, expandedBefore: false, currentSelection: null });
    expect(res.expandedAfter).toBe(true);
    expect(res.newSelection).toBe(agg);
  });

  it('collapsing clears child selection', () => {
    const res = toggleAggregation({ aggregatedPath: agg, childPaths: children, expandedBefore: true, currentSelection: '/root/b' });
    expect(res.expandedAfter).toBe(false);
    expect(res.newSelection).toBeNull();
  });

  it('collapsing preserves aggregated selection', () => {
    const res = toggleAggregation({ aggregatedPath: agg, childPaths: children, expandedBefore: true, currentSelection: agg });
    expect(res.expandedAfter).toBe(false);
    expect(res.newSelection).toBe(agg);
  });
});
