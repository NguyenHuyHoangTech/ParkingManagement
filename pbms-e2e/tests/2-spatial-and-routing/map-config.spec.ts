import { test, expect } from '@playwright/test';

test.describe('Spatial and Routing', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'mocked-token', role: 'ROLE_MANAGER' } }));
    });
  });

  test('Map Configuration Screen', async ({ page }) => {
    await page.goto('/manager/space-map');
    await expect(page.locator('body')).toContainText(/Map/i);
  });
});
