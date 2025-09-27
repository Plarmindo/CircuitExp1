/**
 * Batch Renderer for Metro Stage
 * Optimizes PIXI.js rendering performance through batching, texture atlasing, and efficient draw calls
 */

import { Graphics, Texture, RenderTexture, Container as _Container, Application } from 'pixi.js';
// Unused type imports - keeping for future use
// import type { LayoutPointV2 } from '../layout-v2';
// import type { GraphAdapter } from '../graph-adapter';

export interface BatchRenderOptions {
  /** Maximum batch size for draw calls */
  maxBatchSize: number;
  /** Enable texture atlasing for sprites */
  enableAtlasing: boolean;
  /** Atlas texture size */
  atlasSize: number;
  /** Enable instanced rendering for similar objects */
  enableInstancing: boolean;
  /** Frustum culling buffer zone */
  cullingBuffer: number;
}

export interface RenderBatch {
  id: string;
  type: 'nodes' | 'edges' | 'labels';
  objects: BatchObject[];
  texture?: Texture;
  dirty: boolean;
}

export interface BatchObject {
  id: string;
  x: number;
  y: number;
  scale: number;
  color: number;
  alpha: number;
  visible: boolean;
  priority: number;
}

export interface BatchStats {
  totalBatches: number;
  totalObjects: number;
  renderedObjects: number;
  culledObjects: number;
  drawCalls: number;
  atlasUsage: number;
  frameTime: number;
}

const DEFAULT_OPTIONS: BatchRenderOptions = {
  maxBatchSize: 1000,
  enableAtlasing: true,
  atlasSize: 2048,
  enableInstancing: true,
  cullingBuffer: 100,
};

export class BatchRenderer {
  private app: Application;
  private options: BatchRenderOptions;
  private batches: Map<string, RenderBatch> = new Map();
  private atlas: RenderTexture | null = null;
  private atlasRegions: Map<string, { x: number; y: number; width: number; height: number }> = new Map();
  private frameStats: BatchStats = {
    totalBatches: 0,
    totalObjects: 0,
    renderedObjects: 0,
    culledObjects: 0,
    drawCalls: 0,
    atlasUsage: 0,
    frameTime: 0,
  };
  private lastFrameTime = 0;
  private viewport = { x: 0, y: 0, width: 800, height: 600, scale: 1 };

  constructor(app: Application, options: Partial<BatchRenderOptions> = {}) {
    this.app = app;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.initializeAtlas();
  }

  /**
   * Initialize texture atlas for efficient sprite batching
   */
  private initializeAtlas(): void {
    if (!this.options.enableAtlasing) return;

    try {
      this.atlas = RenderTexture.create({
        width: this.options.atlasSize,
        height: this.options.atlasSize,
      });
      console.log(`[BatchRenderer] Atlas initialized: ${this.options.atlasSize}x${this.options.atlasSize}`);
    } catch (error) {
      console.warn('[BatchRenderer] Failed to create atlas:', error);
      this.options.enableAtlasing = false;
    }
  }

  /**
   * Update viewport for frustum culling
   */
  updateViewport(x: number, y: number, width: number, height: number, scale: number): void {
    this.viewport = { x, y, width, height, scale };
  }

  /**
   * Create or update a render batch
   */
  createBatch(
    id: string,
    type: 'nodes' | 'edges' | 'labels',
    objects: BatchObject[]
  ): void {
    const existingBatch = this.batches.get(id);

    if (existingBatch) {
      // Update existing batch
      existingBatch.objects = objects;
      existingBatch.dirty = true;
    } else {
      // Create new batch
      const batch: RenderBatch = {
        id,
        type,
        objects,
        dirty: true,
      };
      this.batches.set(id, batch);
    }
  }

  /**
   * Perform frustum culling on batch objects
   */
  private cullObjects(objects: BatchObject[]): BatchObject[] {
    const { x, y, width, height, scale } = this.viewport;
    const buffer = this.options.cullingBuffer;

    const left = x - buffer;
    const right = x + width + buffer;
    const top = y - buffer;
    const bottom = y + height + buffer;

    return objects.filter(obj => {
      const objX = obj.x * scale;
      const objY = obj.y * scale;
      const objSize = obj.scale * scale;

      return (
        objX + objSize >= left &&
        objX - objSize <= right &&
        objY + objSize >= top &&
        objY - objSize <= bottom &&
        obj.visible &&
        obj.alpha > 0
      );
    });
  }

  /**
   * Render all batches with optimizations
   */
  render(): void {
    const startTime = performance.now();

    this.frameStats = {
      totalBatches: this.batches.size,
      totalObjects: 0,
      renderedObjects: 0,
      culledObjects: 0,
      drawCalls: 0,
      atlasUsage: this.calculateAtlasUsage(),
      frameTime: 0,
    };

    // Sort batches by type and priority for optimal rendering order
    const sortedBatches = Array.from(this.batches.values()).sort((a, b) => {
      const typeOrder = { edges: 0, nodes: 1, labels: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });

    for (const batch of sortedBatches) {
      this.renderBatch(batch);
    }

    this.frameStats.frameTime = performance.now() - startTime;
    this.lastFrameTime = this.frameStats.frameTime;
  }

  /**
   * Render a single batch with culling and instancing
   */
  private renderBatch(batch: RenderBatch): void {
    this.frameStats.totalObjects += batch.objects.length;

    // Perform frustum culling
    const visibleObjects = this.cullObjects(batch.objects);
    this.frameStats.renderedObjects += visibleObjects.length;
    this.frameStats.culledObjects += batch.objects.length - visibleObjects.length;

    if (visibleObjects.length === 0) return;

    // Group objects by similar properties for batching
    const groups = this.groupObjectsForBatching(visibleObjects);

    for (const group of groups) {
      this.renderObjectGroup(batch.type, group);
      this.frameStats.drawCalls++;
    }
  }

  /**
   * Group objects with similar properties for efficient batching
   */
  private groupObjectsForBatching(objects: BatchObject[]): BatchObject[][] {
    const groups: BatchObject[][] = [];
    let currentGroup: BatchObject[] = [];
    let lastColor = -1;
    let lastAlpha = -1;

    // Sort by color and alpha for better batching
    const sortedObjects = objects.sort((a, b) => {
      if (a.color !== b.color) return a.color - b.color;
      if (a.alpha !== b.alpha) return a.alpha - b.alpha;
      return a.priority - b.priority;
    });

    for (const obj of sortedObjects) {
      // Start new group if properties changed or group is full
      if (
        (obj.color !== lastColor || obj.alpha !== lastAlpha) ||
        currentGroup.length >= this.options.maxBatchSize
      ) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [];
        lastColor = obj.color;
        lastAlpha = obj.alpha;
      }

      currentGroup.push(obj);
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Render a group of similar objects efficiently
   */
  private renderObjectGroup(type: 'nodes' | 'edges' | 'labels', objects: BatchObject[]): void {
    if (objects.length === 0) return;

    // Use instanced rendering for large groups if supported
    if (this.options.enableInstancing && objects.length > 10) {
      this.renderInstanced(type, objects);
    } else {
      this.renderIndividual(type, objects);
    }
  }

  /**
   * Render objects using instanced rendering
   */
  private renderInstanced(type: 'nodes' | 'edges' | 'labels', objects: BatchObject[]): void {
    if (!this.app.renderer.gl) {
      // Fallback to individual rendering if WebGL is not available
      this.renderIndividual(type, objects);
      return;
    }

    const gl = this.app.renderer.gl;
    const ext = gl.getExtension('ANGLE_instanced_arrays');

    if (!ext) {
      // Fallback if instanced arrays extension is not available
      console.warn('[BatchRenderer] ANGLE_instanced_arrays not supported, falling back to individual rendering');
      this.renderIndividual(type, objects);
      return;
    }

    // Create instance data buffer
    const instanceData = new Float32Array(objects.length * 8); // x, y, scale, r, g, b, a, unused

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const baseIndex = i * 8;

      instanceData[baseIndex] = obj.x;
      instanceData[baseIndex + 1] = obj.y;
      instanceData[baseIndex + 2] = obj.scale;
      instanceData[baseIndex + 3] = ((obj.color >> 16) & 0xFF) / 255; // R
      instanceData[baseIndex + 4] = ((obj.color >> 8) & 0xFF) / 255; // G
      instanceData[baseIndex + 5] = (obj.color & 0xFF) / 255; // B
      instanceData[baseIndex + 6] = obj.alpha; // A
      instanceData[baseIndex + 7] = 0; // Padding for alignment
    }

    // Create or get instanced geometry
    const instancedGeometry = this.createInstancedGeometry(type, objects.length);
    if (!instancedGeometry) {
      this.renderIndividual(type, objects);
      return;
    }

    // Upload instance data
    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW);

    // Set up vertex attributes for instancing
    const stride = 8 * Float32Array.BYTES_PER_ELEMENT;

    // Position attribute (x, y)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    ext.vertexAttribDivisorANGLE(0, 1);

    // Scale attribute
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    ext.vertexAttribDivisorANGLE(1, 1);

    // Color attribute (r, g, b, a)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    ext.vertexAttribDivisorANGLE(2, 1);

    // Use instanced shader program
    const shaderProgram = this.getInstancedShaderProgram(type);
    gl.useProgram(shaderProgram);

    // Set uniforms
    const resolutionLocation = gl.getUniformLocation(shaderProgram, 'u_resolution');
    gl.uniform2f(resolutionLocation, this.app.screen.width, this.app.screen.height);

    // Draw instanced
    ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, instancedGeometry.vertexCount, objects.length);

    // Clean up
    gl.deleteBuffer(instanceBuffer);

    // Reset vertex attribute divisors
    ext.vertexAttribDivisorANGLE(0, 0);
    ext.vertexAttribDivisorANGLE(1, 0);
    ext.vertexAttribDivisorANGLE(2, 0);
  }

  /**
   * Create instanced geometry for the given type
   */
  private createInstancedGeometry(type: 'nodes' | 'edges' | 'labels', _instanceCount: number): { vertexCount: number; vao: WebGLVertexArrayObject } | null {
    const gl = this.app.renderer.gl;

    // Create vertex array object
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let vertices: Float32Array;
    let vertexCount: number;

    switch (type) {
      case 'nodes':
        // Create a simple circle geometry for nodes
        vertexCount = this.createCircleGeometry(gl, 5); // 5 unit radius
        break;
      case 'edges':
        // Create a simple line geometry for edges
        vertexCount = this.createLineGeometry(gl);
        break;
      case 'labels':
        // Create a simple quad geometry for labels
        vertexCount = this.createQuadGeometry(gl, 20, 10); // 20x10 quad
        break;
      default:
        return null;
    }

    gl.bindVertexArray(null);
    return { vertexCount, vao };
  }

  /**
   * Create circle geometry for nodes
   */
  private createCircleGeometry(gl: WebGLRenderingContext, radius: number): number {
    const segments = 16;
    const vertices: number[] = [];

    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      // Triangle: center, point1, point2
      vertices.push(0, 0);
      vertices.push(Math.cos(angle1) * radius, Math.sin(angle1) * radius);
      vertices.push(Math.cos(angle2) * radius, Math.sin(angle2) * radius);
    }

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    // Set up vertex attribute
    gl.enableVertexAttribArray(3); // Base vertex positions
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);

    return segments * 3; // 3 vertices per triangle
  }

  /**
   * Create line geometry for edges
   */
  private createLineGeometry(gl: WebGLRenderingContext): number {
    const _vertices = new Float32Array([
      -10, 0,  // Start point
      10, 0    // End point
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Set up vertex attribute
    gl.enableVertexAttribArray(3); // Base vertex positions
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);

    return 2;
  }

  /**
   * Create quad geometry for labels
   */
  private createQuadGeometry(gl: WebGLRenderingContext, width: number, height: number): number {
    const halfW = width / 2;
    const halfH = height / 2;

    const _vertices = new Float32Array([
      -halfW, -halfH,  // Bottom left
       halfW, -halfH,  // Bottom right
       halfW,  halfH,  // Top right
      -halfW, -halfH,  // Bottom left
       halfW,  halfH,  // Top right
      -halfW,  halfH   // Top left
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Set up vertex attribute
    gl.enableVertexAttribArray(3); // Base vertex positions
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);

    return 6; // 6 vertices for 2 triangles
  }

  /**
   * Get or create instanced shader program for the given type
   */
  private getInstancedShaderProgram(type: 'nodes' | 'edges' | 'labels'): WebGLProgram {
    const gl = this.app.renderer.gl;

    // Cache shader programs
    const cacheKey = `instanced_${type}`;
    let program = (this.app.renderer as any)._batchRendererShaderCache?.[cacheKey];

    if (!program) {
      const vertexShader = this.createVertexShader(type);
      const fragmentShader = this.createFragmentShader(type);

      program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[BatchRenderer] Shader program linking failed:', gl.getProgramInfoLog(program));
        program = this.getFallbackShaderProgram();
      }

      // Cache the program
      if (!(this.app.renderer as any)._batchRendererShaderCache) {
        (this.app.renderer as any)._batchRendererShaderCache = {};
      }
      (this.app.renderer as any)._batchRendererShaderCache[cacheKey] = program;
    }

    return program;
  }

  /**
   * Create vertex shader for instanced rendering
   */
  private createVertexShader(_type: 'nodes' | 'edges' | 'labels'): WebGLShader {
    const gl = this.app.renderer.gl;

    const source = `
      attribute vec2 a_basePosition;
      attribute vec2 a_instancePosition;
      attribute float a_instanceScale;
      attribute vec4 a_instanceColor;

      uniform vec2 u_resolution;

      varying vec4 v_color;

      void main() {
        vec2 position = a_basePosition * a_instanceScale + a_instancePosition;
        vec2 clipSpace = ((position / u_resolution) * 2.0) - 1.0;

        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        v_color = a_instanceColor;
      }
    `;

    return this.compileShader(gl.VERTEX_SHADER, source);
  }

  /**
   * Create fragment shader for instanced rendering
   */
  private createFragmentShader(_type: 'nodes' | 'edges' | 'labels'): WebGLShader {
    const gl = this.app.renderer.gl;

    const source = `
      precision mediump float;

      varying vec4 v_color;

      void main() {
        gl_FragColor = v_color;
      }
    `;

    return this.compileShader(gl.FRAGMENT_SHADER, source);
  }

  /**
   * Get fallback shader program for when instanced rendering fails
   */
  private getFallbackShaderProgram(): WebGLProgram {
    const gl = this.app.renderer.gl;

    const vertexSource = `
      attribute vec2 a_position;
      uniform vec2 u_resolution;

      void main() {
        vec2 clipSpace = ((a_position / u_resolution) * 2.0) - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      uniform vec4 u_color;

      void main() {
        gl_FragColor = u_color;
      }
    `;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    return program;
  }

  /**
   * Compile shader source
   */
  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.app.renderer.gl;
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[BatchRenderer] Shader compilation failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Render objects individually (fallback method)
   */
  private renderIndividual(type: 'nodes' | 'edges' | 'labels', objects: BatchObject[]): void {
    const graphics = new Graphics();

    for (const obj of objects) {
      switch (type) {
        case 'nodes':
          this.drawNode(graphics, obj);
          break;
        case 'edges':
          this.drawEdge(graphics, obj);
          break;
        case 'labels':
          this.drawLabel(graphics, obj);
          break;
      }
    }

    // Add to stage for rendering
    this.app.stage.addChild(graphics);
  }

  /**
   * Draw a node sprite
   */
  private drawNode(graphics: Graphics, obj: BatchObject): void {
    graphics.beginFill(obj.color, obj.alpha);
    graphics.drawCircle(obj.x, obj.y, obj.scale * 5);
    graphics.endFill();
  }

  /**
   * Draw an edge sprite
   */
  private drawEdge(graphics: Graphics, obj: BatchObject): void {
    graphics.lineStyle(obj.scale * 2, obj.color, obj.alpha);
    // Note: This is simplified - actual edge rendering would need start/end points
    graphics.moveTo(obj.x - 10, obj.y);
    graphics.lineTo(obj.x + 10, obj.y);
  }

  /**
   * Draw a label sprite
   */
  private drawLabel(graphics: Graphics, obj: BatchObject): void {
    // Note: This is simplified - actual label rendering would use Text objects
    graphics.beginFill(obj.color, obj.alpha);
    graphics.drawRect(obj.x - 20, obj.y - 5, 40, 10);
    graphics.endFill();
  }

  /**
   * Calculate atlas texture usage percentage
   */
  private calculateAtlasUsage(): number {
    if (!this.atlas || !this.options.enableAtlasing) return 0;

    const totalPixels = this.options.atlasSize * this.options.atlasSize;
    let usedPixels = 0;

    for (const region of this.atlasRegions.values()) {
      usedPixels += region.width * region.height;
    }

    return (usedPixels / totalPixels) * 100;
  }

  /**
   * Get current frame statistics
   */
  getStats(): BatchStats {
    return { ...this.frameStats };
  }

  /**
   * Clear all batches
   */
  clear(): void {
    this.batches.clear();
    this.atlasRegions.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clear();

    if (this.atlas) {
      this.atlas.destroy();
      this.atlas = null;
    }
  }

  /**
   * Update rendering options
   */
  updateOptions(options: Partial<BatchRenderOptions>): void {
    this.options = { ...this.options, ...options };

    // Reinitialize atlas if size changed
    if (options.atlasSize && options.atlasSize !== this.options.atlasSize) {
      if (this.atlas) {
        this.atlas.destroy();
      }
      this.initializeAtlas();
    }
  }
}
