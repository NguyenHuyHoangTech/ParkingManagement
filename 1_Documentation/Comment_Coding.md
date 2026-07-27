/**
 * =========================================================================================
 * CHI TIẾT VÒNG ĐỜI VÀ KIẾN TRÚC XỬ LÝ REQUEST CỦA HỆ THỐNG (KÈM MINH CHỨNG CODE)
 * (Trình bày chi tiết luồng dữ liệu ánh xạ trực tiếp vào các dòng code trong file này)
 * =========================================================================================
 * 
 * BƯỚC 1: KHỞI TẠO BỘ ĐIỀU PHỐI VÀ TIÊM PHỤ THUỘC (DEPENDENCY INJECTION)
 * - Minh chứng 1: Tại dòng 107 có khai báo `@RestController`. Đây là ký hiệu (Annotation) 
 *   báo cho Spring Boot biết class này là một Web API. Từ đó Spring sẽ tự động đúc (instantiate) 
 *   nó thành một Singleton Bean lưu thường trực trên RAM.
 * - Minh chứng 2: Tại dòng 106 có `@CrossOrigin("*")`. Ký hiệu này là bằng chứng cho thấy 
 *   file đã tháo gỡ hàng rào bảo mật CORS, cho phép mọi thiết bị (dấu `*`) gửi Request tới.
 * - Minh chứng 3: Từ dòng 127 đến 158 là khối Constructor `IotHardwareController(...)`. 
 *   Việc khai báo các tham số bên trong ngoặc tròn như `GateOperationService gateOperationService` 
 *   chính là kỹ thuật Constructor Injection. Spring Boot sẽ tự động tìm các Service này trong 
 *   bộ nhớ và nhét (tiêm) vào các biến cục bộ (ví dụ lệnh `this.gateOperationService = gateOperationService`),
 *   giúp Controller có đủ "vũ khí" (kết nối với Database và Logic) để hoạt động.
 * 
 * BƯỚC 2: TIẾP NHẬN REQUEST TỪ THIẾT BỊ IOT (DISPATCHER SERVLET & HANDLER MAPPING)
 * - Minh chứng 1: Dòng 108 khai báo `@RequestMapping("/api/v1/operation/iot/hardware")` ở đầu 
 *   class, đây là Gốc của URL.
 * - Minh chứng 2: Dòng 273 khai báo `@PostMapping("/gates/checkin")`. Việc ghép nối gốc URL 
 *   ở trên với đuôi `/gates/checkin` và quy định Method là POST chính là bằng chứng cho việc 
 *   `HandlerMapping` (người điều phối của Spring) sẽ định tuyến chính xác mọi Request từ thiết 
 *   bị IoT vào đúng hàm `simulateCheckIn()` này chứ không đi nhầm sang hàm khác.
 * 
 * BƯỚC 3: RÀNG BUỘC VÀ CHUYỂN ĐỔI DỮ LIỆU (DESERIALIZATION)
 * - Minh chứng: Tại dòng 275, tham số của hàm được khai báo là: `(@RequestBody CheckInRequestDTO request)`.
 * - Cụ thể tại sao đây là minh chứng? 
 *   + Chữ `@RequestBody` là lệnh bắt buộc Spring Boot phải kích hoạt thư viện Jackson để đọc 
 *     chuỗi văn bản JSON (gửi từ thiết bị IoT) thành dạng Java.
 *   + `CheckInRequestDTO` là khuôn mẫu. Jackson sẽ bóc tách chuỗi JSON (tìm thuộc tính biển 
 *     số, ảnh Base64) và nhét vào khuôn mẫu này.
 *   + Kết quả được lưu vào biến có tên là `request`. Từ giây phút này, biến `request` mang 
 *     trong mình toàn bộ dữ liệu hợp lệ (sẵn sàng trên RAM) để truyền vào thân hàm.
 * 
 * BƯỚC 4: ỦY QUYỀN XỬ LÝ NGHIỆP VỤ LÕI (SERVICE DELEGATION - N-TIER ARCHITECTURE)
 * - Controller (Lễ tân) không chứa logic tính toán. Nó phải đẩy việc cho Service.
 * - Minh chứng: Dòng 281 chứa câu lệnh: 
 *   `GateResponseDTO response = gateOperationService.triggerScanCheckIn(request);`
 * - Cụ thể tại sao dòng này là minh chứng? 
 *   + Gọi đối tượng: `gateOperationService` chính là bộ não đã được tiêm vào từ Bước 1. 
 *     Controller đang gọi bộ não ra làm việc.
 *   + Gọi hàm và truyền tham số: Lệnh `triggerScanCheckIn(request)` hành động ném thẳng 
 *     biến `request` (chứa dữ liệu xe vào từ Bước 3) sang cho lớp Service để nó lo việc kết nối 
 *     CSDL, kiểm tra Blacklist, tìm bãi trống. Điều này chứng minh Controller hoàn toàn "vô can" 
 *     trong việc tính toán (Tuân thủ nguyên lý Separation of Concerns).
 *   + Hứng kết quả: `GateResponseDTO response = ...` là hành động hứng (gán) kết quả do Service 
 *     tạo ra sau khi tính toán xong. Biến `response` lúc này là một Object chứa thông báo trạng thái,
 *     tên cổng mở, thời gian vào.
 * 
 * BƯỚC 5: ĐÓNG GÓI VÀ TRẢ VỀ RESPONSE (SERIALIZATION & HTTP 200 OK)
 * - Cuối cùng phải trả kết quả về cho thiết bị IoT để màn hình hiện chữ Thành công.
 * - Minh chứng: Dòng 286 chứa câu lệnh: 
 *   `return ResponseEntity.ok(ApiResponse.success(response, "Check-in triggered"));`
 * - Cụ thể tại sao dòng này là minh chứng?
 *   + Lệnh `ApiResponse.success(response, ...)`: Tiến hành đóng gói Object `response` (từ Bước 4) 
 *     vào trong một cấu trúc JSON chuẩn của dự án (luôn có trường statusCode, message, data).
 *   + Lệnh `ResponseEntity.ok(...)`: Đây là lệnh đóng dấu mã HTTP Status Code 200 (Thành công) 
 *     cho toàn bộ gói tin HTTP.
 *   + Lệnh `return`: Chuyển quyền điều khiển lại cho Spring Boot. Quá trình Serialization 
 *     (ngược với Bước 3) được kích hoạt: Biến đối tượng Java thành một chuỗi JSON thuần túy 
 *     và bắn thẳng qua cáp mạng về lại cho Tool IoT. Kết thúc vòng đời luồng dữ liệu!
 * 
 * PHỤ LỤC 1: HÀNH TRÌNH REQUEST CỦA LUỒNG CHECK-OUT (TƯƠNG TỰ BƯỚC 1 ĐẾN 5)
 * - Minh chứng Handler: Dòng 357 `@PostMapping("/gates/checkout")`. Spring định tuyến tín hiệu xe ra vào hàm `simulateCheckOut`.
 * - Minh chứng Deserialization: Dòng 358 `(@RequestBody CheckOutRequestDTO request)`. Jackson bóc tách JSON thành object `request` mang dữ liệu xe ra (biển số, thẻ).
 * - Minh chứng Delegation: Dòng 363 `GateResponseDTO response = gateOperationService.triggerScanCheckOut(request);`. Controller ném cái `request` sang bộ não Service để nó tính toán giá tiền (nếu là vé lượt) rồi gán vào biến `response`.
 * - Minh chứng Serialization: Dòng 367 `return ResponseEntity.ok(ApiResponse.success(response, ...));`. Đóng gói kết quả và trả về HTTP 200 OK cho máy quét cổng ra.
 * 
 * PHỤ LỤC 2: HÀNH TRÌNH REQUEST CỦA LUỒNG SENSOR UPDATE (CẬP NHẬT CHỖ TRỐNG)
 * - Minh chứng Handler: Dòng 202 `@PostMapping("/sensors/update")`. Hứng tín hiệu từ cảm biến gắn tại từng ô đậu xe.
 * - Minh chứng Deserialization: Dòng 203 `(@RequestBody SensorEventDto request)`. Bóc tách mã ô đỗ và trạng thái đè lên/rời đi.
 * - Minh chứng Delegation: Dòng 205 `zoneMonitoringService.processSensorEvent(...)`. Giao việc cho Service đổi màu ô đỗ trên bản đồ.
 * - Minh chứng Serialization: Dòng 207 `return ResponseEntity.ok(...)`. Báo lại cho cảm biến.
 * 
 * PHỤ LỤC 3: HÀNH TRÌNH REQUEST CỦA LUỒNG FAST FORWARD TIME (TUA THỜI GIAN)
 * - Minh chứng Handler: Dòng 267 `@PostMapping("/time/fast-forward")`. Hứng lệnh tua thời gian từ Simulator.
 * - Minh chứng Delegation đa tầng (Không có ở Check-In): 
 *   + Dòng 282 `systemConfigService.saveOrUpdateConfigValue(...)`: Lưu độ lệch thời gian vào Cấu hình hệ thống.
 *   + Dòng 288 `messagingTemplate.convertAndSend(...)`: Gọi công cụ WebSocket bắn tín hiệu Real-time bắt toàn bộ giao diện Web phải cập nhật lại đồng hồ hiển thị.
 *   + Dòng 292 `eventPublisher.publishEvent(...)`: Dùng kiến trúc Event-Driven bắn 1 sự kiện ngầm trong nội bộ Backend (Ví dụ để đánh thức các hàm Dọn dẹp vé quá hạn).
 * 
 * PHỤ LỤC 4: HÀNH TRÌNH REQUEST ĐỒNG BỘ DỮ LIỆU (DATA SYNC VÀ DEBUG)
 * - Minh chứng Handler (GET): Hàm `syncData` (dòng 382) và `debugSession` (dòng 220) khai báo `@GetMapping`. 
 * - Minh chứng Tối ưu hóa: Dòng 383 `@Transactional(readOnly = true)`. Báo cho bộ máy Hibernate biết đây chỉ là lệnh SELECT (không có thao tác Ghi/Xóa dữ liệu) để nó tối ưu hóa RAM và khóa (Lock) của cơ sở dữ liệu.
 * - Minh chứng Gom dữ liệu: Không có Service Delegation phức tạp. Các hàm này chỉ gọi trực tiếp các kho dữ liệu (như dòng 391 `slotRepository.findAll()`), nhét vào một cái túi bọc Hash Map khổng lồ và quăng ra bằng Jackson.
 * =========================================================================================
 */