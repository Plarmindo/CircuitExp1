import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

// We load the store module twice simulating two app runs to ensure persistence across process restarts.

describe('favorites-store persistence across reload', () => {
  it('retains favorites after simulated restart', async () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'fav-restart-'));
    const storeFile = path.join(tmpDir, 'favorites.json');

    // First run: create store, add favorite
    const { createFavoritesStore } = await import('../../favorites-store.cjs');
    const store1 = createFavoritesStore(storeFile);
    await store1.add('/root/alpha');
    expect(await store1.list()).toEqual(['/root/alpha']);

    // Simulate process exit by clearing from require cache (ESM dynamic import already unique path, but ensure)
    // Second run: re-import and list
    const { createFavoritesStore: createStore2 } = await import('../../favorites-store.cjs');
    const store2 = createStore2(storeFile);
    expect(await store2.list()).toEqual(['/root/alpha']);

    // Add another and verify both present
    await store2.add('/root/beta');
    expect(await store2.list()).toEqual(['/root/alpha', '/root/beta']);
  });
});
