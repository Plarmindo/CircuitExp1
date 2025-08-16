import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1400, height: 900 },
    baseURL: 'http://localhost:5175',
    launchOptions: {
      args: ['--enable-unsafe-swiftshader','--disable-web-security']
    }
  },
  webServer: [
    {
      command: 'npm run dev',
      port: 5175,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
