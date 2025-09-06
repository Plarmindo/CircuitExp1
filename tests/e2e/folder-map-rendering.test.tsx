import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';

// Mock electron APIs
const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: { ipcRenderer: mockIpcRenderer },
  writable: true,
});

vi.mock('pixi.js', () => ({
  Application: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    canvas: { width: 800, height: 600 },
    renderer: { resize: vi.fn() },
    stage: { addChild: vi.fn(), removeChildren: vi.fn() },
    ticker: { destroy: vi.fn() },
  })),
}));

describe('Folder Map Rendering E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      switch (channel) {
        case 'get-app-data-path':
          return Promise.resolve('/mock/path');
        case 'get-recent-scans':
          return Promise.resolve([]);
        case 'scan-folder':
          return Promise.resolve({
            nodes: [{ path: '/test', name: 'test', type: 'directory', x: 0, y: 0, size: 1024 }],
            routes: [],
          });
        default:
          return Promise.resolve();
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders main app', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Circuit Explorer/i)).toBeInTheDocument();
    });
  });
});
