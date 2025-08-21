import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// SEC-6: Static audit to ensure BrowserWindow webPreferences remain securely hardened.
// This test scans the main process source (electron-main.cjs) without launching Electron.
// It validates that critical security flags are correctly set and that insecure overrides
// are absent (e.g. webSecurity=false, allowRunningInsecureContent=true).

const MAIN_PATH = path.join(__dirname, '..', '..', 'electron-main.cjs');

describe('SEC-6 BrowserWindow webPreferences hardening', () => {
  it('webPreferences contain mandatory secure flags', () => {
    const src = fs.readFileSync(MAIN_PATH, 'utf8');

    // Consolidate the BrowserWindow options block into a single string for regex assertions.
    const windowOptsMatch = src.match(/new\s+BrowserWindow\s*\(([^)]*)\)/s);
    expect(windowOptsMatch).not.toBeNull();
    const opts = windowOptsMatch ? windowOptsMatch[1].replace(/\s+/g, ' ') : '';

    // Mandatory secure settings – must be explicitly present and set to the expected value.
    const requiredPairs: Array<[RegExp, string]> = [
      [/contextIsolation:\s*true/, 'contextIsolation'],
      [/sandbox:\s*true/, 'sandbox'],
      [/nodeIntegration:\s*false/, 'nodeIntegration'],
      [/enableRemoteModule:\s*false/, 'enableRemoteModule'],
    ];

    for (const [regex] of requiredPairs) {
      expect(regex.test(opts)).toBe(true);
    }
  });

  it('webPreferences do NOT weaken security by disabling webSecurity or allowing insecure content', () => {
    const src = fs.readFileSync(MAIN_PATH, 'utf8');
    const opts = src.replace(/\s+/g, ' ');

    // Disallow dangerous overrides.
    const dangerous = [
      /webSecurity:\s*false/,
      /allowRunningInsecureContent:\s*true/,
      /experimentalFeatures:\s*true/,
      /contextIsolation:\s*false/,
      /sandbox:\s*false/,
      /nodeIntegration:\s*true/,
    ];

    for (const bad of dangerous) {
      expect(bad.test(opts)).toBe(false);
    }
  });
});
