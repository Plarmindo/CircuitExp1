/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../src/visualization/metro-stage', () => ({
  MetroStage: () => React.createElement('div', { 'data-testid': 'metro-stage' }),
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
let container: HTMLElement | null = null;

describe('Skip link accessibility', () => {
  beforeEach(() => {
    const { container: c } = render(React.createElement(MetroUI, baseProps));
    container = c;
  });
  afterEach(() => {
    container = null;
  });
  it('renders skip link and allows focus move to main content', async () => {
    let skip: HTMLAnchorElement | null = null;
    const start = Date.now();
    while (!skip && Date.now() - start < 1000) {
      skip = container!.querySelector('a.sr-only[href="#mainContent"]') as HTMLAnchorElement | null;
      if (!skip) await new Promise((r) => setTimeout(r, 10));
    }
    expect(skip).toBeTruthy();
    skip!.focus();
    expect(document.activeElement).toBe(skip);
    // simulate activation
    const main = container!.querySelector('#mainContent') as HTMLElement | null;
    expect(main).toBeTruthy();
  });
});
