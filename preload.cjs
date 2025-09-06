const { contextBridge, ipcRenderer } = require('electron');

// ---------------------------------------------------------------------------
// SEC-7  |  Preload IPC hardening
// ---------------------------------------------------------------------------
// 1.  Renderer -> Main communication is restricted to an explicit allow-list of
//     channel names. Any attempt to invoke an undeclared channel will be
//     rejected with a generic error preventing channel enumeration.
// 2.  Every ipcRenderer.invoke that crosses the Electron context boundary must
//     go through the `safeInvoke` helper which performs the allow-list check.
// 3.  Renderer → Main one-way messages (send) are avoided except for
//     `renderer:log`, which is intentionally fire-and-forget and therefore left
//     as a regular `send` call.
// ---------------------------------------------------------------------------

const VALID_INVOKE_CHANNELS = new Set([
  'open-path',
  'show-properties',
  'rename-path',
  'delete-path',
  'toggle-favorite',
  'favorites:list',
  'favorites:add',
  'favorites:remove',
  'recent:list',
  'recent:clear',
  'settings:get',
  'settings:update',
  'scan:start',
  'select-and-scan-folder',
  'scan:cancel',
  'scan:state',
  'logs:recent',
  'window:getBounds',
  'window:maximize',
  'window:unmaximize',
  'window:isMaximized',
]);

function safeInvoke(channel, ...args) {
  if (!VALID_INVOKE_CHANNELS.has(channel)) {
    return Promise.reject(new Error('Invalid IPC channel'));
  }
  return ipcRenderer.invoke(channel, ...args);
}

// ---------------------------------------------------------------------------
// Main → Renderer event bridge (scan progress etc.)
// These are forwarded to DOM CustomEvents so React components can subscribe
// without importing the Electron API directly – keeping a clean separation
// between UI and host environment.
// ---------------------------------------------------------------------------
ipcRenderer.on('scan:progress', (_e, payload) => {
  try {
    window.dispatchEvent(new CustomEvent('scan:progress', { detail: payload }));
  } catch {}
});
ipcRenderer.on('scan:partial', (_e, payload) => {
  try {
    window.dispatchEvent(new CustomEvent('scan:partial', { detail: payload }));
  } catch {}
});
ipcRenderer.on('scan:done', (_e, payload) => {
  try {
    window.dispatchEvent(new CustomEvent('scan:done', { detail: payload }));
  } catch {}
});
ipcRenderer.on('scan:started', (_e, payload) => {
  try {
    window.dispatchEvent(new CustomEvent('scan:started', { detail: payload }));
  } catch {}
});

// ---------------------------------------------------------------------------
// Renderer-side API – exposed as `window.electronAPI`
// Every method that crosses the process boundary uses safeInvoke.
// Event subscriptions return an unsubscribe function for clean-up.
// ---------------------------------------------------------------------------
contextBridge.exposeInMainWorld('electronAPI', {
  // File / path operations
  openPath: (path) => safeInvoke('open-path', path),
  showProperties: (path) => safeInvoke('show-properties', path),
  renamePath: (oldPath, newName) => safeInvoke('rename-path', oldPath, newName),
  deletePath: (path) => safeInvoke('delete-path', path),
  toggleFavorite: (path, setFav) => safeInvoke('toggle-favorite', path, setFav),

  // Favorites / Recent
  favoritesList: () => safeInvoke('favorites:list'),
  favoritesAdd: (p) => safeInvoke('favorites:add', p),
  favoritesRemove: (p) => safeInvoke('favorites:remove', p),
  recentList: () => safeInvoke('recent:list'),
  recentClear: () => safeInvoke('recent:clear'),

  // Settings
  settingsGet: () => safeInvoke('settings:get'),
  settingsUpdate: (patch) => safeInvoke('settings:update', patch),
  onSettingsLoaded: (cb) => {
    ipcRenderer.on('settings:loaded', (_e, payload) => cb(payload));
    return () => ipcRenderer.removeAllListeners('settings:loaded');
  },
  onSettingsUpdated: (cb) => {
    ipcRenderer.on('settings:updated', (_e, payload) => cb(payload));
    return () => ipcRenderer.removeAllListeners('settings:updated');
  },

  // Scan lifecycle
  startScan: (rootPath, options) => safeInvoke('scan:start', rootPath, options),
  selectAndScanFolder: () => safeInvoke('select-and-scan-folder'),
  cancelScan: (scanId) => safeInvoke('scan:cancel', scanId),
  getScanState: (scanId) => safeInvoke('scan:state', scanId),
  onScanProgress: (cb) => {
    ipcRenderer.on('scan:progress', (_e, payload) => cb(payload));
    return () => ipcRenderer.removeAllListeners('scan:progress');
  },
  onScanPartial: (cb) => {
    ipcRenderer.on('scan:partial', (_e, payload) => cb(payload));
    return () => ipcRenderer.removeAllListeners('scan:partial');
  },
  onScanDone: (cb) => {
    ipcRenderer.on('scan:done', (_e, payload) => cb(payload));
    return () => ipcRenderer.removeAllListeners('scan:done');
  },
  onScanStarted: (cb) => {
    ipcRenderer.on('scan:started', (_e, payload) => cb(payload));
    return () => ipcRenderer.removeAllListeners('scan:started');
  },

  // Logs & diagnostics
  logsRecent: (limit) => safeInvoke('logs:recent', limit),
  rendererLog: (level, msg, detail, component) => {
    ipcRenderer.send('renderer:log', { level, msg, detail, component });
  },
  getLastProdCSP: () => {
    try {
      return process._lastProdCSP || null;
    } catch {
      return null;
    }
  },

  // Window state helpers
  windowGetBounds: () => safeInvoke('window:getBounds'),
  windowMaximize: () => safeInvoke('window:maximize'),
  windowUnmaximize: () => safeInvoke('window:unmaximize'),
  windowIsMaximized: () => safeInvoke('window:isMaximized'),
});
