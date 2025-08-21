export interface FallbackRendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  backgroundColor?: string;
  textColor?: string;
}

/**
 * Handles 2D canvas rendering when Pixi.js fails or is not available
 */
export class FallbackRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private width: number;
  private height: number;
  private backgroundColor: string;
  private textColor: string;

  constructor(config: FallbackRendererConfig) {
    this.canvas = config.canvas;
    this.width = config.width;
    this.height = config.height;
    this.backgroundColor = config.backgroundColor || '#102030';
    this.textColor = config.textColor || '#ffffff';
    
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Renders a fallback message on the canvas
   * @param message The message to display
   * @param subtitle Optional subtitle
   */
  renderFallback(message: string, subtitle?: string): void {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Set text properties
    this.ctx.fillStyle = this.textColor;
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Draw main message
    this.ctx.fillText(message, this.width / 2, this.height / 2 - 20);

    // Draw subtitle if provided
    if (subtitle) {
      this.ctx.font = '16px sans-serif';
      this.ctx.fillText(subtitle, this.width / 2, this.height / 2 + 20);
    }

    // Draw border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(10, 10, this.width - 20, this.height - 20);
  }

  /**
   * Renders a simple loading state
   */
  renderLoading(): void {
    this.renderFallback('Loading...', 'Please wait while the metro map initializes');
  }

  /**
   * Renders an error state
   * @param error The error message
   */
  renderError(error: string): void {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Set text properties
    this.ctx.fillStyle = '#ff4444'; // Red for error
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Draw main message
    this.ctx.fillText('Error Loading Map', this.width / 2, this.height / 2 - 40);

    // Draw error details
    this.ctx.fillStyle = this.textColor;
    this.ctx.font = '14px sans-serif';
    
    // Handle multi-line error messages
    const lines = error.split('\n');
    const lineHeight = 20;
    const startY = this.height / 2;
    
    lines.forEach((line, index) => {
      this.ctx.fillText(line, this.width / 2, startY + (index * lineHeight));
    });

    // Draw border
    this.ctx.strokeStyle = '#ff4444';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(10, 10, this.width - 20, this.height - 20);
  }

  /**
   * Clears the canvas
   */
  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Gets the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Resizes the canvas
   * @param width New width
   * @param height New height
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }
}