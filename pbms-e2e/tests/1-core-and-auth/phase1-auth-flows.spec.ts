import { test, expect, Page } from '@playwright/test';

// ============================================================
// PHASE 1: CORE AUTHENTICATION FLOWS - ALL IN ONE
// Thực hiện toàn bộ luồng trong 1 test case duy nhất 
// để xuất ra 1 file video duy nhất.
// ============================================================

const BASE_URL = 'http://localhost:5173';
const BACKDOOR_URL = 'http://localhost:8080/api/v1/identity/auth';

test('Luồng xác thực toàn diện (Đăng ký -> Quên MK -> Đổi MK)', async ({ page, request }) => {
  const newEmail = `new_user_e2e_${Date.now()}@gmail.com`;
  const originalPass = 'Fpt123456@';
  const tempPass = 'Fpt12345@';
  
  // Helper: đăng nhập
  async function loginAs(email: string, password: string) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="user@example.com"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Login")');
  }

  // Helper: đăng xuất
  async function logout() {
    await page.locator('.anticon-user').first().click();
    await page.click('span:has-text("Logout")');
    await expect(page.locator('button:has-text("Login")').first()).toBeVisible({ timeout: 10000 });
  }

  // =========================================================
  // 1. TẠO TÀI KHOẢN MỚI
  // =========================================================
  await test.step('1. Đăng ký tài khoản mới', async () => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.click('text="Apply Now"');
    await expect(page.locator('text="Create an account"')).toBeVisible({ timeout: 5000 });

    await page.fill('input[placeholder="user@example.com"]', newEmail);
    await page.fill('input[placeholder="Nguyen Van A"]', 'E2E Test User');
    await page.fill('input[placeholder="At least 6 characters"]', originalPass);

    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(1).fill(originalPass);

    await page.click('button:has-text("Register & Obtain OTP")');
    await page.waitForTimeout(2000);

    const otpRes = await request.get(`${BACKDOOR_URL}/test-get-otp?email=${newEmail}&purpose=REGISTER`);
    const otp = await otpRes.text();
    expect(otp).not.toBe('NOT_FOUND');

    await page.fill('input[placeholder="123456"]', otp);
    await page.click('button:has-text("Confirm & Finish")');

    await expect(page.locator('text="authentication Success! Go to Logine page"')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("Login")').first()).toBeVisible({ timeout: 10000 });
  });

  // =========================================================
  // 2. QUÊN MẬT KHẨU & THIẾT LẬP MẬT KHẨU TẠM
  // =========================================================
  await test.step('2. Quên mật khẩu và đặt mật khẩu tạm', async () => {
    await page.goto(`${BASE_URL}/login`);
    await page.click('button:has-text("Forgot Passwordo")');

    await page.fill('input[placeholder="user@example.com"]', newEmail);
    await page.click('button:has-text("Send Confirmation Code")');
    
    await page.waitForTimeout(2000);
    const otpRes = await request.get(`${BACKDOOR_URL}/test-get-otp?email=${newEmail}&purpose=FORGOT_PASSWORD`);
    const otp = await otpRes.text();
    expect(otp).not.toBe('NOT_FOUND');

    await page.fill('input[placeholder="123456"]', otp);
    await page.click('button:has-text("Authentication OTP")');

    await page.waitForSelector('input[placeholder="At least 6 characters"]', { timeout: 15000 });
    await page.fill('input[placeholder="At least 6 characters"]', tempPass);
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(1).fill(tempPass);
    await page.click('button:has-text("Confirm Password Change")');

    await expect(page.locator('text="Change Password Success! Please Logine"')).toBeVisible({ timeout: 15000 });
  });

  // =========================================================
  // 3. LOGIN VÀO BẰNG MẬT KHẨU TẠM
  // =========================================================
  await test.step('3. Đăng nhập bằng mật khẩu tạm', async () => {
    await loginAs(newEmail, tempPass);
    await expect(page.locator('.anticon-user').first()).toBeVisible({ timeout: 15000 });
  });

  // =========================================================
  // 4. ĐỔI THÔNG TIN MẬT KHẨU VỀ MK CŨ
  // =========================================================
  await test.step('4. Đổi mật khẩu về mật khẩu ban đầu', async () => {
    await page.locator('.anticon-user').first().click();
    await page.click('span:has-text("Setting")');
    await expect(page.locator('text="Settings Account"').first()).toBeVisible({ timeout: 10000 });

    await page.click('div.ant-tabs-tab:has-text("Security")');
    await page.waitForTimeout(500);

    await page.fill('input[placeholder="Enter old Passwordeee"]', tempPass);
    await page.fill('input[placeholder="Enter new Passwordeee"]', originalPass);
    await page.fill('input[placeholder="Re-enter the new Password"]', originalPass);
    await page.click('button:has-text("Change Password")');

    await expect(page.locator('text="Change Password Success!"')).toBeVisible({ timeout: 10000 });
    await page.click('button.ant-modal-close');
  });

  // =========================================================
  // 5. LOGOUT VÀ LOGIN LẠI (HOÀN THÀNH)
  // =========================================================
  await test.step('5. Logout và Login lại bằng mật khẩu ban đầu', async () => {
    await logout();
    await loginAs(newEmail, originalPass);
    await expect(page.locator('.anticon-user').first()).toBeVisible({ timeout: 15000 });
  });

});
