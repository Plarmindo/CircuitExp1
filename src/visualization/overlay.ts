import type { MutableRefObject } from 'react';

export function initOverlay(
  container: HTMLElement,
  overlayDivRef: MutableRefObject<HTMLDivElement | null>
) {
  if (overlayDivRef.current) return; // already
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.top = '4px';
  div.style.right = '4px';
  div.style.background = 'rgba(0,0,0,0.55)';
  div.style.color = '#fff';
  div.style.font = '11px/1.3 monospace';
  div.style.padding = '6px 8px';
  div.style.borderRadius = '4px';
  div.style.pointerEvents = 'none';
  div.style.whiteSpace = 'pre';
  div.style.display = 'none';
  overlayDivRef.current = div;
  // Ensure container is positioned
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(div);
}

export interface OverlayUpdateParams {
  overlayDiv: HTMLDivElement | null;
  overlayEnabled: boolean;
  fpsTimes: number[];
  layoutSize: number;
  lastCulled: number;
  spriteNodes: number;
  spriteLines: number;
  reusePct: number;
  lastLayoutMs: number;
  lastBatchMs: number;
  avgCost: number | null;
  benchResult?: {
    baselineAvg: number;
    culledAvg: number;
    improvementPct: number;
    reusePct: number;
  } | null;
}

export function updateOverlayBox(p: OverlayUpdateParams) {
  const div = p.overlayDiv;
  if (!div || !p.overlayEnabled) {
    if (div) div.style.display = 'none';
    return;
  }
  div.style.display = 'block';
  const now = performance.now();
  p.fpsTimes.push(now);
  while (p.fpsTimes.length && now - p.fpsTimes[0] > 1000) p.fpsTimes.shift();
  const fps = p.fpsTimes.length;
  const benchLine = p.benchResult
    ? `\nBench Δ ${p.benchResult.improvementPct.toFixed(1)}% (base ${p.benchResult.baselineAvg.toFixed(2)}ms -> ${p.benchResult.culledAvg.toFixed(2)}ms)`
    : '';
  div.textContent = `FPS ${fps}\nNodes ${p.layoutSize}\nCulled ${p.lastCulled}\nSprites N:${p.spriteNodes} L:${p.spriteLines}\nReuse ${p.reusePct.toFixed(1)}%\nLayout ${p.lastLayoutMs.toFixed(1)}ms\nBatch ${p.lastBatchMs.toFixed(1)}ms${p.avgCost != null ? `\nOverlay ${p.avgCost.toFixed(3)}ms` : ''}${benchLine}`;
}
