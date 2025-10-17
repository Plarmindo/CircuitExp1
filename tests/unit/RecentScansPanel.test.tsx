/**
 * Unit tests for RecentScansPanel component
 * Tests expand/collapse, re-scan, clear history, path shortening, and timestamp formatting
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecentScansPanel } from '../../src/components/RecentScansPanel';
import * as recentScansClient from '../../src/recent-scans-client';

// Mock the recent-scans-client module
vi.mock('../../src/recent-scans-client', () => ({
  listRecent: vi.fn(),
  clearRecent: vi.fn(),
}));

describe('RecentScansPanel', () => {
  const mockOnScan = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful response by default
    vi.mocked(recentScansClient.listRecent).mockResolvedValue({
      success: true,
      recent: [
        '/path/to/directory1',
        '/path/to/directory2',
        '/path/to/directory3',
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render with loading state initially', () => {
      render(<RecentScansPanel onScan={mockOnScan} />);
      expect(screen.getByText(/loading recent scans/i)).toBeInTheDocument();
    });

    it('should display recent scans after loading', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/directory1/)).toBeInTheDocument();
      expect(screen.getByText(/directory2/)).toBeInTheDocument();
      expect(screen.getByText(/directory3/)).toBeInTheDocument();
    });

    it('should show count of recent scans', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
      });
    });

    it('should render collapsed by default', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        const panel = screen.getByText(/recent scans/i).closest('.recent-scans-panel');
        expect(panel).toHaveClass('collapsed');
      });
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should expand when toggle button clicked', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      const panel = screen.getByText(/recent scans/i).closest('.recent-scans-panel');
      expect(panel).toHaveClass('expanded');
    });

    it('should collapse when toggle button clicked while expanded', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      const toggleButton = screen.getByLabelText(/expand panel/i);

      // Expand
      fireEvent.click(toggleButton);
      let panel = screen.getByText(/recent scans/i).closest('.recent-scans-panel');
      expect(panel).toHaveClass('expanded');

      // Collapse
      fireEvent.click(toggleButton);
      panel = screen.getByText(/recent scans/i).closest('.recent-scans-panel');
      expect(panel).toHaveClass('collapsed');
    });

    it('should show list items only when expanded', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      // Should not show items when collapsed
      expect(screen.queryByText(/directory1/)).not.toBeVisible();

      // Expand
      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      // Should show items when expanded
      await waitFor(() => {
        expect(screen.getByText(/directory1/)).toBeVisible();
      });
    });
  });

  describe('Re-scan Functionality', () => {
    it('should call onScan when a recent scan item is clicked', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      // Expand panel
      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      // Click first item
      await waitFor(() => {
        const firstItem = screen.getByText(/directory1/);
        const button = firstItem.closest('button');
        fireEvent.click(button!);
      });

      expect(mockOnScan).toHaveBeenCalledWith('/path/to/directory1');
    });

    it('should call onScan with correct path for each item', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      // Expand panel
      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      // Click second item
      await waitFor(() => {
        const secondItem = screen.getByText(/directory2/);
        const button = secondItem.closest('button');
        fireEvent.click(button!);
      });

      expect(mockOnScan).toHaveBeenCalledWith('/path/to/directory2');
    });
  });

  describe('Clear History Functionality', () => {
    it('should show clear button when scans exist', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/clear all recent scans/i)).toBeInTheDocument();
      });
    });

    it('should not show clear button when no scans exist', async () => {
      vi.mocked(recentScansClient.listRecent).mockResolvedValue({
        success: true,
        recent: [],
      });

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      // Expand to see content
      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.queryByLabelText(/clear all recent scans/i)).not.toBeInTheDocument();
      });
    });

    it('should show confirmation dialog when clear button clicked', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/clear all recent scans/i)).toBeInTheDocument();
      });

      const clearButton = screen.getByLabelText(/clear all recent scans/i);
      fireEvent.click(clearButton);

      expect(confirmSpy).toHaveBeenCalledWith('Clear all recent scans history?');
      confirmSpy.mockRestore();
    });

    it('should call clearRecent when confirmed', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.mocked(recentScansClient.clearRecent).mockResolvedValue({
        success: true,
        recent: [],
      });

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/clear all recent scans/i)).toBeInTheDocument();
      });

      const clearButton = screen.getByLabelText(/clear all recent scans/i);
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(recentScansClient.clearRecent).toHaveBeenCalled();
      });

      confirmSpy.mockRestore();
    });

    it('should not call clearRecent when cancelled', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/clear all recent scans/i)).toBeInTheDocument();
      });

      const clearButton = screen.getByLabelText(/clear all recent scans/i);
      fireEvent.click(clearButton);

      expect(recentScansClient.clearRecent).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no scans exist', async () => {
      vi.mocked(recentScansClient.listRecent).mockResolvedValue({
        success: true,
        recent: [],
      });

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      // Expand panel
      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText(/no recent scans yet/i)).toBeInTheDocument();
        expect(screen.getByText(/scanned directories will appear here/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when loading fails', async () => {
      vi.mocked(recentScansClient.listRecent).mockResolvedValue({
        success: false,
        recent: [],
        error: 'Failed to load',
      });

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      vi.mocked(recentScansClient.listRecent).mockResolvedValue({
        success: false,
        recent: [],
        error: 'Network error',
      });

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('should retry loading when retry button clicked', async () => {
      vi.mocked(recentScansClient.listRecent)
        .mockResolvedValueOnce({
          success: false,
          recent: [],
          error: 'Network error',
        })
        .mockResolvedValueOnce({
          success: true,
          recent: ['/path/to/directory1'],
        });

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/retry/i);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/directory1/)).toBeInTheDocument();
      });

      expect(recentScansClient.listRecent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Path Shortening', () => {
    it('should shorten long paths', async () => {
      vi.mocked(recentScansClient.listRecent).mockResolvedValue({
        success: true,
        recent: ['/very/long/path/that/exceeds/the/maximum/length/allowed/for/display/in/the/ui'],
      });

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      // Expand panel
      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        // Should contain shortened path with "..."
        expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
      });
    });
  });

  describe('Display Limits', () => {
    it('should display maximum 10 recent scans', async () => {
      const manyScans = Array.from({ length: 15 }, (_, i) => `/path/to/directory${i + 1}`);

      vi.mocked(recentScansClient.listRecent).mockResolvedValue({
        success: true,
        recent: manyScans,
      });

      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/\(15\)/)).toBeInTheDocument();
      });

      // Expand panel
      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        // Should show first 10
        expect(screen.getByText(/directory1/)).toBeInTheDocument();
        expect(screen.getByText(/directory10/)).toBeInTheDocument();
        // Should not show 11th and beyond
        expect(screen.queryByText(/directory11/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on buttons', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/expand panel/i)).toBeInTheDocument();
      });

      // Expand
      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/collapse panel/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/clear all recent scans/i)).toBeInTheDocument();
      });
    });

    it('should have title attributes for long paths', async () => {
      render(<RecentScansPanel onScan={mockOnScan} />);

      await waitFor(() => {
        expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
      });

      // Expand
      const toggleButton = screen.getByLabelText(/expand panel/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        const button = screen.getByText(/directory1/).closest('button');
        expect(button).toHaveAttribute('title', expect.stringContaining('/path/to/directory1'));
      });
    });
  });
});
