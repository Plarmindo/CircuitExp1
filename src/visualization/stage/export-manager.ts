import type { Application } from 'pixi.js';

export interface ExportOptions {
  transparent?: boolean;
  filename?: string;
}

export interface ExportResult {
  dataUrl: string;
  width: number;
  height: number;
  size: number;
  transparent: boolean;
}

/**
 * Handles PNG export functionality for the metro stage
 */
export class ExportManager {
  private app: Application;
  private pixiFailed: boolean;

  constructor(app: Application, pixiFailed: boolean = false) {
    this.app = app;
    this.pixiFailed = pixiFailed;
  }

  /**
   * Exports the current canvas as PNG
   * @param options Export configuration options
   */
  exportPNG(options: ExportOptions = {}): void {
    const searchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined;
    const transparentParam = searchParams?.get('transparentExport') === '1';
    const transparent = options.transparent ?? transparentParam;

    let canvas: HTMLCanvasElement | null = null;

    // Attempt to grab the Pixi-managed canvas first
    if (this.app && (this.app as unknown as { canvas?: HTMLCanvasElement }).canvas) {
      canvas = (this.app as unknown as { canvas?: HTMLCanvasElement }).canvas ?? null;
    }

    if (!canvas) {
      canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    }

    if (!canvas) {
      console.warn('[ExportManager] Export aborted: no canvas found');
      return;
    }

    this.performBlobExport(canvas, options.filename || 'metro-map.png', transparent);
  }

  /**
   * Exports canvas to blob and triggers download
   * @param canvas Canvas element to export
   * @param downloadName Filename for download
   * @param transparent Whether to export with transparency
   */
  private performBlobExport(
    canvas: HTMLCanvasElement,
    downloadName: string,
    transparent: boolean
  ): void {
    try {
      canvas.toBlob((blob) => {
        if (!blob) return;

        if (typeof window !== 'undefined') {
          window.__lastExportPng = {
            size: blob.size,
            width: canvas.width,
            height: canvas.height,
            transparent,
          };
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    } catch (err) {
      console.error('[ExportManager] toBlob failed', err);
    }
  }

  /**
   * Updates internal references for canvas size changes
   * @param width New canvas width
   * @param height New canvas height
   */
  updateCanvasSize(width: number, height: number): void {
    // Currently, export logic reads dimensions directly from the canvas.
    // This method is provided for future compatibility if size-dependent caching is introduced.
    // No operation needed for now.
  }

  /**
   * Exports canvas to data URL for testing purposes
   * @param transparent Whether to export with transparency
   * @returns Export result or null if failed
   */
  exportDataUrl(transparent = false): ExportResult | null {
    let canvas: HTMLCanvasElement | null = null;

    if (this.app && (this.app as unknown as { canvas?: HTMLCanvasElement }).canvas) {
      canvas = (this.app as unknown as { canvas?: HTMLCanvasElement }).canvas ?? null;
    }

    if (!canvas) {
      canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    }

    if (!canvas) {
      return null;
    }

    if (this.pixiFailed) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#102030';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.fillText('Metro Fallback', 10, 24);
      }
    }

    try {
      const dataUrl = canvas.toDataURL('image/png');
      return {
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        size: Math.round(dataUrl.length * 0.75), // Approximate size
        transparent,
      };
    } catch {
      return null;
    }
  }
}