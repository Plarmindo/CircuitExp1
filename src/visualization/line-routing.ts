import * as PIXI from 'pixi.js';

export interface RouteParams {
  parentX: number; parentY: number; childX: number; childY: number;
  parentRadius: number; childRadius: number; lineThickness: number;
  color: number; gridSize?: number; siblingOffsetX?: number;
}

export type RouteCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; cx: number; cy: number; x: number; y: number };

export interface ComputedRoute {
  commands: RouteCommand[];
  startExitY: number; // Y coordinate where line exits parent perimeter
  endPerimeterX: number; // X coordinate where line hits child perimeter (horizontal termination)
  snappedParent: { x: number; y: number };
  snappedChild: { x: number; y: number };
}

// Pure computation of orthogonal + optional rounded corner route. Useful for tests.
export function computeOrthogonalRoute(p: RouteParams): ComputedRoute {
  const gridSize = p.gridSize ?? 20;
  const snap = (v: number) => Math.round(v / gridSize) * gridSize;
  const px = snap(p.parentX); const py = snap(p.parentY);
  const cx = snap(p.childX); const cy = snap(p.childY);
  const dx = cx - px; const dy = cy - py;
  const absDx = Math.abs(dx); const absDy = Math.abs(dy);
  const cornerRadius = Math.min(18, absDx * 0.5, absDy * 0.5);
  const startY = py + (dy > 0 ? p.parentRadius : -p.parentRadius);
  const siblingOffsetX = p.siblingOffsetX || 0;
  const routePx = px + siblingOffsetX;
  const childPerimeterX = cx - Math.sign(dx || 1) * (p.childRadius + 0.5);
  const cmds: RouteCommand[] = [];
  cmds.push({ type: 'M', x: px, y: startY });
  if (siblingOffsetX) cmds.push({ type: 'L', x: routePx, y: startY });
  // Special-case: very small horizontal separation risks horizontal segment crossing child interior.
  // We detour to the side before reaching child's center line to prevent drawing through station circle.
  const smallDx = absDx <= p.childRadius + 2;
  if (smallDx) {
    const direction = dx >= 0 ? 1 : -1; // choose side relative to child center
    const approachY = cy - (dy > 0 ? p.childRadius + 2 : -p.childRadius - 2); // stop just outside vertical above/below child perimeter
    const sideX = cx + direction * (p.childRadius + 6); // lateral detour beyond perimeter to ensure clear approach
    const perimeterX = cx + direction * (p.childRadius + 0.5);
    // Vertical toward approach point (if not already there)
    if (startY !== approachY) cmds.push({ type: 'L', x: routePx, y: approachY });
    // Horizontal out to side detour
    if (routePx !== sideX) cmds.push({ type: 'L', x: sideX, y: approachY });
    // Vertical down/up to child's center Y
    if (approachY !== cy) cmds.push({ type: 'L', x: sideX, y: cy });
    // Horizontal into perimeter (stop before entering circle)
    if (sideX !== perimeterX) cmds.push({ type: 'L', x: perimeterX, y: cy });
    return { commands: cmds, startExitY: startY, endPerimeterX: perimeterX, snappedParent: { x: px, y: py }, snappedChild: { x: cx, y: cy } };
  }
  if (cornerRadius > 4 && absDx > 6 && absDy > 6) {
    const vertExtent = (absDy - cornerRadius - p.childRadius * 0.6);
    const vertEndY = startY + (dy > 0 ? Math.max(0, vertExtent) : -Math.max(0, vertExtent));
    cmds.push({ type: 'L', x: routePx, y: vertEndY });
    const ctrlX = routePx; const ctrlY = cy;
    const horizStartX = routePx + (dx > 0 ? cornerRadius : -cornerRadius);
    cmds.push({ type: 'Q', cx: ctrlX, cy: ctrlY, x: horizStartX, y: cy });
    cmds.push({ type: 'L', x: childPerimeterX, y: cy });
  } else {
    cmds.push({ type: 'L', x: routePx, y: cy });
    cmds.push({ type: 'L', x: childPerimeterX, y: cy });
  }
  return { commands: cmds, startExitY: startY, endPerimeterX: childPerimeterX, snappedParent: { x: px, y: py }, snappedChild: { x: cx, y: cy } };
}

// Draws the route using PIXI based on pure commands.
export function drawOrthogonalRoute(g: PIXI.Graphics, p: RouteParams): ComputedRoute {
  const computed = computeOrthogonalRoute(p);
  g.clear();
  g.lineStyle({ width: p.lineThickness, color: p.color, alpha: 0.9, join: 'round', cap: 'round' });
  for (const c of computed.commands) {
    if (c.type === 'M') g.moveTo(c.x, c.y);
    else if (c.type === 'L') g.lineTo(c.x, c.y);
    else if (c.type === 'Q') g.quadraticCurveTo(c.cx, c.cy, c.x, c.y);
  }
  return computed;
}
