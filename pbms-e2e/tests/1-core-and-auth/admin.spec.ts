import { test, expect } from '@playwright/test';

test.describe('Admin Screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    // Set localStorage to simulate logged-in state
    await page.addInitScript(() => {
      window.localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'mocked-token', role: 'ROLE_ADMIN' } }));
    });
  });

  test('User Management Screen', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('body')).toContainText(/User/i);
  });

  test('Audit Log Screen', async ({ page }) => {
    await page.goto('/admin/audit-logs');
    await expect(page.locator('body')).toContainText(/Audit/i);
  });

  test('System Config Screen', async ({ page }) => {
    await page.goto('/admin/system-configs');
    await expect(page.locator('body')).toContainText(/Config/i);
  });
});
