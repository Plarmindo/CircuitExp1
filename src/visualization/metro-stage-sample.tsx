import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { createGraphAdapter } from './graph-adapter';
import { layoutHierarchicalV2 } from './layout-v2';
import type { ScanNode } from '../shared/scan-types';
import { tokens } from './style-tokens';

interface MetroStageSampleProps { width?: number; height?: number; }

/**
 * MetroStageSample – standalone stage that renders a small mock tree so the
 * interface is not empty when the Electron bridge is unavailable (e.g. pure
 * browser preview or unit-tests).
 */
export const MetroStageSample: React.FC<MetroStageSampleProps> = ({ width = 900, height = 600 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    const adapter = createGraphAdapter();

    // --- Build mock tree (root → two dirs → some files) --------------------
    const mockNodes: ScanNode[] = [
      { path: 'root', name: 'root', depth: 0, kind: 'dir' },
      { path: 'root/dirA', parentPath: 'root', name: 'dirA', depth: 1, kind: 'dir' },
      { path: 'root/dirB', parentPath: 'root', name: 'dirB', depth: 1, kind: 'dir' },
      { path: 'root/dirA/file1.txt', parentPath: 'root/dirA', name: 'file1.txt', depth: 2, kind: 'file' },
      { path: 'root/dirA/file2.txt', parentPath: 'root/dirA', name: 'file2.txt', depth: 2, kind: 'file' },
      { path: 'root/dirB/file3.txt', parentPath: 'root/dirB', name: 'file3.txt', depth: 2, kind: 'file' },
      { path: 'root/dirB/file4.txt', parentPath: 'root/dirB', name: 'file4.txt', depth: 2, kind: 'file' }
    ];
    adapter.applyDelta(mockNodes);

    // --- PIXI setup ---------------------------------------------------------
    const app = new PIXI.Application();
    appRef.current = app;
    const style = tokens();
    app.init({ width, height, background: style.palette.background, antialias: true }).then(() => {
      if (containerRef.current) containerRef.current.appendChild(app.canvas as HTMLCanvasElement);

      const linesLayer = new PIXI.Container();
      const stationsLayer = new PIXI.Container();
      app.stage.addChild(linesLayer, stationsLayer);

      const redraw = () => {
        const layout = layoutHierarchicalV2(adapter, {});
        setNodeCount(layout.nodes.length);
        linesLayer.removeChildren();
        stationsLayer.removeChildren();

        // Draw lines
        for (const lp of layout.nodes) {
          if (lp.aggregated) continue;
          const node = adapter.getNode(lp.path);
          if (node?.parentPath) {
            const parentPoint = layout.nodeIndex.get(node.parentPath);
            if (parentPoint) {
              const g = new PIXI.Graphics();
              g.lineStyle({ width: style.lineThickness, color: style.palette.line, alpha: 0.35 });
              g.moveTo(parentPoint.x, parentPoint.y);
              g.lineTo(lp.x, lp.y);
              linesLayer.addChild(g);
            }
          }
        }

        // Draw stations
        for (const lp of layout.nodes) {
          const node = adapter.getNode(lp.path);
          const g = new PIXI.Graphics();
          let radius = style.stationRadius.directory;
          let fill = style.palette.directory;
          if (lp.aggregated) {
            radius = style.stationRadius.aggregated;
            fill = style.palette.aggregated;
          } else if (node?.kind === 'file') {
            radius = style.stationRadius.file;
            fill = style.palette.file;
          }
          g.beginFill(fill, 1);
          g.drawCircle(0, 0, radius);
          g.endFill();
          if (lp.aggregated) {
            g.lineStyle({ width: style.lineThickness, color: style.palette.lineAgg, alpha: 0.9 });
            g.drawCircle(0, 0, radius - 4);
            g.lineStyle();
          }
          g.x = lp.x;
          g.y = lp.y;
          stationsLayer.addChild(g);
        }
      };

      redraw();
    });

    return () => {
      const inst = appRef.current as PIXI.Application | null;
      if (inst && (inst as any).renderer) {
        inst.destroy(true);
      }
    };
  }, [width, height]);

  return (
    <div style={{ border: '1px solid #ccc', marginTop: 24 }}>
      <div style={{ padding: '4px 8px', background: '#f0f0f0', fontSize: 12 }}>Sample Stage (Nodes: {nodeCount})</div>
      <div ref={containerRef} style={{ width, height }} />
    </div>
  );
};