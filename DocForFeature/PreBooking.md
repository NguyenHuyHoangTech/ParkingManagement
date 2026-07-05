# Tài Liệu Chức Năng Đặt Chỗ Trước (Pre-Booking / Reservation)

Tính năng Đặt Chỗ Trước cho phép khách hàng (Customer) đặt trước một vị trí đỗ xe tại một khu vực (Zone) cụ thể. Hệ thống sẽ giữ chỗ, tính toán trước chi phí và tự động quản lý vòng đời của đơn đặt chỗ dựa trên thời gian thực tế hoặc thời gian giả lập (Time Fast-Forward).

---

## 1. Luồng Tạo Đặt Chỗ (Create Reservation)

Khách hàng tạo yêu cầu đặt chỗ thông qua ứng dụng/web.

### 1.1 Điều kiện tiên quyết:
- Bắt buộc cung cấp thông tin **Loại phương tiện (Vehicle Type)** và **Biển số xe (Plate Number)**.
- Phương tiện (Vehicle) không nằm trong **Sổ đen (Blacklist)**.
- Phương tiện hiện tại **không có đơn đặt chỗ nào đang ở trạng thái `PENDING`**.
- Phương tiện **chưa ở trong bãi đỗ** (Hệ thống truy vấn `ParkingSessionRepository` để chặn không cho phép xe đang có phiên `ACTIVE` tạo thêm Booking).
- Loại phương tiện (Vehicle Type) truyền lên **phải khớp** với loại phương tiện đã được gắn với Biển số xe này trong CSDL (nếu biển số đã từng đăng ký trước đó).
- Sức chứa của Khu vực (Zone) được chọn **chưa vượt quá 100%** (Sức chứa được tính toán thông qua `ZoneRoutingService`).

### 1.2 Xử lý dữ liệu:
- Yêu cầu đặt chỗ (`CreateReservationRequest`) trước tiên phải vượt qua khâu kiểm duyệt của `PaymentValidatorService` và thực hiện thanh toán qua Payment Gateway (PayOS, Momo).
- Hệ thống cung cấp API `/preview` để tính toán chi phí dự kiến (`previewPrice`) dựa trên: `VehicleType`, `ExpectedEntryTime` và `ExpectedDuration` trước khi khách hàng thanh toán.
- Chỉ khi nhận được Webhook thanh toán thành công, hệ thống mới tiến hành chèn dữ liệu vào DB (Tạo mới `Vehicle` nếu biển số chưa tồn tại, và khởi tạo `Reservation` với trạng thái `PENDING`) để tránh rác dữ liệu.
- **Tự động lên lịch các tác vụ (Schedule Tasks)** liên quan đến vòng đời của đơn đặt chỗ thông qua `TaskScheduler`.

---

## 2. Luồng Hủy Đặt Chỗ & Hoàn Tiền (Cancel & Refund)

Chỉ có thể hủy khi đơn đặt chỗ đang ở trạng thái `PENDING`. 
Chính sách hoàn tiền (Refund Policy) được áp dụng tự động dựa trên thời gian thực hiện hủy so với thời gian dự kiến vào bãi (`ExpectedEntryTime`) và cấu hình hệ thống `RESERVATION_EARLY_MINS` (mặc định 30 phút).

### 2.1 Chính sách phí phạt:
- **Hủy trước khoảng Early (ví dụ: > 30 phút trước khi vào):** Hoàn tiền 100%, không bị phạt.
- **Hủy trong khoảng Early (ví dụ: <= 30 phút trước khi vào):** Hoàn tiền 50%, phạt 50% số tiền đã thanh toán.
- **Sau khi đã quá hạn (ExpectedEntryTime):** Không thể hủy.

### 2.2 Xử lý tài chính (Finance):
- Chuyển trạng thái đặt chỗ sang `CANCELLED`.
- Nếu có số tiền hoàn lại (`RefundAmount > 0`), hệ thống tự động sinh một `RefundRequest` với trạng thái `PENDING` để bộ phận kế toán xử lý trả tiền về ngân hàng của khách.
- Nếu có phí phạt (`PenaltyFee > 0`), hệ thống tự động ghi nhận ngay một `Transaction` (Doanh thu) với trạng thái `SUCCESS` dưới dạng `GATEWAY` mang mã `PENALTY-RES-{id}`.

---

## 3. Luồng Quản Lý Vòng Đời & Tác Vụ Lên Lịch (Scheduled Tasks)

Hệ thống sử dụng `TaskScheduler` để đăng ký các đồng hồ đếm ngược tự động tương ứng với từng mốc thời gian của Đơn đặt chỗ.

### 3.1 Các mốc thời gian được lên lịch:
1. **Timer 1 (Notification):** 
   - Kích hoạt tại: `ExpectedEntryTime - RESERVATION_EARLY_MINS`.
   - Hành động (`notifyStaffTask`): Gửi tín hiệu WebSocket thông báo (Push Notification) đến màn hình giám sát của nhân viên trực tầng (Floor) rằng chiếc xe này sắp đến.
   - Đánh dấu trạng thái cờ `notifiedEarlyArrival = true`.
2. **Timer 2 (Late Warning):**
   - Kích hoạt tại: `ExpectedEntryTime`.
   - Hành động (`lateWarningTask`): Ghi log cảnh báo rằng khách hàng đã đến trễ so với thời gian đặt chỗ.
3. **Timer 3 (Expiration / End of Booking):**
   - Kích hoạt tại: `ExpectedEntryTime + ExpectedDuration`.
   - Hành động (`endOfBookingTask`): Quyết định trạng thái cuối cùng của đơn đặt chỗ thông qua đối chiếu với Lượt đỗ xe (`ParkingSession`) thực tế:
     - **Xe đã vào bãi nhưng chưa ra (`ACTIVE`):** Chuyển Reservation sang `COMPLETED`. Khách hàng chuyển sang tính phí đỗ quá hạn (Guest Pricing / Overstay).
     - **Xe đã vào và đã ra (`COMPLETED`):** Chuyển Reservation sang `COMPLETED`.
     - **Xe không đến (No-Show / `PENDING`):** Chuyển trạng thái sang `COMPLETED_UNUSED`. Phạt 100% tiền đặt chỗ bằng cách sinh `Transaction` doanh thu ngay lập tức (`PENALTY-RES-{id}`).

---

## 4. Tích Hợp Chạy Tua Thời Gian (Time Fast-Forward Simulator)

Đây là tính năng giả lập vô cùng phức tạp, cho phép tua nhanh thời gian (Time Travel) để test hệ thống mà không cần chờ đợi. `ReservationService` xử lý bắt sự kiện tua thời gian một cách triệt để.

### Xử lý bắt sự kiện `TimeFastForwardedEvent`:
- Khi thời gian hệ thống bị tua nhanh đến một thời điểm `NewSimulatedTime`.
- Hệ thống quét toàn bộ các Timer (TaskRegistry) đang đếm ngược:
  - Nếu `TargetTime <= NewSimulatedTime` (Đã bị tua qua mốc thời gian): **Hủy tiến trình chạy nền và thực thi đồng bộ ngay lập tức (Run synchronously)**. Đảm bảo mọi trạng thái (Phạt No-Show, Hủy, Quá hạn) vẫn được sinh ra đúng y như thời gian trôi tự nhiên.
  - Nếu `TargetTime > NewSimulatedTime` (Thời gian vẫn ở tương lai): Tính toán lại độ trễ (delay) so với thời gian hiện tại mới và **đặt lại lịch (Reschedule)**.

---

## 5. Cập Nhật Thông Tin & Xử Lý Xung Đột

- **Cập nhật Biển số (`updateReservationPlate`):** Khách hàng có thể đổi biển số phương tiện miễn là đơn đang ở trạng thái `PENDING` và chưa qua thời điểm `ExpectedEntryTime`. Tự động tạo Vehicle mới nếu biển số chưa có trên hệ thống.
- **Giải quyết xung đột chỗ đỗ (Resolve Conflict):** 
  - Tại thời điểm bắt đầu đếm ngược thông báo sớm (Early Arrival Window), hệ thống sẽ đếm lại số lượng chỗ trống thực tế của Zone đặt trước. Nếu Zone đã bị lấp đầy hoàn toàn (Số xe `OCCUPIED` >= Sức chứa hiệu dụng), hệ thống sẽ phát tín hiệu WebSocket `ZONE_CONFLICT`.
  - Trên màn hình trực cổng của Staff, danh sách "Xe đang chờ gán chỗ (Pre-booked Queue)" sẽ hiện ra các đơn đang bị lỗi đầy bãi này. Nhân viên cần thông báo cho các xe khác di chuyển hoặc ra trực tiếp đặt biển giữ chỗ (cone).
  - Khi đã có khoảng trống, nhân viên bấm nút **"Thử gán lại (Retry)"** trên UI. Backend đếm lại số slot, nếu thành công thì xóa cảnh báo.
  - Tự động dọn dẹp: Nếu xe đã lỡ check-in hoặc hết giờ chờ, Backend tự động xóa cảnh báo này đi.

---

## 6. Luồng Kiểm Soát Cổng (Gate Operations) Dành Cho Xe Đặt Trước

Sự tương tác giữa đơn đặt chỗ và trạm kiểm soát (Gate) khi xe thực sự đi vào và đi ra khỏi bãi được xử lý tập trung tại `GateOperationService`:

### 6.1 Lúc xe vào bãi (Check-In):
- Tại cổng, hệ thống nhận diện **Biển số xe (Plate Number)** bằng camera AI để tìm kiếm xem xe này có đơn đặt chỗ đang `PENDING` nào không.
- Bắt buộc kiểm tra **Loại phương tiện (Vehicle Type)**:
  - Nếu loại xe do AI phát hiện (hoặc nhân viên chọn) KHÔNG KHỚP với loại xe trong Booking, hệ thống sẽ chặn Check-In và báo lỗi: *"Loại phương tiện AI nhận diện không khớp với Đơn đặt chỗ (Booking). Vui lòng kiểm tra lại."*
- Bắt buộc phải **quẹt/cấp phát một thẻ RFID vật lý** để gắn với phiên đỗ xe, tương tự như khách vãng lai. Thẻ RFID này sẽ được liên kết với đơn đặt trước thông qua biển số.
- **Ràng buộc thời gian (Early Window Validation):** 
  - Nếu khách đến quá sớm (trước khoảng thời gian cho phép `RESERVATION_EARLY_MINS`), đơn đặt chỗ **chưa được tính là hợp lệ để vào bãi**. Màn hình LED Gate và Staff sẽ nhận được cảnh báo (`earlyBookingNotice`): *"Notice: This vehicle has a booking at HH:mm but it is not time yet."*
  - Nếu khách đến trong khung giờ hợp lệ, hệ thống tự động gán `SuggestedZone` cho xe đúng bằng khu vực (Zone) khách đã đặt.
  - **Điều phối dự phòng (Fallback Routing):** Nếu xe đặt trước đến cổng mà Zone đặt trước đã bị chiếm 100% (nhân viên quên giữ chỗ), hệ thống tự động từ bỏ Zone đặt trước và gọi thuật toán điều phối của hệ thống để tìm một bãi khác **giống y hệt xe khách vãng lai (Walk-In)**. Hệ thống chỉ điều phối vào các Zone WALK_IN theo đúng độ ưu tiên và luật lấp đầy mà Manager đã cấu hình. Nếu tất cả các Zone WALK_IN đều full, hệ thống sẽ trả về bãi Free.
  - **Tắt điều phối (Đổi sang Free):** Nếu màn hình Staff đã bấm nút "Đổi sang Free" (bãi Free), hệ thống sẽ tôn trọng tùy chọn này và không áp dụng thuật toán điều phối nữa, lưu thẳng xuống DB là `Free`.
- Tạo `ParkingSession` mới, liên kết với Reservation.
- Cập nhật Reservation sang trạng thái `ACTIVE` (Xe đã vào bãi).
- Gửi thông báo WebSocket (`RESERVATION_ARRIVED`) cho nhân viên quản lý biết xe đặt trước đã vào bãi thành công.

### 6.2 Lúc xe ra bãi (Check-Out):
- Tại cổng ra, hệ thống đối chiếu `ParkingSession` với `Reservation` tương ứng.
- **Tính toán phí phát sinh (Overtime Fee):**
  - Khách hàng đã thanh toán trước khoản phí đặt chỗ (`ReservationFee`). 
  - Tuy nhiên, hệ thống sẽ kiểm tra xem thời gian xe thực tế ra khỏi bãi (`TimeOut`) có vượt quá tổng thời gian đã mua (`ExpectedEntryTime + ExpectedDuration`) hay không.
  - Nếu vượt quá, `PricingCalculatorService` sẽ tự động tính thêm tiền đỗ lố giờ (Overtime) với giá dành cho xe vãng lai (Guest), và cộng khoản này vào `TotalFee` yêu cầu khách thanh toán bổ sung tại cổng.
  - Nếu ra sớm hơn hoặc đúng giờ, khách hàng không phải đóng thêm tiền (`ExpectedFee = 0`).
- Sau khi xe ra khỏi bãi, hệ thống cập nhật trạng thái Reservation sang `COMPLETED` và đóng `ParkingSession`.
