import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * IPC channels that the main process is allowed to expose.
 * Update this list deliberately when adding new features.
 */
const allowedChannels = [
  'favorites:add', 'favorites:list', 'favorites:remove',
  'logs:recent', 'recent:clear', 'recent:list',
  'scan:cancel', 'scan:start', 'scan:state',
  'select-and-scan-folder', 'settings:get', 'settings:update',
  'window:getBounds', 'window:isMaximized', 'window:maximize', 'window:unmaximize'
] as const;

type Channel = (typeof allowedChannels)[number];

describe('Security ▸ IPC channel whitelist', () => {
  const projectRoot = path.resolve(__dirname, '../../');
  const mainBundles = ['electron-main.cjs'];

  for (const bundleName of mainBundles) {
    const bundlePath = path.join(projectRoot, bundleName);

    it(`${bundleName} exposes only whitelisted ipcMain.handle channels`, () => {
      // Gracefully skip if the file does not exist in this build context.
      if (!fs.existsSync(bundlePath)) {
        console.warn(`⚠️  Skipping IPC whitelist test: ${bundleName} not found`);
        return;
      }

      const source = fs.readFileSync(bundlePath, 'utf8');
      const regex = /ipcMain\.handle\(\s*['"`]([^'"`]+)['"`]/g;
      const discovered = new Set<Channel | string>();
      let match: RegExpExecArray | null;

      while ((match = regex.exec(source)) !== null) {
        discovered.add(match[1]);
      }

      // Equality check: both sets must contain exactly the same members.
      expect(discovered).toEqual(new Set(allowedChannels));
    });
  }
});
