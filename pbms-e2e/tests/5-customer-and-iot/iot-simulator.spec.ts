import { test, expect } from '@playwright/test';

test.describe('IoT Simulator', () => {
  // Use port 3001 for IoT Simulator
  test.use({ baseURL: 'http://localhost:3001' });

  test('IoT Simulator Load', async ({ page }) => {
    await page.goto('/');
    // Should load the IoT simulator map or console
    await expect(page.locator('body')).toContainText(/IoT|Simulator/i);
  });
});
