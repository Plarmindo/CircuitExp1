const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function scanFolder(dirPath) {
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) return null;
  const result = {
    name: path.basename(dirPath),
    path: dirPath,
    children: [],
  };
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const itemStats = fs.statSync(itemPath);
      if (itemStats.isDirectory()) {
        result.children.push(scanFolder(itemPath));
      } else {
        result.children.push({
          name: item,
          path: itemPath,
          type: 'file',
        });
      }
    }
  } catch (err) {
    result.error = err.message;
  }
  return result;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  // Set proper Content Security Policy headers
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';"
        ]
      }
    });
  });

  win.loadURL('http://localhost:5173');

  ipcMain.handle('select-and-scan-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    if (canceled || filePaths.length === 0) return null;
    return scanFolder(filePaths[0]);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
