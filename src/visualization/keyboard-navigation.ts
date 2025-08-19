import { findNextDirectional } from './navigation-helpers';

export interface KeyNavContext {
  selectedKeyRef: React.MutableRefObject<string | null>;
  layoutIndexRef: React.MutableRefObject<Map<string, { x: number; y: number; aggregated?: boolean; aggregatedChildrenPaths?: string[]; aggregatedExpanded?: boolean }>>;
  expandedAggregationsRef: React.MutableRefObject<Set<string>>;
  redraw: (applyPending?: boolean, opts?: { skipLayout?: boolean }) => void;
  toggleAggregation: (args: { aggregatedPath: string; childPaths: string[]; expandedBefore: boolean; currentSelection: string | null }) => { expandedAfter: boolean; newSelection: string | null };
}

export function createKeyHandler(ctx: KeyNavContext) {
  const { selectedKeyRef, layoutIndexRef, expandedAggregationsRef, redraw, toggleAggregation } = ctx;
  return (e: KeyboardEvent) => {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const dirKeyMap: Record<string, 'up'|'down'|'left'|'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (e.key in dirKeyMap) {
      e.preventDefault();
      const entries: { path: string; x: number; y: number; aggregated?: boolean }[] = [];
      for (const [p, v] of layoutIndexRef.current.entries()) entries.push({ path: p, x: v.x, y: v.y, aggregated: v.aggregated });
      const next = findNextDirectional(selectedKeyRef.current, dirKeyMap[e.key], entries);
      if (next && next !== selectedKeyRef.current) {
        selectedKeyRef.current = next;
        const info = layoutIndexRef.current.get(next);
        window.dispatchEvent(new CustomEvent('metro:select', { detail: { path: next, type: info?.aggregated ? 'aggregated' : 'node' } }));
        redraw(false, { skipLayout: true });
      }
      return;
    }
    if (e.key === 'Enter') {
      const sel = selectedKeyRef.current;
      if (sel) {
        const info = layoutIndexRef.current.get(sel);
        if (info?.aggregated && !expandedAggregationsRef.current.has(sel)) {
          const toggled = toggleAggregation({
            aggregatedPath: sel,
            childPaths: info.aggregatedChildrenPaths || [],
            expandedBefore: false,
            currentSelection: selectedKeyRef.current,
          });
          if (toggled.expandedAfter) expandedAggregationsRef.current.add(sel);
          selectedKeyRef.current = toggled.newSelection;
          window.dispatchEvent(new CustomEvent('metro:select', { detail: selectedKeyRef.current ? { path: selectedKeyRef.current, type: 'aggregated' } : null }));
          redraw(false);
        }
      }
      return;
    }
    if (e.key === 'Escape') {
      if (selectedKeyRef.current) {
        selectedKeyRef.current = null;
        window.dispatchEvent(new CustomEvent('metro:select', { detail: null }));
        redraw(false, { skipLayout: true });
      }
      return;
    }
  };
}
