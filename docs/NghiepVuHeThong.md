# Nghiệp Vụ Check-in, Check-out và Quản Lý Phiên Đỗ Xe (Parking Session)

Tài liệu này tổng hợp toàn bộ logic nghiệp vụ (business logic) cốt lõi của quy trình quản lý xe ra vào (Check-in / Check-out) và vòng đời của một phiên đỗ xe (Parking Session) trong hệ thống ParkingManagement.

Hệ thống được thiết kế theo kiến trúc **"Human-in-the-loop"** (Có sự can thiệp và xác nhận của con người). Mỗi quy trình ra/vào đều được chia làm 2 giai đoạn:
1. **Giai đoạn Trigger (Tính toán nháp):** Hệ thống nhận tín hiệu từ IoT (Camera/Đầu đọc thẻ), tính toán các kịch bản, và phát sóng (broadcast) kết quả qua WebSocket lên màn hình giao diện của nhân viên. Dữ liệu chưa được lưu chính thức.
2. **Giai đoạn Process (Xử lý thực tế):** Nhân viên đối chiếu thông tin trên màn hình (biển số, hình ảnh, loại xe), ấn "Xác nhận". Lúc này dữ liệu mới được chốt, lưu vào CSDL và lệnh mở cổng được phát ra.

---

## 1. Nghiệp Vụ Check-In (Xe Vào Bãi)

Quá trình xe vào bãi được xử lý qua 2 bước chính tương ứng với 2 API:

### 1.1. Trigger Check-In (Tín hiệu từ Camera AI)
* **Nhận diện:** IoT Controller gửi tín hiệu bao gồm ID Cổng, Biển số xe, Loại xe (được AI nhận diện), Mã thẻ RFID và Hình ảnh chụp.
* **Phân loại Khách Hàng (Customer Type):** Hệ thống phân tách thành 3 loại:
  * **MONTHLY (Vé tháng):** Xe có biển số khớp với vé tháng đang `ACTIVE` và còn hạn.
  * **PREBOOKED (Đặt trước):** Xe có đơn đặt chỗ đang `ACTIVE` hoặc `PENDING` (chưa dùng và đến đúng giờ).
  * **WALK-IN (Khách vãng lai):** Các trường hợp còn lại.
* **Xử lý Đặt chỗ (Booking):**
  * Nếu xe có Booking: Kiểm tra loại xe AI nhận diện có khớp với loại xe trong Booking không. Nếu đến quá sớm (trước thời gian cho phép), hiển thị cảnh báo.
  * Kiểm tra khu vực (Zone) được đặt trước xem có đang bị đầy vật lý không. Nếu đầy, gọi AI tìm khu vực trống khác thay thế.
* **Thuật toán điều hướng (Routing):**
  * Gọi `ZoneRoutingService` để gợi ý khu vực đậu xe trống phù hợp nhất dựa trên loại xe, loại khách và tầng của cổng vào.
* **Kiểm tra Danh sách đen (Blacklist):**
  * Kiểm tra xem biển số xe này có đang bị đánh dấu Blacklist không để cảnh báo trước.
* **Bắn WebSocket:** Đóng gói toàn bộ thông tin nháp vào `ScanEventDTO` và gửi qua kênh WebSocket lên UI của nhân viên trực cổng.

### 1.2. Process Check-In (Nhân viên Xác Nhận)
* **Kiểm tra tính hợp lệ cơ bản:** 
  * Cổng có nhân viên đang trực (`Active StaffWorkSession`) không.
  * Loại xe (VehicleType) gửi lên phải đang ở trạng thái `ACTIVE` (không bị khóa).
  * Thẻ RFID quét vào phải hợp lệ và đang ở trạng thái rảnh (`AVAILABLE`). Nếu thẻ đang báo mất (`LOST`) hoặc hỏng (`DAMAGED`), hệ thống chặn ngay lập tức.
* **Chống trùng lặp (Duplicate Entry Prevention):** 
  * Kiểm tra xem biển số xe và loại xe này có đang ở trong bãi không (đã có ParkingSession `ACTIVE`). Nếu có, chặn không cho tạo mới để tránh lỗi xe ảo.
* **Xử lý xe trong Blacklist (Danh sách đen):**
  * Nếu xe nằm trong Blacklist, hệ thống sẽ **tự động gỡ cờ Blacklist** cho xe vào.
  * ĐỒNG THỜI, tự động tạo ra một Vé phạt (IncidentTicket) loại `BLACKLIST_VIOLATION` (ví dụ phạt 500k cho xe máy) đính kèm vào phiên đỗ xe này để **truy thu** khi xe ra khỏi bãi.
* **Xử lý Xung đột Đặt trước (Booking Conflicts):**
  * Ràng buộc đúng loại xe: Xe thực tế đi vào (hoặc do nhân viên sửa lại) phải khớp 100% với Loại xe (VehicleType) đã đặt trong Booking. Nếu sai, không cho phép Check-in dưới dạng Booking.
  * Chặn khách đến quá sớm: Nếu khách có Booking ở tương lai nhưng đến quá sớm và muốn đi vào dưới dạng khách Vãng lai (Walk-in), hệ thống sẽ chặn hoàn toàn. Bắt buộc khách phải hủy Booking trên App thì mới được vào bãi.
* **Tự động Báo cáo Sai lệch AI (Auto-Incident for AI Mismatch):**
  * Trong quá trình nhân viên đối chiếu, nếu phát hiện AI nhận diện sai (sai biển số hoặc sai loại xe) và nhân viên tự tay sửa lại trên màn hình, hệ thống sẽ tự động tạo ngầm một sự cố (IncidentTicket) loại `LPR_MISMATCH` hoặc `TYPE_MISMATCH` để thống kê và cải thiện chất lượng Camera sau này.
* **Tạo Phiên Đỗ Xe (Parking Session):**
  * Khởi tạo `ParkingSession` với trạng thái `ACTIVE`.
  * Lưu trữ: Cổng vào, Thời gian vào, Biển số, Loại xe, Thẻ RFID, Hình ảnh toàn cảnh, Hình ảnh biển số, Khu vực được gợi ý, và Đơn đặt chỗ (nếu có).
* **Cập nhật trạng thái liên quan:**
  * Thẻ RFID chuyển sang trạng thái đang sử dụng (`IN_USE`).
  * Đơn đặt chỗ (Booking) chuyển sang `ACTIVE` và bắn thông báo (notification) cho quản lý biết xe đặt trước đã tới.
* **Kết thúc:** Lưu Session vào Database và trả về lệnh mở barrier.

---

## 2. Nghiệp Vụ Check-Out (Xe Ra Bãi)

Tương tự xe vào, quy trình xe ra cũng tuân thủ 2 bước:

### 2.1. Trigger Check-Out (Tín hiệu từ Camera AI)
* **Xác định thông tin cơ bản:** Lấy ID Cổng ra, Biển số, Loại xe và Mã RFID.
* **Xác định loại khách:** (Giống lúc Check-in)
* **Bắn WebSocket:** Gửi dữ liệu ra kênh WebSocket để UI hiển thị thông tin xe. UI lúc này sẽ gọi API lấy thông tin thanh toán nháp (hàm `getCheckOutSessionInfo`).

### 2.2. Tính toán Hóa Đơn (Pricing Logic - Tiền xử lý trên UI)
Hàm `getCheckOutSessionInfo` tính toán chi tiết tiền phí:
* **Mốc bắt đầu tính phí (Fee Start Time):** Thường là thời gian xe vào. Tuy nhiên, nếu xe có vé tháng nhưng **hết hạn giữa chừng** khi đang đỗ, mốc tính phí phụ trội sẽ bắt đầu từ lúc vé tháng hết hạn.
* **Tính phí đỗ xe (Expected Fee):**
  * **Khách vé tháng:** Miễn phí (0đ).
  * **Khách đặt trước:** Đã trả tiền trước, nên Phí cơ bản = 0đ. Nếu ra trễ giờ, tính thêm **Phí quá giờ (Overtime Fee)** dựa trên khoảng thời gian lố.
  * **Khách vãng lai:** Dựa vào `PricingCalculatorService` tính phí theo từng block quy định.
* **Tính phí phạt (Penalty Fee):**
  * Tổng hợp tất cả các vé phạt, sự cố (IncidentTicket) đang ở trạng thái chờ thanh toán (`WAITING_CHECKOUT` hoặc `PENDING - OVERSTAY`) để cộng vào hóa đơn.
* **Giảm giá (Discount):** Áp dụng mã giảm giá nếu có.
* **Tổng tiền (Total Amount):** `Phí cơ bản + Phí quá giờ + Phí phạt - Giảm giá`.
* **Cảnh báo (Warnings):** Sinh ra các thông báo cảnh báo cho nhân viên nếu xe ở quá thời gian quy định (Overstay) hoặc có sự cố chưa giải quyết.
* **Khóa giá (Lock Quote):** Sinh ra một Token JWT (`CheckoutToken`) chứa mức giá đã tính toán, có hiệu lực 5 phút để tránh việc chênh lệch giá khi thanh toán tiền mặt.

### 2.3. Process Check-Out (Nhân viên Xác Nhận & Thanh Toán)
* **Xác thực:** 
  * Xác minh Cổng ra có nhân viên trực.
  * Lấy `ParkingSession` hiện tại bằng mã thẻ RFID hoặc Biển số. Session phải đang ở trạng thái `ACTIVE` (hoặc `LOCKED`).
  * **Bảo mật thanh toán:** Đối chiếu Token báo giá. Nếu khách trả tiền mặt mà thời gian chờ quá lâu làm giá thay đổi, hệ thống sẽ báo lỗi yêu cầu nhân viên lấy lại báo giá mới.
* **Xử lý sự cố (Incident Handling):**
  * Nếu thẻ RFID có báo cáo Mất thẻ (`LOST_CARD`) hoặc Hỏng thẻ (`DAMAGED_CARD`) mà chưa đóng phạt, **từ chối cho ra**.
* **Chốt Số Liệu:**
  * Lưu mốc Thời gian ra, Cổng ra, Hình ảnh ra.
  * Lưu chốt mức phí, phí phạt, phí quá giờ vào Session.
* **Giải quyết Vi phạm:**
  * Chuyển tất cả các vé phạt (Incident) đã đóng tiền thành `RESOLVED`.
  * Nếu có phạt Blacklist, xóa hoàn toàn cờ Blacklist của xe trong CSDL (vì khách đã đền bù).
  * Hủy (`CANCELLED`) tự động các sự cố đang `PENDING` (không liên quan đến Overstay) do xe đã ra khỏi bãi.
* **Giao Dịch (Transaction):**
  * Nếu tổng tiền > 0, tạo một bản ghi `Transaction` ghi nhận khoản thu, liên kết với nhân viên đang trực ca và Session.
* **Hoàn trả Thẻ RFID & Đóng Session:**
  * Nếu thẻ bị mất/hỏng, cập nhật trạng thái thẻ thành `LOST` hoặc `DAMAGED`. Nếu bình thường, trả về `AVAILABLE`.
  * Gỡ biển số gắn với thẻ.
  * Đóng Đơn đặt chỗ (Booking) chuyển thành `COMPLETED`.
  * Đóng `ParkingSession` chuyển thành `COMPLETED`.
* **Kết thúc:** Bắn WebSocket thông báo xuất lệnh mở cổng.

---

## 3. Quản Lý Vòng Đời Parking Session (Tóm Tắt)
* `ParkingSession` là thực thể trung tâm, lưu giữ toàn bộ hành trình của 1 lượt gửi xe.
* **Khởi tạo:** Khi có sự kiện `processCheckIn` thành công, lưu lại toàn bộ dữ liệu xe vào, ảnh, khu vực đậu xe. Trạng thái: `ACTIVE`.
* **Trong quá trình đỗ:**
  * Có thể bị đính kèm các `IncidentTicket` (sự cố) nếu vi phạm (đỗ sai chỗ, làm mất thẻ, đỗ quá giờ).
  * Nếu xe bị khóa bởi bảo vệ do vi phạm, trạng thái có thể bị chuyển sang `LOCKED`.
* **Kết thúc:** Khi có sự kiện `processCheckOut` thành công, chốt số liệu tài chính, lưu ảnh lúc ra, liên kết với `Transaction` thanh toán. Trạng thái: `COMPLETED`.
* **Dữ liệu vĩnh viễn:** Parking Session không bị xóa cứng mà được giữ lại để phục vụ đối soát tài chính, thống kê doanh thu và báo cáo lưu lượng bãi xe.

---

## 4. Checklist Tổng Hợp Nghiệp Vụ
Dưới đây là bảng tổng hợp thao tác dưới dạng Checklist dùng cho quá trình kiểm thử (UAT) hoặc làm kịch bản demo hệ thống.

### 4.1. Luồng Nghiệp vụ Check-In (Xe vào)
- [ ] **Quét nhận diện (Scan & Detect):** Hệ thống Camera chụp ảnh, bóc tách biển số LPR thành công khi xe tiến vào vạch.
- [ ] **Xác thực (Validation):** Server truy vấn Database, xác định chính xác xe thuộc nhóm: Vãng lai, Vé tháng, Đặt trước hay Blacklist.
- [ ] **Điều phối (Zone Allocation):** Thuật toán tìm kiếm bãi đỗ (Zone) phù hợp và đang còn trống để đề xuất lên màn hình.
- [ ] **Đối chiếu (Verify):** Nhân viên kiểm tra bằng mắt thường, xác nhận thông tin (Ảnh thực tế vs Biển số AI đọc) là khớp nhau.
- [ ] **Gán thẻ (Assign Card):** Nhân viên quẹt thẻ RFID mới (nếu là khách vãng lai) để điền mã thẻ vào phiên đỗ xe hiện tại.
- [ ] **Xác nhận & Giao thẻ (Confirm & Handover):** Nhân viên bấm nút `[Cho xe vào]` trên phần mềm và đưa thẻ cho khách.
- [ ] **Mở cổng & Cập nhật (Open Gate & Update):** Barie tự động mở, hệ thống trừ đi 1 vị trí trống tại Zone tương ứng và lưu Database thành công.

### 4.2. Luồng Nghiệp vụ Check-Out (Xe ra)
- [ ] **Quét tín hiệu (Signal Detection):** Khách quẹt thẻ RFID hoặc Camera AI quét biển số khi xe đến cổng ra.
- [ ] **Tính toán phí tự động (Fee Calculation):** Cỗ máy tính tiền (Pricing Engine) tự động lấy giờ vào - giờ ra để ra được tổng hóa đơn nháp.
- [ ] **Đối chiếu an ninh (Security Validation):** Màn hình hiển thị ảnh lúc xe vào và lúc xe ra. Nhân viên đối chiếu chéo để đảm bảo không bị tráo xe, mất cắp.
- [ ] **Xử lý thanh toán (Payment Processing):** Khách hàng quét mã QR (hệ thống nhận Webhook tự động) HOẶC nhân viên thu tiền mặt và bấm `[Hoàn tất thanh toán]`.
- [ ] **Đóng phiên (Session Closure):** Hệ thống lưu hóa đơn doanh thu, đóng phiên đỗ xe (Chuyển status thành COMPLETED).
- [ ] **Mở cổng tự động (Auto-Release):** Barie tự động mở cho khách ra về, hệ thống cộng lại 1 vị trí trống cho Zone tương ứng.

### 4.3. Luồng Quản lý và Cấu hình Chính sách Giá (Pricing & Configuration)
- [ ] **Gán Chính sách theo Loại xe:** Mỗi loại xe (Ô tô, Xe máy...) được cấu hình riêng biệt với 1 `PricingPolicy` đang ở trạng thái ACTIVE.
- [ ] **Cấu hình Lớp Phủ Toàn cục (Global Settings):** Áp dụng thành công chính sách số phút miễn phí đầu tiên (Ví dụ: dưới 15p = 0đ).
- [ ] **Cấu hình Vé Tháng (Monthly Rate):** Thiết lập giá niêm yết khi mua/gia hạn vé tháng cho từng loại phương tiện.
- [ ] **Cấu hình Ca & Khối (Shifts & Blocks):** Thiết lập thành công việc chia giờ (Ca ngày/Ca đêm) và chia giá tiền theo từng Block (Ví dụ: 2h đầu 20k, các giờ sau 5k).
- [ ] **Tính tiền Khách Vãng lai (Walk-in Fee):** Máy cắt (Shift Slicer) và Máy trượt (Block Slider) hoạt động chuẩn xác, tính đúng tiền luỹ kế cho khách vãng lai.
- [ ] **Miễn phí Vé Tháng (Monthly Waiver):** Hệ thống nhận diện đúng xe có vé tháng còn hạn và áp dụng phí = 0đ.
- [ ] **Phạt Quá hạn Vé tháng (Expired Overtime):** Nếu vé tháng hết hạn giữa chừng khi xe đang nằm trong bãi, hệ thống tự động tính tiền vãng lai cho khoảng thời gian lố (từ lúc hết hạn đến lúc lấy xe ra).
- [ ] **Khóa cấu hình an toàn (Safety Lock):** Chặn không cho lưu (Save) thay đổi bảng giá nếu hệ thống đang có giao dịch chưa xử lý xong.
