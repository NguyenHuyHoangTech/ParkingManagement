# Danh sách phân công nhiệm vụ thành viên dự án ParkingManagement

Dưới đây là chi tiết phân công công việc của từng thành viên trong hệ thống bãi đỗ xe thông minh. Các nhiệm vụ đã được bao quát từ xây dựng API cốt lõi ở Backend (Spring Boot, SQL Server), đến giao diện người dùng Frontend (ReactJS, TypeScript) và tích hợp các công nghệ thực tế (Websocket, IoT, Cổng thanh toán).

---

### **🛡️ 1. Thành viên 1: Xác thực cốt lõi, Quản trị hệ thống & Xử lý sự cố**
*(Vai trò: Chuyên trách Bảo mật, Quản trị Hệ thống & Quản lý Sự cố)*

| Tên công việc | Mức độ | Trạng thái |
| :---- | :---- | :---- |
| Xây dựng API: Xác thực & Phân quyền (Tích hợp Spring Security, JWT, OTP, Google OAuth2) | 100% | Hoàn thành |
| Xây dựng API: Cấu hình hệ thống động & Ghi log kiểm toán (Audit Logging) | 100% | Hoàn thành |
| Xây dựng API: Quản lý vé sự cố, xác thực e-KYC & Cronjob phát hiện xe đỗ quá giờ | 100% | Hoàn thành |
| Xây dựng UI/FE: Bố cục chính (React Router, quản lý State với Zustand) & Các trang Đăng nhập | 100% | Hoàn thành |
| Xây dựng UI/FE: Trang Quản trị viên (Quản lý người dùng, Lịch sử hệ thống, Cài đặt cấu hình) | 100% | Hoàn thành |
| Xây dựng UI/FE: Giao diện bàn xử lý sự cố & Quản lý vòng đời vé sự cố (Incident Desk) | 100% | Hoàn thành |

### **🗺️ 2. Thành viên 2: Không gian bãi đỗ, Điều hướng & Quản lý thẻ RFID**
*(Vai trò: Chuyên trách Hạ tầng vật lý, Thuật toán không gian & Quản lý thẻ)*

| Tên công việc | Mức độ | Trạng thái |
| :---- | :---- | :---- |
| Xây dựng API: Quản lý hạ tầng không gian phân cấp (Tòa nhà, Tầng, Khu vực, Chỗ đỗ, Cổng trạm) | 100% | Hoàn thành |
| Xây dựng API: Thuật toán điều hướng xe thông minh & Quản lý danh mục từng loại xe | 100% | Hoàn thành |
| Xây dựng API: Quản lý kho thẻ RFID & Theo dõi vòng đời thẻ vật lý | 100% | Hoàn thành |
| Cấu hình Backend: Tích hợp WebSocket (StompJS/Redis) truyền tọa độ bản đồ 2D thời gian thực | 100% | Hoàn thành |
| Xây dựng UI/FE: Bản đồ không gian 2D tương tác (Kéo thả cấu hình với Konva/React-Konva) | 100% | Hoàn thành |
| Xây dựng UI/FE: Quản lý kho thẻ, phân phối & Tự động tạo mã UID cho thẻ mới | 100% | Hoàn thành |

### **💰 3. Thành viên 3: Tài chính, Thanh toán & Phân tích dữ liệu**
*(Vai trò: Chuyên trách Thuật toán tính phí, Sổ cái & Tích hợp cổng thanh toán)*

| Tên công việc | Mức độ | Trạng thái |
| :---- | :---- | :---- |
| Xây dựng API: Động cơ tính phí đa tầng, Tính toán phạt vi phạm & Giao dịch sổ cái (Ledger) | 100% | Hoàn thành |
| Xây dựng API: Cung cấp số liệu thống kê (Doanh thu, Lưu lượng xe, Tỷ lệ lấp đầy bãi đỗ) | 100% | Hoàn thành |
| Cấu hình Backend: Tích hợp Webhooks cổng thanh toán (PayOS/VNPay) & Luồng hoàn tiền | 100% | Hoàn thành |
| Xây dựng UI/FE: Cấu hình hệ thống tài chính (Thiết lập chính sách giá, Quy tắc phạt) | 100% | Hoàn thành |
| Xây dựng UI/FE: Bảng điều khiển phân tích số liệu (Vẽ biểu đồ bằng Recharts) | 100% | Hoàn thành |
| Xây dựng UI/FE: Giao diện quản lý và xét duyệt các yêu cầu hoàn tiền (Refund Management) | 100% | Hoàn thành |

### **🚀 4. Thành viên 4: Vận hành trạm kiểm soát (Gate Operations) & IoT**
*(Vai trò: Chuyên trách DevOps, Luồng Check-in/Out cốt lõi & Giả lập phần cứng)*

| Tên công việc | Mức độ | Trạng thái |
| :---- | :---- | :---- |
| Cấu hình hệ thống: Thiết lập dự án, môi trường & CI/CD Pipelines (SQL Server, Vite) | 100% | Hoàn thành |
| Xây dựng API: Luồng Check-in/Check-out tự động & Vòng đời phiên đỗ xe (Parking Session) | 100% | Hoàn thành |
| Xây dựng API: Quản lý phân ca làm việc, chấm công và bàn giao ca của nhân viên | 100% | Hoàn thành |
| Xây dựng API: Cổng giao tiếp IoT (Nhận diện Webhooks camera, Tín hiệu cảm biến phần cứng) | 100% | Hoàn thành |
| Xây dựng UI/FE: Bảng điều khiển vận hành cốt lõi tại cổng trạm & Giao diện bàn giao ca | 100% | Hoàn thành |
| Xây dựng UI/FE: Ứng dụng độc lập giả lập phần cứng IoT (Mô phỏng Camera, Barie, Quẹt thẻ) | 100% | Hoàn thành |

### **📱 5. Thành viên 5: Trải nghiệm khách hàng (B2C) & Đặt chỗ**
*(Vai trò: Chuyên trách Cổng thông tin khách hàng Web & Quy trình dịch vụ)*

| Tên công việc | Mức độ | Trạng thái |
| :---- | :---- | :---- |
| Xây dựng API: Quy trình đặt chỗ trước (Pre-Booking) & Đăng ký gói vé tháng (Monthly Pass) | 100% | Hoàn thành |
| Xây dựng API: Tra cứu vị trí xe đang đỗ & Ước tính chi phí thanh toán theo thời gian thực | 100% | Hoàn thành |
| Xây dựng UI/FE: Ứng dụng Web B2C (Trang chủ, Lịch sử bãi đỗ xe của tôi, Cổng hỗ trợ KH) | 100% | Hoàn thành |
| Xây dựng UI/FE: Ứng dụng Web B2C (Luồng thực hiện đặt chỗ trước, Cổng thanh toán vé tháng) | 100% | Hoàn thành |
| Xây dựng UI/FE: Bảng điều khiển quản lý danh sách đặt chỗ trước (Pre-Booking) cho Admin | 100% | Hoàn thành |
| Xây dựng UI/FE: Bảng điều khiển quản lý và phát hành vé tháng (Monthly Pass) cho Admin | 100% | Hoàn thành |
