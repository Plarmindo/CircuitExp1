import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// SEC-3: static audit ensuring sandbox + contextIsolation true and remote disabled.

describe('SEC-3 sandbox & contextIsolation audit', () => {
  it('BrowserWindow webPreferences enforce sandbox + contextIsolation and disable remote', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', '..', 'electron-main.cjs'), 'utf8');
    expect(content).toMatch(/sandbox:\s*true/);
    expect(content).toMatch(/contextIsolation:\s*true/);
    expect(content).toMatch(/enableRemoteModule:\s*false/);
    // Ensure nodeIntegration remains false
    expect(content).toMatch(/nodeIntegration:\s*false/);
  });
});
