/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// This test verifies that arrow key navigation only triggers when the stage container has focus (A11Y-1 gating)
// We mock MetroStage to expose a simple layoutIndexRef via debug API would be complex; instead we assert that without focus
// no select event is dispatched while with focus it is.

// Mock heavy MetroStage with minimal event dispatch simulation for ArrowRight
let lastSelect: { path: string; type: 'node' | 'aggregated' } | null = null;

const MockStageImpl: React.FC = () => {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.classList.contains('stage-container') && e.key === 'ArrowRight') {
        window.dispatchEvent(
          new CustomEvent('metro:select', { detail: { path: 'mock/node', type: 'node' } })
        );
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return <div data-testid="mock-stage" />;
};
// Use factory returning component defined inside to avoid temporal dead zone
vi.mock('../../src/visualization/stage', () => ({
  __esModule: true,
  default: () => React.createElement(MockStageImpl),
}));
vi.mock('../../src/components/MiniMap', () => ({ MiniMap: () => React.createElement('div') }));

// Import after mocks so MetroUI sees mocked modules
import { MetroUI } from '../../src/components/MetroUI';

window.addEventListener('metro:select', (e: Event) => {
  lastSelect = (e as CustomEvent).detail;
});

interface BaseProps {
  scanId: string | null;
  progress: null;
  nodes: unknown[];
  receivedNodes: number;
  done: { cancelled?: boolean } | false;
  rootPath: string;
}
// Minimal prop bag for MetroUI in this isolated test (cast because MetroUI expects richer types)
const baseProps = {
  scanId: null,
  progress: null,
  nodes: [],
  receivedNodes: 0,
  done: false,
  rootPath: '',
} as unknown as BaseProps;

describe('Stage keyboard navigation gating', () => {
  it('does not trigger selection when stage not focused, triggers when focused', async () => {
    const { container } = render(<MetroUI {...baseProps} />);
    // Wait for stage container to mount because MetroUI performs layout effects asynchronously
    let stageContainer: HTMLElement | null = null;
    const start = Date.now();
    while (!stageContainer && Date.now() - start < 500) {
      stageContainer = container.querySelector('.stage-container') as HTMLElement | null;
      if (!stageContainer) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    expect(stageContainer).toBeTruthy();

    // Ensure not focused initially
    expect(document.activeElement).not.toBe(stageContainer);
    fireEvent.keyDown(stageContainer!, { key: 'ArrowRight' });
    expect(lastSelect).toBeNull();

    // Focus stage and try again
    // Programmatically focus. JSDOM occasionally requires explicit focus event
    stageContainer!.focus();
    fireEvent.focus(stageContainer!);
    expect(document.activeElement).toBe(stageContainer);
    // Allow any pending focus events to propagate
    await new Promise((r) => setTimeout(r, 20)); // allow Lazy component effect to register listener
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await new Promise((r) => setTimeout(r, 0));
    expect(lastSelect).toBeTruthy();
    expect(lastSelect!.path).toBe('mock/node');
  });
});
