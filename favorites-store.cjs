// CORE-1 Favorites persistence module (CommonJS)
// Provides simple JSON-backed list with corruption fallback + backup.
const fs = require('fs');
const path = require('path');

function createFavoritesStore(filePathOrFn) {
  const resolvePath = () => (typeof filePathOrFn === 'function' ? filePathOrFn() : filePathOrFn);

  function ensureDirExists(fp) {
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  function save(list) {
    const fp = resolvePath();
    ensureDirExists(fp);
    try {
      fs.writeFileSync(fp, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('[favorites-store] save failed', e.message);
    }
  }

  function load() {
    const fp = resolvePath();
    try {
      if (!fs.existsSync(fp)) return [];
      const raw = fs.readFileSync(fp, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.filter(x => typeof x === 'string');
      throw new Error('favorites not array');
    } catch (err) {
      // Corruption: backup original then reset file to []
      try {
        if (fs.existsSync(fp)) {
          const bak = fp + '.corrupt-' + Date.now() + '.bak';
            fs.copyFileSync(fp, bak);
        }
      } catch (e2) {
        console.warn('[favorites-store] failed to backup corrupt file', e2.message);
      }
      save([]);
      return [];
    }
  }

  function list() { return load(); }
  function add(p) {
    if (typeof p !== 'string' || !p.trim()) throw new Error('path required');
    const current = load();
    if (!current.includes(p)) {
      current.push(p);
      save(current);
    }
    return current;
  }
  function remove(p) {
    const next = load().filter(x => x !== p);
    save(next);
    return next;
  }

  return { list, add, remove, _load: load, _save: save, path: resolvePath };
}

module.exports = { createFavoritesStore };
