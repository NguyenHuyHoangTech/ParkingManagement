import { test, expect } from '@playwright/test';

test.describe('Manager Screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'mocked-token', role: 'ROLE_MANAGER' } }));
    });
  });

  test('Pricing Config Screen', async ({ page }) => {
    await page.goto('/manager/pricing');
    await expect(page.locator('body')).toContainText(/Pricing/i);
  });

  test('Revenue Dashboard', async ({ page }) => {
    await page.goto('/manager/dashboard');
    await expect(page.locator('body')).toContainText(/Revenue/i);
  });
  
  test('Card Management', async ({ page }) => {
    await page.goto('/manager/cards');
    await expect(page.locator('body')).toContainText(/Card/i);
  });
});
