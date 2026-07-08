import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', async route => {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify({ data: { accessToken: 'mocked-token', role: 'ROLE_ADMIN' } }) 
      });
    });
  });

  test('Login Flow', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@pbms.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).not.toHaveURL(/.*login/, { timeout: 10000 });
  });

  test('Forgot Password Flow', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Forgot Password');
    // Ensure form changes to Forgot Password
    await expect(page.getByRole('button', { name: /Send OTP/i }).first()).toBeVisible();
  });

  test('Register Flow', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Apply Now');
    // Ensure form changes to Registration
    await expect(page.getByRole('button', { name: /Register/i }).first()).toBeVisible();
  });
});
