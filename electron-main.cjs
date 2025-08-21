const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const scanManager = require('./scan-manager.cjs'); // RESTORED: necessário para startScan e eventos
const { validateSchema } = require('./ipc-validation.cjs'); // SEC-2 basic input validation
const DEV_PORT_ENV = process.env.VITE_DEV_PORT || 5173;
let detectedDevPort = null;
// CORE-4 centralized logger (phase 1). Fallback to console if import fails.
// CORE-4: use CommonJS runtime logger (avoids requiring TS transpile in Electron main during tests)
let coreLogger, getRecentLogs, enableFileLogger; try { ({ log: coreLogger, getRecentLogs, enableFile: enableFileLogger } = require('./src/logger/central-logger.cjs')); } catch { coreLogger = console; getRecentLogs = () => []; enableFileLogger = ()=>{}; }
process.on('uncaughtException', (err) => { try { coreLogger.error('[uncaughtException]', { message: err.message, stack: err.stack }); } catch {} });
process.on('unhandledRejection', (reason) => { try { coreLogger.error('[unhandledRejection]', { reason: (reason && reason.message) ? { message: reason.message, stack: reason.stack } : reason }); } catch {} });

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
  coreLogger.info('[dev-detect] probing candidates', { candidates });
  for (const p of candidates) {
    const result = await probePort(p);
    if (result.ok && result.isVite) {
    coreLogger.info('[dev-detect] using dev server port (vite signature found)', { port: p });
      return p;
    }
    if (result.ok) {
    coreLogger.debug('[dev-detect] non-vite response', { port: p });
    }
  }
  coreLogger.warn('[dev-detect] no Vite dev server detected, will fallback');
  return null;
}

app.whenReady().then(() => {
  try {
    // CORE-4: enable file sink (production only) under userData/logs
    if (app.isPackaged) {
      const logDir = path.join(app.getPath('userData'), 'logs');
      enableFileLogger(logDir, 'app.ndjson');
      coreLogger.info('[logger] file sink enabled', { dir: logDir });
    } else {
      coreLogger.debug('[logger] dev mode – file sink skipped');
    }
  } catch (err) {
    try { coreLogger.error('[logger] enable file sink failed', { error: err.message }); } catch {}
  }

  // Register IPC handlers immediately when app is ready
  registerIPCHandlers();
  createWindow();
});

function registerIPCHandlers() {

  // Window state management for dynamic map resizing
  ipcMain.handle('window:getBounds', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      return win.getBounds();
    }
    return null;
  });

  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.maximize();
      return true;
    }
    return false;
  });

  ipcMain.handle('window:unmaximize', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.unmaximize();
      return true;
    }
    return false;
  });

  ipcMain.handle('window:isMaximized', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      return win.isMaximized();
    }
    return false;
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

  // CORE-1 Favorites IPC
  ipcMain.handle('favorites:list', () => {
    favoritesCache = favoritesStore.list();
    return { success: true, favorites: favoritesCache };
  });
  ipcMain.handle('favorites:add', (e, path) => {
    const v = validateSchema([{ type: 'string', nonEmpty: true, noTraversal: true }], [path]);
    if (!v.ok) return { success: false, error: 'validation', details: v.errors };
    try {
      favoritesCache = favoritesStore.add(path);
      return { success: true, favorites: favoritesCache };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('favorites:remove', (e, path) => {
    const v = validateSchema([{ type: 'string', nonEmpty: true, noTraversal: true }], [path]);
    if (!v.ok) return { success: false, error: 'validation', details: v.errors };
    try {
      favoritesCache = favoritesStore.remove(path);
      return { success: true, favorites: favoritesCache };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // CORE-3 Settings IPC
  ipcMain.handle('settings:get', () => {
    try {
      const s = userSettingsStore.get();
      return { success: true, settings: s, file: userSettingsStore.path() };
    } catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('settings:update', (e, patch) => {
    const v = validateSchema([{ type: 'record' }], [patch]);
    if (!v.ok) return { success: false, error: 'validation', details: v.errors };
    try {
      const s = userSettingsStore.update(patch);
      try {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('settings:updated', s);
          }
        });
      } catch (_) {}
      return { success: true, settings: s };
    } catch (err) { return { success: false, error: err.message }; }
  });
}

// LEGACY synchronous scanFolder REMOVED (Item 9) – replaced by async scan manager.
// (If needed for fallback debugging, can temporarily restore behind DEV flag.)

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Start hidden to prevent visual resize
    webPreferences: {
      preload: __dirname + '/preload.cjs',
      contextIsolation: true,
  nodeIntegration: false,
  sandbox: true, // SEC-3 sandbox enabled to harden renderer, no Node primitives in DOM
  enableRemoteModule: false // explicit: remote module deprecated/disabled
    }
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
  
  // Maximize window to use full display area
  win.maximize();
  win.show();
  // Load user settings early (theme etc.) and inform renderer after load
  let initialSettings = userSettingsStore.get();
  const isDev = !app.isPackaged; // re-evaluate here after ready
  if (isDev) {
    if (process.env.DEV_FORCE_URL) {
      // Developer override: assume the dev server is at the configured port.
      detectedDevPort = DEV_PORT_ENV;
  coreLogger.info('[dev-detect] DEV_FORCE_URL set', { port: detectedDevPort });
    } else if (!detectedDevPort) {
      detectedDevPort = await findDevServerPort();
      // Retry curto adicional: às vezes Vite ainda está a bootstrapar quando electron arranca
      if (!detectedDevPort) {
        try { coreLogger.info('[dev-detect] retry in 1200ms'); } catch {}
        await new Promise(r => setTimeout(r, 1200));
        detectedDevPort = await findDevServerPort();
      }
    }
    if (detectedDevPort) {
  win.loadURL(`http://localhost:${detectedDevPort}/#forceStage`);
      // Dev-only CSP allowing Vite HMR websocket. We still avoid arbitrary remote origins.
      // SEC-1 (dev mode relaxed): allow 'unsafe-inline' style for Vite injected styles; no remote scripts.
      win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        // DEV: permitir inline + eval para Vite preamble + React Fast Refresh.
        // Mantemos restrições em outras diretivas.
        // Ajuste: remover 'unsafe-inline' e 'unsafe-eval' para alinhar com SEC-1 mesmo em dev, já que React 19 + Vite permitem sem inline se preamble carregado.
        // Se surgir erro de preamble novamente poderemos reintroduzir condicional controlada por env.
        // DEV: relax CSP to allow Vite's injected preamble (inline scripts/styles)
        // and HMR websocket. This is strictly dev-only and kept permissive
        // to avoid blocking the Vite/react preamble that is injected at runtime.
        const devCsp = [
          "default-src 'self'",
          // Allow inline scripts and eval in dev so Vite/react preamble can run.
          "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
          // Allow inline styles injected by Vite in dev.
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          // Permit both http(s) and ws to localhost dev server for HMR and client requests
          `connect-src 'self' http://localhost:${detectedDevPort} ws://localhost:${detectedDevPort}`,
          "object-src 'none'",
          "frame-ancestors 'none'",
          "base-uri 'self'"
        ].join('; ');
        callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [devCsp] } });
      });
    } else {
      coreLogger.warn('[dev-detect] fallback path engaged (no running dev server)');
      // Fallback temporário + tentativa tardia de reconectar se Vite surgir depois
      const indexPathDevFail = path.join(__dirname, 'dist', 'index.html');
      if (fs.existsSync(indexPathDevFail)) {
        win.loadFile(indexPathDevFail);
      } else {
        win.loadURL('data:text/html,<h1>Dev server não encontrado</h1><p>A iniciar tentativa tardia...</p>');
      }
      // Nova tentativa pós fallback (até 3 vezes)
      for (let attempt=1; attempt<=3 && !detectedDevPort; attempt++) {
        await new Promise(r => setTimeout(r, 1500));
        detectedDevPort = await findDevServerPort();
        if (detectedDevPort) {
          try {
            coreLogger.info('[dev-detect] late connect success', { attempt, port: detectedDevPort });
            win.loadURL(`http://localhost:${detectedDevPort}/#forceStage`);
            break;
          } catch (e) { coreLogger.error('[dev-detect] late loadURL failed', { error: e.message }); }
        } else {
          try { coreLogger.debug('[dev-detect] late retry no server', { attempt }); } catch {}
        }
      }
    }
  } else {
    // Production: load built static assets (run: npm run build)
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    win.loadFile(indexPath);
    // SEC-1 Production CSP hardened: restrict connect-src, allow only self + data: images.
    // NOTE: If inline styles required, migrate them to external CSS (handled by Vite build already).
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'", // no inline
        "img-src 'self' data:",
        "font-src 'self'", // limit fonts
        "connect-src 'self'", // no external fetch
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'"
      ].join('; ');
  // SEC-1 instrumentation (test visibility only): capture last production CSP for E2E header assertion.
  // Stored on process global to avoid exposing via IPC in production runtime; harmless string.
  try { process._lastProdCSP = csp; } catch (_) { /* ignore */ }
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
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
    const v = validateSchema([{ type: 'string', nonEmpty: true, noTraversal: true }], [pathArg]);
  if (!v.ok) { coreLogger.warn('[ipc][open-path] validation fail', { errors: v.errors }); return { success: false, error: 'validation', details: v.errors }; }
    shell.openPath(pathArg);
    return { success: true };
  });

  ipcMain.handle('rename-path', async (event, oldPath, newName) => {
    const v = validateSchema([
      { type: 'string', nonEmpty: true, noTraversal: true },
      { type: 'string', nonEmpty: true }
    ], [oldPath, newName]);
  if (!v.ok) { coreLogger.warn('[ipc][rename-path] validation fail', { errors: v.errors }); return { success: false, error: 'validation', details: v.errors }; }
    try {
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);
      fs.renameSync(oldPath, newPath);
      return { success: true, newPath };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('delete-path', async (event, targetPath) => {
    const v = validateSchema([{ type: 'string', nonEmpty: true, noTraversal: true }], [targetPath]);
  if (!v.ok) { coreLogger.warn('[ipc][delete-path] validation fail', { errors: v.errors }); return { success: false, error: 'validation', details: v.errors }; }
    try {
      if (fs.lstatSync(targetPath).isDirectory()) fs.rmdirSync(targetPath, { recursive: true });
      else fs.unlinkSync(targetPath);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('toggle-favorite', async () => {
    return { success: true };
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
  if (process.env.DEBUG_SCAN_VERBOSE) {
    scanManager.on('scan:partial', (payload) => {
      try {
  const n = payload?.nodes?.length || 0;
  const firstNode = payload?.nodes?.[0];
  const depthsSample = payload?.nodes?.slice(0,5).map(n=>n.depth).join(',');
  const anyDepth0 = payload?.nodes?.some(x => x.depth === 0);
  console.log('[main][scan:partial]', 'count=', n, 'first=', firstNode?.path, 'firstDepth=', firstNode?.depth, 'sampleDepths=', depthsSample, 'hasDepth0=', anyDepth0);
      } catch { /* ignore */ }
    });
  }
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
      const v = validateSchema([
        { type: 'string', nonEmpty: true },
        { type: 'object', optional: true }
      ], [rootPath, options]);
      if (!v.ok) return { success: false, error: 'validation', details: v.errors };
  // CORE-4: always emit request debug (will filter by level) so tests can assert presence without env flags
  try { coreLogger.debug('[scan:start] request', { rootPath, options }); } catch {}
      // Cancel any existing scans before starting a new one
      try {
        const existing = scanManager.listScans();
        for (const sid of existing) { try { scanManager.cancelScan(sid); } catch (_) {} }
  } catch (e) { coreLogger.warn('[scan:start] failed to cancel existing scans', { error: e.message }); }
      const result = scanManager.startScan(rootPath, options);
      // CORE-2 track programmatic start as well
      recentScansCache = recentScansStore.touch(rootPath);
      try { event.sender.send('scan:started', { scanId: result.scanId, rootPath }); } catch (_) {}
  // CORE-4: unconditional info log (ring buffer capture) – removed env gating to satisfy centralized logging acceptance
  try { coreLogger.info('[scan:start] started', { scanId: result.scanId, rootPath }); } catch {}
      return { success: true, ...result };
    } catch (e) {
      coreLogger.error('[scan:start] exception', { error: e.message });
      return { success: false, error: e.message };
    }
  });



  ipcMain.handle('scan:cancel', (event, scanId) => {
    try {
      if (typeof scanId !== 'string') throw new Error('scanId must be string');
      const ok = scanManager.cancelScan(scanId);
      coreLogger.info('[scan:cancel]', { scanId, ok });
      return { success: ok };
    } catch (e) {
      coreLogger.error('[scan:cancel] exception', { error: e.message, scanId });
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('scan:state', (event, scanId) => {
    try {
      const state = scanManager.getScanState(scanId);
      if (!state) return { success: false, error: 'not found' };
      return { success: true, state };
    } catch (e) {
      coreLogger.warn('[scan:state] error', { error: e.message, scanId });
      return { success: false, error: e.message };
    }
  });

  // CORE-4 expose recent logs (dev only)
  ipcMain.handle('logs:recent', (_e, limit = 100) => {
    try { return { success: true, logs: getRecentLogs(Math.min(Math.max(limit,1),500)) }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // CORE-4: renderer forwarded log events (limited surface – only accepted shape)
  ipcMain.on('renderer:log', (e, payload) => {
    try {
      if (!payload || typeof payload !== 'object') return;
      const { level, msg, detail, component } = payload;
      const allowed = ['debug','info','warn','error'];
      if (!allowed.includes(level)) return;
      (coreLogger[level] || coreLogger.info).call(coreLogger, `[renderer] ${msg}`, { component: component||'renderer', detail });
    } catch { /* swallow */ }
  });
}
