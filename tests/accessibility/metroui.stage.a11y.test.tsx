/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { vi } from 'vitest';

// Mock heavy visualization modules and async data clients to avoid side effects
vi.mock('../../src/visualization/metro-stage', () => ({
  MetroStage: () => React.createElement('div', { 'data-testid': 'metro-stage-inner' }),
}));
vi.mock('../../src/components/MiniMap', () => ({ MiniMap: () => React.createElement('div') }));
vi.mock('../../src/favorites/favorites-client', () => ({
  favoritesClient: { list: async () => [], add: async () => [], remove: async () => [] },
}));
vi.mock('../../src/recent-scans-client', () => ({
  listRecent: async () => ({ success: true, recent: [] }),
  clearRecent: async () => ({ success: true }),
}));

import { MetroUI } from '../../src/components/MetroUI';

const baseProps: any = {
  scanId: null,
  progress: null,
  nodes: [],
  receivedNodes: 0,
  done: false,
  rootPath: '',
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

describe('MetroUI stage container accessibility', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(React.createElement(MetroUI, baseProps));
  });
  afterEach(() => {
    if (root && container) {
      root.unmount();
      container.remove();
    }
    root = null;
    container = null;
  });

  it('stage container is focusable and has ARIA labeling', async () => {
    let stageContainer: HTMLElement | null = null;
    const start = Date.now();
    while (!stageContainer && Date.now() - start < 300) {
      stageContainer = container!.querySelector('.stage-container') as HTMLElement | null;
      if (!stageContainer) await new Promise((r) => setTimeout(r, 10));
    }
    expect(stageContainer).toBeTruthy();
    expect(stageContainer!.getAttribute('tabindex')).toBe('0');
    expect(stageContainer!.getAttribute('role')).toBe('group');
    expect(stageContainer!.getAttribute('aria-label')).toContain('Visualization Stage');
    stageContainer!.focus();
    expect(document.activeElement).toBe(stageContainer);
  });
});
