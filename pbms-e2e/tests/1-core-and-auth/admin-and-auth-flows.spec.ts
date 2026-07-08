import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe.serial('Core Auth and Admin Interactions', () => {
  let adminContext: BrowserContext;
  let userContext: BrowserContext;
  let adminPage: Page;
  let userPage: Page;

  // Cấu hình hằng số
  const BASE_URL = 'http://localhost:5173';
  const ADMIN_EMAIL = 'systemadministratorweb@gmail.com';
  const ADMIN_PASS = 'Fpt123456@';
  const TARGET_EMAIL = 'hocdengiavn@gmail.com';
  const TARGET_ORIGINAL_PASS = 'Fpt123456@';
  const TARGET_TEMP_PASS = 'Fpt654321@'; // Dùng trong lúc đổi mật khẩu
  let currentTargetPass = TARGET_ORIGINAL_PASS; // Theo dõi mật khẩu hiện tại của user
  
  test.beforeAll(async ({ browser }) => {
    // Khởi tạo 2 browser contexts độc lập, độ phân giải 1920x1080
    adminContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: 'test-results/videos/admin/' } });
    adminPage = await adminContext.newPage();

    userContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: 'test-results/videos/user/' } });
    userPage = await userContext.newPage();
  });

  test.afterAll(async () => {
    await adminContext.close();
    await userContext.close();
  });

  // =========================================================================
  // PHASE 1: CORE AUTHENTICATION FLOWS (Thực hiện trên userPage)
  // =========================================================================

  test('Phase 1: Forgot Password & Reset', async ({ request }) => {
    await userPage.goto(`${BASE_URL}/login`);
    await userPage.click('text="Forgot Passwordo"');

    // Màn hình quên mật khẩu
    await userPage.fill('input[placeholder*="user@example.com"]', TARGET_EMAIL);
    await userPage.click('button:has-text("Send Confirmation Code")');

    // Đợi 2s để Backend xử lý gửi OTP
    await userPage.waitForTimeout(2000);

    // Dùng backdoor lấy OTP
    const response = await request.get(`http://localhost:8080/api/v1/identity/auth/test-get-otp?email=${TARGET_EMAIL}&purpose=FORGOT_PASSWORD`);
    const otp = await response.text();
    expect(otp).not.toBe('NOT_FOUND');

    // Nhập OTP
    await userPage.fill('input[placeholder="123456"]', otp);
    await userPage.click('button:has-text("Authentication OTP")');

    // Nhập mật khẩu mới (step 3)
    await userPage.waitForSelector('input[placeholder="At least 6 characters"]', { timeout: 15000 });
    await userPage.fill('input[placeholder="At least 6 characters"]', TARGET_TEMP_PASS);
    // Confirm password - dùng locator theo vị trí thứ 2 trong form
    const pwInputs = userPage.locator('input[type="password"]');
    await pwInputs.nth(1).fill(TARGET_TEMP_PASS);
    await userPage.click('button:has-text("Confirm Password Change")');

    await expect(userPage.locator('text="Change Password Success! Please Logine"')).toBeVisible({ timeout: 15000 });
    currentTargetPass = TARGET_TEMP_PASS; // Cập nhật mật khẩu hiện tại
  });

  test('Phase 1: Login', async () => {
    await userPage.goto(`${BASE_URL}/login`);
    await userPage.fill('input[type="email"]', TARGET_EMAIL);
    await userPage.fill('input[type="password"]', currentTargetPass);
    await userPage.click('button[type="submit"]');

    // Chờ màn hình dashboard (bất kì role nào thì avatar cũng phải hiện)
    await expect(userPage.locator('.anticon-user').first()).toBeVisible({ timeout: 15000 });
  });

  test('Phase 1: Logout', async () => {
    // Giả sử user đang ở dashboard
    await userPage.locator('.anticon-user').first().click(); // Bấm vào avatar góc phải
    await userPage.click('span:has-text("Logout")');

    // Chờ quay về trang login
    await expect(userPage.locator('button:has-text("Login")').first()).toBeVisible();
  });

  test('Phase 1: Login again with new password and Change Password from UI', async () => {
    // Đăng nhập lại bằng pass mới
    await userPage.goto(`${BASE_URL}/login`);
    await userPage.fill('input[type="email"]', TARGET_EMAIL);
    await userPage.fill('input[type="password"]', currentTargetPass);
    await userPage.click('button[type="submit"]');
    await expect(userPage.locator('.anticon-user').first()).toBeVisible({ timeout: 15000 });

    // Mở Profile Settings
    await userPage.locator('.anticon-user').first().click();
    await userPage.click('text="Setting"');
    
    // Đợi Modal hiện lên
    await expect(userPage.locator('.ant-modal-title:has-text("Settings Account")')).toBeVisible();
    
    // Sang tab Security
    await userPage.click('div.ant-tabs-tab:has-text("Security")');

    // TEST NEGATIVE: Nhập sai pass cũ
    await userPage.fill('input[placeholder="Enter old Passwordeee"]', 'WrongPass123@');
    await userPage.fill('input[placeholder="Enter new Passwordeee"]', TARGET_ORIGINAL_PASS);
    await userPage.fill('input[placeholder="Re-enter the new Password"]', TARGET_ORIGINAL_PASS);
    await userPage.click('button:has-text("Change Password")');

    // Phải báo lỗi
    await expect(userPage.locator('text="Incorrect old password"')).toBeVisible();

    // TEST POSITIVE: Nhập đúng pass cũ
    await userPage.fill('input[placeholder="Enter old Passwordeee"]', currentTargetPass);
    await userPage.click('button:has-text("Change Password")');

    // Phải báo thành công
    await expect(userPage.locator('text="Change Password Success!"')).toBeVisible();
    currentTargetPass = TARGET_ORIGINAL_PASS; // Trả lại mật khẩu gốc
    
    // Đóng modal
    await userPage.click('button.ant-modal-close');
  });

  test('Phase 1: Register New Account', async ({ request }) => {
    const newEmail = 'new_user_e2e_' + Date.now() + '@gmail.com';
    
    // Logout trước nếu đang login
    await userPage.locator('.anticon-user').first().click();
    await userPage.click('span:has-text("Logout")');

    await userPage.goto(`${BASE_URL}/login`);
    await userPage.click('text="Apply Now"'); // Chuyển sang Register

    await userPage.fill('input[placeholder="user@example.com"]', newEmail);
    await userPage.fill('input[placeholder="Nguyen Van A"]', 'E2E Test User');
    await userPage.fill('input[placeholder="At least 6 characters"]', TARGET_TEMP_PASS);
    
    const passwordInputs = await userPage.locator('input[type="password"]').all();
    if (passwordInputs.length >= 2) {
        await passwordInputs[1].fill(TARGET_TEMP_PASS);
    }
    
    await userPage.click('button:has-text("Register & Obtain OTP")');

    await userPage.waitForTimeout(2000);

    // Lấy OTP Register
    const response = await request.get(`http://localhost:8080/api/v1/identity/auth/test-get-otp?email=${newEmail}&purpose=REGISTER`);
    const otp = await response.text();
    expect(otp).not.toBe('NOT_FOUND');

    // Nhập OTP
    await userPage.fill('input[placeholder="123456"]', otp);
    
    await userPage.click('button:has-text("Confirm & Finish")');

    // Đợi thông báo thành công
    await expect(userPage.locator('text="authentication Success! Go to Logine page"')).toBeVisible({ timeout: 15000 });
    
    // Đợi tự động chuyển về trang login (khoảng 1.5s)
    await expect(userPage.locator('button:has-text("Login")').first()).toBeVisible({ timeout: 15000 });

    // Login lại bằng TARGET_EMAIL để tiếp tục Phase 2
    await userPage.fill('input[placeholder="user@example.com"]', TARGET_EMAIL);
    await userPage.fill('input[type="password"]', currentTargetPass);
    await userPage.click('button:has-text("Login")');
    await expect(userPage.locator('.anticon-user').first()).toBeVisible({ timeout: 15000 });
  });

  // =========================================================================
  // PHASE 2: ADMIN & USER INTERACTION FLOWS
  // =========================================================================

  test('Phase 2: Admin Login', async ({ request }) => {
    // Khởi tạo Admin qua backdoor
    const initRes = await request.get(`http://localhost:8080/api/v1/identity/auth/test-init-admin`);
    console.log("Init Admin Status:", initRes.status(), await initRes.text());

    // Login bằng role ADMIN
    await adminPage.goto(`${BASE_URL}/login`);
    await adminPage.fill('input[placeholder="user@example.com"]', ADMIN_EMAIL);
    await adminPage.fill('input[type="password"]', ADMIN_PASS);
    
    // Listen for any API responses
    adminPage.on('response', async (res) => {
      if (res.url().includes('/auth/login')) {
        console.log("Login API Response:", res.status(), await res.text().catch(() => ''));
      }
    });

    await adminPage.click('button:has-text("Login")');
    
    // Wait a bit to see where we landed
    await adminPage.waitForTimeout(2000);
    console.log("URL after login:", adminPage.url());

    await expect(adminPage.locator('text="User Management"').first()).toBeVisible({ timeout: 15000 });
  });

  test('Phase 2: System Configuration (Negative & Positive)', async () => {
    await adminPage.click('span:has-text("System Config")');
    await expect(adminPage.locator('h2:has-text("System Config")')).toBeVisible();

    // Verify sections are present
    await expect(adminPage.locator('text="Email Configuration (SMTP)"')).toBeVisible();
    await expect(adminPage.locator('text="PayOS Configuration"')).toBeVisible();
    
    // We don't click Test Connection because it hits real external APIs which might fail if keys aren't set
    // Just verify the save button exists
    await expect(adminPage.locator('button:has-text("Save All Configurations")')).toBeVisible();
  });

  test('Phase 2: Real-time Sync (Admin edits User)', async () => {
    await adminPage.click('span:has-text("User Management")');
    await expect(adminPage.locator('h1:has-text("Internal User Management")')).toBeVisible();

    // Tìm kiếm
    await adminPage.fill('input[placeholder="Search Name, Emaileee"]', TARGET_EMAIL);
    await adminPage.press('input[placeholder="Search Name, Emaileee"]', 'Enter');
    await adminPage.waitForTimeout(1000);
    
    // Bấm Edit
    await adminPage.locator('button:has(.anticon-edit)').first().click();
    await expect(adminPage.locator('div[role="dialog"]:has-text("Edit account")')).toBeVisible({ timeout: 10000 });
    
    // Đổi tên
    const newName = 'Target User Updated ' + Date.now();
    await adminPage.locator('div[role="dialog"]:has-text("Edit account")').locator('input#name').fill(newName);
    await adminPage.locator('div[role="dialog"]:has-text("Edit account")').locator('button:has-text("Update")').click();

    // User sẽ bị force logout do WebSocket đẩy event UPDATE
    await expect(userPage.locator('button:has-text("Login")').first()).toBeVisible({ timeout: 15000 });

    // User đăng nhập lại và thấy tên mới
    await userPage.fill('input[placeholder="user@example.com"]', TARGET_EMAIL);
    await userPage.fill('input[type="password"]', currentTargetPass);
    await userPage.click('button:has-text("Login")');

    await expect(userPage.locator(`text="${newName}"`).first()).toBeVisible({ timeout: 15000 });
  });

  test('Phase 2: Real-time Sync (User edits themselves)', async () => {
    // Trình duyệt 8 đổi tên lại
    const revertedName = 'Nguyen Huy Hoang target';
    await userPage.locator('.anticon-user').first().click();
    await userPage.click('span:has-text("Setting")');
    await expect(userPage.locator('text="Settings Account"').first()).toBeVisible();
    await userPage.locator('div[role="dialog"]:has-text("Settings Account")').locator('input#name').fill(revertedName);
    await userPage.locator('div[role="dialog"]:has-text("Settings Account")').locator('button:has-text("Save Changes")').click();

    // Chờ lưu xong
    await expect(userPage.locator('text="Update successful!"')).toBeVisible();
    await userPage.click('button.ant-modal-close');

    // Admin reload lại table để thấy tên mới
    await adminPage.reload();
    await expect(adminPage.locator('h1:has-text("Internal User Management")')).toBeVisible();
    await adminPage.fill('input[placeholder="Search Name, Emaileee"]', TARGET_EMAIL);
    await adminPage.press('input[placeholder="Search Name, Emaileee"]', 'Enter');
    await expect(adminPage.locator(`td:has-text("${revertedName}")`).first()).toBeVisible({ timeout: 15000 });
  });

  test('Phase 2: Role Change to STAFF', async () => {
    // Admin navigate trực tiếp bằng URL để tránh lỗi navigation
    await adminPage.goto(`${BASE_URL}/admin/users`);
    await adminPage.waitForURL(`${BASE_URL}/admin/users`, { timeout: 15000 });
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('h1:has-text("Internal User Management")')).toBeVisible({ timeout: 15000 });
    console.log("Admin URL before search:", adminPage.url());
    await adminPage.fill('input[placeholder="Search Name, Emaileee"]', TARGET_EMAIL);
    await adminPage.press('input[placeholder="Search Name, Emaileee"]', 'Enter');
    await adminPage.waitForTimeout(2000);
    console.log("Admin URL after search:", adminPage.url());
    
    // Admin sửa role của Target User sang STAFF
    await adminPage.locator('button:has(.anticon-edit)').first().click();
    await expect(adminPage.locator('div[role="dialog"]:has-text("Edit account")')).toBeVisible({ timeout: 10000 });
    console.log("Admin URL after clicking edit:", adminPage.url());
    // Đợi dialog ổn định
    await adminPage.waitForTimeout(1000);
    // Dùng evaluate để force click vào Ant Select bên trong dialog
    const dialog = adminPage.locator('div[role="dialog"]:has-text("Edit account")');
    await dialog.locator('div.ant-select-selector').dispatchEvent('mousedown');
    await adminPage.waitForTimeout(500);
    await adminPage.locator('div.ant-select-dropdown').waitFor({ state: 'visible', timeout: 5000 });
    await adminPage.locator('div.ant-select-item-option-content:has-text("Staff")').click();
    await dialog.locator('button:has-text("Update")').click();

    // Trình duyệt 8 đăng xuất và đăng nhập lại
    await userPage.locator('.anticon-user').first().click();
    await userPage.click('span:has-text("Logout")');
    await userPage.fill('input[placeholder="user@example.com"]', TARGET_EMAIL);
    await userPage.fill('input[type="password"]', currentTargetPass);
    await userPage.click('button:has-text("Login")');

    // Phải thấy màn hình STAFF (Work Session Management)
    await expect(userPage.locator('text="Work Session Management"')).toBeVisible({ timeout: 15000 });
  });

  test('Phase 2: Role Change to MANAGER', async () => {
    // Admin navigate trực tiếp bằng URL
    await adminPage.goto(`${BASE_URL}/admin/users`);
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('h1:has-text("Internal User Management")')).toBeVisible({ timeout: 15000 });
    await adminPage.fill('input[placeholder="Search Name, Emaileee"]', TARGET_EMAIL);
    await adminPage.press('input[placeholder="Search Name, Emaileee"]', 'Enter');
    await adminPage.waitForTimeout(1500);
    
    // Admin sửa role sang MANAGER
    await adminPage.locator('button:has(.anticon-edit)').first().click();
    await expect(adminPage.locator('div[role="dialog"]:has-text("Edit account")')).toBeVisible({ timeout: 10000 });
    await adminPage.waitForTimeout(1000);
    const dialogManager = adminPage.locator('div[role="dialog"]:has-text("Edit account")');
    await dialogManager.locator('div.ant-select-selector').dispatchEvent('mousedown');
    await adminPage.waitForTimeout(500);
    await adminPage.locator('div.ant-select-dropdown').waitFor({ state: 'visible', timeout: 5000 });
    await adminPage.locator('div.ant-select-item-option-content:has-text("Manager")').click();
    await dialogManager.locator('button:has-text("Update")').click();

    // Trình duyệt 8 đăng xuất và đăng nhập lại
    await userPage.locator('.anticon-user').first().click();
    await userPage.click('span:has-text("Logout")');
    await userPage.fill('input[placeholder="user@example.com"]', TARGET_EMAIL);
    await userPage.fill('input[type="password"]', currentTargetPass);
    await userPage.click('button:has-text("Login")');

    // Phải thấy màn hình MANAGER Dashboard
    await expect(userPage.locator('text="Revenue"')).toBeVisible({ timeout: 15000 });
  });

  test('Phase 2: Lock and Unlock User', async () => {
    // Admin navigate trực tiếp
    await adminPage.goto(`${BASE_URL}/admin/users`);
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('h1:has-text("Internal User Management")')).toBeVisible({ timeout: 15000 });
    await adminPage.fill('input[placeholder="Search Name, Emaileee"]', TARGET_EMAIL);
    await adminPage.press('input[placeholder="Search Name, Emaileee"]', 'Enter');
    await adminPage.waitForTimeout(1500);

    const userRow = adminPage.locator('tr', { hasText: TARGET_EMAIL });
    
    // Admin khoá account
    await userRow.locator('button:has-text("Lock")').click();
    await adminPage.click('.ant-popover-buttons button:has-text("Lock")');
    await expect(adminPage.locator('.ant-message:has-text("Account has been locked successfully.")')).toBeVisible();

    // User reload sẽ bị đá ra trang login kèm báo lỗi bị khoá
    await userPage.reload();
    await expect(userPage.locator('button:has-text("Login")').first()).toBeVisible({ timeout: 15000 });

    // Admin mở khoá account
    await userRow.locator('button:has-text("Unlock")').click();
    await adminPage.click('.ant-popover-buttons button:has-text("Unlock")');
    await expect(adminPage.locator('.ant-message:has-text("Account has been unlocked successfully.")')).toBeVisible();

    // User đăng nhập lại thành công
    await userPage.fill('input[placeholder="user@example.com"]', TARGET_EMAIL);
    await userPage.fill('input[type="password"]', currentTargetPass);
    await userPage.click('button:has-text("Login")');
    await expect(userPage.locator('.anticon-user').first()).toBeVisible({ timeout: 15000 });
  });

  test('Phase 2: Admin Reset Password', async ({ request }) => {
    // Admin navigate trực tiếp
    await adminPage.goto(`${BASE_URL}/admin/users`);
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('h1:has-text("Internal User Management")')).toBeVisible({ timeout: 15000 });
    await adminPage.fill('input[placeholder="Search Name, Emaileee"]', TARGET_EMAIL);
    await adminPage.press('input[placeholder="Search Name, Emaileee"]', 'Enter');
    await adminPage.waitForTimeout(1500);

    const userRow = adminPage.locator('tr', { hasText: TARGET_EMAIL });
    
    // Admin nhấn Reset Password
    await userRow.locator('button:has-text("Reset")').click();
    await adminPage.click('.ant-popover-buttons button:has-text("Reset")');
    await expect(adminPage.locator('.ant-message:has-text("New password sent via email.")')).toBeVisible();

    // Dùng backdoor để đọc mật khẩu mới từ Backend (cửa sau 2)
    const response = await request.get(`http://localhost:8080/api/v1/identity/auth/test-get-reset-password?email=${TARGET_EMAIL}`);
    const newRandomPass = await response.text();
    expect(newRandomPass).not.toBe('NOT_FOUND');

    // Đăng xuất và đăng nhập bằng pass mới
    await userPage.locator('.anticon-user').first().click();
    await userPage.click('span:has-text("Logout")');
    await userPage.fill('input[placeholder="user@example.com"]', TARGET_EMAIL);
    await userPage.fill('input[type="password"]', newRandomPass);
    await userPage.click('button:has-text("Login")');
    await expect(userPage.locator('.anticon-user').first()).toBeVisible({ timeout: 15000 });

    currentTargetPass = newRandomPass;
  });

  test('Phase 2: Audit Logs', async () => {
    await adminPage.click('span:has-text("Active Log")');
    await expect(adminPage.locator('h1:has-text("Active Log")').or(adminPage.locator('h1:has-text("Audit Log")'))).toBeVisible();

    // Xem log mới nhất có UPDATE_USER và RESET_PASSWORD không
    await expect(adminPage.locator('td:has-text("RESET_PASSWORD")').first()).toBeVisible();
    await expect(adminPage.locator('td:has-text("UPDATE")').first()).toBeVisible();
  });

  // =========================================================================
  // TEARDOWN: Khôi phục dữ liệu
  // =========================================================================

  test('Teardown: Revert password and role', async () => {
    // Trình duyệt 8 đổi mật khẩu lại thành Fpt123456@
    await userPage.locator('.anticon-user').first().click();
    await userPage.click('span:has-text("Setting")');
    await userPage.click('div.ant-tabs-tab:has-text("Security")');
    await userPage.fill('input[placeholder="Enter old Passwordeee"]', currentTargetPass);
    await userPage.fill('input[placeholder="Enter new Passwordeee"]', TARGET_ORIGINAL_PASS);
    await userPage.fill('input[placeholder="Re-enter the new Password"]', TARGET_ORIGINAL_PASS);
    await userPage.click('button:has-text("Change Password")');
    await expect(userPage.locator('text="Change Password Success!"')).toBeVisible();
    currentTargetPass = TARGET_ORIGINAL_PASS;
    await userPage.click('button.ant-modal-close');

    // Admin trả role về CUSTOMER
    await adminPage.goto(`${BASE_URL}/admin/users`);
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('h1:has-text("Internal User Management")')).toBeVisible({ timeout: 15000 });
    await adminPage.fill('input[placeholder="Search Name, Emaileee"]', TARGET_EMAIL);
    await adminPage.press('input[placeholder="Search Name, Emaileee"]', 'Enter');
    await adminPage.waitForTimeout(1500);
    await adminPage.locator('button:has(.anticon-edit)').first().click();
    await expect(adminPage.locator('div[role="dialog"]:has-text("Edit account")')).toBeVisible({ timeout: 10000 });
    await adminPage.waitForTimeout(1000);
    const dialogTeardown = adminPage.locator('div[role="dialog"]:has-text("Edit account")');
    await dialogTeardown.locator('div.ant-select-selector').dispatchEvent('mousedown');
    await adminPage.waitForTimeout(500);
    await adminPage.locator('div.ant-select-dropdown').waitFor({ state: 'visible', timeout: 5000 });
    await adminPage.locator('div.ant-select-item-option-content:has-text("Customer")').click();
    await dialogTeardown.locator('button:has-text("Update")').click();
  });

});
