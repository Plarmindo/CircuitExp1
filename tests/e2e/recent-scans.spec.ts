import { test, expect } from './fixtures';

// CORE-2 E2E: verify recent scans list updates and clear operation.

interface ElectronRecentAPI {
  recentList(): Promise<{ recent: string[] }>;
  recentClear(): Promise<void>;
  startScan?(root: string): Promise<void>;
}
interface ElectronBridge {
  electronAPI?: ElectronRecentAPI;
  __metroDebug?: unknown;
}

test('recent scans panel updates after scans and supports clear', async ({ page }) => {
  const hasElectron = await page.evaluate(() => {
    const w = window as unknown as ElectronBridge;
    return !!w.electronAPI?.recentList;
  });
  test.skip(!hasElectron, 'Electron bridge not available in pure web test context');

  // Trigger a couple of scans
  await page.evaluate(async () => {
    const w = window as unknown as ElectronBridge;
    const api = w.electronAPI!;
    await api.startScan?.('C:/');
    await api.startScan?.('C:/Windows');
  });

  // Wait for recent list to include the Windows path at front
  await page.waitForFunction(
    () =>
      (async () => {
        const w = window as unknown as ElectronBridge;
        const r = await w.electronAPI!.recentList();
        return (
          Array.isArray(r.recent) && r.recent[0] && r.recent[0].toLowerCase().includes('windows')
        );
      })(),
    { timeout: 15000 }
  );

  const recentAfter = await page.evaluate(async () => {
    const w = window as unknown as ElectronBridge;
    return (await w.electronAPI!.recentList()).recent;
  });
  expect(recentAfter[0].toLowerCase()).toContain('windows');

  // Clear list
  const cleared = await page.evaluate(async () => {
    const w = window as unknown as ElectronBridge;
    await w.electronAPI!.recentClear();
    return (await w.electronAPI!.recentList()).recent;
  });
  expect(cleared.length).toBe(0);
});
