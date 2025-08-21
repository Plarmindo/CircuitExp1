import { test, expect } from '@playwright/test';

test.describe('User-Friendly Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays permission denied error with retry option', async ({ page }) => {
    // Mock a permission denied error
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error("EACCES: permission denied, scandir '/protected'"),
        })
      );
    });

    // Check that error banner appears
    const errorBanner = await page.locator('.error-banner').first();
    await expect(errorBanner).toBeVisible();

    // Check error title and message
    await expect(errorBanner.locator('.error-title')).toContainText('Access Denied');
    await expect(errorBanner.locator('.error-message')).toContainText(
      'Access denied. Please check folder permissions'
    );

    // Check that retry button is available
    const retryButton = errorBanner.locator('button:has-text("Retry")');
    await expect(retryButton).toBeVisible();

    // Check that dismiss button is available
    const dismissButton = errorBanner.locator('button:has-text("Dismiss")');
    await expect(dismissButton).toBeVisible();
  });

  test('displays directory not found error with select new option', async ({ page }) => {
    // Mock a directory not found error
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error("ENOENT: no such file or directory, scandir '/nonexistent'"),
        })
      );
    });

    const errorBanner = await page.locator('.error-banner').first();
    await expect(errorBanner).toBeVisible();

    await expect(errorBanner.locator('.error-title')).toContainText('Directory Not Found');
    await expect(errorBanner.locator('.error-message')).toContainText(
      'The specified directory no longer exists'
    );

    // Check that "Select New Folder" button is available
    const selectNewButton = errorBanner.locator('button:has-text("Select New Folder")');
    await expect(selectNewButton).toBeVisible();
  });

  test('displays disk space error with helpful message', async ({ page }) => {
    // Mock a disk space error
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error('ENOSPC: no space left on device'),
        })
      );
    });

    const errorBanner = await page.locator('.error-banner').first();
    await expect(errorBanner).toBeVisible();

    await expect(errorBanner.locator('.error-title')).toContainText('Disk Space Low');
    await expect(errorBanner.locator('.error-message')).toContainText(
      'Your disk is running low on space'
    );
  });

  test('error details can be expanded and collapsed', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error('Test error with stack trace'),
        })
      );
    });

    const errorBanner = await page.locator('.error-banner').first();
    const detailsToggle = errorBanner.locator('button:has-text("Show details")');
    await expect(detailsToggle).toBeVisible();

    // Click to show details
    await detailsToggle.click();
    await expect(errorBanner.locator('.error-details')).toBeVisible();

    // Click to hide details
    await detailsToggle.click();
    await expect(errorBanner.locator('.error-details')).not.toBeVisible();
  });

  test('error can be dismissed', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error('Test dismissible error'),
        })
      );
    });

    const errorBanner = await page.locator('.error-banner').first();
    await expect(errorBanner).toBeVisible();

    const dismissButton = errorBanner.locator('button:has-text("Dismiss")');
    await dismissButton.click();

    await expect(errorBanner).not.toBeVisible();
  });

  test('multiple errors stack correctly', async ({ page }) => {
    // Trigger multiple errors
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error('First error'),
        })
      );
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error('Second error'),
        })
      );
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error('Third error'),
        })
      );
    });

    // Check that all error banners are visible
    const errorBanners = await page.locator('.error-banner').all();
    expect(errorBanners).toHaveLength(3);
  });

  test('error reporting service captures error context', async ({ page }) => {
    const errorInfo = await page.evaluate(() => {
      return new Promise((resolve) => {
        const error = new Error('Test context error');
        const info = (window as any).errorReporter?.reportError(error, 'test-context');
        resolve(info);
      });
    });

    expect(errorInfo).toBeDefined();
    expect(errorInfo).toHaveProperty('id');
    expect(errorInfo).toHaveProperty('title');
    expect(errorInfo).toHaveProperty('message');
    expect(errorInfo).toHaveProperty('type');
  });

  test('scan-specific errors are handled gracefully', async ({ page }) => {
    // Mock scan error from main process
    await page.evaluate(() => {
      (window as any).electronAPI?.onScanError?.((error: any) => {
        window.dispatchEvent(new CustomEvent('scan:error', { detail: error }));
      });

      window.dispatchEvent(
        new CustomEvent('scan:error', {
          detail: {
            scanId: 'test-scan',
            errorCode: 'EACCES',
            userMessage: 'Access denied to directory',
            recoverable: true,
            suggestedAction: 'retry',
          },
        })
      );
    });

    const errorBanner = await page.locator('.error-banner').first();
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner.locator('.error-title')).toContainText('Access Denied');
  });
});
