import { useEffect, useState } from 'react';

/**
 * Hook to manage scan progress state
 * Simplifies integration with existing scan events
 */
export const useScanProgress = () => {
  const [scanId, setScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [processedNodes, setProcessedNodes] = useState<number>(0);
  const [totalNodes, setTotalNodes] = useState<number | undefined>(undefined);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  useEffect(() => {
    const handleScanRegistered = (event: CustomEvent) => {
      const { scanId: id } = event.detail;
      setScanId(id);
      setProgress(0);
      setProcessedNodes(0);
      setTotalNodes(undefined);
      setStartTime(Date.now());
      setElapsedTime(0);
    };

    const handleScanProgress = (event: CustomEvent) => {
      const {
        scanId: id,
        progress: progressValue,
        processedNodes: processed,
        totalNodes: total,
      } = event.detail;
      
      if (id === scanId || !scanId) {
        setScanId(id);
        setProgress(progressValue || 0);
        setProcessedNodes(processed || 0);
        if (total) setTotalNodes(total);
        if (startTime) {
          setElapsedTime(Date.now() - startTime);
        }
      }
    };

    const handleScanDone = (event: CustomEvent) => {
      const { scanId: id } = event.detail;
      if (id === scanId) {
        setProgress(100);
        if (startTime) {
          setElapsedTime(Date.now() - startTime);
        }
      }
    };

    const handleScanCancelled = (event: CustomEvent) => {
      const { scanId: id } = event.detail;
      if (id === scanId) {
        setScanId(null);
        setProgress(0);
        setProcessedNodes(0);
        setTotalNodes(undefined);
        setElapsedTime(0);
      }
    };

    window.addEventListener('scan:registered', handleScanRegistered as EventListener);
    window.addEventListener('scan:progress', handleScanProgress as EventListener);
    window.addEventListener('scan:done', handleScanDone as EventListener);
    window.addEventListener('scan:cancelled', handleScanCancelled as EventListener);

    return () => {
      window.removeEventListener('scan:registered', handleScanRegistered as EventListener);
      window.removeEventListener('scan:progress', handleScanProgress as EventListener);
      window.removeEventListener('scan:done', handleScanDone as EventListener);
      window.removeEventListener('scan:cancelled', handleScanCancelled as EventListener);
    };
  }, [scanId, startTime]);

  // Update elapsed time periodically
  useEffect(() => {
    if (!scanId || progress >= 100) return;

    const interval = setInterval(() => {
      if (startTime) {
        setElapsedTime(Date.now() - startTime);
      }
    }, 100); // Update every 100ms for smooth time display

    return () => clearInterval(interval);
  }, [scanId, startTime, progress]);

  return {
    scanId,
    progress,
    processedNodes,
    totalNodes,
    elapsedTime,
  };
};
