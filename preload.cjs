const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  showProperties: (path) => ipcRenderer.invoke('show-properties', path),
  renamePath: (oldPath, newName) => ipcRenderer.invoke('rename-path', oldPath, newName),
  deletePath: (path) => ipcRenderer.invoke('delete-path', path),
  toggleFavorite: (path, setFav) => ipcRenderer.invoke('toggle-favorite', path, setFav),
  favoritesList: () => ipcRenderer.invoke('favorites:list'),
  favoritesAdd: (p) => ipcRenderer.invoke('favorites:add', p),
  favoritesRemove: (p) => ipcRenderer.invoke('favorites:remove', p),
  recentList: () => ipcRenderer.invoke('recent:list'),
  recentClear: () => ipcRenderer.invoke('recent:clear'),
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsUpdate: (patch) => ipcRenderer.invoke('settings:update', patch),
  onSettingsLoaded: (cb) => { ipcRenderer.on('settings:loaded', (_e, payload) => cb(payload)); return () => ipcRenderer.removeAllListeners('settings:loaded'); },
  onSettingsUpdated: (cb) => { ipcRenderer.on('settings:updated', (_e, payload) => cb(payload)); return () => ipcRenderer.removeAllListeners('settings:updated'); },
  startScan: (rootPath, options) => ipcRenderer.invoke('scan:start', rootPath, options),
  selectAndScanFolder: () => ipcRenderer.invoke('select-and-scan-folder'), // Item 10
  cancelScan: (scanId) => ipcRenderer.invoke('scan:cancel', scanId),
  getScanState: (scanId) => ipcRenderer.invoke('scan:state', scanId),
  onScanProgress: (cb) => { ipcRenderer.on('scan:progress', (_e, payload) => cb(payload)); return () => ipcRenderer.removeAllListeners('scan:progress'); },
  onScanPartial: (cb) => { ipcRenderer.on('scan:partial', (_e, payload) => cb(payload)); return () => ipcRenderer.removeAllListeners('scan:partial'); },
  onScanDone: (cb) => { ipcRenderer.on('scan:done', (_e, payload) => cb(payload)); return () => ipcRenderer.removeAllListeners('scan:done'); }
});
