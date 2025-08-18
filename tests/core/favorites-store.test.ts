import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

interface FavoritesStore { list(): string[]; add(p: string): string[]; remove(p: string): string[]; }
let createFavoritesStore: (p: string | (() => string)) => FavoritesStore;

beforeAll(async () => {
  createFavoritesStore = (await import('../../favorites-store.cjs')).createFavoritesStore as typeof createFavoritesStore;
});

const tmpDir = path.join(process.cwd(), 'test-results', 'fav-store');
const favFile = path.join(tmpDir, 'favorites.json');

function ensureClean() {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });
}

describe('CORE-1 favorites-store', () => {
  beforeEach(() => {
    ensureClean();
  });

  it('add/remove persists and reloads', () => {
    const store = createFavoritesStore(favFile);
    expect(store.list()).toEqual([]);
    store.add('/a');
    store.add('/b');
    expect(store.list().sort()).toEqual(['/a','/b']);
    store.remove('/a');
    expect(store.list()).toEqual(['/b']);
    // Reload new instance
    const store2 = createFavoritesStore(favFile);
    expect(store2.list()).toEqual(['/b']);
  });

  it('corruption fallback recreates empty file and backups corrupt', () => {
    const store = createFavoritesStore(favFile);
    store.add('/c');
    // Corrupt the file
    fs.writeFileSync(favFile, '{not-json', 'utf8');
    const store2 = createFavoritesStore(favFile);
    const list = store2.list();
    expect(list).toEqual([]);
    // Expect a backup file exists
    const backups = fs.readdirSync(tmpDir).filter(f => f.includes('corrupt'));
    expect(backups.length).toBeGreaterThan(0);
    // New add works after corruption
    store2.add('/d');
    expect(store2.list()).toEqual(['/d']);
  });

  it('ignores duplicate adds', () => {
    const store = createFavoritesStore(favFile);
    store.add('/z');
    store.add('/z');
    expect(store.list()).toEqual(['/z']);
  });
});
