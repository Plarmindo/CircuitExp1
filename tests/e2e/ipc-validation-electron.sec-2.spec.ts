import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

// SEC-2 E2E: Ensure invalid path arguments are rejected with structured validation error.

test('SEC-2 invalid open-path traversal is rejected', async () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '..', '..', 'electron-main.cjs')],
    env: Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined)
    ) as Record<string, string>,
  });
  const win = await electronApp.firstWindow();
  // Evaluate in window context calling preload API
  const result = await win.evaluate(async () => {
    // @ts-expect-error preload augmentation not declared in test env types
    return await window.electronAPI.openPath('../secret');
  });
  expect(result && typeof result === 'object').toBe(true);
  expect(result.success).toBe(false);
  expect(result.error).toBe('validation');
  await electronApp.close();
});
