const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const scanManager = require('./scan-manager.cjs'); // RESTORED: necessário para startScan e eventos
const DEV_PORT_ENV = process.env.VITE_DEV_PORT || 5173;
let detectedDevPort = null;

// Simple favorites persistence (CORE-1) – refactored to dedicated module with corruption fallback
const { createFavoritesStore } = require('./favorites-store.cjs');
const favoritesStore = createFavoritesStore(() => path.join(app.getPath('userData'), 'favorites.json'));
// CORE-2 Recent scans store
const { createRecentScansStore } = require('./recent-scans-store.cjs');
const recentScansStore = createRecentScansStore(() => path.join(app.getPath('userData'), 'recent-scans.json'), { max: 7 });
// CORE-3 User settings store
const { createUserSettingsStore } = require('./user-settings-store.cjs');
const userSettingsStore = createUserSettingsStore(() => path.join(app.getPath('userData'), 'user-settings.json'));
let favoritesCache = favoritesStore.list();
let recentScansCache = recentScansStore.list();

async function probePort(port) {
  // Primeiro GET / para ver assinatura básica; depois se parecer Vite confirmar /@vite/client
  return new Promise((resolve) => {
    const chunks = [];
  const req = http.get({ host: 'localhost', port, path: '/', timeout: 800 }, (res) => {
      res.on('data', (d) => { if (chunks.length < 40) chunks.push(d); });
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
    const hasModuleScript = /<script[^>]+type="module"[^>]+src="\/src\/main\.[tj]sx?"/i.test(body);
        if (!hasModuleScript) {
          if (process.env.DEBUG_DEV_DETECT) {
            console.log('[dev-detect] body snippet (first 200 chars):', body.slice(0,200));
          }
          return resolve({ ok: true, isVite: false });
        }
        // Confirmação /@vite/client
        const req2 = http.get({ host: 'localhost', port, path: '/@vite/client', timeout: 800 }, (res2) => {
          const c2 = [];
            res2.on('data', (d2) => { if (c2.length < 40) c2.push(d2); });
            res2.on('end', () => {
              const body2 = Buffer.concat(c2).toString('utf8');
              const isHot = body2.includes('import.meta.hot');
              resolve({ ok: true, isVite: isHot });
            });
        });
        req2.on('error', () => resolve({ ok: true, isVite: false }));
        req2.on('timeout', () => { req2.destroy(); resolve({ ok: true, isVite: false }); });
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

async function findDevServerPort() {
  // Prioriza porta configurada e variáveis comuns; remove duplicados
  const candidates = [DEV_PORT_ENV, 5175, 5174, 5176, 5177, 5178].filter((v, i, a) => a.indexOf(v) === i);
  console.log('[dev-detect] probing candidates', candidates.join(','));
  for (const p of candidates) {
    const result = await probePort(p);
    if (result.ok && result.isVite) {
      console.log('[dev-detect] using dev server port (vite signature found)', p);
      return p;
    }
    if (result.ok) {
      console.log('[dev-detect] port', p, 'responded but not Vite, skipping');
    }
  }
  console.log('[dev-detect] no Vite dev server detected, will fallback');
  return null;
}

app.whenReady().then(createWindow);

// LEGACY synchronous scanFolder REMOVED (Item 9) – replaced by async scan manager.
// (If needed for fallback debugging, can temporarily restore behind DEV flag.)

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  // Load user settings early (theme etc.) and inform renderer after load
  let initialSettings = userSettingsStore.get();
  const isDev = !app.isPackaged; // re-evaluate here after ready
  if (isDev) {
    if (!detectedDevPort) {
      detectedDevPort = await findDevServerPort();
    }
    if (detectedDevPort) {
  win.loadURL(`http://localhost:${detectedDevPort}/#forceStage`);
      // Dev-only CSP allowing Vite HMR websocket
      win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:${detectedDevPort};`
            ]
          }
        });
      });
    } else {
      console.log('[dev-detect] fallback path engaged (no running dev server)');
      // Fallback: tenta servir build se dev server não estiver ativo
      const indexPathDevFail = path.join(__dirname, 'dist', 'index.html');
      if (fs.existsSync(indexPathDevFail)) {
        win.loadFile(indexPathDevFail);
      } else {
        win.loadURL('data:text/html,<h1>Falha ao localizar dev server</h1><p>Inicia "npm run dev" ou executa "npm run build".</p>');
      }
    }
  } else {
    // Production: load built static assets (run: npm run build)
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    win.loadFile(indexPath);
    // Minimal CSP for file:// context
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`
          ]
        }
      });
    });
  }

  // Item 9: Start asynchronous scan on startup instead of sending full tree snapshot.
  win.webContents.once('did-finish-load', () => {
  try { win.webContents.send('settings:loaded', initialSettings); } catch (e) { console.warn('failed to send initial settings', e); }
    const mockFolder = path.join(__dirname, 'mock-root');
    // Only auto-start mock scan in dev; in prod we might wait for user selection
    if (!(!app.isPackaged)) return; // only dev
    try {
      const { scanId } = scanManager.startScan(mockFolder, { includeMetadata: false });
      if (process.env.DEBUG_SCAN) console.log('[startup] async scan started', scanId, mockFolder);
  try { win.webContents.send('scan:started', { scanId, rootPath: mockFolder }); } catch (_) {}
    } catch (e) {
      console.error('[startup] failed to start async scan:', e.message);
    }
  });

  ipcMain.handle('select-and-scan-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    if (canceled || filePaths.length === 0) return { success: false, cancelled: true };
    try {
      // Cancel all existing scans to ensure only one active scan at a time
      try {
        const existing = scanManager.listScans();
        for (const sid of existing) { try { scanManager.cancelScan(sid); } catch (_) {} }
      } catch (e) { console.warn('[select-and-scan-folder] failed to cancel existing scans', e.message); }
      const { scanId } = scanManager.startScan(filePaths[0], { includeMetadata: false });
  // CORE-2 track recent path
  recentScansCache = recentScansStore.touch(filePaths[0]);
      if (process.env.DEBUG_SCAN) console.log('[selection] async scan started', scanId, filePaths[0]);
      try { win.webContents.send('scan:started', { scanId, rootPath: filePaths[0] }); } catch (_) {}
      return { success: true, scanId };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('open-path', async (event, pathArg) => {
    shell.openPath(pathArg);
    return true;
  });

  ipcMain.handle('rename-path', async (event, oldPath, newName) => {
    try {
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);
      fs.renameSync(oldPath, newPath);
      return { success: true, newPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('delete-path', async (event, targetPath) => {
    try {
      if (fs.lstatSync(targetPath).isDirectory()) {
        fs.rmdirSync(targetPath, { recursive: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('toggle-favorite', async () => {
    return { success: true };
  });

  // CORE-1 Favorites IPC
  ipcMain.handle('favorites:list', () => {
    favoritesCache = favoritesStore.list();
    return { success: true, favorites: favoritesCache, file: favoritesStore.path() };
  });
  ipcMain.handle('favorites:add', (e, absPath) => {
    try {
      favoritesCache = favoritesStore.add(absPath);
      return { success: true, favorites: favoritesCache };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('favorites:remove', (e, absPath) => {
    try {
      favoritesCache = favoritesStore.remove(absPath);
      return { success: true, favorites: favoritesCache };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('show-properties', async (event, pathArg) => {
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Propriedades',
      message: `Propriedades de ${pathArg}`,
      detail: pathArg,
      buttons: ['OK']
    });
    return true;
  });

  win.webContents.on('will-navigate', (e) => { e.preventDefault(); }); // Item 13: block external navigation
  // FIX: setWindowOpenHandler lives on webContents, not BrowserWindow instance
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); // Item 13: deny new windows

  // Store listener refs so they can be removed correctly on window close
  const forward = (channel) => (payload) => {
    if (!win.isDestroyed()) {
      if (process.env.DEBUG_SCAN && channel === 'scan:progress') {
        const { scanId, dirsProcessed, filesProcessed, queueLengthRemaining, elapsedMs, approxCompletion } = payload;
        console.log('[progress]', scanId, 'dirs:', dirsProcessed, 'files:', filesProcessed, 'queue:', queueLengthRemaining, 'elapsedMs:', elapsedMs, 'approx:', approxCompletion);
      }
      win.webContents.send(channel, payload);
    }
  };
  const onProgress = forward('scan:progress');
  const onPartial = forward('scan:partial');
  const onDone = forward('scan:done');
  scanManager.on('scan:progress', onProgress);
  scanManager.on('scan:partial', onPartial);
  scanManager.on('scan:done', onDone);

  win.on('closed', () => {
    scanManager.off('scan:progress', onProgress);
    scanManager.off('scan:partial', onPartial);
    scanManager.off('scan:done', onDone);
  });

  ipcMain.handle('scan:start', (event, rootPath, options = {}) => {
    try {
      if (typeof rootPath !== 'string' || !rootPath.trim()) throw new Error('rootPath must be a non-empty string');
      // Cancel any existing scans before starting a new one
      try {
        const existing = scanManager.listScans();
        for (const sid of existing) { try { scanManager.cancelScan(sid); } catch (_) {} }
      } catch (e) { console.warn('[scan:start] failed to cancel existing scans', e.message); }
      const result = scanManager.startScan(rootPath, options);
      // CORE-2 track programmatic start as well
      recentScansCache = recentScansStore.touch(rootPath);
      try { event.sender.send('scan:started', { scanId: result.scanId, rootPath }); } catch (_) {}
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // CORE-2 Recent scans IPC
  ipcMain.handle('recent:list', () => {
    recentScansCache = recentScansStore.list();
    return { success: true, recent: recentScansCache, max: recentScansStore.max };
  });
  ipcMain.handle('recent:clear', () => {
    recentScansCache = recentScansStore.clear();
    return { success: true, recent: recentScansCache };
  });

  // CORE-3 Settings IPC
  ipcMain.handle('settings:get', () => {
    try {
      const s = userSettingsStore.get();
      return { success: true, settings: s, file: userSettingsStore.path() };
    } catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('settings:update', (e, patch) => {
    try {
      if (!patch || typeof patch !== 'object') throw new Error('patch must be object');
      const s = userSettingsStore.update(patch);
      // Push updated settings to any open windows (single window model assumed)
      try { win.webContents.send('settings:updated', s); } catch (_) {}
      return { success: true, settings: s };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('scan:cancel', (event, scanId) => {
    try {
      if (typeof scanId !== 'string') throw new Error('scanId must be string');
      const ok = scanManager.cancelScan(scanId);
      return { success: ok };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('scan:state', (event, scanId) => {
    try {
      const state = scanManager.getScanState(scanId);
      if (!state) return { success: false, error: 'not found' };
      return { success: true, state };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}
