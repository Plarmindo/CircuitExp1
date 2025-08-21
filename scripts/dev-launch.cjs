// Dynamic Vite + Electron launcher (clean)
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

async function findFree(start=5175, end=5205) {
  for (let p=start; p<=end; p++) {
    const ok = await new Promise(r => {
      const s = net.createServer();
      s.once('error', () => { try { s.close(); } catch {} r(false); });
      s.once('listening', () => { s.close(()=>r(true)); });
      s.listen(p,'127.0.0.1');
    });
    if (ok) return p;
  }
  throw new Error('No free dev port in range');
}

async function start() {
  const basePort = await findFree();
  const { createServer } = await import('vite');
  const viteServer = await createServer({ server: { port: basePort, strictPort: false }, logLevel: 'info' });
  await viteServer.listen();
  const addr = viteServer.httpServer.address();
  const activePort = (addr && typeof addr === 'object') ? addr.port : basePort;
  const lockPath = path.join(process.cwd(), '.dev-port');
  fs.writeFileSync(lockPath, String(activePort));
  console.log('[dev-launch] Vite active on port', activePort);

  let electron; let shuttingDown = false;
  const startElectron = () => {
    const electronBin = require.resolve('electron/cli.js');
    electron = spawn(process.execPath, [electronBin,'electron-main.cjs'], {
      env: { ...process.env, VITE_DEV_PORT: String(activePort), DEV_FORCE_URL: '1' },
      stdio: 'inherit'
    });
    electron.on('exit', (code) => {
      if (shuttingDown) return;
      console.log('[dev-launch] Electron exited', code, '— restart in 1500ms');
      setTimeout(startElectron, 1500);
    });
  };
  startElectron();

  const shutdown = async () => {
    if (shuttingDown) return; shuttingDown = true;
    try { await viteServer.close(); } catch {}
    try { if (electron) electron.kill('SIGTERM'); } catch {}
    try { fs.unlinkSync(lockPath); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(err => { console.error('[dev-launch] failed', err); process.exit(1); });
          const s = net.createServer();
