import { defineConfig, devices } from '@playwright/test';

// Add a dedicated Electron project (no webServer needed) alongside default web tests
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.(ts|tsx)$/,
  timeout: 60_000,
  retries: 0,
  testIgnore: ['**/*.test.*'],
  projects: [
    {
      name: 'web-chromium',
      // Exclude Electron-only specs from web browsers
      testIgnore: [
        '**/*-electron.spec.ts',
        '**/html5-compatibility.spec.ts',
        '**/html5-electron-compatibility.spec.ts',
        '**/recent-scans-electron.spec.ts',
        '**/csp-header-electron.sec-1.spec.ts',
        '**/ipc-validation-electron.sec-2.spec.ts',
        '**/sandbox-runtime-electron.sec-3.spec.ts',
        '**/core-4-logging-electron.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        baseURL: 'http://localhost:5175',
      },
    },
    {
      name: 'web-firefox',
      // Exclude Electron-only specs from web browsers
      testIgnore: [
        '**/*-electron.spec.ts',
        '**/html5-compatibility.spec.ts',
        '**/html5-electron-compatibility.spec.ts',
        '**/recent-scans-electron.spec.ts',
        '**/csp-header-electron.sec-1.spec.ts',
        '**/ipc-validation-electron.sec-2.spec.ts',
        '**/sandbox-runtime-electron.sec-3.spec.ts',
        '**/core-4-logging-electron.spec.ts',
      ],
      use: {
        ...devices['Desktop Firefox'],
        headless: true,
        baseURL: 'http://localhost:5175',
      },
    },
    {
      name: 'web-webkit',
      // Exclude Electron-only specs from web browsers
      testIgnore: [
        '**/*-electron.spec.ts',
        '**/html5-compatibility.spec.ts',
        '**/html5-electron-compatibility.spec.ts',
        '**/recent-scans-electron.spec.ts',
        '**/csp-header-electron.sec-1.spec.ts',
        '**/ipc-validation-electron.sec-2.spec.ts',
        '**/sandbox-runtime-electron.sec-3.spec.ts',
        '**/core-4-logging-electron.spec.ts',
      ],
      use: {
        ...devices['Desktop Safari'],
        headless: true,
        baseURL: 'http://localhost:5175',
      },
    },
    {
      name: 'electron',
      testMatch:
        /(recent-scans-electron\.spec|csp-header-electron\.sec-1\.spec|ipc-validation-electron\.sec-2\.spec|sandbox-runtime-electron\.sec-3\.spec|core-4-logging-electron\.spec|html5-compatibility\.spec|html5-electron-compatibility\.spec)\.ts/,
      use: { 
        headless: true,
        // **NEW**: Ensure HTML5 compatibility in Electron testing
        launchOptions: { 
          args: [
            '--enable-features=HTML5',
            '--enable-webgl', 
            '--enable-canvas-2d',
            '--enable-html5'
          ] 
        }
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      port: 5175,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
