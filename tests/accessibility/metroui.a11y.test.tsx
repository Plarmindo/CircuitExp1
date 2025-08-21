/* @vitest-environment jsdom */
import React from 'react';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

// Mock heavy visualization + async data clients
vi.mock('../../src/visualization/metro-stage', () => ({
  MetroStage: () => React.createElement('div', { 'data-testid': 'metro-stage' }),
}));
vi.mock('../../src/components/MiniMap', () => ({
  MiniMap: () => React.createElement('div', { 'data-testid': 'mini-map' }),
}));
vi.mock('../../src/favorites/favorites-client', () => ({
  favoritesClient: { list: async () => [], add: async () => [], remove: async () => [] },
}));
vi.mock('../../src/recent-scans-client', () => ({
  listRecent: async () => ({ success: true, recent: [] }),
  clearRecent: async () => ({ success: true }),
}));

import { MetroUI } from '../../src/components/MetroUI';

// Minimal props stub used to mount the UI without a full app environment
interface TestProps {
  scanId: string | null;
  progress: unknown;
  nodes: unknown[];
  receivedNodes: number;
  done: unknown;
  rootPath: string;
}
const baseProps: TestProps = {
  scanId: null,
  progress: null,
  nodes: [],
  receivedNodes: 0,
  done: false,
  rootPath: '',
};

let container: HTMLElement | null = null;

describe('MetroUI accessibility basics', () => {
  beforeEach(() => {
    const { container: c } = render(React.createElement(MetroUI, baseProps));
    container = c;
  });

  afterEach(() => {
    container = null;
  });

  it('toolbar buttons have accessible names and are focusable', async () => {
    // Poll for elements for a short time to handle any microtask scheduling delays
    const waitFor = async (selector: string, timeout = 1000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const el = container?.querySelector(selector) as HTMLElement | null;
        if (el) return el;
        await new Promise((r) => setTimeout(r, 10));
      }
      return null;
    };

    const zoomIn = await waitFor('button[title="Zoom In"]');
    const zoomOut = await waitFor('button[title="Zoom Out"]');
    const fit = await waitFor('button[title="Fit to View"]');
    const exportBtn = await waitFor('button[title="Export PNG"]');

    expect(zoomIn).toBeTruthy();
    expect(zoomOut).toBeTruthy();
    expect(fit).toBeTruthy();
    expect(exportBtn).toBeTruthy();

    // Focus the zoom in button and assert it becomes activeElement
    zoomIn!.focus();
    expect(document.activeElement).toBe(zoomIn);
  });

  it('updates live region when selection event dispatched', async () => {
    // Poll for live region (rendered at end of MetroUI)
    let live: HTMLElement | null = null;
    const start = Date.now();
    while (!live && Date.now() - start < 1000) {
      live = container!.querySelector('div.sr-only[aria-live="polite"]') as HTMLElement | null;
      if (!live) await new Promise((r) => setTimeout(r, 10));
    }
    expect(live).toBeTruthy();
    // Initially empty
    const initial = live!.textContent;
    // Wait a tick to ensure event listeners registered
    await new Promise((r) => setTimeout(r, 10));
    window.dispatchEvent(
      new CustomEvent('metro:select', { detail: { path: '/root/sample', type: 'node' } })
    );
    // Poll up to 500ms for update
    const startPoll = Date.now();
    let updated = false;
    while (Date.now() - startPoll < 500) {
      const txt = live!.textContent || '';
      if (txt && txt !== initial) {
        updated = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(updated).toBe(true);
    expect(live!.textContent).toContain('Selected');
    expect(live!.textContent).toContain('sample');
  });
});
