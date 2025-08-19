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
        launchOptions: { args: ['--enable-unsafe-swiftshader','--disable-web-security'] }
      },
    },
    {
      name: 'electron',
      testMatch: /recent-scans-electron\.spec\.ts/,
      use: { headless: true },
    }
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
