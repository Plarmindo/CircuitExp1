import { Graphics } from 'pixi.js';

export interface RouteParams {
  parentX: number;
  parentY: number;
  childX: number;
  childY: number;
  parentRadius: number;
  childRadius: number;
  lineThickness: number;
  color: number;
  gridSize?: number;
  siblingOffsetX?: number;
  allowDiagonal45?: boolean; // habilita tentativa de segmentos diagonais 45°/-45° quando reduz caminho e sobreposição
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
  const px = snap(p.parentX);
  const py = snap(p.parentY);
  const cx = snap(p.childX);
  const cy = snap(p.childY);
  const dx = cx - px;
  const dy = cy - py;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const cornerRadius = Math.min(18, absDx * 0.5, absDy * 0.5);
  // Tentativa de rota diagonal simples (45°) se habilitado, ambos eixos têm magnitude comparável e distância suficiente.
  if (p.allowDiagonal45) {
    // Critério: manter proporção entre dx e dy dentro de 0.55-1.8 e ambos acima de 40% gridSize
    const ratio = absDx && absDy ? (absDx > absDy ? absDx / absDy : absDy / absDx) : Infinity;
    if (absDx > gridSize * 0.4 && absDy > gridSize * 0.4 && ratio < 1.8) {
      // Ponto de saída vertical do pai (como antes)
      const startY = py + (dy > 0 ? p.parentRadius : -p.parentRadius);
      const cmds: RouteCommand[] = [{ type: 'M', x: px, y: startY }];
      // Ajuste opcional de offset de irmãos somente no primeiro segmento
      const siblingOffsetX = p.siblingOffsetX || 0;
      const startX = px + siblingOffsetX;
      if (siblingOffsetX) cmds.push({ type: 'L', x: startX, y: startY });
      // Calcular destino na periferia da criança ao longo de uma linha 45°: avançar até antes do raio da criança
      const signX = dx >= 0 ? 1 : -1;
      const signY = dy >= 0 ? 1 : -1;
      const diagLen = Math.min(absDx, absDy) - p.childRadius * 0.8; // mantém pequena margem
      // Centro projetado ao longo diagonal
      const midX = startX + signX * diagLen;
      const midY = startY + signY * (diagLen - p.parentRadius * 0.2); // leve compensação vertical por ter saído da circunferência
      // Terminamos horizontalmente (ou diagonal final) até perímetro da criança
      const childPerimeterX = cx - Math.sign(dx || 1) * (p.childRadius + 0.5);
      // Se já estamos quase alinhados horizontalmente, fazer segmento direto para perímetro em y do filho
      if (Math.abs(midY - cy) < gridSize * 0.6) {
        cmds.push({ type: 'L', x: midX, y: midY });
        cmds.push({ type: 'L', x: childPerimeterX, y: cy });
        return {
          commands: cmds,
          startExitY: startY,
          endPerimeterX: childPerimeterX,
          snappedParent: { x: px, y: py },
          snappedChild: { x: cx, y: cy },
        };
      } else {
        // Duas diagonais: até ponto intermediário próximo ao alinhamento y do filho, depois horizontal final
        const mid2Y = cy;
        const mid2X = midX + signX * Math.abs(cy - midY);
        cmds.push({ type: 'L', x: midX, y: midY });
        cmds.push({ type: 'L', x: mid2X, y: mid2Y });
        cmds.push({ type: 'L', x: childPerimeterX, y: cy });
        return {
          commands: cmds,
          startExitY: startY,
          endPerimeterX: childPerimeterX,
          snappedParent: { x: px, y: py },
          snappedChild: { x: cx, y: cy },
        };
      }
    }
  }
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
    return {
      commands: cmds,
      startExitY: startY,
      endPerimeterX: perimeterX,
      snappedParent: { x: px, y: py },
      snappedChild: { x: cx, y: cy },
    };
  }
  if (cornerRadius > 4 && absDx > 6 && absDy > 6) {
    const vertExtent = absDy - cornerRadius - p.childRadius * 0.6;
    const vertEndY = startY + (dy > 0 ? Math.max(0, vertExtent) : -Math.max(0, vertExtent));
    cmds.push({ type: 'L', x: routePx, y: vertEndY });
    const ctrlX = routePx;
    const ctrlY = cy;
    const horizStartX = routePx + (dx > 0 ? cornerRadius : -cornerRadius);
    cmds.push({ type: 'Q', cx: ctrlX, cy: ctrlY, x: horizStartX, y: cy });
    cmds.push({ type: 'L', x: childPerimeterX, y: cy });
  } else {
    cmds.push({ type: 'L', x: routePx, y: cy });
    cmds.push({ type: 'L', x: childPerimeterX, y: cy });
  }
  return {
    commands: cmds,
    startExitY: startY,
    endPerimeterX: childPerimeterX,
    snappedParent: { x: px, y: py },
    snappedChild: { x: cx, y: cy },
  };
}

// Draws the route using PIXI based on pure commands.
export function drawOrthogonalRoute(g: Graphics, p: RouteParams): ComputedRoute {
  const computed = computeOrthogonalRoute(p);
  g.clear();
  // PixiJS v8: usar nova API explícita de stroke
  try {
    // @ts-expect-error setStrokeStyle existe em Pixi v8
    g.setStrokeStyle({
      width: p.lineThickness,
      color: p.color,
      alpha: 0.9,
      join: 'round',
      cap: 'round',
    });
  } catch {
    // fallback para compat (deprecatado) se setStrokeStyle indisponível
    g.lineStyle({
      width: p.lineThickness,
      color: p.color,
      alpha: 0.9,
      join: 'round',
      cap: 'round',
    });
  }
  for (const c of computed.commands) {
    if (c.type === 'M') g.moveTo(c.x, c.y);
    else if (c.type === 'L') g.lineTo(c.x, c.y);
    else if (c.type === 'Q') g.quadraticCurveTo(c.cx, c.cy, c.x, c.y);
  }
  try {
    (g as unknown as { stroke?: () => void }).stroke?.();
  } catch {
    /* ignore */
  }
  return computed;
}
