import { defineConfig, devices } from '@playwright/test';

// Add a dedicated Electron project (no webServer needed) alongside default web tests
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  projects: [
    {
      name: 'web-chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        baseURL: 'http://localhost:5175',
        launchOptions: { args: ['--enable-unsafe-swiftshader', '--disable-web-security'] },
      },
    },
    {
      name: 'web-firefox',
      use: {
        ...devices['Desktop Firefox'],
        headless: true,
        baseURL: 'http://localhost:5175',
        launchOptions: { args: ['--disable-web-security'] },
      },
    },
    {
      name: 'web-webkit',
      use: {
        ...devices['Desktop Safari'],
        headless: true,
        baseURL: 'http://localhost:5175',
        launchOptions: { args: ['--disable-web-security'] },
      },
    },
    {
      name: 'electron',
      testMatch:
        /(recent-scans-electron\.spec|csp-header-electron\.sec-1\.spec|ipc-validation-electron\.sec-2\.spec|sandbox-runtime-electron\.sec-3\.spec|core-4-logging-electron\.spec)\.ts/,
      use: { headless: true },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      port: 5175,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
