/* @vitest-environment jsdom */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

// Mock heavy visualization modules and clients used by MetroUI so it mounts in jsdom
vi.mock('../../src/visualization/metro-stage', () => ({
  MetroStage: () => React.createElement('div', { 'data-testid': 'metro-stage' }),
}));
vi.mock('../../src/components/MiniMap', () => ({
  MiniMap: () => React.createElement('div', { 'data-testid': 'mini-map' }),
}));
vi.mock('../../src/favorites/favorites-client', () => ({
  favoritesClient: {
    list: async () => ['/root/sample/fav1'],
    add: async () => ['/root/sample/fav1'],
    remove: async () => [],
  },
}));
vi.mock('../../src/recent-scans-client', () => ({
  listRecent: async () => ({ success: true, recent: ['/root/sample/recent1'] }),
  clearRecent: async () => ({ success: true }),
}));

import { MetroUI } from '../../src/components/MetroUI';

const baseProps: any = {
  scanId: null,
  progress: null,
  nodes: [],
  receivedNodes: 0,
  done: false,
  rootPath: '/root/sample',
};

let container: HTMLElement | null = null;

describe('MetroUI sidebar and live-region accessibility', () => {
  beforeEach(() => {
    const { container: c } = render(React.createElement(MetroUI, baseProps));
    container = c;
  });

  afterEach(() => {
    container = null;
    vi.clearAllMocks();
  });

  it('favorites and recent buttons are rendered and focusable, and live region updates on selection', async () => {
    const waitFor = async (sel: string, timeout = 1200) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const el = container?.querySelector(sel) as HTMLElement | null;
        if (el) return el;
        await new Promise((r) => setTimeout(r, 10));
      }
      return null;
    };

    // favorites list should be populated by mocked favoritesClient.list
    const favBtn = await waitFor('.fav-jump');
    expect(favBtn).toBeTruthy();

    // recent list should be populated by mocked listRecent
    const recentBtn = await waitFor('.recent-jump');
    expect(recentBtn).toBeTruthy();

    // focus the favorite button
    favBtn!.focus();
    expect(document.activeElement).toBe(favBtn);

    // dispatch a selection event and ensure live region updated
    window.dispatchEvent(
      new CustomEvent('metro:select', { detail: { path: '/root/sample/fav1', type: 'node' } })
    );

    // the live region we use for announcements is an sr-only div with aria-live; select that specifically
    const live = await waitFor('div.sr-only[aria-live]');
    expect(live).toBeTruthy();
    // MetroUI writes: Selected ${type} ${name}
    const expected = 'Selected node fav1';
    // Poll the live region for the expected announcement (allow for microtask scheduling)
    const start = Date.now();
    let found = false;
    while (Date.now() - start < 1000) {
      const text = live!.textContent?.trim() || '';
      if (text.includes(expected)) {
        found = true;
        break;
      }
      // short wait and retry
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(found).toBeTruthy();
  });
});
