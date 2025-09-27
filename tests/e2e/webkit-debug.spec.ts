import { test, expect } from '@playwright/test';

test('webkit debug: simple navigation', async ({ page }) => {
  // Filter this test to run only on WebKit
  if (test.info().project.name !== 'webkit') {
    test.skip();
  }

  await page.goto('/');
  await expect(page).toHaveTitle(/CircuitExp1/);
});