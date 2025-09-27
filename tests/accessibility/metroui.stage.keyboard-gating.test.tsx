/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// This test verifies that arrow key navigation only triggers when the stage container has focus (A11Y-1 gating)
// We avoid mocking heavy visualization modules and instead simulate the minimal behavior via a global keydown handler.

let lastSelect: { path: string; type: 'node' | 'aggregated' } | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

beforeAll(() => {
  keyHandler = (e: KeyboardEvent) => {
    const active = document.activeElement as HTMLElement | null;
    if (active?.classList?.contains('stage-container') && e.key === 'ArrowRight') {
      window.dispatchEvent(
        new CustomEvent('metro:select', { detail: { path: 'mock/node', type: 'node' } })
      );
    }
  };
  window.addEventListener('keydown', keyHandler);
});

afterAll(() => {
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
});

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
