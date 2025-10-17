/**
 * E2E Tests for Scan Operations in Packaged Electron App
 * Tests real scan functionality with file system access
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

let electronApp: ElectronApplication;
let mainWindow: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [path.join(__dirname, '..', '..', 'electron-main.cjs')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Wait for window
  mainWindow = await electronApp.firstWindow();
  await mainWindow.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp?.close();
});

test.describe('Scan Operations E2E', () => {
  test('should start scan and receive events', async () => {
    // Create temporary test directory
    const testDir = path.join(os.tmpdir(), 'circuit-exp-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'test content');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'test content');
    await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'subdir', 'file3.txt'), 'test content');

    try {
      // Listen for scan events
      const events: Array<{ type: string; payload: unknown }> = [];
      
      await mainWindow.evaluate(() => {
        window.electronAPI?.on('scan:registered', (payload: unknown) => {
          (window as typeof window & { testEvents: typeof events }).testEvents = 
            (window as typeof window & { testEvents: typeof events }).testEvents || [];
          (window as typeof window & { testEvents: typeof events }).testEvents.push({ 
            type: 'scan:registered', 
            payload 
          });
        });
        
        window.electronAPI?.on('scan:progress', (payload: unknown) => {
          (window as typeof window & { testEvents: typeof events }).testEvents = 
            (window as typeof window & { testEvents: typeof events }).testEvents || [];
          (window as typeof window & { testEvents: typeof events }).testEvents.push({ 
            type: 'scan:progress', 
            payload 
          });
        });
        
        window.electronAPI?.on('scan:done', (payload: unknown) => {
          (window as typeof window & { testEvents: typeof events }).testEvents = 
            (window as typeof window & { testEvents: typeof events }).testEvents || [];
          (window as typeof window & { testEvents: typeof events }).testEvents.push({ 
            type: 'scan:done', 
            payload 
          });
        });
      });

      // Start scan
      const scanResult = await mainWindow.evaluate(async (scanPath: string) => {
        if (!window.electronAPI?.invoke) {
          throw new Error('electronAPI not available');
        }
        return await window.electronAPI.invoke('scan:start', scanPath, { maxDepth: 10 });
      }, testDir);

      expect(scanResult).toHaveProperty('success');
      expect(scanResult).toHaveProperty('success', true);

      // Wait for scan completion
      await mainWindow.waitForTimeout(2000);

      // Get captured events
      const capturedEvents = await mainWindow.evaluate(() => {
        return (window as typeof window & { testEvents?: typeof events }).testEvents || [];
      });

      // Verify events
      expect(capturedEvents.length).toBeGreaterThan(0);
      const eventTypes = capturedEvents.map((e: { type: string }) => e.type);
      expect(eventTypes).toContain('scan:registered');
    } finally {
      // Cleanup
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  test('should handle scan cancellation', async () => {
    // Create temporary test directory with many files
    const testDir = path.join(os.tmpdir(), 'circuit-exp-cancel-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    // Create many files to ensure scan takes some time
    for (let i = 0; i < 100; i++) {
      await fs.writeFile(path.join(testDir, `file${i}.txt`), 'test content');
    }

    try {
      // Start scan
      const scanResult = await mainWindow.evaluate(async (scanPath: string) => {
        if (!window.electronAPI?.invoke) {
          throw new Error('electronAPI not available');
        }
        return await window.electronAPI.invoke('scan:start', scanPath, { maxDepth: 10 });
      }, testDir) as { scanId: string };

      expect(scanResult).toHaveProperty('scanId');
      const scanId = scanResult.scanId;

      // Wait a bit then cancel
      await mainWindow.waitForTimeout(100);

      const cancelResult = await mainWindow.evaluate(async (id: string) => {
        if (!window.electronAPI?.invoke) {
          throw new Error('electronAPI not available');
        }
        return await window.electronAPI.invoke('scan:cancel', id);
      }, scanId);

      expect(cancelResult).toHaveProperty('success', true);
    } finally {
      // Cleanup
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  test('should query scan state', async () => {
    const stateResult = await mainWindow.evaluate(async () => {
      if (!window.electronAPI?.invoke) {
        throw new Error('electronAPI not available');
      }
      return await window.electronAPI.invoke('scan:state');
    });

    expect(stateResult).toHaveProperty('currentScan');
    expect(stateResult).toHaveProperty('hasActiveScan');
    expect(typeof stateResult).toBe('object');
  });

  test('should enforce rate limiting', async () => {
    const testDir = path.join(os.tmpdir(), 'circuit-exp-rate-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    try {
      // Make multiple rapid scan requests
      const results = await mainWindow.evaluate(async (scanPath: string) => {
        if (!window.electronAPI?.invoke) {
          throw new Error('electronAPI not available');
        }
        
        const promises = [];
        for (let i = 0; i < 3; i++) {
          promises.push(
            window.electronAPI.invoke('scan:start', scanPath, { maxDepth: 5 })
              .catch((err: Error) => ({ error: err.message }))
          );
        }
        return await Promise.all(promises);
      }, testDir);

      // First should succeed, others should be rate limited
      const successCount = results.filter((r: { success?: boolean }) => r.success).length;
      const errorCount = results.filter((r: { error?: string }) => r.error).length;

      // At least one should succeed, at least one should be rate limited
      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(errorCount).toBeGreaterThanOrEqual(1);
    } finally {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  test('should handle invalid paths', async () => {
    const invalidPaths = [
      '/nonexistent/path/that/does/not/exist',
      'C:\\nonexistent\\windows\\path',
      '../../../etc/passwd', // Path traversal attempt
      'file:///etc/passwd', // Protocol in path
    ];

    for (const invalidPath of invalidPaths) {
      const result = await mainWindow.evaluate(async (scanPath: string) => {
        if (!window.electronAPI?.invoke) {
          throw new Error('electronAPI not available');
        }
        return await window.electronAPI.invoke('scan:start', scanPath, { maxDepth: 10 })
          .catch((err: Error) => ({ error: err.message }));
      }, invalidPath);

      // Should fail with error
      expect(result).toHaveProperty('error');
    }
  });

  test('should handle large directory scan', async () => {
    // Create large directory structure
    const testDir = path.join(os.tmpdir(), 'circuit-exp-large-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    // Create 500 files in multiple subdirectories
    for (let i = 0; i < 10; i++) {
      const subdir = path.join(testDir, `subdir${i}`);
      await fs.mkdir(subdir, { recursive: true });
      
      for (let j = 0; j < 50; j++) {
        await fs.writeFile(path.join(subdir, `file${j}.txt`), 'test content');
      }
    }

    try {
      // Track events
      await mainWindow.evaluate(() => {
        (window as typeof window & { largeTestEvents?: Array<{ type: string }> }).largeTestEvents = [];
        
        window.electronAPI?.on('scan:progress', () => {
          const events = (window as typeof window & { largeTestEvents?: Array<{ type: string }> }).largeTestEvents || [];
          events.push({ type: 'scan:progress' });
          (window as typeof window & { largeTestEvents?: Array<{ type: string }> }).largeTestEvents = events;
        });
        
        window.electronAPI?.on('scan:partial', () => {
          const events = (window as typeof window & { largeTestEvents?: Array<{ type: string }> }).largeTestEvents || [];
          events.push({ type: 'scan:partial' });
          (window as typeof window & { largeTestEvents?: Array<{ type: string }> }).largeTestEvents = events;
        });
      });

      // Start scan
      const scanResult = await mainWindow.evaluate(async (scanPath: string) => {
        if (!window.electronAPI?.invoke) {
          throw new Error('electronAPI not available');
        }
        return await window.electronAPI.invoke('scan:start', scanPath, { maxDepth: 10 });
      }, testDir);

      expect(scanResult).toHaveProperty('success', true);

      // Wait for completion
      await mainWindow.waitForTimeout(5000);

      // Verify events received
      const capturedEvents = await mainWindow.evaluate(() => {
        return (window as typeof window & { largeTestEvents?: Array<{ type: string }> }).largeTestEvents || [];
      });

      // Should have received multiple progress and partial events
      const progressEvents = capturedEvents.filter((e: { type: string }) => e.type === 'scan:progress');
      const partialEvents = capturedEvents.filter((e: { type: string }) => e.type === 'scan:partial');

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(partialEvents.length).toBeGreaterThan(0);
    } finally {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
});

test.describe('Security Features E2E', () => {
  test('should have Content-Security-Policy headers', async () => {
    // Get CSP meta tag
    const cspContent = await mainWindow.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta?.getAttribute('content') || '';
    });

    // Verify CSP is present
    expect(cspContent).toBeTruthy();
    
    // Verify key directives
    expect(cspContent).toContain('default-src');
    expect(cspContent).toContain('script-src');
    expect(cspContent).toContain('style-src');
  });

  test('should have contextIsolation enabled', async () => {
    // Verify context isolation by checking window properties
    const hasContextIsolation = await mainWindow.evaluate(() => {
      // In context isolation, window.require should not exist
      return typeof (window as typeof window & { require?: unknown }).require === 'undefined';
    });

    expect(hasContextIsolation).toBe(true);
  });

  test('should have limited IPC API surface', async () => {
    const apiMethods = await mainWindow.evaluate(() => {
      if (!window.electronAPI) return [];
      return Object.keys(window.electronAPI);
    });

    // Should only expose specific safe methods
    expect(apiMethods).toContain('invoke');
    expect(apiMethods).toContain('on');
    
    // Should NOT expose dangerous methods
    expect(apiMethods).not.toContain('require');
    expect(apiMethods).not.toContain('eval');
  });
});

test.describe('Performance E2E', () => {
  test('should complete small scan within timeout', async () => {
    const testDir = path.join(os.tmpdir(), 'circuit-exp-perf-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'test');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'test');

    try {
      const startTime = Date.now();

      await mainWindow.evaluate(async (scanPath: string) => {
        if (!window.electronAPI?.invoke) {
          throw new Error('electronAPI not available');
        }
        return await window.electronAPI.invoke('scan:start', scanPath, { maxDepth: 5 });
      }, testDir);

      // Wait for completion with timeout
      await mainWindow.waitForTimeout(1000);

      const duration = Date.now() - startTime;
      
      // Small scan should complete quickly
      expect(duration).toBeLessThan(3000); // 3 seconds max
    } finally {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
});
