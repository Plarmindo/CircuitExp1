/**
 * Unit tests for ScanProgressBar component and useScanProgress hook
 * Tests progress calculation, time estimation, throughput calculation, and cancel functionality
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { ScanProgressBar } from '../../src/components/ScanProgressBar';
import { useScanProgress } from '../../src/hooks/useScanProgress';

describe('ScanProgressBar Component', () => {
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Component Rendering', () => {
    it('should not render when scanId is null', () => {
      const { container } = render(
        <ScanProgressBar
          scanId={null}
          progress={0}
          processedNodes={0}
          elapsedTime={0}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('should render when scanId is provided', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={5000}
          elapsedTime={1000}
        />
      );
      expect(screen.getByText(/scanning/i)).toBeInTheDocument();
    });

    it('should display progress percentage', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={75}
          processedNodes={7500}
          elapsedTime={1000}
        />
      );
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should display processed nodes count', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={5000}
          elapsedTime={1000}
        />
      );
      const elements = screen.getAllByText(/5\.0K/);
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0]).toBeInTheDocument();
    });

    it('should display total nodes when provided', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={5000}
          totalNodes={10000}
          elapsedTime={1000}
        />
      );
      expect(screen.getByText(/5\.0K \/ 10\.0K/)).toBeInTheDocument();
    });
  });

  describe('Progress Status', () => {
    it('should show "Starting scan..." when progress is 0', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={0}
          processedNodes={0}
          elapsedTime={0}
        />
      );
      expect(screen.getByText(/starting scan/i)).toBeInTheDocument();
    });

    it('should show "Scanning..." when progress is between 0-95', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={5000}
          elapsedTime={1000}
        />
      );
      expect(screen.getByText(/^scanning\.\.\.$/i)).toBeInTheDocument();
    });

    it('should show "Finalizing..." when progress is 95-99', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={96}
          processedNodes={9600}
          elapsedTime={5000}
        />
      );
      expect(screen.getByText(/finalizing/i)).toBeInTheDocument();
    });

    it('should show "Scan complete!" when progress is 100', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={100}
          processedNodes={10000}
          elapsedTime={5000}
        />
      );
      expect(screen.getByText(/scan complete/i)).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('should format milliseconds correctly', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={10}
          processedNodes={1000}
          elapsedTime={500}
        />
      );
      expect(screen.getByText(/500ms/)).toBeInTheDocument();
    });

    it('should format seconds correctly', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={10}
          processedNodes={1000}
          elapsedTime={2500}
        />
      );
      const elements = screen.getAllByText(/2\.5s/);
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0]).toBeInTheDocument();
    });

    it('should format minutes correctly', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={50000}
          elapsedTime={125000}
        />
      );
      const elements = screen.getAllByText(/2\.1m/);
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0]).toBeInTheDocument();
    });
  });

  describe('Throughput Calculation', () => {
    it('should calculate and display throughput', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={10000}
          elapsedTime={1000}
        />
      );
      // 10000 nodes / 1000ms * 1000 = 10,000 nodes/sec = 10.0K nodes/s
      expect(screen.getByText(/10\.0K nodes\/s/)).toBeInTheDocument();
    });

    it('should handle low throughput', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={10}
          processedNodes={500}
          elapsedTime={1000}
        />
      );
      // 500 nodes / 1000ms * 1000 = 500 nodes/sec
      expect(screen.getByText(/500 nodes\/s/)).toBeInTheDocument();
    });
  });

  describe('Time Remaining Estimation', () => {
    it('should estimate time remaining when total nodes provided', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={5000}
          totalNodes={10000}
          elapsedTime={1000}
        />
      );
      // Throughput: 5000 nodes/sec
      // Remaining: 5000 nodes
      // Est time: 1000ms = 1.0s
      expect(screen.getByText(/~1\.0s/)).toBeInTheDocument();
    });

    it('should not show time remaining when scan is complete', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={100}
          processedNodes={10000}
          totalNodes={10000}
          elapsedTime={2000}
        />
      );
      expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
    });

    it('should estimate based on progress percentage when no total', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={25}
          processedNodes={2500}
          elapsedTime={1000}
        />
      );
      // Progress 25% in 1000ms → total est 4000ms → remaining 3000ms
      expect(screen.getByText(/~3\.0s/)).toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('should show cancel button when onCancel provided', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={5000}
          elapsedTime={1000}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByLabelText(/cancel current scan/i)).toBeInTheDocument();
    });

    it('should not show cancel button when scan is complete', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={100}
          processedNodes={10000}
          elapsedTime={2000}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.queryByLabelText(/cancel current scan/i)).not.toBeInTheDocument();
    });

    it('should call onCancel when cancel button clicked', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={5000}
          elapsedTime={1000}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByLabelText(/cancel current scan/i);
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should not show cancel button when onCancel not provided', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={5000}
          elapsedTime={1000}
        />
      );
      expect(screen.queryByLabelText(/cancel/i)).not.toBeInTheDocument();
    });
  });

  describe('Progress Bar Visual', () => {
    it('should set progress bar width based on progress value', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={75}
          processedNodes={7500}
          elapsedTime={1000}
        />
      );

      const progressBarFill = document.querySelector('.progress-bar-fill');
      expect(progressBarFill).toHaveStyle({ width: '75%' });
    });

    it('should clamp progress to 0-100 range', () => {
      const { rerender } = render(
        <ScanProgressBar
          scanId="scan-123"
          progress={-10}
          processedNodes={0}
          elapsedTime={0}
        />
      );

      let progressBarFill = document.querySelector('.progress-bar-fill');
      expect(progressBarFill).toHaveStyle({ width: '0%' });

      rerender(
        <ScanProgressBar
          scanId="scan-123"
          progress={110}
          processedNodes={11000}
          elapsedTime={1000}
        />
      );

      progressBarFill = document.querySelector('.progress-bar-fill');
      expect(progressBarFill).toHaveStyle({ width: '100%' });
    });
  });

  describe('CSS Classes', () => {
    it('should apply status-starting class when progress is 0', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={0}
          processedNodes={0}
          elapsedTime={0}
        />
      );

      expect(document.querySelector('.status-starting')).toBeInTheDocument();
    });

    it('should apply status-active class during scan', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={50}
          processedNodes={5000}
          elapsedTime={1000}
        />
      );

      expect(document.querySelector('.status-active')).toBeInTheDocument();
    });

    it('should apply status-completing class near end', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={96}
          processedNodes={9600}
          elapsedTime={2000}
        />
      );

      expect(document.querySelector('.status-completing')).toBeInTheDocument();
    });

    it('should apply status-done class when complete', () => {
      render(
        <ScanProgressBar
          scanId="scan-123"
          progress={100}
          processedNodes={10000}
          elapsedTime={2000}
        />
      );

      expect(document.querySelector('.status-done')).toBeInTheDocument();
    });
  });
});

describe('useScanProgress Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with null scanId', () => {
    const { result } = renderHook(() => useScanProgress());

    expect(result.current.scanId).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.processedNodes).toBe(0);
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should update state on scan:registered event', () => {
    const { result } = renderHook(() => useScanProgress());

    act(() => {
      const event = new CustomEvent('scan:registered', {
        detail: { scanId: 'scan-123' },
      });
      window.dispatchEvent(event);
    });

    expect(result.current.scanId).toBe('scan-123');
    expect(result.current.progress).toBe(0);
  });

  it('should update progress on scan:progress event', () => {
    const { result } = renderHook(() => useScanProgress());

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:registered', {
        detail: { scanId: 'scan-123' },
      }));
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:progress', {
        detail: {
          scanId: 'scan-123',
          progress: 50,
          processedNodes: 5000,
          totalNodes: 10000,
        },
      }));
    });

    expect(result.current.scanId).toBe('scan-123');
    expect(result.current.progress).toBe(50);
    expect(result.current.processedNodes).toBe(5000);
    expect(result.current.totalNodes).toBe(10000);
  });

  it('should set progress to 100 on scan:done event', () => {
    const { result } = renderHook(() => useScanProgress());

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:registered', {
        detail: { scanId: 'scan-123' },
      }));
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:progress', {
        detail: {
          scanId: 'scan-123',
          progress: 95,
          processedNodes: 9500,
        },
      }));
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:done', {
        detail: { scanId: 'scan-123' },
      }));
    });

    expect(result.current.progress).toBe(100);
  });

  it('should reset state on scan:cancelled event', () => {
    const { result } = renderHook(() => useScanProgress());

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:registered', {
        detail: { scanId: 'scan-123' },
      }));
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:progress', {
        detail: {
          scanId: 'scan-123',
          progress: 50,
          processedNodes: 5000,
        },
      }));
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:cancelled', {
        detail: { scanId: 'scan-123' },
      }));
    });

    expect(result.current.scanId).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.processedNodes).toBe(0);
  });

  it('should ignore events for different scanId', () => {
    const { result } = renderHook(() => useScanProgress());

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:registered', {
        detail: { scanId: 'scan-123' },
      }));
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:progress', {
        detail: {
          scanId: 'scan-456', // Different scan ID
          progress: 50,
          processedNodes: 5000,
        },
      }));
    });

    // Should not update since scanId doesn't match
    expect(result.current.progress).toBe(0);
    expect(result.current.processedNodes).toBe(0);
  });

  it('should update elapsed time periodically', () => {
    const { result } = renderHook(() => useScanProgress());

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:registered', {
        detail: { scanId: 'scan-123' },
      }));
    });

    const initialTime = result.current.elapsedTime;

    act(() => {
      vi.advanceTimersByTime(1000); // Advance 1 second
    });

    expect(result.current.elapsedTime).toBeGreaterThan(initialTime);
  });

  it('should stop updating elapsed time when scan completes', () => {
    const { result } = renderHook(() => useScanProgress());

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:registered', {
        detail: { scanId: 'scan-123' },
      }));
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('scan:done', {
        detail: { scanId: 'scan-123' },
      }));
    });

    const timeAtCompletion = result.current.elapsedTime;

    act(() => {
      vi.advanceTimersByTime(5000); // Advance 5 seconds
    });

    // Time should not advance after completion
    expect(result.current.elapsedTime).toBe(timeAtCompletion);
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useScanProgress());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'scan:registered',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'scan:progress',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'scan:done',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'scan:cancelled',
      expect.any(Function)
    );
  });
});
