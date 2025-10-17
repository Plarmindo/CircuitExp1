const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development' || process.env.DEV_FORCE_URL === '1';

// Import CSP Manager for security headers
const { CSPManager } = require('./src/security/csp-manager.cjs');
const cspManager = CSPManager.getInstance();

// Import scan manager and validation
const scanManager = require('./scan-manager.cjs');
const { validateSchema, sanitizePath, isSafePath } = require('./ipc-validation.cjs');
const { realpath } = require('fs').promises;

// Track active scans and main window reference
let mainWindow = null;
const activeScanCount = new Map(); // scanId -> count
const rateLimitMap = new Map(); // windowId -> { count, resetTime }
const MAX_CONCURRENT_SCANS = 1;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Event throttling
const EVENT_THROTTLE_MS = 100; // 10 Hz
const lastEventTime = new Map(); // eventType -> timestamp
const pendingEvents = new Map(); // eventType -> event data

// Path allowlist for security
const ALLOWED_SCAN_ROOTS = [
  path.join(require('os').homedir()),
  'C:\\Users', // Windows
  '/Users',    // macOS
  '/home'      // Linux
];

// Import stores
const { createFavoritesStore } = require('./favorites-store.cjs');
const { createRecentScansStore } = require('./recent-scans-store.cjs');

// Initialize stores
const favoritesStore = createFavoritesStore(() => 
  path.join(app.getPath('userData'), 'favorites.json')
);
const recentScansStore = createRecentScansStore(
  () => path.join(app.getPath('userData'), 'recent-scans.json'),
  { max: 10 }
);

// Enhanced security logging
function logSecurityViolation(type, details, windowId) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    details,
    windowId,
    userAgent: mainWindow?.webContents.getUserAgent() || 'unknown'
  };
  console.warn('[SECURITY]', JSON.stringify(logEntry));
}

// Rate limiting per window
function checkRateLimit(windowId) {
  const now = Date.now();
  const windowData = rateLimitMap.get(windowId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > windowData.resetTime) {
    windowData.count = 0;
    windowData.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  windowData.count++;
  rateLimitMap.set(windowId, windowData);
  
  return windowData.count <= MAX_REQUESTS_PER_WINDOW;
}

// Validate scan path security with realpath
async function validateScanPath(inputPath, windowId) {
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    logSecurityViolation('invalid_path_type', { inputPath: typeof inputPath }, windowId);
    throw new Error('Invalid path: must be a non-empty string');
  }

  const sanitized = sanitizePath(inputPath);
  if (!sanitized) {
    logSecurityViolation('path_sanitization_failed', { inputPath }, windowId);
    throw new Error('Invalid path: contains unsafe characters or traversal');
  }

  if (!isSafePath(sanitized)) {
    logSecurityViolation('path_traversal_detected', { inputPath, sanitized }, windowId);
    throw new Error('Invalid path: path traversal detected');
  }

  let resolvedPath;
  try {
    // Use realpath to resolve symlinks and get canonical path
    resolvedPath = await realpath(sanitized);
  } catch (error) {
    logSecurityViolation('path_resolution_failed', { inputPath, sanitized, error: error.message }, windowId);
    throw new Error('Invalid path: cannot resolve path');
  }

  // Check against allowed roots using canonical paths
  const isAllowed = await Promise.all(
    ALLOWED_SCAN_ROOTS.map(async (root) => {
      try {
        const resolvedRoot = await realpath(root);
        return resolvedPath.startsWith(resolvedRoot);
      } catch {
        return false;
      }
    })
  ).then(results => results.some(Boolean));

  if (!isAllowed) {
    logSecurityViolation('access_denied', { inputPath, resolvedPath, allowedRoots: ALLOWED_SCAN_ROOTS }, windowId);
    throw new Error('Access denied: path outside allowed directories');
  }

  return resolvedPath;
}

// Setup IPC handlers
function setupIpcHandlers() {
  // Scan operations
  ipcMain.handle('scan:start', async (event, rootPath, options = {}) => {
    const windowId = event.sender.id;
    let result = null;
    
    try {
      // Rate limiting check
      if (!checkRateLimit(windowId)) {
        logSecurityViolation('rate_limit_exceeded', { windowId }, windowId);
        throw new Error('Rate limit exceeded. Too many requests from this window.');
      }
      
      // Validate inputs with enhanced security
      const validatedPath = await validateScanPath(rootPath, windowId);
      
      // Concurrent scan limiting
      if (activeScanCount.size >= MAX_CONCURRENT_SCANS) {
        throw new Error('Maximum concurrent scans reached. Please wait for current scan to complete.');
      }

      // Start scan with strict default limits for security and performance
      const scanOptions = {
        maxDepth: Math.min(options.maxDepth || 10, 15), // Hard limit at 15
        maxEntries: Math.min(options.maxEntries || 50000, 100000), // Hard limit at 100k
        followSymlinks: false, // Always false for security
        batchSize: Math.min(options.batchSize || 250, 500), // Limit batch size
        timeSliceMs: Math.max(options.timeSliceMs || 12, 5), // Minimum 5ms
        includeMetadata: options.includeMetadata || false
      };
      
      // Start scan FIRST to get the result
      result = scanManager.startScan(validatedPath, scanOptions);
      
      // Then add timeout with the scanId
      const scanTimeout = setTimeout(() => {
        scanManager.cancelScan(result.scanId);
        logSecurityViolation('scan_timeout', { scanId: result.scanId, path: validatedPath }, windowId);
      }, 300000); // 5 minute timeout

      activeScanCount.set(result.scanId, { windowId, timeout: scanTimeout });
      
      return result;
    } catch (error) {
      console.error('[IPC] scan:start error:', error.message);
      // Clean up any partial scan state on error
      if (result && result.scanId) {
        const scanData = activeScanCount.get(result.scanId);
        if (scanData?.timeout) {
          clearTimeout(scanData.timeout);
        }
        activeScanCount.delete(result.scanId);
      }
      throw error;
    }
  });

  ipcMain.handle('scan:cancel', async (event, scanId) => {
    try {
      const result = scanManager.cancelScan(scanId);
      const scanData = activeScanCount.get(scanId);
      if (scanData?.timeout) {
        clearTimeout(scanData.timeout);
      }
      activeScanCount.delete(scanId);
      return { success: result };
    } catch (error) {
      console.error('[IPC] scan:cancel error:', error.message);
      throw error;
    }
  });

  ipcMain.handle('scan:state', async (event, scanId) => {
    try {
      return scanManager.getScanState(scanId);
    } catch (error) {
      console.error('[IPC] scan:state error:', error.message);
      throw error;
    }
  });

  // Legacy folder selection (updated to use scan manager)
  ipcMain.handle('select-and-scan-folder', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
      });
      
      if (canceled || filePaths.length === 0) {
        return null;
      }

      const selectedPath = filePaths[0];
      const validatedPath = await validateScanPath(selectedPath);
      
      // Start scan with default options
      const result = scanManager.startScan(validatedPath, {
        maxDepth: 10,
        maxEntries: 50000,
        followSymlinks: false
      });
      
      activeScanCount.set(result.scanId, 1);
      return result;
    } catch (error) {
      console.error('[IPC] select-and-scan-folder error:', error.message);
      throw error;
    }
  });

  // Window state management
  ipcMain.handle('window:getBounds', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      return mainWindow.getBounds();
    }
    return null;
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.maximize();
      return true;
    }
    return false;
  });

  ipcMain.handle('window:unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.unmaximize();
      return true;
    }
    return false;
  });

  ipcMain.handle('window:isMaximized', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      return mainWindow.isMaximized();
    }
    return false;
  });

  // Favorites functionality
  ipcMain.handle('favorites:list', async () => {
    try {
      return { success: true, favorites: favoritesStore.list() };
    } catch (error) {
      console.error('[IPC] favorites:list error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('favorites:add', async (event, itemPath) => {
    const windowId = event.sender.id;
    try {
      if (!checkRateLimit(windowId)) {
        throw new Error('Rate limit exceeded');
      }
      
      const validatedPath = await validateScanPath(itemPath, windowId);
      const success = favoritesStore.add(validatedPath);
      return { success, path: validatedPath };
    } catch (error) {
      console.error('[IPC] favorites:add error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('favorites:remove', async (event, itemPath) => {
    try {
      const success = favoritesStore.remove(itemPath);
      return { success };
    } catch (error) {
      console.error('[IPC] favorites:remove error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Recent scans functionality
  ipcMain.handle('recent:list', async () => {
    try {
      return { success: true, recent: recentScansStore.list() };
    } catch (error) {
      console.error('[IPC] recent:list error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('recent:clear', async () => {
    try {
      recentScansStore.clear();
      return { success: true };
    } catch (error) {
      console.error('[IPC] recent:clear error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Basic settings functionality
  const userSettings = {};
  
  ipcMain.handle('settings:get', async () => {
    try {
      return { success: true, settings: { ...userSettings } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:update', async (event, patch) => {
    try {
      Object.assign(userSettings, patch);
      return { success: true, settings: { ...userSettings } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Basic logging functionality
  const recentLogs = [];
  const MAX_LOGS = 1000;
  
  ipcMain.handle('logs:recent', async (event, limit = 100) => {
    try {
      return { success: true, logs: recentLogs.slice(-limit) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Renderer logging
  ipcMain.on('renderer:log', (event, logData) => {
    const { level, msg, detail, component } = logData;
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level?.toUpperCase() || 'INFO',
      component: component || 'Unknown',
      message: msg,
      detail: detail || ''
    };
    
    // Add to recent logs
    recentLogs.push(logEntry);
    if (recentLogs.length > MAX_LOGS) {
      recentLogs.shift();
    }
    
    console.log(`[RENDERER:${logEntry.level}] ${logEntry.component}: ${logEntry.message}`, logEntry.detail);
  });
  
  // CSP violation reporting
  ipcMain.on('csp-violation', (event, violationData) => {
    logSecurityViolation('csp_violation', violationData, event.sender.id);
  });
}

// Throttled event sending
function sendThrottledEvent(eventType, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  const now = Date.now();
  const lastTime = lastEventTime.get(eventType) || 0;
  
  if (now - lastTime >= EVENT_THROTTLE_MS) {
    // Send immediately
    mainWindow.webContents.send(eventType, payload);
    lastEventTime.set(eventType, now);
    pendingEvents.delete(eventType);
  } else {
    // Queue for later
    pendingEvents.set(eventType, payload);
    
    // Schedule delayed send
    setTimeout(() => {
      const pending = pendingEvents.get(eventType);
      if (pending && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(eventType, pending);
        lastEventTime.set(eventType, Date.now());
        pendingEvents.delete(eventType);
      }
    }, EVENT_THROTTLE_MS - (now - lastTime));
  }
}

// Setup scan event forwarding to renderer with throttling
function setupScanEventForwarding() {
  // Forward scan events to renderer
  scanManager.on('scan:registered', (payload) => {
    // Always send scan started immediately (not throttled)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:started', payload);
    }
  });

  scanManager.on('scan:progress', (payload) => {
    sendThrottledEvent('scan:progress', payload);
  });

  scanManager.on('scan:partial', (payload) => {
    // Limit batch size for large datasets
    const maxBatchSize = 100;
    if (payload.nodes && payload.nodes.length > maxBatchSize) {
      // Split into smaller chunks
      for (let i = 0; i < payload.nodes.length; i += maxBatchSize) {
        const chunk = {
          ...payload,
          nodes: payload.nodes.slice(i, i + maxBatchSize)
        };
        sendThrottledEvent('scan:partial', chunk);
      }
    } else {
      sendThrottledEvent('scan:partial', payload);
    }
  });

  scanManager.on('scan:done', (payload) => {
    // Always send completion immediately (not throttled)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:done', payload);
      // Clean up active scan tracking and timeout
      const scanData = activeScanCount.get(payload.scanId);
      if (scanData?.timeout) {
        clearTimeout(scanData.timeout);
      }
      activeScanCount.delete(payload.scanId);
    }
  });

  scanManager.on('scan:cancelled', (payload) => {
    // Always send cancellation immediately (not throttled)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:done', { ...payload, cancelled: true });
      // Clean up active scan tracking
      activeScanCount.delete(payload.scanId);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      sandbox: true,
      // Enable WebGL for PixiJS rendering
      webgl: true,
      // Add preload script for secure IPC
      preload: path.join(__dirname, 'preload.cjs'),
    },
    // **NEW**: Enable hardware acceleration for better HTML5 performance
    show: true,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#ffffff'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5175');
    // Set development security headers
    const securityHeaders = cspManager.getSecurityHeaders(true, 5175);
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          ...Object.fromEntries(Object.entries(securityHeaders).map(([k, v]) => [k.toLowerCase(), [v]]))
        }
      });
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    // Set production security headers
    const securityHeaders = cspManager.getSecurityHeaders();
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          ...Object.fromEntries(Object.entries(securityHeaders).map(([k, v]) => [k.toLowerCase(), [v]]))
        }
      });
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up IPC handlers
  setupIpcHandlers();
  
  // Set up scan manager event forwarding
  setupScanEventForwarding();
}

app.whenReady().then(() => {
  // Clean up any stuck scan state from previous crashes
  activeScanCount.clear();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
