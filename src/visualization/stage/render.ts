import { Application, Container, Graphics, Text } from 'pixi.js';
import { drawOrthogonalRoute, type RouteCommand } from '../line-routing';
import type { LayoutPointV2 } from '../layout-v2';
import type { GraphAdapter } from '../graph-adapter';
// Unused type import - keeping for future use
// import type { MetroDebugWindow } from './debug-api';

export interface RenderSceneParams {
  app: Application;
  pixiFailed: boolean;
  layoutNodes: Array<
    LayoutPointV2 & { aggregatedChildrenPaths?: string[]; aggregatedExpanded?: boolean }
  >;
  adapter: GraphAdapter;
  nodeIndex: Map<string, LayoutPointV2>;
  style: ReturnType<typeof import('../style-tokens').tokens>;
  scaleRef: { current: number };
  disableCullingRef: { current: boolean };
  hoveredKeyRef: { current: string | null };
  selectedKeyRef: { current: string | null };
  nodeColorRef: { current: Map<string, number> };
  spriteNodes: { current: Map<string, Graphics> };
  spriteLines: { current: Map<string, Graphics> };
  spriteBadges: { current: Map<string, Text> };
  spriteLabels: { current: Map<string, Text> };
  reuseStatsRef: { current: { totalAllocated: number; reusedPct: number } };
  lastCulledCountRef: { current: number };
  // Optional depth cap (LOD) — when set, nodes with depth greater than this are culled
  depthCap?: number | null;
  onNodeSpriteCreate?: (sprite: Graphics, key: string) => void; // allow caller to attach event handlers
}

interface RouteCollected {
  key: string;
  commands: RouteCommand[];
}

// Utility to convert millimeters to CSS pixels, cached for performance
let __pxPerMMCache: number | null = null;
function getPxPerMM(): number {
  if (__pxPerMMCache && Number.isFinite(__pxPerMMCache)) return __pxPerMMCache;
  try {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const div = document.createElement('div');
      div.style.width = '100mm';
      div.style.height = '0';
      div.style.position = 'absolute';
      div.style.visibility = 'hidden';
      document.body.appendChild(div);
      const px = div.getBoundingClientRect().width;
      document.body.removeChild(div);
      if (Number.isFinite(px) && px > 0) {
        __pxPerMMCache = px / 100;
        return __pxPerMMCache;
      }
    }
  } catch {
    /* ignore */
  }
  __pxPerMMCache = 96 / 25.4; // CSS px per mm fallback
  return __pxPerMMCache;
}

export function renderScene(p: RenderSceneParams) {
  const {
    app,
    pixiFailed,
    layoutNodes,
    adapter,
    nodeIndex,
    style,
    scaleRef,
    disableCullingRef,
    hoveredKeyRef,
    selectedKeyRef,
    nodeColorRef,
    spriteNodes,
    spriteLines,
    spriteBadges,
    spriteLabels,
    reuseStatsRef,
    lastCulledCountRef,
    depthCap,
    onNodeSpriteCreate,
  } = p;

  if (import.meta.env?.DEV && (!layoutNodes || layoutNodes.length === 0)) {
    type AdapterWithDebug = GraphAdapter & { debugRootCount?: () => number };
    const rootCount = (adapter as AdapterWithDebug).debugRootCount
      ? (adapter as AdapterWithDebug).debugRootCount!()
      : 'n/a';
    console.warn(
      '[renderScene] empty layoutNodes; adapter size=',
      adapter.size(),
      'roots=',
      rootCount
    );
    try {
      const g = new Graphics();
      g.beginFill(0xff0000, 1);
      g.drawCircle(6, 6, 5);
      g.endFill();
      (app.stage.children[1] as Container).addChild(g);
    } catch {
      /* ignore */
    }
  }

  const seenNodeKeys = new Set<string>();
  const seenLineKeys = new Set<string>();

  const getNodeSprite = (key: string) => {
    let s = spriteNodes.current.get(key);
    if (!s) {
      s = new Graphics();
      if (!pixiFailed) {
        s.eventMode = 'static';
        s.cursor = 'pointer';
        (app.stage.children[1] as Container).addChild(s); // stations layer
        reuseStatsRef.current.totalAllocated++;
        if (onNodeSpriteCreate) onNodeSpriteCreate(s, key);
      }
      spriteNodes.current.set(key, s);
    }
    return s;
  };

  const getLineSprite = (key: string) => {
    let s = spriteLines.current.get(key);
    if (!s) {
      s = new Graphics();
      if (!pixiFailed) (app.stage.children[0] as Container).addChild(s); // lines layer
      spriteLines.current.set(key, s);
    }
    return s;
  };

  // Lines first
  const gridSize = 20;
  const snap = (v: number) => Math.round(v / gridSize) * gridSize;
  const siblingRouteOffsetMap = new Map<string, number>();
  const getSiblingOffset = (parentPath: string, snappedCy: number) => {
    const key = parentPath + '|' + snappedCy;
    const count = siblingRouteOffsetMap.get(key) || 0;
    siblingRouteOffsetMap.set(key, count + 1);
    if (count === 0) return 0;
    const magnitude = 4 * Math.ceil(count / 2);
    return (count % 2 === 1 ? 1 : -1) * magnitude;
  };
  const collectedRoutes: RouteCollected[] = [];

  // Precompute desired screen-space sizes and current scale
  const __pxPerMM = getPxPerMM();
  const __nodeDiameterMM = 2.5; // requirement: nodes 2.5mm (diameter)
  const __nodeRadiusPx = (__nodeDiameterMM * __pxPerMM) / 2; // screen-space radius in px
  const __textMM = 2; // requirement: text 2mm
  const __textPx = __textMM * __pxPerMM; // screen-space font size in px

  for (const lp of layoutNodes) {
    if (lp.aggregated) continue;
    const node = adapter.getNode(lp.path);
    if (!node || !node.parentPath) continue;
    if (pixiFailed) continue;
    // Obtain parent point for depth checks and routing
    const parentPoint =
      nodeIndex.get(node.parentPath) ||
      nodeIndex.get(node.parentPath.replace(/\\/g, '/')) ||
      nodeIndex.get(node.parentPath.replace(/\//g, String.raw`\\`));
    if (!parentPoint) continue;
    // Depth cap culling for lines: skip if either endpoint is beyond depth cap
    if (depthCap != null && (lp.depth > depthCap || parentPoint.depth > depthCap)) {
      continue;
    }
    // DEBUG: log primeira dezena para diagnosticar ausência de linhas
    if (import.meta.env?.DEV && collectedRoutes.length < 10) {
      try {
        console.log(
          '[renderScene][debug-line] parent->child candidate',
          node.parentPath,
          '->',
          lp.path
        );
      } catch {
        /* ignore */
      }
    }
    const _parentNode = adapter.getNode(node.parentPath);
    // Compute world-space radii that yield a constant screen-space size
    const parentRadius = __nodeRadiusPx / Math.max(1e-6, p.scaleRef.current);
    const childRadius = __nodeRadiusPx / Math.max(1e-6, p.scaleRef.current);
    const lineKey = `${node.parentPath}__${lp.path}`;
    const lg = getLineSprite(lineKey);
    lg.visible = true; // garantir que não fica oculto por algum estado anterior
    const siblingOffsetX = getSiblingOffset(node.parentPath, snap(lp.y));
    const computed = drawOrthogonalRoute(lg, {
      parentX: parentPoint.x,
      parentY: parentPoint.y,
      childX: lp.x,
      childY: lp.y,
      parentRadius,
      childRadius,
      lineThickness: style.lineThickness,
      color: style.palette.line || 0x444444,
      siblingOffsetX,
      gridSize,
      allowDiagonal45: true,
    });
    collectedRoutes.push({ key: lineKey, commands: computed.commands });
    seenLineKeys.add(lineKey);
  }

  if (typeof window !== 'undefined' && (window as any).__metroDebug) {
    (window as any).__metroDebug.lastRoutes = collectedRoutes.slice(0, 50);
  }

  const scaleNow = scaleRef.current;
  let culled = 0;
  for (const lp of layoutNodes) {
    // Depth cap culling for nodes
    if (depthCap != null && lp.depth > depthCap) {
      // Do not create/update sprites; treat as culled and let cleanup remove prior sprites
      culled++;
      continue;
    }
    const node = adapter.getNode(lp.path);
    const key = lp.path;
    if (pixiFailed) {
      let fill = style.palette.directory;
      if (lp.aggregated) fill = style.palette.aggregated;
      else if (node?.kind === 'file') fill = style.palette.file;
      nodeColorRef.current.set(key, fill);
      seenNodeKeys.add(key);
      continue;
    }
    const g = getNodeSprite(key);
    g.clear();
    // Fixed visual size: compute world-space radius from desired screen-space px
    const radiusWorld = __nodeRadiusPx / Math.max(1e-6, scaleNow);
    let fill = style.palette.directory;
    if (lp.aggregated) {
      fill = style.palette.aggregated;
    } else if (node?.kind === 'file') {
      fill = style.palette.file;
    }
    nodeColorRef.current.set(key, fill);
    // With fixed screen-space nodes, projected radius is constant in px
    const projectedRadius = __nodeRadiusPx;
    const cullThreshold = 0.5;
    if (!disableCullingRef.current && projectedRadius < cullThreshold) {
      if (lp.aggregated) {
        g.visible = true;
        const pxSize = 2 / Math.max(1e-6, scaleNow);
        g.beginFill(style.palette.aggregated, 1);
        g.drawRect(-pxSize / 2, -pxSize / 2, pxSize, pxSize);
        g.endFill();
        const count = lp.aggregatedChildrenPaths?.length || 0;
        let badge = spriteBadges.current.get(key);
        const label =
          count > 999 ? '1k+' : count > 99 ? `${Math.floor(count / 100)}00+` : `${count}`;
        if (!badge) {
          badge = new Text({ text: label, style: { fill: '#ffffff', fontSize: __textPx } });
          badge.anchor.set(0.5);
          spriteBadges.current.set(key, badge);
          app.stage.addChild(badge);
        } else if (badge.text !== label) {
          badge.text = label;
        }
        badge.visible = true;
        badge.x = lp.x;
        badge.y = lp.y - 6 / Math.max(1e-6, scaleNow);
        badge.scale.set(1 / Math.max(1e-6, scaleNow));
      } else {
        const existing = spriteBadges.current.get(key);
        if (existing) existing.visible = false;
      }
      if (!lp.aggregated) g.visible = false; // culled normal node
      culled++;
      g.x = lp.x;
      g.y = lp.y;
      seenNodeKeys.add(key);
      continue;
    } else {
      g.visible = true;
      const existing = spriteBadges.current.get(key);
      if (existing) existing.visible = false;
    }
    const isHovered = hoveredKeyRef.current === key;
    const isSelected = selectedKeyRef.current === key;
    const strokeColor = isSelected
      ? style.palette.selected
      : lp.aggregated
        ? style.palette.lineAgg
        : 0;
    const strokeWidth = isSelected
      ? style.lineThickness + 1.5
      : lp.aggregated
        ? style.lineThickness
        : 0;
    const halo = isHovered && !isSelected;
    if (halo) {
      g.beginFill(style.palette.hover, 0.18);
      // Halo radius: node radius plus 10px, converted to world-space
      g.drawCircle(0, 0, (__nodeRadiusPx + 10) / Math.max(1e-6, scaleNow));
      g.endFill();
    }
    g.beginFill(fill, 1);
    g.drawCircle(0, 0, radiusWorld);
    g.endFill();
    if (lp.aggregated && lp.aggregatedExpanded) {
      g.lineStyle(2, style.palette.selected, 0.8);
      // Use 4px padding converted to world-space
      const pad = 4 / Math.max(1e-6, scaleNow);
      g.moveTo(-radiusWorld + pad, 0);
      g.lineTo(radiusWorld - pad, 0);
      g.moveTo(0, -radiusWorld + pad);
      g.lineTo(0, radiusWorld - pad);
      g.lineStyle();
    }
    if (strokeWidth > 0) {
      g.lineStyle(strokeWidth, strokeColor, 0.95);
      // Outer ring offset: +/- 2px converted to world-space
      const delta = (isSelected ? 2 : -4) / Math.max(1e-6, scaleNow);
      g.drawCircle(0, 0, radiusWorld + delta);
      g.lineStyle();
    }
    g.x = lp.x;
    g.y = lp.y;
    seenNodeKeys.add(key);
    if (!lp.aggregated && node?.kind === 'dir' && spriteLabels.current.size < 300) {
      let label = spriteLabels.current.get(key);
      if (!label) {
        label = new Text({
          text: node.name || key.split([/[/\\]/] as any).pop() || key,
          style: { fill: '#444', fontSize: __textPx },
        });
        label.anchor.set(0.5, -0.2);
        spriteLabels.current.set(key, label);
        app.stage.addChild(label);
      }
      label.text = node.name || label.text;
      label.x = lp.x;
      label.y = lp.y;
      // Keep text visually constant by inversely scaling with zoom
      label.scale.set(1 / Math.max(1e-6, scaleNow));
      label.visible = g.visible;
    } else {
      const existing = spriteLabels.current.get(key);
      if (existing) existing.visible = g.visible;
    }
  }

  lastCulledCountRef.current = culled;

  // Reuse stats update
  if (reuseStatsRef.current.totalAllocated > 0) {
    reuseStatsRef.current.reusedPct =
      (spriteNodes.current.size / reuseStatsRef.current.totalAllocated) * 100;
  }

  // Cleanup orphan sprites
  for (const [k, s] of spriteNodes.current) {
    if (!seenNodeKeys.has(k)) {
      s.destroy({ children: true, texture: true, baseTexture: true });
      spriteNodes.current.delete(k);
    }
  }
  for (const [k, s] of spriteLines.current) {
    if (!seenLineKeys.has(k)) {
      s.destroy({ children: true, texture: true, baseTexture: true });
      spriteLines.current.delete(k);
    }
  }
  for (const [k, b] of spriteBadges.current) {
    if (!seenNodeKeys.has(k)) {
      b.destroy({ children: true, texture: true, baseTexture: true });
      spriteBadges.current.delete(k);
    }
  }
  for (const [k, lbl] of spriteLabels.current) {
    if (!seenNodeKeys.has(k)) {
      lbl.destroy({ children: true, texture: true, baseTexture: true });
      spriteLabels.current.delete(k);
    }
  }

  if (import.meta.env?.DEV) {
    try {
      const linesLayer = app.stage.children[0] as Container;
      const drawnLines = linesLayer.children.length;
      if (!drawnLines) {
        console.warn('[renderScene][debug] nenhuma linha desenhada; adicionando linha de teste');
        const test = new Graphics();
        test.lineStyle({ width: 2, color: 0xff0000, alpha: 1 });
        test.moveTo(-50, -50);
        test.lineTo(50, 50);
        linesLayer.addChild(test);
      } else {
        console.log('[renderScene][debug] linhas desenhadas', {
          sprites: spriteLines.current.size,
          layerChildren: drawnLines,
          seen: seenLineKeys.size,
        });
      }
    } catch {
      /* ignore */
    }
  }

  // Dispatch LOD stats for HUD consumers
  try {
    const totalNodes = layoutNodes.length;
    const renderedCount = totalNodes - culled;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('metro:lodStats', {
          detail: {
            scale: scaleNow,
            depthCap: depthCap ?? null,
            rendered: renderedCount,
            total: totalNodes,
            culled,
          },
        })
      );
    }
  } catch {
    /* ignore */
  }

  return { culled };
}
