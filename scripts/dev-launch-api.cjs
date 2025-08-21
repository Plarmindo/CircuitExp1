#!/usr/bin/env node
/**
 * Programmatic dev launcher using Vite API and dynamic port.
 * - Finds free port
 * - Starts Vite (no strictPort) programmatically
 * - Writes .dev-port (for tests or other tools)
 * - Launches Electron pointing to that port (DEV_FORCE_URL=1)
 * - Auto restarts Electron if it crashes; exits fully if Vite stops
 */
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function findFree(start=5175, end=5205) {
  const tryPort = (p) => new Promise(res => {
    const srv = net.createServer().once('error', () => { res(false); })
      .once('listening', () => { srv.close(()=>res(true)); }).listen(p,'127.0.0.1');
  });
  for (let p=start; p<=end; p++) {  
    const ok = await tryPort(p);
    if (ok) return p;
  }
  throw new Error('No free port in range');
}

async function startVite(desiredPort) {
  const vite = await import('vite');
  const server = await vite.createServer({
    server: { port: desiredPort, strictPort: false },
    appType: 'spa'
  });
  await server.listen();
  const actualPort = server.config.server.port;
  return { server, port: actualPort };
}

(async () => {
  const basePort = process.env.VITE_DEV_PORT ? parseInt(process.env.VITE_DEV_PORT,10) : 5175;
  const free = await findFree(basePort, basePort+30);
  console.log('[dev-launch-api] candidate port', free);
  const { server, port } = await startVite(free);
  console.log('[dev-launch-api] vite listening on', port);
  const lockFile = path.join(process.cwd(), '.dev-port');
  fs.writeFileSync(lockFile, String(port));

  let electron; let shuttingDown = false;
  const startElectron = () => {
    console.log('[dev-launch-api] starting electron');
    const electronBin = require.resolve('electron/cli.js');
    electron = spawn(process.execPath, [electronBin, 'electron-main.cjs'], {
      env: { ...process.env, VITE_DEV_PORT: String(port), DEV_FORCE_URL: '1' },
      stdio: 'inherit'
    });
    electron.on('exit', (code) => {
      if (shuttingDown) return;
      console.warn('[dev-launch-api] electron exited code', code, '— restarting in 2s');
      setTimeout(startElectron, 2000);
    });
  };
  startElectron();

  const cleanup = async () => {
    shuttingDown = true;
    console.log('[dev-launch-api] shutting down');
    try { await server.close(); } catch {}
    try { if (electron && !electron.killed) electron.kill('SIGTERM'); } catch {}
    try { fs.unlinkSync(lockFile); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

})();
