import { test, expect } from '@playwright/test';

// ============================================================
// PHASE 2: ADMIN PANEL FLOWS
// Thực hiện toàn bộ luồng kiểm thử chức năng dành cho Admin
// ============================================================

const BASE_URL = 'http://localhost:5173';
const ADMIN_EMAIL = 'systemadministratorweb@gmail.com';
const ADMIN_PASS = 'Fpt123456@';

test('Luồng kiểm thử chức năng Admin toàn diện', async ({ page }) => {
  test.setTimeout(300000); // 5 phút do slowMo tốn rất nhiều thời gian

  // =========================================================
  // 1. LOGIN VÀO TRANG ADMIN
  // =========================================================
  await test.step('1. Đăng nhập vào Admin', async () => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="user@example.com"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button:has-text("Login")');

    // Chờ điều hướng vào màn hình Admin (Internal User Management)
    await expect(page.locator('h1:has-text("Internal User Management")')).toBeVisible({ timeout: 15000 });
  });

  // =========================================================
  // 2. MÀN HÌNH QUẢN LÝ USER (User Management)
  // =========================================================
  await test.step('2. Màn hình User Management: Search & Filter', async () => {
    // Test nút Search
    const searchInput = page.locator('input[placeholder="Search Name, Emaileee"]');
    await searchInput.fill('admin');
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(1000);

    // Test Filter by Role
    const roleSelect = page.locator('.ant-select').filter({ hasText: 'Filter by Role' });
    await roleSelect.click();
    await page.click('div.ant-select-item-option-content:has-text("Staff")');
    await page.waitForTimeout(1000);

    // Test Filter by Status
    const statusSelect = page.locator('.ant-select').filter({ hasText: 'Filter by Status' });
    await statusSelect.click();
    await page.click('div.ant-select-item-option-content:has-text("Active")');
    await page.waitForTimeout(1000);

    // Xoá bộ lọc để xem lại tất cả
    await searchInput.fill('');
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(1000);
  });
  // =========================================================
  // 2.1. THAO TÁC TRÊN TÀI KHOẢN (Edit, Lock, Unlock, Reset PW)
  // =========================================================
  await test.step('2.1. Màn hình User Management: Edit, Lock/Unlock, Reset PW', async () => {
    // Reload lại trang để xoá toàn bộ bộ lọc (Status, Role, Search) từ bước 2
    // Đảm bảo khi Lock tài khoản (thành Inactive), tài khoản vẫn hiển thị trên bảng
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Đợi bảng có dữ liệu
    await expect(page.locator('.ant-table-row').nth(1)).toBeVisible({ timeout: 15000 });
    
    // Lấy email của người dùng thứ 2 để làm mốc tìm kiếm (không lấy admin đang login)
    const targetEmail = await page.locator('.ant-table-row').nth(1).locator('td').first().locator('.text-gray-400').innerText();
    const originalName = await page.locator('.ant-table-row').nth(1).locator('td').first().locator('.font-medium').innerText();
    
    // Tìm kiếm đích danh email này để nó là kết quả duy nhất (tránh lỗi database đảo lộn thứ tự sau khi update)
    const searchInput = page.locator('input[placeholder="Search Name, Emaileee"]');
    await searchInput.fill(targetEmail);
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(1500);

    // Tạo locator động tìm theo email để đảm bảo luôn lấy đúng người dùng dù bảng có reload
    const targetRow = page.locator('.ant-table-row', { hasText: targetEmail }).first();
    
    // 1. Sửa thông tin tài khoản user
    // Bấm Edit
    await targetRow.locator('button:has-text("Edit")').click();
    await expect(page.locator('.ant-modal-title:has-text("Edit account")')).toBeVisible({ timeout: 5000 });
    
    // Đổi tên và lưu
    const nameInput = page.locator('.ant-modal-body:visible input[placeholder="Nguyen Van A"]');
    await nameInput.fill(originalName + ' Edited');
    await page.locator('.ant-modal-body button:has-text("Update")').click();
    await expect(page.locator('.ant-message-success:has-text("Information updated successfully.")').last()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Khôi phục lại tên cũ
    await targetRow.locator('button:has-text("Edit")').click();
    await expect(page.locator('.ant-modal-title:has-text("Edit account")')).toBeVisible({ timeout: 5000 });
    await nameInput.fill(originalName);
    await page.locator('.ant-modal-body button:has-text("Update")').click();
    await expect(page.locator('.ant-message-success:has-text("Information updated successfully.")').last()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 2. Khóa một tài khoản sau đó mở khóa lại
    const actionCell = targetRow.locator('td').last();
    const lockBtn = actionCell.locator('button').filter({ hasText: /^Lock$/ });
    
    // Bấm Lock
    await lockBtn.click();
    // Bấm Confirm trên Popconfirm
    await page.locator('.ant-popover:visible button.ant-btn-primary').click();
    await expect(page.locator('.ant-message-success:has-text("Account has been locked successfully.")').last()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
      
    // Bấm Unlock
    const unlockBtn = actionCell.locator('button').filter({ hasText: /^Unlock$/ });
    await unlockBtn.click();
    // Bấm Confirm
    await page.locator('.ant-popover:visible button.ant-btn-primary').click();
    await expect(page.locator('.ant-message-success:has-text("Account has been unlocked successfully.")').last()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 3. Ấn vào reset password của một tài khoản
    await actionCell.locator('button:has-text("Reset PW")').click();
    await page.locator('.ant-popover:visible button.ant-btn-primary').click();
    await expect(page.locator('.ant-message-success:has-text("New password sent via email.")').last()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
  });
  // =========================================================
  // 3. MÀN HÌNH CẤU HÌNH HỆ THỐNG (System Configuration)
  // =========================================================
  await test.step('3. Màn hình System Configuration: Negative & Positive Test', async () => {
    // Thay vì click menu dễ gặp lỗi do React Portal, ta goto trực tiếp URL
    await page.goto(`${BASE_URL}/admin/system-configs`);
    await expect(page.locator('h2:has-text("System Config")')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000); // Chờ dữ liệu config fetch xong

    // MOCK API để E2E test chạy ổn định, không phụ thuộc vào 3rd party services
    await page.route('**/system/configs/test-*', async route => {
      const postData = route.request().postDataJSON() || {};
      const payloadString = JSON.stringify(postData);
      
      // Nếu payload chứa chữ WRONG (do test cố tình gõ sai) thì trả về lỗi
      if (payloadString.includes('WRONG')) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Connection failed!' })
        });
      } else {
        // Trả về thành công
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'SUCCESS', data: [{ model: 'gemini-pro', response: 'ok' }] })
        });
      }
    });

    // Hàm helper để test 1 config card
    const testConfigSection = async (cardTitle: string, inputLabel: string, isPasswordType: boolean = false) => {
      const card = page.locator('.ant-card').filter({ hasText: cardTitle });
      const testBtn = card.locator('button:has-text("Test Connection")');
      
      // Lấy input field
      const inputWrapper = card.locator('div').filter({ hasText: new RegExp(`^${inputLabel}$`) }).first();
      // Ant Design input DOM structure can be tricky, we find input inside the container that has the label text nearby
      // A safer way is filtering all inputs inside the card by assuming the first or second input.
      // Let's just grab the first input of the card.
      const inputField = isPasswordType ? card.locator('input[type="password"]').first() : card.locator('input[type="text"]').first();

      // Lưu lại giá trị gốc
      const originalValue = await inputField.inputValue();

      // --- NEGATIVE TEST ---
      // Xoá 1 ký tự cuối để làm sai cấu hình
      await inputField.fill(originalValue.slice(0, -1) + 'WRONG');
      await testBtn.click();
      
      // Chờ thông báo lỗi hoặc trạng thái lỗi
      await expect(page.locator('.ant-message-error')).toBeVisible({ timeout: 15000 });
      // Đợi message biến mất để tránh che khuất các thao tác sau
      await page.waitForTimeout(2000);

      // --- POSITIVE TEST ---
      // Khôi phục lại giá trị đúng
      await inputField.fill(originalValue);
      await testBtn.click();
      
      // Chờ thông báo thành công
      await expect(page.locator('.ant-message-success:has-text("Connected successfully!")').last()).toBeVisible({ timeout: 15000 });
      await expect(card.locator('span.ant-typography-success')).toBeVisible({ timeout: 5000 }); // Chữ "Verified"
      await page.waitForTimeout(1000);
    };

    // Test 3 cấu hình theo yêu cầu
    console.log('Testing Email Configuration...');
    await testConfigSection('Email Configuration (SMTP)', 'SMTP Email Address', false);

    console.log('Testing PayOS Configuration...');
    await testConfigSection('PayOS Configuration', 'Client ID', false);

    console.log('Testing PayPal Configuration...');
    await testConfigSection('PayPal Configuration', 'Sandbox Client ID', false);

    // Đối với Gemini, chỉ cần bấm test để verify (không cần test negative)
    console.log('Testing Gemini Configuration...');
    const geminiCard = page.locator('.ant-card').filter({ hasText: 'Gemini AI Configuration' });
    await geminiCard.locator('button:has-text("Test Connection")').click();
    await expect(page.locator('.ant-message-success:has-text("Connected successfully!")').last()).toBeVisible({ timeout: 15000 });
    await expect(geminiCard.locator('span.ant-typography-success')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Khi tất cả đã verified, ấn nút Save All Configurations
    const saveBtn = page.locator('button:has-text("Save All Configurations")');
    await expect(saveBtn).not.toBeDisabled();
    await saveBtn.click();
    await expect(page.locator('.ant-message-success:has-text("System configuration saved!")')).toBeVisible({ timeout: 10000 });
  });

  // =========================================================
  // 4. MÀN HÌNH QUẢN LÝ LOG (Audit Logs)
  // =========================================================
  await test.step('4. Màn hình Audit Logs: Search, Filters & Details', async () => {
    // Thay vì click menu dễ gặp lỗi do React Portal, ta goto trực tiếp URL
    await page.goto(`${BASE_URL}/admin/audit-logs`);
    await expect(page.locator('h2:has-text("System Audit Logs")')).toBeVisible({ timeout: 15000 });

    // Test Search by Email
    const searchEmail = page.locator('input[placeholder="admin@example.com"]');
    await searchEmail.fill('system');
    await page.waitForTimeout(1500); // Chờ gọi API

    // Test Filter Action (All Actions -> UPDATE)
    const actionSelect = page.locator('.ant-select').filter({ hasText: 'All Actions' });
    await actionSelect.click();
    await page.locator('div.ant-select-item-option-content').filter({ hasText: /^UPDATE$/ }).first().click();
    await page.waitForTimeout(1500);

    // Test Filter Resource
    const resourceInput = page.locator('input[placeholder="e.g. User, Role..."]');
    await resourceInput.fill('Config');
    await page.waitForTimeout(1500);

    // Test Date Range
    const datePicker = page.locator('input[placeholder="Start date"]');
    await datePicker.dispatchEvent('click');
    await page.waitForTimeout(500);
    // Chọn ngày đầu và ngày cuối hiển thị trên lịch
    await page.locator('.ant-picker-cell-in-view').first().click();
    await page.waitForTimeout(300);
    await page.locator('.ant-picker-cell-in-view').last().click();
    await page.waitForTimeout(1500);

    // Test ấn vào một log chi tiết để xem sự thay đổi (Nút "View Diff")
    const viewDiffBtn = page.locator('button:has-text("View Diff")').first();
    // Đảm bảo có ít nhất 1 log
    const count = await viewDiffBtn.count();
    if (count > 0) {
      await viewDiffBtn.click();
      await expect(page.locator('div.ant-modal-title:has-text("Audit Log Detail (Diff Viewer)")')).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(2000); // Chờ 2s để người dùng xem diff
      // Tắt modal
      await page.click('button:has-text("Close")');
    } else {
      console.log('Không có log nào phù hợp với bộ lọc để xem chi tiết.');
    }
  });

});
