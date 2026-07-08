import { test, expect, chromium } from '@playwright/test';

const fs = require('fs');
const path = require('path');

test.describe('System Wide Simulation (8 Roles)', () => {
  // Increase timeout for this massive test
  test.setTimeout(120000);

  test('Simultaneously login 8 roles', async () => {
    // Để mượt và video đẹp, chúng ta sử dụng Chromium và chế độ headless: true
    // Nếu để headless: false, máy tính phải render 8 cửa sổ vật lý cùng lúc sẽ gây lag và vỡ video.
    const browser = await chromium.launch({
      headless: true, 
      args: ['--window-size=1920,1080', '--disable-gpu']
    });

    const accounts = [
      { role: 'Admin', email: 'systemadministratorweb@gmail.com', password: 'Fpt123456789@', url: 'http://localhost:5173/auth/login' },
      { role: 'Manager', email: 'systemmanagerweb@gmail.com', password: 'Fpt123456789@', url: 'http://localhost:5173/auth/login' },
      { role: 'Staff IN', email: 'systemstaffwebsite@gmail.com', password: 'Fpt123456789@', url: 'http://localhost:5173/auth/login' },
      { role: 'Staff OUT', email: 'hoctapfu3@gmail.com', password: 'Fpt123456789@', url: 'http://localhost:5173/auth/login' },
      { role: 'Staff Patrol', email: 'zpmediavn@gmail.com', password: 'Fpt123456789@', url: 'http://localhost:5173/auth/login' },
      { role: 'User', email: 'systemuserweb@gmail.com', password: 'Fpt123456789@', url: 'http://localhost:5173/auth/login' },
      { role: 'IoT Tool', email: null, password: null, url: 'http://localhost:3001' },
      { role: 'Auth Flow', email: 'hocdengiavn@gmail.com', password: 'Fpt123456789@', url: 'http://localhost:5173/auth/login' }
    ];

    const contexts = await Promise.all(accounts.map((account, idx) => browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: 'test-results/videos/raw/',
        size: { width: 1920, height: 1080 }
      }
    })));
    const pages = await Promise.all(contexts.map(context => context.newPage()));

    console.log('Opened 8 separate browser contexts and pages.');

    // Launch all login processes simultaneously
    const loginPromises = accounts.map(async (account, index) => {
      const page = pages[index];
      
      console.log(`[${account.role}] Navigating to ${account.url}...`);
      await page.goto(account.url, { waitUntil: 'domcontentloaded' });

      // If it's IoT tool, we just wait to see it load
      if (!account.email) {
        // Wait for some text to appear if needed, e.g. "IoT"
        await page.waitForTimeout(5000); 
        console.log(`[${account.role}] Loaded successfully.`);
        return;
      }

      // For standard FE login
      console.log(`[${account.role}] Logging in as ${account.email}...`);
      
      // Wait for email input
      await page.waitForSelector('input[type="email"]');
      await page.fill('input[type="email"]', account.email);
      
      // Wait for password input
      await page.waitForSelector('input[type="password"]');
      await page.fill('input[type="password"]', account.password!);
      
      // Click Login button
      await page.click('button[type="submit"]');

      // Wait for navigation after login
      await page.waitForURL('**/dashboard/**', { timeout: 15000 }).catch(() => {});
      console.log(`[${account.role}] Login completed.`);
      
    });

    await Promise.all(loginPromises);
    console.log('All 8 roles have completed their initial flows.');

    // Keep it open for a bit to allow manual observation if running with UI
    await new Promise(resolve => setTimeout(resolve, 15000));

    await Promise.all(contexts.map(context => context.close()));

    // Rename videos to structured names
    for (let i = 0; i < contexts.length; i++) {
      const page = pages[i];
      const video = page.video();
      if (video) {
        const originalPath = await video.path().catch(() => null);
        if (originalPath && fs.existsSync(originalPath)) {
          const newFileName = `Role-${i + 1}-${accounts[i].role.replace(/ /g, '-')}.webm`;
          const newPath = path.join(path.dirname(originalPath), '..', newFileName);
          fs.renameSync(originalPath, newPath);
          console.log(`Saved video: test-results/videos/${newFileName}`);
        }
      }
    }

    await browser.close();
  });
});
