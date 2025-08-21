/**
 * central-logger.cjs
 * CommonJS runtime variant used by Electron main process (avoids requiring TS transpilation at runtime).
 * Mirrors src/logger/central-logger.ts (CORE-4) so ring buffer + file sink work in production/e2e.
 */
const fs = require('fs');
const path = require('path');

/** @typedef {'debug'|'info'|'warn'|'error'} LogLevel */
const LOG_LEVELS = ['debug','info','warn','error'];
let filePath = null;
let fileFd = null;
let globalLevel = process.env.LOG_LEVEL || 'info';
const ring = [];
const ringMax = 500;
function shouldLog(level){
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(globalLevel);
}
function setLevel(l){ globalLevel = l; }
function enableFile(dir, filename = 'app-log.ndjson') {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    filePath = path.join(dir, filename);
    fileFd = fs.openSync(filePath, 'a');
  } catch (err) {
    console.warn('[logger] failed to enable file sink', err);
  }
}
function disableFile(){ if (fileFd) { try { fs.closeSync(fileFd); } catch {} } fileFd=null; filePath=null; }
function write(rec){
  const line = JSON.stringify(rec);
  ring.push(rec); if (ring.length > ringMax) ring.splice(0, ring.length - ringMax);
  if (fileFd) { try { fs.writeSync(fileFd, line + '\n'); } catch (err) { console.warn('[logger] file write failed', err); } }
  if (process.env.NODE_ENV !== 'production') {
    const color = rec.level === 'error' ? '\x1b[31m' : rec.level === 'warn' ? '\x1b[33m' : rec.level === 'debug' ? '\x1b[36m' : '\x1b[32m';
    console.log(color + '[' + rec.level + ']' + '\x1b[0m', rec.component ? '[' + rec.component + ']' : '', rec.msg, rec.detail ? rec.detail : '');
  } else {
    console.log(line);
  }
}
function createLogger(opts){
  const component = opts && opts.component;
  function base(level, msg, detail){ if (!shouldLog(level)) return; write({ ts: new Date().toISOString(), level, msg, component, detail }); }
  return {
    debug: (m,d)=>base('debug',m,d),
    info: (m,d)=>base('info',m,d),
    warn: (m,d)=>base('warn',m,d),
    error: (m,d)=>base('error',m,d)
  };
}
const log = createLogger({ component: 'global' });
function getRecentLogs(limit=100){ if (limit<=0) return []; return ring.slice(-limit); }
module.exports = { LOG_LEVELS, setLevel, enableFile, disableFile, createLogger, log, getRecentLogs };
