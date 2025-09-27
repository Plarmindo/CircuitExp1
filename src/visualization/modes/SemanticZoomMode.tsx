import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResponsiveMetroStage from '../../components/ResponsiveMetroStage';
import type { LayoutNodeLite, RouteCommand } from '../stage/types';

export interface SemanticZoomModeProps {
  layout?: LayoutNodeLite[];
  routes?: RouteCommand[];
  onNodeClick?: (path: string) => void;
  onNodeHover?: (path: string | null) => void;
  onLayoutUpdate?: (layout: LayoutNodeLite[]) => void;
  theme?: any;
  debug?: boolean;
}

interface DebugWindow {
  __metroDebug?: {
    getScale?: () => number;
    getViewport?: () => { x: number; y: number; scale: number } | null;
    getNodes?: () => Array<{ path: string; x: number; y: number; aggregated?: boolean }>;
  };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

const scaleToPct = (s: number) => `${Math.round(clamp(s, 0.05, 5) * 100)}%`;

// Reasonable default thresholds; can be tuned later or made configurable
const LOW_THRESHOLD = 0.6; // overview
const HIGH_THRESHOLD = 1.0; // detail

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

// Thin shell enhanced with semantic overlays and zoom controls
const SemanticZoomMode: React.FC<SemanticZoomModeProps> = (props) => {
  const [scale, setScale] = useState<number>(1);
  const [center, setCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [focusPath, setFocusPath] = useState<string>('');
  const [announce, setAnnounce] = useState<string>('');
  const lastAnnounceRef = useRef<string>('');
  const rafRef = useRef<number | null>(null);
  const lastSampleRef = useRef<number>(0);

  const dbg = (typeof window !== 'undefined' ? (window as unknown as DebugWindow).__metroDebug : undefined);

  const crumbSegments = useMemo(() => {
    const path = focusPath || '';
    const parts = path.split('/').filter(Boolean);
    const segs: Array<{ label: string; path: string }> = [];
    const acc: string[] = [];
    for (const p of parts) {
      acc.push(p);
      segs.push({ label: p, path: '/' + acc.join('/') });
    }
    return segs;
  }, [focusPath]);

  const level = useMemo<'overview' | 'region' | 'detail'>(() => {
    if (scale < LOW_THRESHOLD) return 'overview';
    if (scale >= HIGH_THRESHOLD) return 'detail';
    return 'region';
  }, [scale]);

  const announceSR = useCallback((msg: string) => {
    if (msg && msg !== lastAnnounceRef.current) {
      lastAnnounceRef.current = msg;
      setAnnounce(msg);
    }
  }, []);

  const jumpToPath = useCallback((path: string) => {
    try {
      const ev = new CustomEvent('metro:centerOnPath', { detail: { path } });
      window.dispatchEvent(ev);
    } catch {
      // no-op
    }
  }, []);

  const findNearestPathToCenter = useCallback((): string | '' => {
    try {
      const nodes = dbg?.getNodes?.();
      if (!nodes || !nodes.length) return '';
      const cx = center.x;
      const cy = center.y;
      let best: { path: string; d2: number } | null = null;
      for (const n of nodes) {
        const d = dist2(cx, cy, n.x, n.y);
        if (!best || d < best.d2) best = { path: n.path, d2: d };
      }
      return best?.path || '';
    } catch {
      return '';
    }
  }, [center.x, center.y, dbg]);

  // Sample viewport + scale at ~10Hz to keep overlay in sync without heavy coupling
  useEffect(() => {
    let mounted = true;
    const sample = (t: number) => {
      if (!mounted) return;
      const last = lastSampleRef.current;
      if (t - last >= 100) {
        lastSampleRef.current = t;
        const vp = dbg?.getViewport?.();
        const s = dbg?.getScale?.();
        if (vp && Number.isFinite(vp.x) && Number.isFinite(vp.y)) {
          const c = { x: vp.x, y: vp.y };
          if (c.x !== center.x || c.y !== center.y) {
            setCenter(c);
          }
        }
        if (typeof s === 'number' && Number.isFinite(s) && s !== scale) {
          setScale(s);
        }
      }
      rafRef.current = requestAnimationFrame(sample);
    };
    rafRef.current = requestAnimationFrame(sample);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [center.x, center.y, scale, dbg]);

  // Update focus path based on level and nearest node
  useEffect(() => {
    const nearest = findNearestPathToCenter();
    if (!nearest) return;
    if (level === 'detail') {
      if (nearest !== focusPath) setFocusPath(nearest);
    } else if (level === 'region') {
      const parts = nearest.split('/').filter(Boolean);
      const parent = parts.length > 1 ? '/' + parts.slice(0, parts.length - 1).join('/') : '/' + parts.join('/');
      if (parent !== focusPath) setFocusPath(parent);
    } else {
      // overview: root segment (first two parts to give context if available)
      const parts = nearest.split('/').filter(Boolean);
      const root = parts.length > 1 ? '/' + parts.slice(0, 1).join('/') : '/' + (parts[0] || '');
      if (root !== focusPath) setFocusPath(root);
    }
  }, [level, findNearestPathToCenter]);

  // Announce SR updates on scale/focus changes
  useEffect(() => {
    const msg = `Zoom ${scaleToPct(scale)}, focus ${focusPath || 'root'}`;
    announceSR(msg);
  }, [scale, focusPath, announceSR]);

  // Keyboard handlers for zoom in/out/fit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // If another handler has already handled this event, skip to avoid double-dispatch
      if (e.defaultPrevented || (e as any).cancelBubble) return;

      // Gating: only respond when the Stage container has focus (or focus is within it)
      const stage = document.querySelector('.stage-container') as HTMLElement | null;
      const active = (document.activeElement as HTMLElement | null) || null;
      const withinStage = !!stage && (active === stage || (!!active && stage.contains(active)));
      if (!withinStage) return;

      // avoid interfering with inputs or editable content inside overlays
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable = target.getAttribute('contenteditable') === 'true';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) return;
      }
      const k = e.key;
      // Support Ctrl/Cmd + =/- and bare +/- for convenience
      const withAccel = e.ctrlKey || e.metaKey;
      if (k === '+' || k === '=' || (withAccel && (k === '+' || k === '='))) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('metro:zoomIn'));
      } else if (k === '-' || (withAccel && k === '-')) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('metro:zoomOut'));
      } else if (k === '0' && withAccel) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('metro:fit'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onCrumbClick = useCallback((p: string) => {
    setFocusPath(p);
    jumpToPath(p);
  }, [jumpToPath]);

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  };

  const hudStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'rgba(20,20,20,0.6)',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 12,
    pointerEvents: 'auto',
    userSelect: 'none',
    backdropFilter: 'blur(4px)',
  };

  const crumbBarStyle: React.CSSProperties = {
    position: 'absolute',
    left: 12,
    top: 12,
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    background: 'rgba(255,255,255,0.9)',
    color: '#333',
    borderRadius: 6,
    padding: '6px 10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    pointerEvents: 'auto',
  };

  const crumbStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'transparent',
  };

  const crumbActiveStyle: React.CSSProperties = {
    ...crumbStyle,
    background: '#e6f2ff',
    color: '#084298',
    fontWeight: 600,
  };

  const sepStyle: React.CSSProperties = { opacity: 0.5 };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ResponsiveMetroStage {...props} />
      <div style={overlayStyle} aria-hidden>
        {/* Breadcrumbs */}
        {crumbSegments.length > 0 && (
          <nav aria-label="Breadcrumb" style={crumbBarStyle}>
            {crumbSegments.map((c, i) => {
              const isLast = i === crumbSegments.length - 1;
              const st = isLast ? crumbActiveStyle : crumbStyle;
              return (
                <React.Fragment key={c.path}>
                  <button
                    type="button"
                    onClick={() => onCrumbClick(c.path)}
                    style={st}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {c.label || '/'}
                  </button>
                  {!isLast && <span style={sepStyle}>/</span>}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        {/* Zoom HUD */}
        <div role="status" aria-live="polite" style={hudStyle}>
          <div style={{ fontWeight: 600, letterSpacing: 0.2 }}>Zoom {scaleToPct(scale)}</div>
          <div style={{ opacity: 0.85, fontSize: 11, marginTop: 2 }}>Mode: {level}</div>
        </div>
      </div>

      {/* Screen reader live region */}
      <div aria-live="polite" style={srOnly}>{announce}</div>
    </div>
  );
};

export default SemanticZoomMode;
