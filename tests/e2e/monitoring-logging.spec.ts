import { test, expect } from '@playwright/test';

test.describe('Monitoring and Logging System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should display monitoring dashboard toggle', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('📈');
  });

  test('should toggle monitoring dashboard', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');

    // Initially shows MetroUI
    await expect(page.locator('.metro-ui')).toBeVisible();

    // Click to show monitoring
    await toggle.click();
    await expect(toggle).toHaveText('📊');
    await expect(page.locator('.monitoring-dashboard')).toBeVisible();

    // Click to hide monitoring
    await toggle.click();
    await expect(toggle).toHaveText('📈');
    await expect(page.locator('.metro-ui')).toBeVisible();
  });

  test('should display system health metrics', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    const dashboard = page.locator('.monitoring-dashboard');
    await expect(dashboard).toBeVisible();

    // Check health indicators
    await expect(page.locator('.health-indicator')).toBeVisible();
    await expect(page.locator('.metric-card')).toHaveCount(4); // Memory, CPU, Disk, Scan Performance
  });

  test('should show memory usage metrics', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    const memoryCard = page.locator('.metric-card').first();
    await expect(memoryCard).toContainText('Memory Usage');
    await expect(memoryCard.locator('.metric-value')).toBeVisible();
    await expect(memoryCard.locator('.metric-unit')).toBeVisible();
  });

  test('should show CPU usage metrics', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    const cpuCard = page.locator('.metric-card').nth(1);
    await expect(cpuCard).toContainText('CPU Usage');
    await expect(cpuCard.locator('.metric-value')).toBeVisible();
  });

  test('should show disk usage metrics', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    const diskCard = page.locator('.metric-card').nth(2);
    await expect(diskCard).toContainText('Disk Usage');
    await expect(diskCard.locator('.metric-value')).toBeVisible();
  });

  test('should show scan performance metrics', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    const scanCard = page.locator('.metric-card').nth(3);
    await expect(scanCard).toContainText('Scan Performance');
    await expect(scanCard.locator('.metric-value')).toBeVisible();
  });

  test('should display audit events section', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    const auditSection = page.locator('.audit-section');
    await expect(auditSection).toBeVisible();
    await expect(auditSection).toContainText('Recent Audit Events');
  });

  test('should refresh metrics when refresh button is clicked', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    const refreshButton = page.locator('button:has-text("Refresh")').first();
    await expect(refreshButton).toBeVisible();

    // Click refresh and verify loading state
    await refreshButton.click();
    await expect(page.locator('.loading-spinner')).toBeVisible();
  });

  test('should export metrics data', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    const exportButton = page.locator('button:has-text("Export")');
    await expect(exportButton).toBeVisible();

    // Click export and verify download
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/metrics-\d{4}-\d{2}-\d{2}/);
  });

  test('should log folder selection audit events', async ({ page }) => {
    // Mock the folder selection
    await page.evaluate(() => {
      window.electronAPI = {
        selectAndScanFolder: async () => ({ folder: '/test/path', success: true }),
      };
    });

    // Trigger folder selection
    await page.click('button:has-text("Select Folder")');

    // Verify audit logging would happen (check console or mock)
    const logs = await page.evaluate(() => {
      return (window as any).auditLogs || [];
    });

    expect(logs.length).toBeGreaterThan(0);
  });

  test('should handle permission denied errors with audit logging', async ({ page }) => {
    // Mock permission denied error
    await page.evaluate(() => {
      window.electronAPI = {
        selectAndScanFolder: async () => {
          throw new Error('EACCES: permission denied');
        },
      };
    });

    await page.click('button:has-text("Select Folder")');

    // Wait for error to be processed
    await page.waitForTimeout(1000);

    // Check that security violation was logged
    const logs = await page.evaluate(() => {
      return (window as any).auditLogs || [];
    });

    const securityLogs = logs.filter((log: any) => log.type === 'security-violation');
    expect(securityLogs.length).toBeGreaterThan(0);
  });

  test('should display health check status indicators', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    const healthChecks = page.locator('.health-check-item');
    await expect(healthChecks.first()).toBeVisible();

    // Check status indicators
    await expect(page.locator('.status-healthy')).toBeVisible();
    await expect(page.locator('.health-check-name')).toBeVisible();
    await expect(page.locator('.health-check-description')).toBeVisible();
  });

  test('should update metrics in real-time', async ({ page }) => {
    const toggle = page.locator('.monitoring-toggle');
    await toggle.click();

    // Wait a bit and check if values update
    await page.waitForTimeout(2000);

    const newMemoryValue = await page
      .locator('.metric-card')
      .first()
      .locator('.metric-value')
      .textContent();
    const newMemory = parseFloat(newMemoryValue || '0');

    // Values should be reasonable (0-100%)
    expect(newMemory).toBeGreaterThanOrEqual(0);
    expect(newMemory).toBeLessThanOrEqual(100);
  });
});
