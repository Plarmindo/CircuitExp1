// CORE-2 Recent scanned paths persistence (MRU list)
// Similar pattern to favorites-store but maintains ordering (most recent first) and max length.
const fs = require('fs');
const path = require('path');

function createRecentScansStore(filePathOrFn, opts = {}) {
  const max = typeof opts.max === 'number' && opts.max > 0 ? opts.max : 5;
  const existsFn = typeof opts.existsFn === 'function' ? opts.existsFn : fs.existsSync; // for test injection / lazy pruning
  const prune = opts.prune !== false; // allow disabling pruning in tests
  const resolvePath = () => (typeof filePathOrFn === 'function' ? filePathOrFn() : filePathOrFn);
  function ensureDirExists(fp) { const dir = path.dirname(fp); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
  function save(list) {
    const fp = resolvePath(); ensureDirExists(fp);
    try { fs.writeFileSync(fp, JSON.stringify({ max, items: list }, null, 2), 'utf8'); } catch (e) { console.error('[recent-scans-store] save failed', e.message); }
  }
  function load() {
    const fp = resolvePath();
    try {
      if (!fs.existsSync(fp)) return [];
      const raw = fs.readFileSync(fp, 'utf8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.items)) return data.items.filter(x => typeof x === 'string');
      throw new Error('invalid recent scans file');
    } catch (e) {
      try { if (fs.existsSync(fp)) fs.copyFileSync(fp, fp + '.corrupt-' + Date.now() + '.bak'); } catch (_) {}
      save([]); return [];
    }
  }
  function list() {
    let items = load();
    if (prune) {
      // Lazy existence pruning — remove entries that no longer exist
      const filtered = items.filter(p => {
        try { return existsFn(p); } catch { return false; }
      });
      if (filtered.length !== items.length) {
        save(filtered);
        items = filtered;
      }
    }
    return items;
  }
  function touch(p) {
    if (typeof p !== 'string' || !p.trim()) throw new Error('path required');
    let cur = load().filter(x => x !== p); // remove existing occurrence
    cur.unshift(p); // add to front
    if (cur.length > max) cur = cur.slice(0, max);
    save(cur);
    return cur;
  }
  function clear() { save([]); return []; }
  return { list, touch, clear, path: resolvePath, max };
}

module.exports = { createRecentScansStore };
