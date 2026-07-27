package com.pbms.modules.operation.controller;

/**
 * =========================================================================================
 * 🌟 BỨC TRANH TOÀN CẢNH CỤ THỂ CHUẨN KỸ THUẬT CỦA IotHardwareController.java 🌟
 * =========================================================================================
 * 
 * 1. AI KHỞI TẠO NÓ LÊN? (VÒNG ĐỜI - LIFECYCLE)
 * - Khi Spring Boot chạy, tính năng Dependency Injection (DI) sẽ quét qua file này vì có tag `@RestController`.
 * - Hệ thống (IoC Container) sẽ tạo ra 1 Singleton Bean duy nhất và nhét vào đó (Inject) 12 lớp Repository và 3 lớp Service thông qua Constructor (Từ dòng 55 đến 86).
 * 
 * 2. AI GỌI ĐẾN NÓ? (ĐẦU VÀO CỤ THỂ - INPUT)
 * Tool giả lập (IoT Simulator) hoặc Postman sẽ gửi các HTTP Request cụ thể tới các URL sau (đã ghép tiền tố `/api/v1/operation/iot/hardware`):
 * - POST `.../gates/checkin` : Mang theo body JSON (CheckInRequestDTO) chứa hình ảnh base64, biển số, thẻ từ xe VÀO.
 * - POST `.../gates/checkout`: Mang theo body JSON (CheckOutRequestDTO) chứa hình ảnh base64, biển số, thẻ từ xe RA.
 * - POST `.../sensors/update`: Mang theo body JSON báo hiệu trạng thái ô đỗ (Ví dụ: sensorId = 5, status = OCCUPIED).
 * - POST `.../time/fast-forward`: Mang theo chuỗi ngày giờ tương lai để tua hệ thống.
 * - GET  `.../data-sync` : Chỉ gọi GET (không cần body) để lấy toàn bộ dữ liệu bãi xe vẽ sơ đồ.
 * - GET  `.../debug-session`: Chỉ gọi GET để moi thông tin hardcode (ID = 20) test nhanh.
 * 
 * 3. NÓ GỌI ĐẾN AI? (ĐẦU RA CỤ THỂ TỚI SERVICE VÀ DATABASE)
 * Đây là lớp Controller (Cửa ngõ), nó lập tức đẩy data vào các Service và Repo như sau:
 * 
 * - Hàm `simulateCheckIn()`:
 *   -> GỌI: `gateOperationService.triggerScanCheckIn(request)`
 *   -> Hậu quả: Lớp Service này sẽ dùng AI logic (zoneRoutingService) tìm chỗ trống, tạo data thô, sau đó bắn tin nhắn qua WebSocket kênh `/topic/gates/{gateId}/scans` xuống màn hình Frontend (file GateInConsoleScreen.tsx).
 * 
 * - Hàm `simulateCheckOut()`:
 *   -> GỌI: `gateOperationService.triggerScanCheckOut(request)`
 *   -> Hậu quả: Tương tự Check-in, nhưng để bắn tin nhắn chứa giờ vào - giờ ra xuống kênh WebSocket để màn hình thu ngân tính tiền.
 * 
 * - Hàm `handleSensorUpdate()`:
 *   -> GỌI: `zoneMonitoringService.processSensorEvent(sensorId, status)`
 *   -> Hậu quả: Đổi trạng thái ô đỗ (Slot) trong Database thành OCCUPIED (Đang đỗ) hoặc AVAILABLE (Trống) và bắn tín hiệu qua kênh `/topic/map-updates`.
 * 
 * - Hàm `fastForwardTime()`:
 *   -> GỌI 1: `systemConfigService.saveOrUpdateConfigValue("TIME_SIMULATED_OFFSET_SECONDS", offset)` để lưu số giây lệch (Offset) vào bảng `system_config` trong Database.
 *   -> GỌI 2: `messagingTemplate.convertAndSend("/topic/time-sync", wsPayload)` để thông báo cho toàn bộ Web Frontend nhảy đồng hồ lên.
 *   -> GỌI 3: `eventPublisher.publishEvent(...)` để kích hoạt các CronJob dọn dẹp các đơn đặt chỗ (Booking) bị quá giờ.
 * 
 * - Hàm `syncData()` (Chuyên bòn rút Database):
 *   -> Lấy danh sách ô đỗ: GỌI `slotRepository.findAll()` -> Query bảng `slot`.
 *   -> Lấy phiên đỗ xe đang chạy: GỌI `sessionRepository.findAll()` -> Query bảng `parking_session`.
 *   -> Lấy danh sách đặt chỗ: GỌI `reservationRepository.findAll()` -> Query bảng `reservation`.
 *   -> Lấy thẻ từ nhàn rỗi: GỌI `rfidCardRepository.findByStatus("AVAILABLE")` -> Query bảng `rfid_card`.
 *   -> Lấy các danh mục khác: GỌI `gateRepository`, `monthlyTicketRepository`, `vehicleTypeRepository`, `floorRepository`, `zoneRepository`.
 * =========================================================================================
 */

// =========================================================================
// PHẦN 1: CÁC THƯ VIỆN DTO (DATA TRANSFER OBJECT)
// Công dụng: Định nghĩa hình dáng của các "gói hàng" (dữ liệu) đi ra đi vào API
// =========================================================================
import com.pbms.common.dto.ApiResponse; // Lớp dùng để bọc kết quả trả về cho Client theo 1 chuẩn chung (Ví dụ luôn có code: 200, message: "OK", data: {...}).
import com.pbms.common.utils.TimeProvider; // Tiện ích quản lý thời gian của hệ thống (giúp xử lý múi giờ hoặc tính năng tua nhanh thời gian test).
import com.pbms.modules.operation.dto.CheckInRequestDTO; // Gói dữ liệu chứa thông tin khi xe VÀO (Ví dụ: biển số đọc được, chuỗi mã hóa hình ảnh, mã thẻ từ).
import com.pbms.modules.operation.dto.CheckOutRequestDTO; // Gói dữ liệu chứa thông tin khi xe RA (tương tự như CheckIn, nhưng dùng cho luồng ra).
import com.pbms.modules.operation.dto.GateResponseDTO; // Gói dữ liệu hệ thống trả ngược lại cho thiết bị IoT sau khi xử lý xong quét thẻ/biển số.
import com.pbms.modules.operation.dto.SensorEventDto; // Gói dữ liệu từ cảm biến đậu xe (báo cáo có xe đậu vào ô hay vừa rời đi).

// =========================================================================
// PHẦN 2: CÁC LỚP SERVICE (CHỨA LOGIC NGHIỆP VỤ)
// Công dụng: Đây là các "bộ não" thực hiện tính toán, kiểm tra đúng/sai.
// =========================================================================
import com.pbms.modules.operation.service.GateOperationService; // Dịch vụ LÕI xử lý toàn bộ luồng xe vào, xe ra, mở cổng, báo lỗi.
import com.pbms.modules.operation.service.ZoneMonitoringService; // Dịch vụ giám sát các khu vực đậu xe, đếm số chỗ trống.

// =========================================================================
// PHẦN 3: CÁC REPOSITORY (KẾT NỐI DATABASE)
// Công dụng: Các class này dùng để lấy dữ liệu từ CSDL (SQL) hoặc Lưu mới vào CSDL.
// =========================================================================
import com.pbms.modules.infrastructure.repository.SlotRepository; // Thao tác với bảng Slot (Ô đậu xe).
import com.pbms.modules.operation.repository.ParkingSessionRepository; // Thao tác với bảng ParkingSession (Lịch sử các phiên xe ra/vào).
import com.pbms.modules.operation.repository.ReservationRepository; // Thao tác với bảng Reservation (Các đơn đặt chỗ trước của khách).
import com.pbms.modules.infrastructure.repository.GateRepository; // Thao tác với bảng Gate (Thông tin các cổng ra vào).
import com.pbms.modules.infrastructure.repository.FloorRepository; // Thao tác với bảng Floor (Thông tin tầng hầm/tầng nổi).
import com.pbms.modules.infrastructure.repository.ZoneRepository; // Thao tác với bảng Zone (Các khu đậu xe).
import com.pbms.modules.operation.repository.VehicleTypeRepository; // Thao tác với bảng VehicleType (Loại xe: Ô tô, xe máy...).
import com.pbms.modules.operation.repository.MonthlyTicketRepository; // Thao tác với bảng MonthlyTicket (Vé tháng).
import com.pbms.modules.infrastructure.repository.RfidCardRepository; // Thao tác với bảng RfidCard (Thẻ từ).
import com.pbms.modules.operation.repository.StaffWorkSessionRepository; // Thao tác với bảng StaffWorkSession (Ca làm việc của nhân viên).

// =========================================================================
// PHẦN 4: CÁC THƯ VIỆN CỦA SPRING BOOT VÀ JAVA
// Công dụng: Framework hỗ trợ tạo API, kết nối mạng, xử lý thời gian...
// =========================================================================
import org.springframework.context.ApplicationEventPublisher; // Thư viện giúp phát ra các sự kiện (Event) ngầm trong hệ thống.
import com.pbms.common.event.TimeFastForwardedEvent; // Lớp tự định nghĩa để lắng nghe sự kiện tua nhanh thời gian.
import com.pbms.modules.system.service.SystemConfigService; // Dịch vụ lấy cấu hình hệ thống (Ví dụ: giá tiền, quy định).
import org.springframework.beans.factory.annotation.Autowired; // Đánh dấu để Spring Boot tự động "bơm" (Inject) các service/repo vào file này để dùng.
import org.springframework.http.ResponseEntity; // Lớp bọc của Spring đại diện cho 1 gói tin HTTP trả về (chứa mã 200, 400...).
import org.springframework.transaction.annotation.Transactional; // Đảm bảo tính toàn vẹn dữ liệu: Nếu bị lỗi giữa chừng thì sẽ hủy toàn bộ thao tác Database.
import org.springframework.web.bind.annotation.*; // Chứa các thẻ quan trọng như @RestController, @PostMapping... để tạo API.
import org.springframework.messaging.simp.SimpMessagingTemplate; // Công cụ dùng để bắn tin nhắn WebSocket tới Frontend (Real-time).

import java.time.LocalDateTime; // Thư viện Java chuẩn để xử lý Ngày - Giờ.
import java.util.HashMap; // Thư viện Java để tạo Map (giống Object trong JS) chứa Key-Value.
import java.util.Map; // Giao diện (Interface) chung của các loại Map.

/**
 * === PHẦN 5: ĐỊNH NGHĨA CLASS CONTROLLER ===
 * Nơi hứng mọi tín hiệu từ các thiết bị IoT bắn lên (như Camera AI chụp biển số, đầu đọc thẻ tít thẻ).
 */
@CrossOrigin("*") // Dòng này cho phép mọi website, ứng dụng (từ localhost hoặc ip khác) được phép gọi API này mà không bị chặn lỗi bảo mật CORS.
@RestController // Biến file Java này thành một Web API Controller. Nó sẽ tự động chuyển đổi dữ liệu trả về thành chuỗi JSON.
@RequestMapping("/api/v1/operation/iot/hardware") // Khai báo đường dẫn gốc. Muốn gọi các hàm bên dưới, phải nối đường dẫn này vào trước.
public class IotHardwareController {

    private final ZoneMonitoringService zoneMonitoringService;
    private final GateOperationService gateOperationService;
    private final SlotRepository slotRepository;
    private final ParkingSessionRepository sessionRepository;
    private final ReservationRepository reservationRepository;
    private final GateRepository gateRepository;
    private final VehicleTypeRepository vehicleTypeRepository;
    private final RfidCardRepository rfidCardRepository;
    private final FloorRepository floorRepository;
    private final ZoneRepository zoneRepository;
    private final StaffWorkSessionRepository staffWorkSessionRepository;
    private final MonthlyTicketRepository monthlyTicketRepository;
    private final SystemConfigService systemConfigService;
    private final ApplicationEventPublisher eventPublisher;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public IotHardwareController(ZoneMonitoringService zoneMonitoringService,
                                 GateOperationService gateOperationService,
                                 SlotRepository slotRepository,
                                 ParkingSessionRepository sessionRepository,
                                 ReservationRepository reservationRepository,
                                 GateRepository gateRepository,
                                 VehicleTypeRepository vehicleTypeRepository,
                                 RfidCardRepository rfidCardRepository,
                                 FloorRepository floorRepository,
                                 ZoneRepository zoneRepository,
                                 StaffWorkSessionRepository staffWorkSessionRepository,
                                 MonthlyTicketRepository monthlyTicketRepository,
                                 SystemConfigService systemConfigService,
                                 ApplicationEventPublisher eventPublisher,
                                 SimpMessagingTemplate messagingTemplate) {
        this.zoneMonitoringService = zoneMonitoringService;
        this.gateOperationService = gateOperationService;
        this.slotRepository = slotRepository;
        this.sessionRepository = sessionRepository;
        this.reservationRepository = reservationRepository;
        this.gateRepository = gateRepository;
        this.vehicleTypeRepository = vehicleTypeRepository;
        this.rfidCardRepository = rfidCardRepository;
        this.floorRepository = floorRepository;
        this.zoneRepository = zoneRepository;
        this.staffWorkSessionRepository = staffWorkSessionRepository;
        this.monthlyTicketRepository = monthlyTicketRepository;
        this.systemConfigService = systemConfigService;
        this.eventPublisher = eventPublisher;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * =========================================================================
     * API: NHẬN TÍN HIỆU TỪ CẢM BIẾN CHỖ ĐẬU XE (SENSOR UPDATE)
     * =========================================================================
     * MỤC ĐÍCH: 
     * Bãi xe có các cảm biến (sensor) gắn ở từng ô đậu xe. Khi có xe đè lên hoặc rời đi, 
     * cảm biến sẽ bắn API này để báo cáo trạng thái (Ví dụ: "Ô A1 đã có xe", "Ô B2 đã trống").
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Lắng nghe method POST tại endpoint "/sensors/update".
     * 2. Nhận gói dữ liệu (SensorEventDto) chứa Mã cảm biến (SensorId) và Trạng thái mới (Status).
     * 3. Chuyền thông tin này cho ZoneMonitoringService để nó cập nhật vào Database và đổi màu sơ đồ trên Web.
     * 4. Trả về thông báo thành công cho cảm biến.
     */
    @PostMapping("/sensors/update")
    public ResponseEntity<ApiResponse<String>> handleSensorUpdate(@RequestBody SensorEventDto request) {
        // Chuyển việc xử lý lõi cho bộ não (ZoneMonitoringService)
        zoneMonitoringService.processSensorEvent(request.getSensorId(), request.getStatus());
        // Báo lại cho thiết bị là đã cập nhật xong
        return ResponseEntity.ok(ApiResponse.success("Processed", "Sensor update processed successfully"));
    }

    /**
     * =========================================================================
     * API: LẤY THÔNG TIN DEBUG PHIÊN ĐỖ XE (DEBUG SESSION)
     * =========================================================================
     * MỤC ĐÍCH: 
     * API này chỉ dùng cho mục đích kiểm thử (Testing) hoặc cho Tool IoT Simulator. 
     * Nó giúp nhà phát triển (hoặc thầy cô lúc chấm) xem nhanh dữ liệu của 1 phiên đỗ xe ngẫu nhiên 
     * (ở đây đang hardcode ID = 20) xem có thẻ RFID, có biển số hay không.
     */
    @GetMapping("/debug-session") // Lắng nghe method GET tại "/debug-session"
    @Transactional(readOnly = true) // Đánh dấu đây là hàm chỉ Đọc dữ liệu (không sửa/xóa), giúp Spring tối ưu tốc độ Database.
    public ResponseEntity<Map<String, Object>> debugSession() {
        Map<String, Object> debug = new HashMap<>();
        
        // Tìm thử phiên đỗ xe có ID = 20 trong Database
        com.pbms.modules.operation.domain.ParkingSession s = sessionRepository.findById(20L).orElse(null);
        if (s != null) {
            // Nhét các thông tin biển số, loại xe, mã thẻ vào biến `debug`
            debug.put("plate", s.getPlate());
            debug.put("hasVehicleType", s.getVehicleType() != null);
            if (s.getVehicleType() != null) debug.put("vehicleTypeId", s.getVehicleType().getId());
            debug.put("hasRfidCard", s.getRfidCard() != null);
            if (s.getRfidCard() != null) debug.put("rfidCardId", s.getRfidCard().getId());
            if (s.getRfidCard() != null) debug.put("rfidCardCode", s.getRfidCard().getCardCode());
        }
        
        // Trả kết quả JSON về cho công cụ Test
        return ResponseEntity.ok(debug);
    }

    /**
     * =========================================================================
     * API: TUA NHANH THỜI GIAN HỆ THỐNG (FAST FORWARD TIME)
     * =========================================================================
     * MỤC ĐÍCH:
     * Dùng cho việc DEMO đồ án. Vì không thể chờ xe đậu vài tiếng đồng hồ để tính tiền,
     * API này giúp "Tua nhanh thời gian" của toàn bộ hệ thống tới 1 giờ bất kỳ trong tương lai
     * để test tính năng thu phí (Pricing) hoặc tự động hủy chỗ đặt (Expire Booking).
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Lắng nghe method POST tại "/time/fast-forward".
     * 2. Lấy `targetTime` (thời gian muốn tua tới) từ gói dữ liệu (payload).
     * 3. Lưu lại độ chênh lệch thời gian (Offset) vào Database (bảng SystemConfig) để các bộ phận khác lấy đúng giờ giả lập.
     * 4. Bắn WebSocket báo cho Frontend (Màn hình nhân viên) biết là "Giờ đã bị tua" để giao diện tự cập nhật đồng hồ.
     * 5. Kích hoạt Event ngầm `TimeFastForwardedEvent` để chạy các job như: Hủy vé quá hạn.
     */
    @PostMapping("/time/fast-forward")
    public ResponseEntity<ApiResponse<String>> fastForwardTime(@RequestBody Map<String, String> payload) {
        String targetTimeStr = payload.get("targetTime"); // Bóc tách chuỗi thời gian muốn tua tới
        if (targetTimeStr == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Missing targetTime")); // Nếu gửi thiếu thì chửi lỗi 400
        }
        LocalDateTime targetTime = LocalDateTime.parse(targetTimeStr); // Đổi từ chuỗi sang kiểu Ngày-Giờ của Java
        try {
            LocalDateTime oldTime = TimeProvider.now(); // Lấy giờ hiện tại trước khi tua
            TimeProvider.fastForwardTo(targetTime); // Chạy hàm tua thời gian
            
            // Tính số giây bị lệch so với giờ thực tế, và lưu vào Cấu hình (SystemConfig) Database
            long offsetSeconds = TimeProvider.getSimulatedOffset().getSeconds();
            systemConfigService.saveOrUpdateConfigValue("TIME_SIMULATED_OFFSET_SECONDS", String.valueOf(offsetSeconds));
            
            // Gửi tin nhắn qua WebSocket báo cho tất cả màn hình Web cập nhật đồng hồ hiển thị
            Map<String, Object> wsPayload = new HashMap<>();
            wsPayload.put("offsetSeconds", offsetSeconds);
            messagingTemplate.convertAndSend("/topic/time-sync", (Object) wsPayload);

            // Bắn một phát súng (Event) thông báo trong nội bộ hệ thống Backend: "Giờ đã thay đổi, các JOB dọn dẹp data hãy chạy đi!"
            eventPublisher.publishEvent(new TimeFastForwardedEvent(this, oldTime, TimeProvider.now()));
            
            // Trả về chữ OK và giờ sau khi tua
            return ResponseEntity.ok(ApiResponse.success("Current Time: " + TimeProvider.now(), "Time fast-forwarded successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        }
    }

    /**
     * =========================================================================
     * API 1: NHẬN TÍN HIỆU TỪ CỔNG VÀO (CHECK-IN)
     * =========================================================================
     * MỤC ĐÍCH: 
     * Khi xe tới cổng vào, thiết bị Camera hoặc Đầu đọc thẻ sẽ gửi 1 API (POST) đến đây.
     * Hàm này sẽ hứng dữ liệu và chuyển cho bộ não (Service) xử lý, sau đó báo lại cho máy quét.
     * 
     * MÃ GIẢ CHI TIẾT TỪNG BƯỚC (PSEUDO-CODE):
     * 1. Lắng nghe HTTP POST tại đường dẫn /gates/checkin.
     * 2. Phân tích gói JSON được gửi tới (body) thành đối tượng CheckInRequestDTO.
     * 3. Gọi GateOperationService.triggerScanCheckIn() truyền gói dữ liệu vào để xử lý luồng lõi.
     * 4. Lấy kết quả (GateResponseDTO) từ Service.
     * 5. Bọc kết quả vào ApiResponse, đánh mã code HTTP 200 (OK) và trả về cho thiết bị.
     */
    @PostMapping("/gates/checkin") // Dòng này chỉ định: Chỉ chấp nhận method POST, nối vào sau đường dẫn gốc thành: /api/v1/operation/iot/hardware/gates/checkin
    // @RequestBody: Cú pháp báo cho Spring Boot biết phải dịch chuỗi JSON gửi lên thành class CheckInRequestDTO (lưu vào biến `request`)
    public ResponseEntity<ApiResponse<GateResponseDTO>> simulateCheckIn(@RequestBody CheckInRequestDTO request) {
        
        // Bước 1: Gọi hàm xử lý lõi.
        // Hàm triggerScanCheckIn sẽ làm các việc (nằm ở file GateOperationService): 
        // Tìm xem khách này là vé tháng hay vé lượt -> Có Booking không -> Tìm tuyến đường bãi trống -> Bắn WebSocket lên giao diện cho bảo vệ xem.
        // Kết quả xử lý xong sẽ được lưu vào biến `response`.
        GateResponseDTO response = gateOperationService.triggerScanCheckIn(request);
        
        // Bước 2: Trả kết quả về cho thiết bị IoT (camera/đầu đọc).
        // ApiResponse.success(): Bọc dữ liệu `response` vào trong một chuẩn JSON chung của team, kèm câu thông báo "Check-in triggered".
        // ResponseEntity.ok(): Tạo một gói tin HTTP có mã 200 (Nghĩa là Thành công), chứa nội dung ApiResponse ở trên.
        return ResponseEntity.ok(ApiResponse.success(response, "Check-in triggered"));
    }

    /**
     * =========================================================================
     * API 2: NHẬN TÍN HIỆU TỪ CỔNG RA (CHECK-OUT)
     * =========================================================================
     * MỤC ĐÍCH:
     * Tương tự như lúc vào, khi khách quét thẻ/biển số lúc ra về, thiết bị gọi API này.
     * 
     * MÃ GIẢ CHI TIẾT TỪNG BƯỚC (PSEUDO-CODE):
     * 1. Lắng nghe HTTP POST tại đường dẫn /gates/checkout.
     * 2. Bắt lấy gói dữ liệu JSON và gán vào biến CheckOutRequestDTO.
     * 3. Đẩy dữ liệu sang GateOperationService.triggerScanCheckOut() để nó tìm giờ vào, tính tiền, và bắn WebSocket lên màn hình thu ngân.
     * 4. Bọc kết quả và trả về HTTP 200 OK.
     */
    @PostMapping("/gates/checkout") // Lắng nghe method POST tại endpoint /gates/checkout
    public ResponseEntity<ApiResponse<GateResponseDTO>> simulateCheckOut(@RequestBody CheckOutRequestDTO request) {
        
        // Gọi Service lõi xử lý việc xe quét thẻ/biển số ở cổng ra.
        // Bên trong hàm này sẽ tính toán xem xe này phải đóng bao nhiêu tiền (nếu là vé lượt) và bắn lên màn hình cổng ra.
        GateResponseDTO response = gateOperationService.triggerScanCheckOut(request);
        
        // Trả về cho thiết bị quét tín hiệu 200 OK, ngụ ý: "Server đã nhận và xử lý tín hiệu thành công".
        return ResponseEntity.ok(ApiResponse.success(response, "Check-out triggered"));
    }

    /**
     * =========================================================================
     * API: ĐỒNG BỘ DỮ LIỆU CHUNG (DATA SYNC) CHO TOOL SIMULATOR
     * =========================================================================
     * MỤC ĐÍCH: 
     * Vì chúng ta dùng Tool IoT giả lập để vẽ bản đồ 2D cho người test bấm, 
     * hàm này chỉ để "Gom" toàn bộ dữ liệu thô (Danh sách xe, bãi đỗ, vé tháng...) 
     * và nhét chung vào 1 cục (Map) trả về cho Tool giả lập để nó vẽ sơ đồ khởi tạo.
     * Hàm này rất dài nhưng chỉ là Get Data bình thường, không xử lý logic phức tạp.
     */
    @GetMapping("/data-sync")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<Map<String, Object>>> syncData() {
        Map<String, Object> data = new HashMap<>();
        
        // 1. Current System Time
        data.put("currentTime", TimeProvider.now());
        
        // 1. Slots (Mapped to Map to avoid deep nesting and lazy loading)
        data.put("slots", slotRepository.findAll().stream()
                .filter(s -> s.getZone() != null && !"DELETED".equals(s.getZone().getStatus()))
                .map(s -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId());
            map.put("slotName", s.getSlotName());
            map.put("status", s.getStatus());
            if (s.getZone() != null) {
                map.put("zoneId", s.getZone().getId());
            }
            return map;
        }).toList());
        
        // 3. Active Sessions (Mapped to avoid infinite recursion)
        data.put("activeSessions", sessionRepository.findAll().stream()
                .filter(s -> "ACTIVE".equals(s.getStatus()) || "LOCKED".equals(s.getStatus()))
                .map(s -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", s.getId());
                    map.put("plate", s.getPlate());
                    map.put("timeIn", s.getTimeIn());
                    map.put("status", s.getStatus());
                    map.put("suggestedZoneId", s.getSuggestedZoneId());
                    map.put("picInPanorama", s.getPicInPanorama());
                    map.put("picInFace", s.getPicInFace());
                    if (s.getGateIn() != null && s.getGateIn().getFloor() != null) {
                        map.put("floorId", s.getGateIn().getFloor().getId());
                    }
                    if (s.getVehicleType() != null) {
                        map.put("vehicleTypeId", s.getVehicleType().getId());
                    }
                    if (s.getRfidCard() != null) {
                        Map<String, Object> rfidMap = new HashMap<>();
                        rfidMap.put("cardCode", s.getRfidCard().getCardCode());
                        rfidMap.put("cardId", s.getRfidCard().getCardId());
                        map.put("rfidCard", rfidMap);
                    }

                    if (s.getVehicleType() != null) {
                        Map<String, Object> vMap = new HashMap<>();
                        vMap.put("id", s.getVehicleType().getId());
                        vMap.put("typeName", s.getVehicleType().getTypeName());
                        map.put("vehicleType", vMap);
                    }
                    return map;
                })
                .toList());

        // 4. Reservations (Mapped to avoid infinite recursion)
        data.put("reservations", reservationRepository.findAll().stream()
                .filter(r -> "ACTIVE".equals(r.getStatus()) || "PENDING".equals(r.getStatus()))
                .map(r -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", r.getId());
                    map.put("expectedEntryTime", r.getExpectedEntryTime());
                    map.put("reservationFee", r.getReservationFee());
                    map.put("status", r.getStatus());
                    if (r.getVehicle() != null) {
                        Map<String, Object> vMap = new HashMap<>();
                        vMap.put("id", r.getVehicle().getId());
                        vMap.put("plateNumber", r.getVehicle().getPlateNumber());
                        if (r.getVehicle().getVehicleType() != null) {
                            Map<String, Object> vtMap = new HashMap<>();
                            vtMap.put("id", r.getVehicle().getVehicleType().getId());
                            vtMap.put("typeName", r.getVehicle().getVehicleType().getTypeName());
                            vMap.put("vehicleType", vtMap);
                        }
                        map.put("vehicle", vMap);
                    }
                    if (r.getZone() != null) {
                        Map<String, Object> zMap = new HashMap<>();
                        zMap.put("id", r.getZone().getId());
                        zMap.put("zoneName", r.getZone().getZoneName());
                        if (r.getZone().getFloor() != null) {
                            zMap.put("floorId", r.getZone().getFloor().getId());
                        }
                        map.put("zone", zMap);
                    }
                    return map;
                })
                .toList());

        // 5. Gates (Mapped)
        data.put("gates", gateRepository.findAll().stream().map(g -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", g.getId());
            map.put("gateName", g.getGateName());
            var activeSessionOpt = staffWorkSessionRepository.findByGateIdAndStatus(g.getId(), "ACTIVE");
            map.put("hasStaff", activeSessionOpt.isPresent());
            if (activeSessionOpt.isPresent()) {
                map.put("gateType", activeSessionOpt.get().getWorkGateType());
            } else {
                map.put("gateType", "NONE"); // Indicate inactive gate
            }
            if (g.getFloor() != null) {
                map.put("floorType", g.getFloor().getFloorType());
                map.put("floorId", g.getFloor().getId());
            }
            return map;
        }).toList());

        // 6. Monthly Tickets
        data.put("monthlyTickets", monthlyTicketRepository.findAll().stream()
                .filter(m -> "ACTIVE".equals(m.getStatus()))
                .map(m -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", m.getId());
                    map.put("plate", m.getPlateNumber());
                    if (m.getUser() != null) {
                        map.put("customerName", m.getUser().getFullName());
                    }
                    map.put("validFrom", m.getValidFrom());
                    map.put("validUntil", m.getValidUntil());
                    map.put("status", m.getStatus());
                    if (m.getVehicleType() != null) {
                        Map<String, Object> vMap = new HashMap<>();
                        vMap.put("id", m.getVehicleType().getId());
                        vMap.put("typeName", m.getVehicleType().getTypeName());
                        map.put("vehicleType", vMap);
                    }
                    return map;
                }).toList());

        // 7. Vehicle Types (Mapped)
        data.put("vehicleTypes", vehicleTypeRepository.findAll().stream().map(v -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", v.getId());
            map.put("typeName", v.getTypeName());
            map.put("category", v.getCategory());
            map.put("matrixWidth", v.getMatrixWidth());
            map.put("matrixHeight", v.getMatrixHeight());
            return map;
        }).toList());

        // 7. Available RFID Cards
        data.put("availableCards", rfidCardRepository.findByStatus("AVAILABLE").stream()
                .map(c -> c.getCardCode())
                .toList());

        // 8. Floors
        data.put("floors", floorRepository.findAll().stream().map(f -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", f.getId());
            map.put("floorName", f.getFloorName());
            map.put("floorType", f.getFloorType());
            map.put("mapCols", f.getMapCols());
            map.put("mapRows", f.getMapRows());
            return map;
        }).toList());

        // 9. Zones
        data.put("zones", zoneRepository.findAll().stream()
                .filter(z -> !"DELETED".equals(z.getStatus()))
                .map(z -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", z.getId());
            map.put("zoneName", z.getZoneName());
            if (z.getFloor() != null) {
                map.put("floorId", z.getFloor().getId());
            }
            map.put("layoutX", z.getLayoutX());
            map.put("layoutY", z.getLayoutY());
            map.put("rotation", z.getRotation());
            map.put("functionType", z.getFunctionType());
            if (z.getVehicleType() != null) {
                map.put("vehicleTypeId", z.getVehicleType().getId());
            }
            return map;
        }).toList());

        return ResponseEntity.ok(ApiResponse.success(data, "Synced"));
    }
}

