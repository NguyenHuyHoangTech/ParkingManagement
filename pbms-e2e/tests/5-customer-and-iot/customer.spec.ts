import { test, expect } from '@playwright/test';

test.describe('Customer Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'mocked-token', role: 'ROLE_CUSTOMER' } }));
    });
  });

  test('Customer Home Screen', async ({ page }) => {
    await page.goto('/customer/home');
    await expect(page.locator('body')).toContainText(/Home|Parking/i);
  });
  
  test('My Parking Screen', async ({ page }) => {
    await page.goto('/customer/my-parking');
    await expect(page.locator('body')).toContainText(/Parking/i);
  });
});
