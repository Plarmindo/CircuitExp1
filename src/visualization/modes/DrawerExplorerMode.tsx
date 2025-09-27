import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResponsiveMetroStage from '../../components/ResponsiveMetroStage';
import { UnifiedNavigation } from '../../navigation/unified-navigation';
import { MiniMap } from '../../components/MiniMap';

export interface DrawerExplorerModeProps {
  theme?: any;
  layout?: any[];
  routes?: any[];
  onNodeClick?: (p: string) => void;
  onNodeHover?: (p: string | null) => void;
  onLayoutUpdate?: (l: any[]) => void;
  debug?: boolean;
}

const DRAWER_WIDTH = 360;
const ITEM_HEIGHT = 28;

type TabKey = 'favorites' | 'recent';

const DrawerExplorerMode: React.FC<DrawerExplorerModeProps> = (props) => {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('favorites');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [filter, setFilter] = useState('');
  const [announce, setAnnounce] = useState('');
  const [showMinimap, setShowMinimap] = useState(true);

  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [focusIndex, setFocusIndex] = useState<number>(-1);

  // Load lists
  const loadFavorites = useCallback(async () => {
    setLoadingFavs(true);
    try {
      const list = await UnifiedNavigation.favorites.list();
      setFavorites(list || []);
    } catch (e) {
      console.error('Failed to load favorites', e);
    } finally {
      setLoadingFavs(false);
    }
  }, []);
  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await UnifiedNavigation.recent.list();
      const list = Array.isArray((res as any)?.recent) ? (res as any).recent : (res as any);
      setRecent(list || []);
    } catch (e) {
      console.error('Failed to load recent', e);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    // initial load
    loadFavorites();
    loadRecent();
  }, [loadFavorites, loadRecent]);

  // Forward node click while opening the drawer and tracking the selection locally
  const handleNodeClick = useCallback(
    (p: string) => {
      setSelectedPath(p);
      if (!drawerOpen) setDrawerOpen(true);
      props.onNodeClick?.(p);
    },
    [drawerOpen, props]
  );

  // Forward hover unchanged
  const handleNodeHover = useCallback(
    (p: string | null) => props.onNodeHover?.(p),
    [props]
  );

  // When drawer state changes, emit panel events so ResponsiveMetroStage recalculates dimensions
  useEffect(() => {
    const ev = new CustomEvent(drawerOpen ? 'panel:maximized' : 'panel:minimized');
    window.dispatchEvent(ev);
    // Also schedule a follow-up resize after CSS transition
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 180);
    return () => window.clearTimeout(t);
  }, [drawerOpen]);

  const drawerAriaLabel = useMemo(
    () => (selectedPath ? `Details for ${selectedPath}` : 'Selection drawer'),
    [selectedPath]
  );

  const activeList = tab === 'favorites' ? favorites : recent;
  const filteredList = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter((p) => p.toLowerCase().includes(q));
  }, [activeList, filter, tab]);

  // Virtualization calculations
  const viewportHeight = 260; // body upper area reserved; actual container gets flex so compute via ref on render
  const total = filteredList.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 3);
  const endIndex = Math.min(total, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + 3);
  const itemsToRender = filteredList.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  const centerOnPath = useCallback((path: string) => {
    const ev = new CustomEvent('metro:centerOnPath', { detail: { path } });
    window.dispatchEvent(ev);
    setAnnounce(`Centered on ${path}`);
  }, []);

  const onItemActivate = useCallback(
    (path: string, index: number) => {
      setSelectedPath(path);
      centerOnPath(path);
      setFocusIndex(index);
    },
    [centerOnPath]
  );

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const max = total - 1;
    const k = e.key;
    const withAccel = (e as React.KeyboardEvent).ctrlKey || (e as React.KeyboardEvent).metaKey;

    // Suppress zoom shortcuts while focus is in the list: avoid stage actions and browser page zoom
    if (k === '+' || k === '=' || k === '-' || (withAccel && (k === '+' || k === '=' || k === '-' || k === '0' || k === 'Digit0'))) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(max, (focusIndex >= 0 ? focusIndex : -1) + 1);
      setFocusIndex(next);
      const needed = next * ITEM_HEIGHT;
      if (listRef.current && needed > scrollTop + viewportHeight - ITEM_HEIGHT) {
        listRef.current.scrollTop = needed - (viewportHeight - ITEM_HEIGHT);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, (focusIndex >= 0 ? focusIndex : 0) - 1);
      setFocusIndex(prev);
      const needed = prev * ITEM_HEIGHT;
      if (listRef.current && needed < scrollTop) {
        listRef.current.scrollTop = needed;
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusIndex(0);
      if (listRef.current) listRef.current.scrollTop = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusIndex(max);
      if (listRef.current) listRef.current.scrollTop = max * ITEM_HEIGHT;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const idx = focusIndex >= 0 ? focusIndex : 0;
      const path = filteredList[idx];
      if (path) onItemActivate(path, idx);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: drawerOpen ? '1fr auto' : '1fr 0px',
        transition: 'grid-template-columns 160ms ease',
      }}
    >
      {/* Stage area */}
      <div style={{ position: 'relative', minWidth: 0 }}>
        <ResponsiveMetroStage
          theme={props.theme}
          layout={props.layout}
          routes={props.routes}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onLayoutUpdate={props.onLayoutUpdate}
          debug={props.debug}
        />

        {/* Edge opener when closed */}
        {!drawerOpen && (
          <button
            type="button"
            aria-label="Open selection drawer"
            onClick={() => setDrawerOpen(true)}
            style={{
              position: 'absolute',
              top: '50%',
              right: 8,
              transform: 'translateY(-50%)',
              background: 'var(--panel)',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 4,
              padding: '6px 8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              cursor: 'pointer',
            }}
          >
            ▶
          </button>
        )}
      </div>

      {/* Drawer panel */}
      <aside
        role="complementary"
        aria-label={drawerAriaLabel}
        aria-hidden={!drawerOpen}
        style={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          overflow: 'hidden',
          borderLeft: '1px solid var(--border, #e5e7eb)',
          background: 'var(--panel)',
          color: 'var(--text, inherit)',
          transition: 'width 160ms ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderBottom: '1px solid var(--border, #e5e7eb)',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedPath ? selectedPath : 'No selection'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              aria-pressed={tab === 'favorites'}
              aria-label="Show favorites"
              onClick={() => setTab('favorites')}
              style={{
                background: tab === 'favorites' ? 'var(--accent, #3b82f6)' : 'transparent',
                color: tab === 'favorites' ? '#fff' : 'inherit',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Favorites
            </button>
            <button
              type="button"
              aria-pressed={tab === 'recent'}
              aria-label="Show recent"
              onClick={() => setTab('recent')}
              style={{
                background: tab === 'recent' ? 'var(--accent, #3b82f6)' : 'transparent',
                color: tab === 'recent' ? '#fff' : 'inherit',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Recent
            </button>
            <button
              type="button"
              aria-label="Close drawer"
              onClick={() => setDrawerOpen(false)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Controls */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #e5e7eb)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            placeholder={`Filter ${tab}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter entries"
            style={{ flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border, #e5e7eb)' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input type="checkbox" checked={showMinimap} onChange={(e) => setShowMinimap(e.target.checked)} />
            Minimap
          </label>
        </div>

        {/* List area */}
        <div style={{ padding: '8px 0 0 0', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <div
            role="listbox"
            aria-label={tab === 'favorites' ? 'Favorites list' : 'Recent list'}
            aria-busy={tab === 'favorites' ? loadingFavs : loadingRecent}
            tabIndex={0}
            ref={listRef}
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            onKeyDown={onListKeyDown}
            style={{
              overflow: 'auto',
              height: viewportHeight,
              outline: 'none',
            }}
          >
            <div style={{ height: total * ITEM_HEIGHT, position: 'relative' }}>
              <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
                {itemsToRender.map((path, i) => {
                  const absoluteIndex = startIndex + i;
                  const selected = selectedPath === path;
                  const focused = focusIndex === absoluteIndex;
                  return (
                    <button
                      key={path + '_' + absoluteIndex}
                      role="option"
                      aria-selected={selected}
                      onClick={() => onItemActivate(path, absoluteIndex)}
                      tabIndex={focused ? 0 : -1}
                      style={{
                        display: 'block',
                        width: '100%',
                        height: ITEM_HEIGHT,
                        textAlign: 'left',
                        padding: '6px 10px',
                        background: focused ? 'rgba(59,130,246,0.12)' : 'transparent',
                        color: 'inherit',
                        border: 'none',
                        borderBottom: '1px solid var(--border, #e5e7eb)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {path}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Minimap section */}
          {showMinimap && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border, #e5e7eb)' }}>
              <MiniMap />
            </div>
          )}
        </div>

        {/* Screen reader live region */}
        <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
          {announce}
        </div>
      </aside>
    </div>
  );
};

export default DrawerExplorerMode;
