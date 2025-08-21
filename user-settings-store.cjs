// CORE-3 User Settings Persistence
// JSON backed settings with schema version & migration placeholder.
const fs = require('fs');
const path = require('path');

const CURRENT_VERSION = 2;
const DEFAULT_SETTINGS = {
  version: CURRENT_VERSION,
  theme: 'light', // 'light' | 'dark'
  defaultScan: {
    maxEntries: 0, // 0 => unlimited
    aggregationThreshold: 28,
  },
  pii: {
    enabled: true,
    redactionEnabled: false,
    confidenceThreshold: 0.8,
    customPatterns: []
  }
};

function createUserSettingsStore(filePathOrFn) {
  const resolvePath = () => (typeof filePathOrFn === 'function' ? filePathOrFn() : filePathOrFn);
  function ensureDirExists(fp) { const dir = path.dirname(fp); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
  function readRaw() {
    const fp = resolvePath();
    try {
      if (!fs.existsSync(fp)) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid settings root');
      // Migration placeholder
      if (parsed.version !== CURRENT_VERSION) {
        // For now, just reset while preserving known keys when possible.
        return { ...DEFAULT_SETTINGS, theme: parsed.theme === 'dark' ? 'dark' : 'light' };
      }
      // Basic shape validation
      if (parsed.theme !== 'light' && parsed.theme !== 'dark') parsed.theme = DEFAULT_SETTINGS.theme;
      if (!parsed.defaultScan || typeof parsed.defaultScan !== 'object') parsed.defaultScan = { ...DEFAULT_SETTINGS.defaultScan };
      if (typeof parsed.defaultScan.maxEntries !== 'number' || parsed.defaultScan.maxEntries < 0) parsed.defaultScan.maxEntries = 0;
      if (typeof parsed.defaultScan.aggregationThreshold !== 'number' || parsed.defaultScan.aggregationThreshold < 1) parsed.defaultScan.aggregationThreshold = DEFAULT_SETTINGS.defaultScan.aggregationThreshold;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      try { const fp2 = resolvePath(); if (fs.existsSync(fp2)) fs.copyFileSync(fp2, fp2 + '.corrupt-' + Date.now() + '.bak'); } catch (_) {}
      return { ...DEFAULT_SETTINGS };
    }
  }
  function write(settings) {
    const fp = resolvePath(); ensureDirExists(fp);
    fs.writeFileSync(fp, JSON.stringify(settings, null, 2), 'utf8');
  }
  let cache = readRaw();
  function get() { cache = readRaw(); return cache; }
  function update(partial) {
    const current = get();
    const next = { ...current, ...partial };
    // Validate again quickly
    if (next.theme !== 'light' && next.theme !== 'dark') next.theme = current.theme;
    if (!next.defaultScan) next.defaultScan = { ...current.defaultScan };
    write(next); cache = next; return next;
  }
  return { get, update, path: resolvePath };
}

module.exports = { createUserSettingsStore, CURRENT_VERSION };
