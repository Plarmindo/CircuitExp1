// Simple favorites persistence store
const fs = require('fs');
const path = require('path');

function createFavoritesStore(getFilePath) {
  let favorites = [];
  let filePath = null;

  function ensurePath() {
    if (!filePath) {
      filePath = getFilePath();
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
      return false;
    }
    
    const normalizedPath = path.resolve(itemPath);
    if (!favorites.includes(normalizedPath)) {
      favorites.push(normalizedPath);
      save();
      return true;
    }
    return false;
  }

  function remove(itemPath) {
    if (typeof itemPath !== 'string') {
      return false;
    }
    
    const normalizedPath = path.resolve(itemPath);
    const index = favorites.indexOf(normalizedPath);
    if (index >= 0) {
      favorites.splice(index, 1);
      save();
      return true;
    }
    return false;
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
