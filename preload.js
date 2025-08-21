// Preload script for Electron
// You can expose APIs to the renderer here if needed

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectAndScanFolder: () => ipcRenderer.invoke('select-and-scan-folder'),
});
