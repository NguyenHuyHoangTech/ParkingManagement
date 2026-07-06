# Kế Hoạch Kiểm Thử Toàn Bộ Hệ Thống Quản Lý Bãi Đỗ Xe (PBMS)

Tài liệu này cung cấp kịch bản kiểm thử toàn diện (End-to-End Test Plan) từ các luồng chính, luồng phụ, cho đến các luồng ngoại lệ và báo cáo để đảm bảo quá trình demo không bỏ sót bất kỳ chức năng hay chi tiết nào.

---

## I. LUỒNG CHÍNH (MAIN FLOWS)

### 1. Luồng Xác Thực và Phân Quyền (Authentication & Authorization)
- [ ] **Đăng nhập thành công:** Đăng nhập với các tài khoản thuộc các vai trò khác nhau (Super Admin, Admin, Manager, Staff, Customer) và kiểm tra điều hướng đúng trang Dashboard/Layout tương ứng.
- [ ] **Đăng nhập bằng Google:** Kiểm tra tính năng SSO qua Google OAuth2.
- [ ] **Bảo mật truy cập:** Thử dán trực tiếp URL của Manager vào trình duyệt khi đang đăng nhập bằng Customer (Phải bị chặn và redirect về login hoặc trang báo lỗi).
- [ ] **Đăng xuất:** Đảm bảo token bị xóa và không thể back lại trang bảo mật sau khi đăng xuất.

### 2. Luồng Gửi/Rút Xe Vãng Lai (Guest Parking Flow)
- [ ] **Vào bãi (Entry):** 
  - Sử dụng IoT Simulator giả lập camera nhận diện biển số (LPR).
  - Trạng thái trên Gate Console của Staff cập nhật tức thời (biển số, hình ảnh, thời gian vào).
  - Barie mở (nếu hợp lệ) -> Khách vào -> Tạo mới `ParkingSession` với trạng thái `ACTIVE`.
- [ ] **Tính cước (Pricing calculation):**
  - Chuyển tiếp thời gian (dùng công cụ Time Travel/Time offset) để giả lập thời gian đỗ xe kéo dài.
  - Xem trước cước phí đỗ xe (nếu hỗ trợ tra cứu).
- [ ] **Ra bãi và Thanh toán (Exit & Payment):**
  - Giả lập camera LPR nhận diện biển số tại cổng ra.
  - Gate Console hiển thị thông tin phí đỗ xe.
  - Thực hiện thanh toán (Tiền mặt/Mã QR).
  - Barie mở -> Khách ra -> Cập nhật `ParkingSession` thành `COMPLETED`.

### 3. Luồng Đặt Chỗ Trước (Pre-booking Flow)
- [ ] **Khách hàng đặt chỗ:** Customer vào trang Pre-Booking, chọn thời gian, chọn bãi/vị trí đỗ và thanh toán trước (nếu cấu hình yêu cầu).
- [ ] **Quản lý duyệt (nếu có):** Manager kiểm tra trong màn hình Pre-Bookings và xác nhận.
- [ ] **Khách hàng vào bãi:** LPR nhận diện đúng biển số đã đặt -> Barie tự mở không cần thu phí lại.
- [ ] **Khách hàng ra bãi đúng giờ:** LPR nhận diện -> Barie tự mở -> Session hoàn tất.

### 4. Luồng Vé Tháng (Monthly Pass Flow)
- [ ] **Đăng ký vé tháng:** Customer đăng ký qua màn hình `Monthly Pass` hoặc Manager cấp phát trên màn hình `Monthly Passes`.
- [ ] **Kiểm tra khi vào/ra:** Giả lập LPR -> Hệ thống nhận diện vé tháng hợp lệ -> Barie tự mở.
- [ ] **Gia hạn:** Gia hạn vé tháng đã hết hạn và kiểm tra tính hợp lệ.

---

## II. LUỒNG PHỤ (SUB-FLOWS)

### 1. Quản lý Nhân sự & Ca làm việc (Staff & Shift Management)
- [ ] **Staff nhận ca:** Staff đăng nhập, thao tác nhận ca tại màn hình `Shift Management`.
- [ ] **Bàn giao ca:** Staff bàn giao ca, hệ thống ghi nhận doanh thu trong ca, đối soát tiền mặt.
- [ ] **Manager theo dõi:** Manager xem được danh sách ca làm việc và doanh thu từng ca.

### 2. Thiết lập & Cấu hình Hệ thống (System Configuration)
- [ ] **Cấu hình Bảng giá (Pricing Config):** Manager thêm mới/cập nhật bảng giá (Pricing Block, Pricing Policy, Pricing Shift). Tạo một lượt xe mới để xác nhận giá mới được áp dụng.
- [ ] **Cấu hình Loại xe (Vehicle Types):** Thêm/Sửa/Xóa loại xe (ví dụ: Ô tô điện, Xe máy).
- [ ] **Sơ đồ bãi đỗ (Space Map) & Định tuyến (Routing):** Thay đổi trạng thái vị trí đỗ (Slot) trên bản đồ và kiểm tra tính năng định tuyến xe vào bãi (Vehicle Routing).

### 3. Quản lý Thẻ & Khách hàng (Card & Customer Management)
- [ ] **Gán thẻ RFID:** Thao tác trên màn hình `Card Management` gán thẻ RFID cho vé tháng hoặc khách hàng.
- [ ] **Hoàn tiền (Refund Process):** Khách hàng hủy đặt chỗ trước giờ quy định -> Tạo `RefundRequest` -> Manager vào duyệt hoàn tiền.

---

## III. LUỒNG NGOẠI LỆ (EXCEPTION & EDGE-CASE FLOWS)

### 1. Lỗi nhận diện và Xử lý sự cố (Incident & Manual Override)
- [ ] **Camera nhận diện sai hoặc không nhận diện được:** LPR Simulator gửi ảnh mờ -> Gate Console báo lỗi nhận diện -> Staff nhập biển số thủ công (Manual Override) và cho xe vào.
- [ ] **Mất vé/Thẻ:** Khách ra không có thông tin -> Staff mở Exception Desk -> Tìm lại thông tin xe qua hình ảnh/biển số -> Tính phí mất thẻ (Penalty) và cho xe ra.
- [ ] **Mở Barie khẩn cấp (Force Open):** Sự cố cháy nổ hoặc xe cứu thương -> Staff chọn "Mở khẩn cấp" -> Hệ thống tự động tạo một log sự cố (Incident Ticket).

### 2. Vi phạm & Phạt (Penalty Calculation)
- [ ] **Xe quá hạn Đặt chỗ trước:** Xe đã Pre-book nhưng vào muộn hoặc ra trễ so với giờ đã book. Hệ thống tính thêm phí phụ trội (Penalty Config) khi ra.
- [ ] **Xe gửi sai khu vực:** Cấu hình Routing rule xe máy không được vào khu vực Ô tô -> Cảnh báo trên màn hình Staff khi xe cố tình đi sai cổng.

### 3. Thẻ/Vé không hợp lệ
- [ ] **Vé tháng hết hạn:** Xe có vé tháng nhưng đã quá ngày -> Cổng báo lỗi "Thẻ hết hạn", yêu cầu mua vé lượt hoặc gia hạn.
- [ ] **Trùng lặp xe trong bãi:** Xe đã vào bãi (chưa ra) nhưng lại quẹt thẻ/nhận diện vào bãi lần nữa -> Báo lỗi trạng thái phi logic.

### 4. Kết nối & Xử lý thời gian
- [ ] **Mất mạng (Offline):** (Nếu có hỗ trợ Offline Mode) Rút mạng và thử thao tác lưu trữ local, sau đó có mạng để đồng bộ.
- [ ] **Time-offset testing:** Sử dụng chức năng Time Offset để tua nhanh thời gian (ví dụ +24 tiếng) -> Đảm bảo cước phí được cộng dồn đúng theo block/ngày.

---

## IV. BÁO CÁO VÀ ĐỐI SOÁT (REPORTS & AUDITING)

### 1. Báo cáo Doanh thu & Vận hành (Manager Dashboards)
- [ ] **Revenue Dashboard:** 
  - Đảm bảo biểu đồ doanh thu (vé lượt, vé tháng, tiền phạt) cập nhật đúng con số thực tế vừa test.
  - So sánh doanh thu theo thời gian, theo loại xe.
- [ ] **Operational Dashboard:**
  - Kiểm tra công suất bãi đỗ (Occupancy rate) cập nhật realtime (ví dụ: bãi 100 chỗ, vào 1 xe -> 1%).
  - Biểu đồ tần suất ra vào theo giờ (Zone Hourly Trend).

### 2. Nhật ký Hệ thống (Audit Logs - Admin)
- [ ] **Ghi nhận thay đổi:** Admin vào màn hình `Audit Logs` -> Kiểm tra các hành động thay đổi cấu hình, tạo user, duyệt hoàn tiền, mở barie thủ công đều được ghi log đầy đủ thông tin (Ai làm, làm gì, lúc nào).

### 3. Đối soát cuối ca (Shift Reconciliation)
- [ ] So sánh tổng tiền mặt thu được tại Gate Console của một Staff so với tổng số tiền hệ thống tính toán (đã trừ đi các giao dịch thanh toán qua QR Code).

---

**LƯU Ý KHI DEMO:**
- Luôn bật sẵn các tab của các Role (có thể dùng Ẩn danh - Incognito) để show sự tương tác Realtime giữa Customer đặt chỗ -> Staff ở cổng -> Manager xem báo cáo.
- Chuẩn bị sẵn công cụ Simulator và Postman (nếu cần trigger các API time-offset).