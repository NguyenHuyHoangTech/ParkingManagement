import { test, expect } from '@playwright/test';

test.describe('Staff Gate Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'mocked-token', role: 'ROLE_STAFF' } }));
    });
  });

  test('Gate In Console Screen', async ({ page }) => {
    await page.goto('/staff/gate-in');
    await expect(page.locator('body')).toContainText(/Gate|In/i);
  });

  test('Gate Out Console Screen', async ({ page }) => {
    await page.goto('/staff/gate-out');
    await expect(page.locator('body')).toContainText(/Gate|Out/i);
  });
  
  test('Patrol (Exception Desk) Screen', async ({ page }) => {
    await page.goto('/staff/exceptions');
    await expect(page.locator('body')).toContainText(/Exception|Patrol/i);
  });
});
