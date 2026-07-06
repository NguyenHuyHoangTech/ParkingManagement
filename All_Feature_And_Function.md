# Toàn Tập Các Tính Năng Và Chức Năng Của Hệ Thống Quản Lý Bãi Xe (PBMS)

Tài liệu này là bản rà soát đầy đủ và chi tiết nhất, bao gồm mọi chức năng từ cốt lõi, quản trị, đến các thiết lập cấu hình nhỏ nhất trong hệ thống phần mềm quản lý bãi xe.

---

## 1. Hệ thống & Quản trị (System & Configuration)
- **Quản lý Thông tin Tòa nhà (Building Profile):** Xem và cập nhật các thông tin cơ bản như tên bãi xe, địa chỉ, tổng sức chứa thiết kế.
- **Cấu hình Biến hệ thống (System Configs):**
  - Thêm, sửa, xóa các tham số vận hành (Ví dụ: `OVERSTAY_HOURS_LIMIT` để tính số giờ coi là đỗ quá hạn, `RESERVATION_EARLY_MINS` ngưỡng phút bắt đầu giữ chỗ).
  - **Tích hợp & Kiểm thử bên thứ 3:** Các nút chức năng đặc biệt để Test kết nối Email (SMTP), Test cổng thanh toán PayPal, Test cổng thanh toán PayOS (QR Code VNĐ), và Test gọi API AI Gemini.
- **Nhật ký Hệ thống (Audit Logs):** Ghi vết toàn bộ thao tác của người dùng trên hệ thống (Ai đã thực hiện hành động gì, vào lúc nào, địa chỉ IP/phiên làm việc nào).
- **Phân quyền & Tài khoản (Identity & Auth):**
  - Đăng nhập, Đăng xuất, Refresh Token.
  - Quản lý danh sách người dùng, cập nhật thông tin, vô hiệu hóa tài khoản, cấp vai trò (Manager, Staff, Admin...).
- **Quản lý Ca làm việc (Work Session):** Chức năng Clock-in (vào ca) và Clock-out (ra ca) dành cho nhân viên điều hành trực tại bãi.

## 2. Quản lý Hạ tầng (Infrastructure)
- **Quản lý Tầng (Floors):** Thêm mới, sửa tên, xóa tầng.
- **Quản lý Khu vực (Zones):** Chia bãi thành các khu đỗ chuyên biệt (VD: Khu VIP, Khu xe tháng, Khu xe máy). Thiết lập sức chứa tối đa và trạng thái hoạt động.
- **Quản lý Vị trí đỗ chi tiết (Slots):** Khai báo danh sách các ô đỗ xe, theo dõi trạng thái Real-time (Trống, Đang có xe, Đang bảo trì).
- **Quản lý Cổng (Gates):** Khai báo các thiết bị cổng vào (Gate In) và cổng ra (Gate Out).
- **Sơ đồ Trực quan (Map Configuration):** Upload tọa độ và cấu hình bản đồ bãi xe, giúp hiển thị trực quan lên màn hình.
- **Cấu hình Quy tắc Điều hướng (Routing Rules):**
  - **Bật/tắt chế độ điều hướng (Smart Routing)** cho từng Zone theo ý muốn.
  - Thiết lập thứ tự ưu tiên gợi ý đỗ xe.
  - Đặt ngưỡng cảnh báo sức chứa cho mỗi khu vực.

## 3. Vận hành Thực tế (Operation & Gates Console)
- **Trạm Kiểm soát Đầu Vào (Gate In Console):**
  - Nhận diện biển số qua AI (ALPR).
  - Đọc thẻ RFID.
  - Kiểm tra điều kiện đầu vào (Thẻ có hiệu lực không, xe có nằm trong Blacklist không).
  - Kích hoạt thuật toán Smart Routing để màn hình LED gợi ý khu vực đỗ tốt nhất.
  - Tạo Lượt gửi xe (Parking Session) và Mở Barie.
- **Trạm Kiểm soát Đầu Ra (Gate Out Console):**
  - Quét thẻ, nhận diện lại biển số và đối chiếu ảnh/biển số lúc vào.
  - Tự động gọi API tính toán phí gửi xe theo thời gian thực (Preview Price & Calculate).
  - Xử lý đóng lượt, thu tiền và Mở Barie.
- **Quản lý Lượt gửi xe (Parking Sessions):**
  - Tra cứu các xe Đang trong bãi (Active Sessions).
  - Xem Lịch sử gửi xe (History).
  - Tìm kiếm nâng cao đa chiều (theo thời gian, biển số, loại xe, mã vé).
- **Quản lý Thẻ vật lý (RFID Cards):** Cấp phát thẻ mới, thu hồi thẻ, khóa thẻ tạm thời, gán thẻ vào vé tháng.
- **Giám sát Thiết bị IoT (IoT Hardware):** Dashboard kiểm tra trạng thái hoạt động của camera, đầu đọc thẻ, bo mạch phần cứng.

## 4. Quản lý Phương tiện & Vé (Vehicles & Tickets)
- **Quản lý Loại phương tiện (Vehicle Types):**
  - Thêm, sửa, xóa loại phương tiện (Ô tô, Xe máy...).
  - Upload Icon tùy chỉnh cho từng loại xe.
  - *Tự động hóa:* Thêm loại phương tiện mới sẽ tự động sinh Bảng giá (Pricing Policy) mặc định tránh lỗi logic.
- **Quản lý Phương tiện & Sổ đen (Vehicles & Blacklist):**
  - Lưu hồ sơ các phương tiện đã từng vào bãi.
  - **Đưa vào Sổ đen (Blacklist):** Chặn không cho một biển số hoặc một xe cụ thể vào bãi.
  - **Gỡ Sổ đen (Unblacklist).**
- **Quản lý Vé tháng (Monthly Tickets):** Đăng ký vé mới, gia hạn vé, đổi biển số xe, khóa vé. Có job chạy ngầm 1:00 AM mỗi ngày để vô hiệu hóa các vé hết hạn.

## 5. Dịch vụ Khách hàng & AI (Customer Services)
- **Giao diện Khách hàng (Public/Customer):** Khách xem trực tuyến bảng giá và số chỗ trống.
- **Hệ thống Đặt chỗ trước (Reservations):**
  - Tạo đơn đặt chỗ (kèm thời gian dự kiến vào/ra).
  - Xem trước cước phí đặt chỗ (Preview Price).
  - Hủy đơn đặt chỗ, thay đổi biển số xe.
- **Giải quyết Xung đột (Resolve Conflict):** Bảng điều khiển riêng cho Manager xử lý khi AI phát hiện có tình trạng đặt chỗ vượt quá số slot trống của khu vực.
- **Trợ lý Ảo (AI Advisor):** Khách hàng/Nhân viên chat với Bot AI để được tư vấn giá vé, luật lệ, hoặc tìm kiếm thông tin xe bằng ngôn ngữ tự nhiên.

## 6. Xử lý Sự cố & Dữ liệu (Incidents & Analytics)
- **Quản lý Sự cố (Incident Tickets):**
  - Tạo ticket sự cố (VD: Khách làm mất thẻ, sai biển số xe, camera nhận diện mờ).
  - Đánh dấu hoàn tất (Resolve) và thêm ghi chú/bình luận (Comment) trong quá trình giải quyết sự cố.
- **Phát hiện Xe Quá hạn (Overstay Detection):** Job chạy ngầm lúc 2:00 AM quét và tự động sinh ticket báo cáo các xe đã "nằm vùng" quá lâu.
- **Báo cáo Doanh thu (Revenue):** Xem thống kê tổng doanh thu theo ngày, nguồn tiền (tiền mặt/PayOS) và loại vé. Hỗ trợ phân trang và xuất Excel (CSV).
- **Báo cáo Lượt xe & Giờ cao điểm (Traffic & Peak Hours):** Xem thống kê tổng lượt xe ra/vào và biểu đồ phân bố theo 24 khung giờ để xác định giờ cao điểm.

## 7. Tài chính & Doanh thu (Finance & Billing)
- **Quản lý Bảng giá (Pricing Policies):**
  - Thiết lập giá phức tạp: Phí cơ bản (Base fee), giá trần (Max cap), giá vé tháng.
  - **Cấu hình Ca (Shifts):** Tính tiền theo khoảng thời gian (VD: Ca ngày, Ca đêm).
  - **Cấu hình Block (Blocks):** Tính tiền theo từng block giờ (VD: 2 giờ đầu 10k, mỗi giờ sau 5k).
- **Thanh toán Trực tuyến (Payments):** Tạo mã thanh toán (Payment Link) và lắng nghe Webhook trả về từ PayOS/PayPal.
- **Quản lý Hoàn tiền (Refunds):** Xử lý hoàn tiền cho khách khi hủy đặt chỗ có trả trước.

## 8. Trình giả lập & Kiểm thử (IoT Simulator)
- **Giả lập sự kiện cổng:** Tạo tín hiệu quẹt thẻ, xe qua vạch (loop detector) ảo.
- **Giả lập lỗi:** Tạo thẻ sai, biển số đen để test luồng chặn xe.
- **Tính năng Tua Nhanh Thời Gian (Time Fast-Forward):** Cực kỳ phức tạp. Hệ thống tự động tính toán bù lại toàn bộ các sự kiện bị tua qua: cập nhật hết hạn vé, sinh báo cáo theo từng giờ bị bỏ lỡ, kiểm tra sự cố tương lai.
