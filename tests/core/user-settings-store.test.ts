import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
// @ts-expect-error CJS module without types
import { createUserSettingsStore, CURRENT_VERSION } from '../../user-settings-store.cjs';

const tmpDir = path.join(process.cwd(), 'test-results', 'user-settings');
const filePath = path.join(tmpDir, 'user-settings.json');

function reset() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
}

describe('user-settings-store (CORE-3)', () => {
  beforeEach(() => reset());

  it('creates default settings when file missing', () => {
    const store = createUserSettingsStore(filePath);
    const s = store.get();
    expect(s.version).toBe(CURRENT_VERSION);
    expect(s.theme).toBe('light');
  });

  it('persists updates and reloads them', () => {
    const store = createUserSettingsStore(filePath);
    store.update({ theme: 'dark' });
    const s2 = store.get();
    expect(s2.theme).toBe('dark');
  });

  it('corruption fallback writes backup and resets', () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{ invalid json', 'utf8');
    const store = createUserSettingsStore(filePath);
    const s = store.get();
    expect(s.version).toBe(CURRENT_VERSION);
    const backups = fs.readdirSync(path.dirname(filePath)).filter(f => f.includes('user-settings.json.corrupt-'));
    expect(backups.length).toBeGreaterThan(0);
  });

  it('migration placeholder resets version but preserves theme when possible', () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ version: CURRENT_VERSION - 1, theme: 'dark', defaultScan: { maxEntries: 5, aggregationThreshold: 15 } }), 'utf8');
    const store = createUserSettingsStore(filePath);
    const s = store.get();
    expect(s.version).toBe(CURRENT_VERSION);
    expect(s.theme).toBe('dark');
    expect(typeof s.defaultScan.aggregationThreshold).toBe('number');
  });
});
