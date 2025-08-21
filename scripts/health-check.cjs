#!/usr/bin/env node
// Automated health check script: verifies dev server start, basic endpoints, and (optional) Electron launch readiness.
// Non-destructive: exits non-zero if any critical step fails.
// Usage: npm run health OR npm run health:electron

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const WANT_ELECTRON = process.argv.includes('--electron');
const PORT = process.env.VITE_DEV_PORT || 5175;

async function fetch(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: 'localhost', port: PORT, path: pathname, timeout: 2000 }, (res) => {
      const chunks = [];
      res.on('data', d => { if (chunks.length < 8) chunks.push(d); });
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function wait(ms){return new Promise(r=>setTimeout(r,ms));}

async function waitForServer(timeoutMs=15000){
  const start = Date.now();
  while (Date.now()-start < timeoutMs){
    try {
      const r = await fetch('/');
      if (r.status === 200 && /<title>/i.test(r.body)) return true;
    } catch {}
    await wait(500);
  }
  return false;
}

async function run() {
  const results = { steps: [], ok: true, electron: WANT_ELECTRON };
  function step(name, ok, detail){results.steps.push({name, ok, detail}); if(!ok) results.ok=false; console.log(`${ok? '✓':'✗'} ${name}${detail? ' - '+detail:''}`);}  

  // 1. Ensure node_modules present
  const hasNM = fs.existsSync(path.join(process.cwd(),'node_modules'));
  step('node_modules present', hasNM, hasNM? null: 'run npm install');
  if(!hasNM) return finalize();

  // 2. Start Vite dev server (spawn first, programmatic fallback)
  console.log('Starting Vite dev server on port', PORT);
  const npxBin = process.platform==='win32' ? path.join(process.env.APPDATA || 'C:/Users', '..','npm','npx.cmd') : 'npx';
  const spawnCmd = fs.existsSync(npxBin)? npxBin : (process.platform==='win32'? 'npx.cmd':'npx');
  const spawnArgs = ['vite','--port', String(PORT),'--strictPort'];
  let viteProc=null; let viteProgrammatic=null; let viteReady=false; let viteLogs='';
  try {
    viteProc = spawn(spawnCmd, spawnArgs, { stdio:['ignore','pipe','pipe'] });
    viteProc.stdout.on('data', d=>{ const s=d.toString(); viteLogs+=s; if(!viteReady && /ready in/i.test(s)) viteReady=true; });
    viteProc.stderr.on('data', d=>{ viteLogs+=d.toString(); });
  } catch(e){
    step('spawn vite', false, e.message);
  }
  // Probe with fallback attempts
  let serverOk=false; let attempts=0;
  while(attempts<4 && !serverOk){
    attempts++;
    serverOk = await waitForServer( attempts===1? 2000: 1200 );
    if(serverOk) break;
    if(attempts===2 && !viteProgrammatic){
      try {
        const viteModule = await import('vite');
        viteProgrammatic = await viteModule.createServer({ server:{ port: PORT, strictPort:true } });
        await viteProgrammatic.listen();
        step('vite programmatic fallback', true);
      } catch(err){
        step('vite programmatic fallback', false, err.message);
      }
    }
  }
  if(!serverOk) serverOk = await waitForServer(1000);
  step('vite dev server reachable', serverOk, serverOk? null: 'failed to start vite');
  if(!serverOk){
    try { viteProc && viteProc.kill(); } catch{}
    try { viteProgrammatic && await viteProgrammatic.close(); } catch{}
    return finalize();
  }

  // 3. Probe /@vite/client
  try {
    const client = await fetch('/@vite/client');
    step('/@vite/client served', client.status===200 && /import\.meta/.test(client.body));
  } catch (e) { step('/@vite/client served', false, e.message); }

  // 4. (Optional) Electron launch test (headless style: spawn and detect window URL load)
  if (WANT_ELECTRON) {
    console.log('Launching Electron for health check');
    const env = { ...process.env, VITE_DEV_PORT: PORT, DEV_FORCE_URL: '1', DEBUG_DEV_DETECT: '1' };
    function resolveElectronBinary(){
      try {
        const pkg = require.resolve('electron/package.json');
        const dir = path.dirname(pkg);
        const candidate = path.join(dir,'dist', process.platform==='win32'? 'electron.exe':'electron');
        if(fs.existsSync(candidate)) return candidate;
      } catch{}
      return null;
    }
    const electronBin = resolveElectronBinary();
    const electronCmd = electronBin || spawnCmd;
    const electronArgs = electronBin? ['electron-main.cjs'] : ['electron','electron-main.cjs'];
    let electronSpawnOk=true; let electronOutput=''; let loaded=false; let electron;
    try {
      electron = spawn(electronCmd, electronArgs, { env, stdio:['ignore','pipe','pipe'] });
      electron.stdout.on('data', d=>{ const s=d.toString(); electronOutput+=s; if(/forceStage/.test(s)) loaded=true; });
      electron.stderr.on('data', d=>{ electronOutput+=d.toString(); });
    } catch (e) {
      electronSpawnOk=false; step('electron spawn', false, e.message);
    }
    if(electronSpawnOk){
      const timeout = Date.now()+12000;
      while(Date.now()<timeout && !loaded){ await wait(400); }
      step('electron launch (dev)', loaded, loaded? null: 'no loadURL evidence');
      try { electron.kill(); } catch {}
    }
  }

  // 5. Clean up
  try { viteProc && viteProc.kill(); } catch {}
  try { viteProgrammatic && await viteProgrammatic.close(); } catch {}
  finalize();

  function finalize(){
    const summary = { ok: results.ok, steps: results.steps };
    const outFile = path.join(process.cwd(),'health-report.json');
    fs.writeFileSync(outFile, JSON.stringify(summary,null,2));
    console.log('\nHealth summary written to', outFile);
    if(!results.ok) process.exitCode=1;
  }
}

run().catch(e=>{ console.error('health check fatal', e); process.exitCode=1; });
