// Simple favorites persistence store
const fs = require('fs');
const path = require('path');

function createFavoritesStore(getFilePath) {
  let favorites = [];
  let filePath = null;

  // Normalize paths to forward slashes for cross-platform consistency
  function normalizePath(p) {
    return p.replace(/\\/g, '/');
  }

  function ensurePath() {
    if (!filePath) {
      // Support both function and string for getFilePath
      filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    return filePath;
  }

  function load() {
    try {
      const file = ensurePath();
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file, 'utf8');
        favorites = JSON.parse(data) || [];
      }
    } catch (error) {
      console.warn('[Favorites] Failed to load:', error.message);
      // Backup corrupt file
      if (fs.existsSync(ensurePath())) {
        try {
          const backupPath = `${ensurePath()}.corrupt-${Date.now()}.backup`;
          fs.copyFileSync(ensurePath(), backupPath);
          fs.unlinkSync(ensurePath()); // Remove corrupt file
        } catch (backupError) {
          console.error('[Favorites] Failed to backup corrupt file:', backupError.message);
        }
      }
      favorites = [];
    }
    return favorites;
  }

  function save() {
    try {
      const file = ensurePath();
      fs.writeFileSync(file, JSON.stringify(favorites, null, 2));
    } catch (error) {
      console.error('[Favorites] Failed to save:', error.message);
    }
  }

  function list() {
    return [...favorites];
  }

  function add(itemPath) {
    if (typeof itemPath !== 'string' || !itemPath.trim()) {
      return list();
    }
    
    // Normalize to forward slashes for consistency, but keep original path format
    const normalizedPath = normalizePath(itemPath);
    if (!favorites.includes(normalizedPath)) {
      favorites.push(normalizedPath);
      save();
    }
    return list();
  }

  function remove(itemPath) {
    if (typeof itemPath !== 'string') {
      return list();
    }
    
    // Normalize to forward slashes for consistency, but keep original path format
    const normalizedPath = normalizePath(itemPath);
    const index = favorites.indexOf(normalizedPath);
    if (index >= 0) {
      favorites.splice(index, 1);
      save();
    }
    return list();
  }

  function clear() {
    favorites = [];
    save();
    return [];
  }

  // Load on creation
  load();

  return {
    list,
    add,
    remove,
    clear
  };
}

module.exports = { createFavoritesStore };
