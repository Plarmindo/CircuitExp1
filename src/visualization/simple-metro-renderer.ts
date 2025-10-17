/**
 * Simple Metro Renderer
 * Focused renderer for the three-folder prototype with clear line connections
 */

import { Graphics, Text, Container, Application } from 'pixi.js';
import type { LayoutNodeLite, RouteCommand } from './stage/types';

export interface SimpleRenderOptions {
  selectedPath?: string | null;
  hoveredPath?: string | null;
  theme?: {
    background?: string;
    text?: string;
    folder?: string;
    file?: string;
    line?: string;
    selectedOutline?: string;
    hoveredOutline?: string;
  };
}

export class SimpleMetroRenderer {
  private app: Application;
  private nodesContainer: Container;
  private linesContainer: Container;
  private labelsContainer: Container;
  private nodeGraphics = new Map<string, Graphics>();
  private lineGraphics: Graphics[] = [];
  private labelTexts = new Map<string, Text>();
  private currentLineWidth = 4;
  private showLines = true;
  private showNodes = true;
  private showLabels = true;

  constructor(app: Application) {
    this.app = app;

    // Create rendering layers
    this.linesContainer = new Container();
    this.nodesContainer = new Container();
    this.labelsContainer = new Container();

    this.linesContainer.name = 'lines-layer';
    this.nodesContainer.name = 'nodes-layer';
    this.labelsContainer.name = 'labels-layer';

    // Add layers in correct order (lines behind nodes, labels on top)
    this.app.stage.addChild(this.linesContainer);
    this.app.stage.addChild(this.nodesContainer);
    this.app.stage.addChild(this.labelsContainer);

    // Listen to MapSettings changes
    this.setupSettingsListeners();
  }

  private setupSettingsListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('metro:settingsChange', this.handleSettingsChange);
      window.addEventListener('metro:settingsReset', this.handleSettingsReset);
    }
  }

  /**
   * Render the complete scene with nodes and routes
   */
  render(layout: LayoutNodeLite[], routes: RouteCommand[], options: SimpleRenderOptions = {}) {
    this.clear();

    // Render lines first (behind nodes) - only if enabled
    if (this.showLines) {
      this.renderRoutes(routes, options);
    }

    // Render nodes on top of lines - only if enabled
    if (this.showNodes) {
      this.renderNodes(layout, options);
    }

    // Render labels on top of everything - only if enabled
    if (this.showLabels) {
      this.renderLabels(layout, options);
    }
  }

  /**
   * Render connecting lines/routes
   */
  private renderRoutes(routes: RouteCommand[], options: SimpleRenderOptions) {
    if (routes.length === 0) return;

    const lineColor = this.parseColor(options.theme?.line || '#95a5a6');
    const lineWidth = this.currentLineWidth;

    let currentGraphics: Graphics | null = null;
    let currentPath: { x: number; y: number }[] = [];

    routes.forEach((command) => {
      switch (command.type) {
        case 'M': // Move to
          // Start a new line segment
          if (currentGraphics && currentPath.length > 1) {
            this.drawPath(currentGraphics, currentPath, lineColor, lineWidth);
          }

          currentGraphics = new Graphics();
          currentPath = [{ x: command.x, y: command.y }];
          this.linesContainer.addChild(currentGraphics);
          this.lineGraphics.push(currentGraphics);
          break;

        case 'L': // Line to
          if (currentGraphics) {
            currentPath.push({ x: command.x, y: command.y });
          }
          break;

        case 'Q': // Quadratic curve to
          if (currentGraphics && command.x1 !== undefined && command.y1 !== undefined) {
            // For quadratic curves, we'll approximate with multiple line segments
            const startPoint = currentPath[currentPath.length - 1];
            if (startPoint) {
              const curvePoints = this.generateQuadraticCurve(
                startPoint.x, startPoint.y,
                command.x1, command.y1,
                command.x, command.y,
                20 // Number of segments
              );
              currentPath.push(...curvePoints);
            }
          }
          break;
      }
    });

    // Draw the final path
    if (currentGraphics && currentPath.length > 1) {
      this.drawPath(currentGraphics, currentPath, lineColor, lineWidth);
    }
  }

  /**
   * Generate points for a quadratic Bézier curve
   */
  private generateQuadraticCurve(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    segments: number
  ): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y2;
      points.push({ x, y });
    }

    return points;
  }

  /**
   * Draw a path with multiple points
   */
  private drawPath(graphics: Graphics, path: { x: number; y: number }[], color: number, width: number) {
    if (path.length < 2) return;

    graphics.clear();
    graphics.lineStyle(width, color, 0.8);

    // Start the path
    graphics.moveTo(path[0].x, path[0].y);

    // Draw lines to each subsequent point
    for (let i = 1; i < path.length; i++) {
      graphics.lineTo(path[i].x, path[i].y);
    }
  }

  /**
   * Render folder and file nodes
   */
  private renderNodes(layout: LayoutNodeLite[], options: SimpleRenderOptions) {
    layout.forEach((node) => {
      const graphics = new Graphics();
      this.nodesContainer.addChild(graphics);
      this.nodeGraphics.set(node.path, graphics);

      // Determine colors based on node type and state
      const isSelected = options.selectedPath === node.path;
      const isHovered = options.hoveredPath === node.path;

      let fillColor: number;
      let outlineColor: number = 0x000000;
      let outlineWidth = 1;

      if (node.nodeType === 'folder' || node.color === '#4CAF50') {
        fillColor = this.parseColor(options.theme?.folder || '#4CAF50');
      } else {
        fillColor = this.parseColor(options.theme?.file || '#2196F3');
      }

      if (isSelected) {
        outlineColor = this.parseColor(options.theme?.selectedOutline || '#FF6B35');
        outlineWidth = 3;
      } else if (isHovered) {
        outlineColor = this.parseColor(options.theme?.hoveredOutline || '#4ECDC4');
        outlineWidth = 2;
      }

      // Draw the node rectangle
      graphics.clear();
      graphics.lineStyle(outlineWidth, outlineColor);
      graphics.beginFill(fillColor, 0.9);

      const width = node.width || 100;
      const height = node.height || 30;
      const cornerRadius = node.nodeType === 'folder' ? 8 : 4;

      graphics.drawRoundedRect(
        node.x - width / 2,
        node.y - height / 2,
        width,
        height,
        cornerRadius
      );
      graphics.endFill();

      // Add a small icon indicator
      if (node.nodeType === 'folder') {
        // Draw a small folder icon
        graphics.beginFill(0xFFFFFF, 0.8);
        graphics.drawRect(node.x - width / 2 + 8, node.y - height / 2 + 6, 12, 8);
        graphics.drawRect(node.x - width / 2 + 8, node.y - height / 2 + 4, 16, 2);
        graphics.endFill();
      } else {
        // Draw a small file icon
        graphics.beginFill(0xFFFFFF, 0.8);
        graphics.drawRect(node.x - width / 2 + 8, node.y - height / 2 + 6, 10, 12);
        graphics.drawPolygon([
          node.x - width / 2 + 18, node.y - height / 2 + 6,
          node.x - width / 2 + 18, node.y - height / 2 + 10,
          node.x - width / 2 + 14, node.y - height / 2 + 10
        ]);
        graphics.endFill();
      }

      // Make nodes interactive
      graphics.eventMode = 'static';
      graphics.cursor = 'pointer';
    });
  }

  /**
   * Render text labels for nodes
   */
  private renderLabels(layout: LayoutNodeLite[], options: SimpleRenderOptions) {
    layout.forEach((node) => {
      const text = new Text(node.label || node.path.split('/').pop() || 'Unknown', {
        fontFamily: 'Arial, sans-serif',
        fontSize: node.nodeType === 'folder' ? 14 : 12,
        fontWeight: node.nodeType === 'folder' ? 'bold' : 'normal',
        fill: options.theme?.text || '#FFFFFF',
        align: 'center',
      });

      // Position text in the center of the node
      text.anchor.set(0.5, 0.5);
      text.x = node.x;
      text.y = node.y;

      // Add subtle shadow for better readability
      text.style.dropShadow = true;
      text.style.dropShadowColor = '#000000';
      text.style.dropShadowBlur = 2;
      text.style.dropShadowDistance = 1;

      this.labelsContainer.addChild(text);
      this.labelTexts.set(node.path, text);
    });
  }

  /**
   * Get node graphics for interaction handling
   */
  getNodeGraphics(path: string): Graphics | undefined {
    return this.nodeGraphics.get(path);
  }

  /**
   * Update selection/hover state without full re-render
   */
  updateNodeState(path: string, state: 'selected' | 'hovered' | 'normal', options: SimpleRenderOptions = {}) {
    const graphics = this.nodeGraphics.get(path);
    if (!graphics) return;

    // Find the node data to get its properties
    // This is a simplified update - in a full implementation, you'd store node data
    let outlineColor: number;
    let outlineWidth: number;

    switch (state) {
      case 'selected':
        outlineColor = this.parseColor(options.theme?.selectedOutline || '#FF6B35');
        outlineWidth = 3;
        break;
      case 'hovered':
        outlineColor = this.parseColor(options.theme?.hoveredOutline || '#4ECDC4');
        outlineWidth = 2;
        break;
      default:
        outlineColor = 0x000000;
        outlineWidth = 1;
    }

    // Update the outline (this is simplified - you'd need to redraw the entire node)
    graphics.lineStyle(outlineWidth, outlineColor);
  }

  /**
   * Clear all rendered content
   */
  clear() {
    this.linesContainer.removeChildren();
    this.nodesContainer.removeChildren();
    this.labelsContainer.removeChildren();

    this.nodeGraphics.clear();
    this.lineGraphics.length = 0;
    this.labelTexts.clear();
  }

  /**
   * Parse color string to number
   */
  private parseColor(color: string): number {
    if (color.startsWith('#')) {
      return parseInt(color.slice(1), 16);
    }
    return 0x000000; // Default to black
  }

  /**
   * Destroy the renderer and clean up resources
   */
  destroy() {
    this.clear();
    this.linesContainer.destroy();
    this.nodesContainer.destroy();
    this.labelsContainer.destroy();

    // Clean up event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('metro:settingsChange', this.handleSettingsChange);
      window.removeEventListener('metro:settingsReset', this.handleSettingsReset);
    }
  }

  private handleSettingsChange = (e: Event) => {
    const event = e as CustomEvent;
    const settings = event.detail;
    if (settings) {
      this.currentLineWidth = settings.line?.width || 4;
      this.showLines = settings.line?.visible !== false;
      this.showNodes = settings.node?.visible !== false;
      this.showLabels = settings.text?.visible !== false;
    }
  };

  private handleSettingsReset = () => {
    this.currentLineWidth = 4;
    this.showLines = true;
    this.showNodes = true;
    this.showLabels = true;
  };
}
