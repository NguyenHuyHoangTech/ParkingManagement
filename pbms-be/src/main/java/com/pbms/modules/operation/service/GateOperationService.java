
package com.pbms.modules.operation.service;

import com.pbms.modules.identity.domain.StaffWorkSession;

import com.pbms.modules.finance.domain.Transaction;
import com.pbms.modules.finance.repository.TransactionRepository;
import com.pbms.modules.finance.service.PricingCalculatorService;
import com.pbms.modules.infrastructure.domain.Gate;
import com.pbms.modules.infrastructure.domain.RfidCard;
import com.pbms.modules.infrastructure.repository.GateRepository;
import com.pbms.modules.infrastructure.repository.RfidCardRepository;
import com.pbms.modules.operation.domain.*;
import com.pbms.modules.operation.dto.CheckInRequestDTO;
import com.pbms.modules.operation.dto.CheckOutRequestDTO;
import com.pbms.modules.operation.dto.GateResponseDTO;
import com.pbms.modules.operation.dto.ScanEventDTO;
import com.pbms.modules.operation.repository.MonthlyTicketRepository;
import com.pbms.modules.operation.repository.ParkingSessionRepository;
import com.pbms.modules.operation.repository.ReservationRepository;
import com.pbms.modules.operation.repository.VehicleTypeRepository;
import com.pbms.modules.operation.repository.VehicleRepository;
import com.pbms.modules.infrastructure.domain.Zone;
import com.pbms.modules.infrastructure.repository.ZoneRepository;
import com.pbms.modules.system.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class GateOperationService {

    private final ParkingSessionRepository sessionRepository;

    private final VehicleRepository vehicleRepository;

    private final ZoneRoutingService zoneRoutingService;

    private final RfidCardRepository rfidCardRepository;

    private final GateRepository gateRepository;

    private final MonthlyTicketRepository monthlyTicketRepository;

    private final VehicleTypeRepository vehicleTypeRepository;

    private final PricingCalculatorService pricingCalculatorService;

    private final ReservationRepository reservationRepository;

    private final ZoneRepository zoneRepository;

    private final SimpMessagingTemplate messagingTemplate;

    private final com.pbms.common.security.JwtProvider jwtProvider;

    private final com.pbms.modules.incident.repository.IncidentTicketRepository incidentTicketRepository;

    private final TransactionRepository transactionRepository;

    private final com.pbms.modules.operation.repository.StaffWorkSessionRepository staffWorkSessionRepository;

    private final SystemConfigService systemConfigService;

    private final com.pbms.common.service.FileStorageService fileStorageService;

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Lọc và lấy danh sách các đơn đặt chỗ (Booking/Reservation) đang ở trạng thái PENDING và còn hiệu lực (không quá trễ, không quá sớm).
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Tìm tất cả Reservation của biển số xe có trạng thái PENDING.
     * 2. Lấy cấu hình hệ thống `RESERVATION_EARLY_MINS` (số phút cho phép xe đến sớm, mặc định 30p).
     * 3. Duyệt qua từng đơn đặt chỗ:
     *    - Tính thời gian hết hạn (expireTime) = Thời gian dự kiến vào + Thời lượng dự kiến.
     *    - Tính thời gian bắt đầu cho phép vào (earlyWindow) = Thời gian dự kiến vào - windowMinutes.
     *    - Nếu thời gian hiện tại > expireTime: Đơn đặt chỗ đã quá hạn -> Đổi trạng thái thành COMPLETED_UNUSED.
     *    - Nếu thời gian hiện tại < earlyWindow: Xe đến quá sớm -> Không đưa vào danh sách hợp lệ.
     *    - Ngược lại: Đơn đặt chỗ hợp lệ -> Thêm vào danh sách valid.
     * 4. Trả về danh sách đơn đặt chỗ hợp lệ.
     */
    private List<Reservation> getValidPendingReservations(String plate) {
        List<Reservation> pending = reservationRepository.findByVehicle_PlateNumberAndStatus(plate, "PENDING");
        List<Reservation> valid = new java.util.ArrayList<>();
        java.time.LocalDateTime now = com.pbms.common.utils.TimeProvider.now();
        int windowMinutes = 30;
        try {
            windowMinutes = Integer
                    .parseInt(systemConfigService.getConfigByKey("RESERVATION_EARLY_MINS").getConfigValue());
        } catch (Exception e) {
        }
        for (Reservation res : pending) {
            java.time.LocalDateTime expireTime = res.getExpectedEntryTime()
                    .plusMinutes(res.getExpectedDurationMinutes());
            java.time.LocalDateTime earlyWindow = res.getExpectedEntryTime().minusMinutes(windowMinutes);
            if (now.isAfter(expireTime)) {
                res.setStatus("COMPLETED_UNUSED");
                reservationRepository.save(res);
            } else if (now.isBefore(earlyWindow)) {
            } else {
                valid.add(res);
            }
        }
        return valid;
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Xác định loại khách hàng (Customer Type) dựa trên Biển số, mã thẻ RFID và loại xe.
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Nếu biển số xe có dữ liệu:
     *    a. Kiểm tra xe có vé tháng (MONTHLY) còn hạn và đúng loại xe hay không. Nếu có -> Trả về "MONTHLY".
     *    b. Kiểm tra xe có đang có đơn đặt chỗ trạng thái ACTIVE không. Nếu có -> Trả về "PREBOOKED".
     *    c. Kiểm tra xe có đơn đặt chỗ hợp lệ (PENDING) chưa sử dụng không. Nếu có -> Trả về "PREBOOKED".
     * 2. Nếu không thuộc các trường hợp trên -> Trả về "WALK-IN" (Khách vãng lai).
     */
    private String determineCustomerType(String plate, String rfid, VehicleType type) {
        java.time.LocalDateTime now = com.pbms.common.utils.TimeProvider.now();
        if (plate != null && !plate.trim().isEmpty()) {
            Optional<MonthlyTicket> mt = monthlyTicketRepository.findByPlateNumberAndStatus(plate, "ACTIVE");
            if (mt.isPresent() && mt.get().getValidUntil().isAfter(now)) {
                if (type == null || (mt.get().getVehicleType() != null
                        && mt.get().getVehicleType().getId().equals(type.getId()))) {
                    return "MONTHLY";
                }
            }

            List<Reservation> activeReservations = reservationRepository.findByVehicle_PlateNumberAndStatus(plate,
                    "ACTIVE");
            if (!activeReservations.isEmpty())
                return "PREBOOKED";

            List<Reservation> pendingReservations = getValidPendingReservations(plate);
            if (!pendingReservations.isEmpty())
                return "PREBOOKED";
        }

        return "WALK-IN";
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Gửi tín hiệu quét thẻ/biển số (Check-IN) từ thiết bị cứng (Camera AI) lên giao diện Web của nhân viên (WebSocket).
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Tìm thông tin cổng (Gate) và loại xe (VehicleType) theo request.
     * 2. Phân tích loại khách hàng (determineCustomerType).
     * 3. Xử lý đặt chỗ (Booking): 
     *    - Nếu có Booking: Kiểm tra loại xe có khớp không, có đến sớm không, và khu vực đậu xe còn chỗ không.
     *    - Nếu khu vực đậu đã đầy -> Gọi AI (zoneRoutingService) tìm khu vực trống khác.
     * 4. Kiểm tra cấu hình hệ thống `DISPLAY_ROUTING` có cho phép hiển thị tuyến đường đề xuất không.
     * 5. Kiểm tra biển số có nằm trong danh sách đen (Blacklist) không.
     * 6. Đóng gói dữ liệu (ScanEventDTO) và gửi qua WebSocket `/topic/gates/{gateId}/scans`.
     * 7. Trả về kết quả thành công cho thiết bị cứng.
     */
    public GateResponseDTO triggerScanCheckIn(CheckInRequestDTO request) {
        Gate gate = gateRepository.findById(request.getGateId())
                .orElseThrow(() -> new IllegalArgumentException("Gate not found"));

        VehicleType type = null;
        if (request.getVehicleTypeId() != null) {
            type = vehicleTypeRepository.findById(request.getVehicleTypeId()).orElse(null);
        }
        if (type == null && request.getVehicleType() != null) {
            type = vehicleTypeRepository.findByTypeName(request.getVehicleType()).orElse(null);
        }

        Zone suggestedZone = null;
        String customerType = determineCustomerType(request.getPlateNumber(), request.getRfid(), type);
        String earlyBookingNotice = null;
        if (type != null) {
            List<Reservation> reservations = getValidPendingReservations(request.getPlateNumber());
            if (!reservations.isEmpty()) {
                Reservation res = reservations.get(0);
                if (!res.getVehicle().getVehicleType().getId().equals(type.getId())) {
                    earlyBookingNotice = "Warning: Booking exists but vehicle type mismatch! Booking is for "
                            + res.getVehicle().getVehicleType().getTypeName();
                    suggestedZone = zoneRoutingService.suggestZone(type, customerType, gate.getFloor());
                } else {
                    suggestedZone = res.getZone();
                    if (zoneRoutingService.isZonePhysicallyFull(suggestedZone.getId())) {
                        log.info("Reserved zone {} is physically full, routing to fallback zone.",
                                suggestedZone.getZoneName());
                        suggestedZone = zoneRoutingService.suggestZone(type, customerType, gate.getFloor());
                    }
                }
            } else {
                final Long targetTypeId = type.getId();
                List<Reservation> allPending = reservationRepository
                        .findByVehicle_PlateNumberAndStatus(request.getPlateNumber(), "PENDING")
                        .stream()
                        .filter(r -> r.getVehicle().getVehicleType().getId().equals(targetTypeId))
                        .collect(java.util.stream.Collectors.toList());
                if (!allPending.isEmpty()) {
                    Reservation earliest = allPending.stream()
                            .min(java.util.Comparator.comparing(r -> r.getExpectedEntryTime())).orElse(null);
                    if (earliest != null) {
                        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                                .ofPattern("HH:mm");
                        earlyBookingNotice = "Notice: This vehicle has a booking at "
                                + earliest.getExpectedEntryTime().format(formatter) + " but it is not time yet.";
                    }
                }
                suggestedZone = zoneRoutingService.suggestZone(type, customerType, gate.getFloor());
            }
        }

        boolean displayRouting = true;
        try {
            com.pbms.modules.system.domain.SystemConfig config = systemConfigService.getConfigByKey("DISPLAY_ROUTING");
            if (config != null && "FALSE".equalsIgnoreCase(config.getConfigValue())) {
                displayRouting = false;
            }
        } catch (Exception e) {
            log.warn("Error reading DISPLAY_ROUTING config: {}", e.getMessage());
        }

        if (displayRouting && suggestedZone != null) {
            request.setSuggestedZoneName(suggestedZone.getZoneName());
        } else {
            request.setSuggestedZoneName("Free");
        }

        boolean isBlacklisted = false;

        if (request.getPlateNumber() != null) {
            java.util.Optional<com.pbms.modules.operation.domain.Vehicle> vOpt = vehicleRepository
                    .findByPlateNumber(request.getPlateNumber());
            if (vOpt.isPresent() && Boolean.TRUE.equals(vOpt.get().getIsBlacklisted())) {
                isBlacklisted = true;
            }
        }

        ScanEventDTO event = ScanEventDTO.builder()
                .gateId(gate.getId())
                .actionType("IN")
                .plateNumber(request.getPlateNumber())
                .vehicleType(request.getVehicleType())
                .rfid(request.getRfid())
                .imageBase64(request.getImageBase64())
                .lprImageBase64(request.getLprImageBase64())
                .suggestedZoneId(displayRouting && suggestedZone != null ? suggestedZone.getId() : null)
                .suggestedZoneName(displayRouting && suggestedZone != null ? suggestedZone.getZoneName() : "Free")
                .customerType(customerType)
                .earlyBookingNotice(earlyBookingNotice)
                .isBlacklisted(isBlacklisted)
                .build();

        messagingTemplate.convertAndSend("/topic/gates/" + gate.getId() + "/scans", event);

        return GateResponseDTO.builder()
                .status("SUCCESS")
                .message("Scan triggered. Waiting for staff approval.")
                .suggestedZoneId(displayRouting && suggestedZone != null ? suggestedZone.getId() : null)
                .suggestedZoneName(displayRouting && suggestedZone != null ? suggestedZone.getZoneName() : "Free")
                .earlyBookingNotice(earlyBookingNotice)
                .build();
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Gửi tín hiệu quét thẻ/biển số (Check-OUT) từ thiết bị cứng (Camera AI) lên giao diện Web của nhân viên qua WebSocket.
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Tìm thông tin cổng ra (Gate) và loại xe (VehicleType).
     * 2. Xác định loại khách hàng (Monthly, Walk-in...).
     * 3. Đóng gói dữ liệu (ScanEventDTO) với hành động "OUT".
     * 4. Bắn sự kiện qua WebSocket tới kênh `/topic/gates/{gateId}/scans`.
     * 5. Trả về phản hồi cho thiết bị rằng tín hiệu đã được gửi thành công.
     */
    @Transactional
    public GateResponseDTO triggerScanCheckOut(CheckOutRequestDTO request) {
        Gate gate = gateRepository.findById(request.getGateId())
                .orElseThrow(() -> new IllegalArgumentException("Gate not found"));

        VehicleType type = null;
        if (request.getVehicleType() != null) {
            type = vehicleTypeRepository.findByTypeName(request.getVehicleType()).orElse(null);
        }

        ScanEventDTO event = ScanEventDTO.builder()
                .gateId(gate.getId())
                .actionType("OUT")
                .plateNumber(request.getPlateNumber())
                .vehicleType(request.getVehicleType())
                .rfid(request.getRfid())
                .imageBase64(request.getImageBase64())
                .lprImageBase64(request.getLprImageBase64())
                .customerType(determineCustomerType(request.getPlateNumber(), request.getRfid(), type))
                .build();

        messagingTemplate.convertAndSend("/topic/gates/" + gate.getId() + "/scans", event);

        return GateResponseDTO.builder()
                .status("SUCCESS")
                .message("Scan triggered. Waiting for staff approval.")
                .build();
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Xác định thời điểm bắt đầu tính phí đậu xe, đặc biệt quan trọng cho các xe sử dụng vé tháng nhưng hết hạn giữa chừng.
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Mặc định thời điểm bắt đầu tính phí là Thời gian xe vào bãi (timeIn).
     * 2. Tìm vé tháng (ACTIVE hoặc EXPIRED) của biển số xe này.
     * 3. Nếu tìm thấy vé tháng:
     *    - Nếu vé tháng hết hạn SAU thời gian xe vào, và TRƯỚC thời gian hiện tại (nghĩa là hết hạn lúc đang đỗ trong bãi):
     *    - Nếu đúng loại xe -> Thời điểm bắt đầu tính phí phụ trội sẽ là Thời điểm vé tháng hết hạn.
     * 4. Trả về thời điểm bắt đầu tính phí.
     */
    private java.time.LocalDateTime determineFeeStartTime(ParkingSession session, String rfidCode) {
        java.time.LocalDateTime feeStartTime = session.getTimeIn();
        java.util.Optional<com.pbms.modules.operation.domain.MonthlyTicket> relevantTicket = java.util.Optional.empty();

        if (session.getPlate() != null && !session.getPlate().isEmpty()) {
            relevantTicket = monthlyTicketRepository.findByPlateNumberAndStatus(session.getPlate(), "ACTIVE");
            if (relevantTicket.isEmpty()) {
                relevantTicket = monthlyTicketRepository.findTopByPlateNumberAndStatusOrderByUpdatedAtDesc(
                        session.getPlate(),
                        "EXPIRED");
            }
        }

        if (relevantTicket.isPresent() && relevantTicket.get().getValidUntil().isAfter(session.getTimeIn())
                && relevantTicket.get().getValidUntil().isBefore(com.pbms.common.utils.TimeProvider.now())) {
            if (session.getVehicleType() != null && relevantTicket.get().getVehicleType() != null
                    && session.getVehicleType().getId()
                            .equals(relevantTicket.get().getVehicleType().getId())) {
                feeStartTime = relevantTicket.get().getValidUntil();
            }
        }

        return feeStartTime;
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Truy xuất thông tin của một phiên đỗ xe (ParkingSession) đang diễn ra bằng thẻ RFID hoặc biển số xe.
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Nếu có mã RFID: Tìm ParkingSession đang ACTIVE hoặc LOCKED gắn với thẻ này.
     * 2. Nếu không có RFID mà có Biển số: Tìm danh sách phiên của biển số, lấy phiên đang ACTIVE hoặc LOCKED.
     * 3. Nếu không tìm thấy phiên hợp lệ -> Quăng lỗi (Throw Exception).
     * 4. Gọi hàm getCheckOutSessionInfo(session, now) để tính toán phí tới thời điểm hiện tại.
     */
    @Transactional(readOnly = true)
    public com.pbms.modules.operation.dto.CheckOutSessionInfoDTO getCheckOutSessionInfo(String rfid, String plate) {
        ParkingSession session = null;
        if (rfid != null && !rfid.isEmpty()) {
            session = sessionRepository.findByRfidCard_CardCodeAndStatus(rfid, "ACTIVE").orElse(null);
            if (session == null) {
                session = sessionRepository.findByRfidCard_CardCodeAndStatus(rfid, "LOCKED").orElse(null);
            }
        } else if (plate != null && !plate.isEmpty()) {
            java.util.List<ParkingSession> list = sessionRepository.findByPlateOrderByTimeInDesc(plate);
            for (ParkingSession s : list) {
                if ("ACTIVE".equals(s.getStatus()) || "LOCKED".equals(s.getStatus())) {
                    boolean hasLostDamaged = incidentTicketRepository.existsBySessionIdAndIssueTypeInAndStatusIn(
                            s.getId(),
                            java.util.Arrays.asList("LOST_CARD", "DAMAGED_CARD"),
                            java.util.Arrays.asList("PENDING", "WAITING_CHECKOUT"));
                    if (hasLostDamaged) {
                        session = s;
                        break;
                    }
                }
            }
        }

        if (session == null) {
            throw new IllegalArgumentException("No active parking session found for the provided vehicle");
        }

        return getCheckOutSessionInfo(session, com.pbms.common.utils.TimeProvider.now());
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Hàm cốt lõi để thu thập và tính toán mọi thông tin chi phí, phạt, quá giờ... để hiển thị lên màn hình thanh toán.
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Khởi tạo đối tượng InfoDTO và gán các thông tin cơ bản (Biển số, thẻ, hình ảnh...).
     * 2. Lấy tên khu vực xe đã đỗ (Zone) dựa vào ID gợi ý hoặc Booking.
     * 3. Xác định thời điểm bắt đầu tính phí (determineFeeStartTime) và tổng thời gian đậu xe (duration).
     * 4. Dựa vào loại khách (MONTHLY, PREBOOKED, WALK-IN) để tính Phí đậu xe và Phí quá giờ:
     *    - Khách vé tháng (MONTHLY) hoặc Đậu bãi vi phạm (IMPOUNDED) -> Phí = 0.
     *    - Khách đặt trước (PREBOOKED) -> Kiểm tra nếu thời gian ra trễ hơn thời gian Booking -> Tính phí quá giờ.
     *    - Khách vãng lai (WALK-IN) -> Gọi PricingCalculatorService tính phí theo block.
     *    - Khách vé tháng bị hết hạn giữa chừng -> Phân tách tính phí từ lúc hết hạn.
     * 5. Tổng hợp các phí phạt (Penalty) từ IncidentTickets.
     * 6. Tính tổng tiền (calculateTotalAmount) = Phí đậu xe + Phí quá giờ + Phí phạt - Giảm giá.
     * 7. Tạo mã JWT (CheckoutToken) an toàn dùng để khóa giá báo trong 5 phút.
     * 8. Trả về đối tượng InfoDTO chứa đầy đủ báo giá.
     */
    public com.pbms.modules.operation.dto.CheckOutSessionInfoDTO getCheckOutSessionInfo(ParkingSession session,
            java.time.LocalDateTime targetTime) {
        com.pbms.modules.operation.dto.CheckOutSessionInfoDTO info = new com.pbms.modules.operation.dto.CheckOutSessionInfoDTO();
        info.setPlateNumberIn(session.getPlate());
        info.setRfid(session.getRfidCard() != null ? session.getRfidCard().getCardCode() : "N/A");
        info.setVehicleType(session.getVehicleType() != null ? session.getVehicleType().getTypeName() : "UNKNOWN");
        String rfidCode = session.getRfidCard() != null ? session.getRfidCard().getCardCode() : null;
        String customerType = determineCustomerType(session.getPlate(), rfidCode, session.getVehicleType());
        info.setCustomerType(customerType);
        info.setPicInPanorama(session.getPicInPanorama());
        info.setPicInFace(session.getPicInFace());
        info.setTimeIn(session.getTimeIn());
        info.setStatus(session.getStatus());

        if (session.getSuggestedZoneId() != null) {
            zoneRepository.findById(session.getSuggestedZoneId())
                    .ifPresent(z -> info.setSuggestedZoneName(z.getZoneName()));
        } else if (session.getSuggestedZoneId() != null) {
            if (session.getSuggestedZoneId() == -1L) {
                info.setSuggestedZoneName("Free Zone");
            } else {
                info.setSuggestedZoneName(zoneRepository.findById(session.getSuggestedZoneId())
                        .map(zone -> zone.getZoneName()).orElse("N/A"));
            }
        } else if (session.getReservation() != null && session.getReservation().getZone() != null) {
            info.setSuggestedZoneName(session.getReservation().getZone().getZoneName());
        } else {
            info.setSuggestedZoneName("Free Zone");
        }

        java.time.LocalDateTime now = targetTime;
        java.time.LocalDateTime feeStartTime = determineFeeStartTime(session, rfidCode);
        long duration = java.time.Duration.between(session.getTimeIn(), now).toMinutes();
        if (duration < 0)
            duration = 0;
        info.setDurationMinutes(duration);
        info.setTimeOut(now);

        boolean isExemptZone = false;
        if (session.getSuggestedZoneId() != null) {
            com.pbms.modules.infrastructure.domain.Zone z = zoneRepository.findById(session.getSuggestedZoneId())
                    .orElse(null);
            if (z != null && "IMPOUNDED".equalsIgnoreCase(z.getFunctionType())) {
                isExemptZone = true;
            }
        }

        if ("MONTHLY".equals(customerType) || isExemptZone) {
            info.setExpectedFee(java.math.BigDecimal.ZERO);
            info.setOvertimeMinutes(0L);
            info.setOvertimeFee(java.math.BigDecimal.ZERO);
        } else if (session.getReservation() != null) {
            java.time.LocalDateTime bookedIn = session.getReservation().getExpectedEntryTime();
            java.time.LocalDateTime bookedOut = bookedIn
                    .plusMinutes(session.getReservation().getExpectedDurationMinutes());
            info.setBookedTimeIn(bookedIn);
            info.setBookedTimeOut(bookedOut);

            if (now.isAfter(bookedOut)) {
                long overtime = java.time.Duration.between(bookedOut, now).toMinutes();
                info.setOvertimeMinutes(overtime);
                if (session.getVehicleType() != null) {
                    try {
                        java.math.BigDecimal fee = pricingCalculatorService
                                .calculateParkingFee(session.getVehicleType().getId(), bookedOut, now);
                        info.setExpectedFee(java.math.BigDecimal.ZERO);
                        info.setOvertimeFee(fee);
                    } catch (Exception e) {
                        info.setExpectedFee(java.math.BigDecimal.ZERO);
                        info.setOvertimeFee(java.math.BigDecimal.ZERO);
                    }
                } else {
                    info.setExpectedFee(java.math.BigDecimal.ZERO);
                    info.setOvertimeFee(java.math.BigDecimal.ZERO);
                }
            } else {
                info.setOvertimeMinutes(0L);
                info.setExpectedFee(java.math.BigDecimal.ZERO);
                info.setOvertimeFee(java.math.BigDecimal.ZERO);
            }
        } else if (session.getVehicleType() != null) {
            try {
                java.math.BigDecimal fee = pricingCalculatorService.calculateParkingFee(
                        session.getVehicleType().getId(),
                        feeStartTime, now);
                log.info("CALCULATED FEE: " + fee + " for duration: " + duration);

                // If feeStartTime is strictly after session timeIn, it means the Monthly ticket
                // expired during the session
                if (feeStartTime.isAfter(session.getTimeIn())) {
                    info.setExpectedFee(java.math.BigDecimal.ZERO);
                    info.setOvertimeFee(fee);
                    info.setOvertimeMinutes(java.time.Duration.between(feeStartTime, now).toMinutes());
                    // Force UI to recognize as MONTHLY so it shows overtime nicely
                    info.setCustomerType("MONTHLY");
                } else {
                    info.setExpectedFee(fee);
                    info.setOvertimeFee(java.math.BigDecimal.ZERO);
                    info.setOvertimeMinutes(0L);
                }
            } catch (Exception e) {
                log.error("Error calculating fee for session " + session.getId(), e);
                info.setExpectedFee(java.math.BigDecimal.ZERO);
                info.setOvertimeFee(java.math.BigDecimal.ZERO);
                info.setOvertimeMinutes(0L);
            }
        } else {
            info.setExpectedFee(java.math.BigDecimal.ZERO);
            info.setOvertimeFee(java.math.BigDecimal.ZERO);
            info.setOvertimeMinutes(0L);
        }

        java.math.BigDecimal penaltyFee = incidentTicketRepository.findBySessionId(session.getId()).stream()
                .map(ticket -> ticket.getFineAmount())
                .filter(java.util.Objects::nonNull)
                .reduce(java.math.BigDecimal.ZERO, (a, b) -> a.add(b));

        if (session.getDiscount() != null) {
            info.setDiscountFee(session.getDiscount());
        } else {
            info.setDiscountFee(java.math.BigDecimal.ZERO);
        }

        info.setFeePenalty(penaltyFee);

        java.math.BigDecimal totalAmountForToken = calculateTotalAmount(info);
        String token = jwtProvider.generateCheckoutToken(String.valueOf(session.getId()),
                totalAmountForToken.doubleValue());
        info.setCheckoutToken(token);
        info.setExpiresInSeconds(300L); // 5 minutes

        return info;
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Tính toán số tiền cuối cùng (Tổng hóa đơn) khách hàng phải trả dựa trên các loại phí.
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Đảm bảo các giá trị phí (ExpectedFee, OvertimeFee, PenaltyFee, Discount) không bị null (mặc định là 0).
     * 2. Công thức: Tổng tiền = (Phí dự kiến + Phí quá giờ + Phí phạt) - Giảm giá.
     * 3. Nếu tổng tiền bị âm -> Trả về 0.
     * 4. Trả về tổng tiền.
     */
    public java.math.BigDecimal calculateTotalAmount(com.pbms.modules.operation.dto.CheckOutSessionInfoDTO info) {
        java.math.BigDecimal parkingFee = info.getExpectedFee() != null ? info.getExpectedFee()
                : java.math.BigDecimal.ZERO;
        java.math.BigDecimal overtimeFee = info.getOvertimeFee() != null ? info.getOvertimeFee()
                : java.math.BigDecimal.ZERO;
        java.math.BigDecimal penaltyFee = info.getFeePenalty() != null ? info.getFeePenalty()
                : java.math.BigDecimal.ZERO;
        java.math.BigDecimal discount = info.getDiscountFee() != null ? info.getDiscountFee()
                : java.math.BigDecimal.ZERO;

        java.math.BigDecimal finalAmount = parkingFee.add(overtimeFee).add(penaltyFee).subtract(discount);
        if (finalAmount.compareTo(java.math.BigDecimal.ZERO) < 0) {
            finalAmount = java.math.BigDecimal.ZERO;
        }
        return finalAmount;
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Xử lý luồng Check-IN chính thức yêu cầu lưu trữ dữ liệu xe vào DB khi nhân viên bấm "Xác nhận".
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Xác thực thông tin: Tìm Cổng (Gate), Loại xe, Ca trực của nhân viên (Active Session).
     * 2. Nếu cổng không có người trực, loại cổng sai (phải là cổng IN), thiếu loại xe -> Quăng lỗi.
     * 3. Kiểm tra Thẻ RFID: Thẻ phải tồn tại và đang ở trạng thái AVAILABLE (chưa dùng).
     * 4. Ngăn chặn trùng lặp: Kiểm tra biển số xe này đã ở trong bãi chưa. Nếu có -> Lỗi.
     * 5. Kiểm tra Biển số Đen (Blacklist): Nếu xe nằm trong sổ đen -> Ghi nhớ cờ Blacklist, và tự động gỡ cờ để xe vào (vì sẽ phạt vào phiên này).
     * 6. Khởi tạo đối tượng ParkingSession (Lưu thời gian, hình ảnh, biển số...).
     * 7. Cập nhật thẻ RFID sang trạng thái IN_USE. Lưu session vào Database.
     * 8. Nếu xe bị Blacklist: Tạo mới/cập nhật các vé phạt (IncidentTicket) để truy thu khi khách ra khỏi bãi.
     * 9. Xử lý Đặt chỗ (Booking): Nếu có Booking, đổi trạng thái sang ACTIVE, gửi thông báo báo có xe Booking tới.
     * 10. Trả về kết quả thành công cho Client.
     */
    @Transactional
    public GateResponseDTO processCheckIn(CheckInRequestDTO request) {
        Gate gate = gateRepository.findById(request.getGateId())
                .orElseThrow(() -> new IllegalArgumentException("Gate not found"));

        VehicleType type = null;
        if (request.getVehicleTypeId() != null) {
            type = vehicleTypeRepository.findById(request.getVehicleTypeId()).orElse(null);
        }
        if (type == null && request.getVehicleType() != null) {
            type = vehicleTypeRepository.findByTypeName(request.getVehicleType()).orElse(null);
        }

        Zone suggestedZone = null;
        String customerType = determineCustomerType(request.getPlateNumber(), request.getRfid(), type);
        List<Reservation> reservations = java.util.Collections.emptyList();
        String earlyBookingNotice = null;

        if (type != null) {
            reservations = getValidPendingReservations(request.getPlateNumber());
            if (!reservations.isEmpty()) {
                if (!reservations.get(0).getVehicle().getVehicleType().getId().equals(type.getId())) {
                    return GateResponseDTO.builder().status("ERROR").message(
                            "Loại phương tiện AI nhận diện không khớp với Đơn đặt chỗ (Booking). Vui lòng kiểm tra lại.")
                            .build();
                }
                suggestedZone = reservations.get(0).getZone();
                if (zoneRoutingService.isZonePhysicallyFull(suggestedZone.getId())) {
                    log.info("Reserved zone {} is physically full, routing to fallback zone.",
                            suggestedZone.getZoneName());
                    suggestedZone = zoneRoutingService.suggestZone(type, customerType, gate.getFloor());
                }
            } else {
                final Long targetTypeId = type.getId();
                List<Reservation> allPending = reservationRepository
                        .findByVehicle_PlateNumberAndStatus(request.getPlateNumber(), "PENDING")
                        .stream()
                        .filter(r -> r.getVehicle().getVehicleType().getId().equals(targetTypeId))
                        .collect(java.util.stream.Collectors.toList());
                if (!allPending.isEmpty()) {
                    Reservation earliest = allPending.stream()
                            .min(java.util.Comparator.comparing(r -> r.getExpectedEntryTime())).orElse(null);
                    if (earliest != null) {
                        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                                .ofPattern("HH:mm");
                        earlyBookingNotice = "Notice: This vehicle has a booking at "
                                + earliest.getExpectedEntryTime().format(formatter) + " but it is not time yet.";
                    }
                }
                suggestedZone = zoneRoutingService.suggestZone(type, customerType, gate.getFloor());
            }
        }

        if ("Free".equalsIgnoreCase(request.getSuggestedZoneName())) {
            suggestedZone = null;
        }

        if (!"Free".equalsIgnoreCase(request.getSuggestedZoneName())) {
            if (suggestedZone != null) {
                request.setSuggestedZoneName(suggestedZone.getZoneName());
                request.setSuggestedZoneId(suggestedZone.getId());
            } else {
                request.setSuggestedZoneName("Free");
                request.setSuggestedZoneId(null);
            }
        } else {
            request.setSuggestedZoneId(null);
        }

        messagingTemplate.convertAndSend("/topic/gates/" + gate.getId() + "/scans", request);

        StaffWorkSession activeSession = staffWorkSessionRepository.findByGateIdAndStatus(gate.getId(), "ACTIVE")
                .orElse(null);
        if (activeSession == null) {
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Gate is inactive (no staff on duty)")
                    .build();
        }



        if (type == null) {
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Invalid vehicle type")
                    .build();
        }

        if ("INACTIVE".equals(type.getStatus())) {
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Vehicle type is blocked/inactive")
                    .build();
        }

        RfidCard card = rfidCardRepository.findByCardCode(request.getRfid()).orElse(null);
        if (card == null) {
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Invalid or missing RFID card")
                    .build();
        }

        if (!"AVAILABLE".equals(card.getStatus())) {
            String statusVN = "LOST".equals(card.getStatus()) ? "Đã bị báo mất"
                    : ("DAMAGED".equals(card.getStatus()) ? "Đã bị báo hỏng" : "Không hợp lệ");
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Thẻ RFID " + statusVN
                            + ". Không thể mở cổng. Vui lòng liên hệ Quản lý (Manager) để xử lý thẻ này!")
                    .build();
        }

        String plate = request.getPlateNumber();
        if (plate == null || plate.isBlank()) {
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Plate number is required")
                    .build();
        }

        // Rule: Duplicate Entry Prevention
        List<ParkingSession> existingSessions = sessionRepository.findByPlateAndVehicleTypeIdAndStatus(plate,
                type.getId(), "ACTIVE");
        if (!existingSessions.isEmpty()) {
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Phương tiện có cùng biển số và loại xe đã ở trong bãi")
                    .build();
        }

        boolean[] isBlacklistedRef = { false };
        vehicleRepository.findByPlateNumber(request.getPlateNumber()).ifPresent(v -> {
            if (Boolean.TRUE.equals(v.getIsBlacklisted())) {
                isBlacklistedRef[0] = true;

                // Theo yêu cầu: Tự động gỡ cờ blacklist ngay khi check-in vì đã áp phí phạt vào
                // session
                v.setIsBlacklisted(false);
                vehicleRepository.save(v);
            }
        });

        Reservation activeRes = null;
        if (!reservations.isEmpty()) {
            activeRes = reservations.get(0);
        }

        ParkingSession session = ParkingSession.builder()
                .gateIn(gate)
                .plate(request.getPlateNumber())
                .vehicleType(type)
                .rfidCard(card)
                .timeIn(com.pbms.common.utils.TimeProvider.now())
                .picInPanorama(fileStorageService.storeBase64File(request.getImageBase64()))
                .picInFace(fileStorageService.storeBase64File(request.getLprImageBase64()))
                .reservation(activeRes)
                .suggestedZoneId(suggestedZone != null ? suggestedZone.getId() : null)
                .status("ACTIVE")
                .build();

        card.setStatus("IN_USE");
        card.setAssignedPlate(request.getPlateNumber());
        rfidCardRepository.save(card);

        session = sessionRepository.save(session);

        if (isBlacklistedRef[0]) {
            java.util.List<com.pbms.modules.incident.domain.IncidentTicket> oldTickets = incidentTicketRepository
                    .findBySessionPlateAndVehicleTypeIdAndStatus(request.getPlateNumber(), type.getId(),
                            "WAITING_CHECKOUT");

            java.math.BigDecimal penaltyFeeToAdd = java.math.BigDecimal.ZERO;
            boolean hasBlacklistViolation = false;

            for (com.pbms.modules.incident.domain.IncidentTicket oldTicket : oldTickets) {
                if ("BLACKLIST_VIOLATION".equals(oldTicket.getIssueType())) {
                    hasBlacklistViolation = true;
                }
                oldTicket.setSession(session);
                saveAndBroadcast(oldTicket);
                penaltyFeeToAdd = penaltyFeeToAdd
                        .add(oldTicket.getFineAmount() != null ? oldTicket.getFineAmount() : java.math.BigDecimal.ZERO);
            }

            if (!hasBlacklistViolation) {
                java.math.BigDecimal penaltyFee;
                try {
                    boolean is2W = type != null && "TWO_WHEEL".equals(type.getCategory());
                    String configKey = is2W ? "PENALTY_BLACKLIST_UNPAID_2W" : "PENALTY_BLACKLIST_UNPAID_4W";
                    penaltyFee = new java.math.BigDecimal(
                            systemConfigService.getConfigByKey(configKey).getConfigValue());
                } catch (Exception e) {
                    penaltyFee = new java.math.BigDecimal("500000");
                }

                com.pbms.modules.incident.domain.IncidentTicket ticket = com.pbms.modules.incident.domain.IncidentTicket
                        .builder()
                        .session(session)
                        .issueType("BLACKLIST_VIOLATION")
                        .priority("HIGH")
                        .status("WAITING_CHECKOUT")
                        .fineAmount(penaltyFee)
                        .build();
                saveAndBroadcast(ticket);
                penaltyFeeToAdd = penaltyFeeToAdd.add(penaltyFee);
            }

            if (penaltyFeeToAdd.compareTo(java.math.BigDecimal.ZERO) > 0) {
                java.math.BigDecimal currentPenalty = session.getPenaltyFee() != null ? session.getPenaltyFee()
                        : java.math.BigDecimal.ZERO;
                session.setPenaltyFee(currentPenalty.add(penaltyFeeToAdd));
                sessionRepository.save(session);
            }
        }

        if (activeRes != null) {
            activeRes.setStatus("ACTIVE");
            if (suggestedZone != null && !suggestedZone.getId().equals(activeRes.getZone().getId())) {
                activeRes.setZone(suggestedZone);
            }
            reservationRepository.save(activeRes);

            String arrivedPlate = activeRes.getVehicle() != null ? activeRes.getVehicle().getPlateNumber() : "N/A";
            String arrivedZone = activeRes.getZone() != null ? activeRes.getZone().getZoneName() : "N/A";
            messagingTemplate.convertAndSend("/topic/staff/notifications",
                    String.format(
                            "{\"type\":\"ZONE_RESERVED\", \"reservationId\":%d, \"plate\":\"%s\", \"zoneName\":\"%s\", \"message\":\"Vehicle arrived.\"}",
                            activeRes.getId(), arrivedPlate, arrivedZone));
        }

        GateResponseDTO response = GateResponseDTO.builder()
                .sessionId(session.getId())
                .plateNumber(session.getPlate())
                .status(isBlacklistedRef[0] ? "WARNING" : "SUCCESS")
                .message(isBlacklistedRef[0] ? "Vehicle has evaded before. Penalty added to session."
                        : "Check-in successful")
                .suggestedZoneId(suggestedZone != null ? suggestedZone.getId() : null)
                .suggestedZoneName(suggestedZone != null ? suggestedZone.getZoneName() : null)
                .earlyBookingNotice(earlyBookingNotice)
                .build();

        return response;
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Xử lý luồng Check-OUT chính thức, hoàn thành giao dịch thanh toán và đóng phiên đỗ xe khi nhân viên bấm "Xác nhận".
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Xác thực thông tin: Kiểm tra Gate, Ca trực của nhân viên, loại cổng (phải là cổng OUT).
     * 2. Tìm Phiên đỗ xe (ParkingSession) bằng mã thẻ RFID.
     * 3. Kiểm tra các sự kiện bất thường (Incident): Mất thẻ, hư thẻ chưa đóng phí phạt -> Chặn cổng, không cho ra.
     * 4. Kiểm tra xem Token báo giá (CheckoutToken) có hợp lệ, khớp với SessionId và chưa hết hạn không. Nếu thanh toán tiền mặt mà Token hết hạn/lệch giá -> Lỗi, yêu cầu báo giá lại.
     * 5. Cập nhật hình ảnh, thời gian ra, cổng ra vào ParkingSession.
     * 6. Tính toán chốt phí: Lấy thông tin giá, áp dụng giảm giá (trừ tiền gốc trước, trừ phụ phí sau).
     * 7. Đóng các vé phạt (IncidentTicket) đang chờ thanh toán sang trạng thái RESOLVED. Nếu xe từng bị Blacklist -> Gỡ Blacklist trong hồ sơ xe.
     * 8. Tạo Transaction (Giao dịch tài chính) lưu hóa đơn.
     * 9. Giải phóng thẻ RFID về trạng thái AVAILABLE. Đổi trạng thái Booking về COMPLETED (nếu có).
     * 10. Bắn WebSocket thông báo cổng mở và trả về kết quả thành công.
     */
    @Transactional
    public GateResponseDTO processCheckOut(CheckOutRequestDTO request) {
        Gate gate = gateRepository.findById(request.getGateId())
                .orElseThrow(() -> new IllegalArgumentException("Gate not found"));

        messagingTemplate.convertAndSend("/topic/gates/" + gate.getId() + "/scans", request);

        StaffWorkSession activeSession = staffWorkSessionRepository.findByGateIdAndStatus(gate.getId(), "ACTIVE")
                .orElse(null);
        if (activeSession == null) {
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Gate is inactive (no staff on duty)")
                    .build();
        }



        ParkingSession session = null;
        if (request.getRfid() != null && !request.getRfid().isEmpty()) {
            session = sessionRepository
                    .findByRfidCard_CardCodeAndStatusIn(request.getRfid(), java.util.Arrays.asList("ACTIVE"))
                    .orElse(null);
        } else if (request.getPlateNumber() != null && !request.getPlateNumber().isEmpty()) {
            java.util.List<ParkingSession> list = sessionRepository.findByPlateOrderByTimeInDesc(request.getPlateNumber());
            for (ParkingSession s : list) {
                if ("ACTIVE".equals(s.getStatus())) {
                    boolean hasLostDamaged = incidentTicketRepository.existsBySessionIdAndIssueTypeInAndStatusIn(
                            s.getId(),
                            java.util.Arrays.asList("LOST_CARD", "DAMAGED_CARD"),
                            java.util.Arrays.asList("PENDING", "WAITING_CHECKOUT"));
                    if (hasLostDamaged) {
                        session = s;
                        break;
                    }
                }
            }
        }
        if (session == null) {
            throw new IllegalArgumentException("No active session found for this card or missing lost/damaged card report for this plate");
        }

        RfidCard card = session.getRfidCard();

        if (!session.getPlate().equals(request.getPlateNumber())) {
            return GateResponseDTO.builder()
                    .sessionId(session.getId())
                    .plateNumber(request.getPlateNumber())
                    .status("WARNING")
                    .message("Plate number mismatch! Expected: " + session.getPlate() + ", Actual: "
                            + request.getPlateNumber())
                    .build();
        }

        session.setGateOut(gate);
        java.time.LocalDateTime checkOutTime = com.pbms.common.utils.TimeProvider.now();
        if (request.getCheckoutToken() != null && !request.getCheckoutToken().isEmpty()) {
            try {
                io.jsonwebtoken.Claims claims = jwtProvider.getCheckoutClaims(request.getCheckoutToken());
                if (!String.valueOf(session.getId()).equals(claims.get("sessionId", String.class))) {
                    throw new IllegalArgumentException("Token không khớp với phiên đỗ xe hiện tại.");
                }
                java.util.Date iat = claims.getIssuedAt();
                checkOutTime = java.time.LocalDateTime.ofInstant(iat.toInstant(), java.time.ZoneId.systemDefault());
            } catch (io.jsonwebtoken.ExpiredJwtException e) {
                if (!"CASH".equalsIgnoreCase(request.getPaymentMethod())) {
                    io.jsonwebtoken.Claims claims = e.getClaims();
                    checkOutTime = java.time.LocalDateTime.ofInstant(claims.getIssuedAt().toInstant(),
                            java.time.ZoneId.systemDefault());
                } else {
                    throw new IllegalArgumentException(
                            "Báo giá đã hết hạn. Vui lòng làm mới trang (refresh) để xem báo giá mới nhất.");
                }
            } catch (Exception e) {
                throw new IllegalArgumentException("Token báo giá không hợp lệ: " + e.getMessage());
            }
        }
        session.setTimeOut(checkOutTime);
        session.setPlateOut(request.getPlateNumber());
        session.setPicOutPanorama(fileStorageService.storeBase64File(request.getImageBase64()));
        session.setPicOutFace(fileStorageService.storeBase64File(request.getLprImageBase64()));

        boolean isMonthlyCovered = false;
        MonthlyTicket monthlyTicket = monthlyTicketRepository
                .findByPlateNumberAndStatus(session.getPlate(), "ACTIVE")
                .orElse(null);
        if (monthlyTicket != null && monthlyTicket.getValidUntil().isAfter(com.pbms.common.utils.TimeProvider.now())) {
            if (monthlyTicket.getVehicleType().getId().equals(session.getVehicleType().getId())) {
                isMonthlyCovered = true;
            }
        }

        BigDecimal fee = BigDecimal.ZERO;
        BigDecimal overtimeFee = BigDecimal.ZERO;
        Long overtimeMinutes = 0L;

        if (!isMonthlyCovered) {
            if (request.getParkingFee() != null) {
                // If FE sends explicit fee, assume it's expectedFee (or combined).
                // We'll recalculate exactly to properly split it.
            }

            if (session.getReservation() != null) {
                java.time.LocalDateTime bookedIn = session.getReservation().getExpectedEntryTime();
                java.time.LocalDateTime bookedOut = bookedIn
                        .plusMinutes(session.getReservation().getExpectedDurationMinutes());
                if (session.getTimeOut().isAfter(bookedOut)) {
                    overtimeFee = pricingCalculatorService.calculateParkingFee(session.getVehicleType().getId(),
                            bookedOut,
                            session.getTimeOut());
                    overtimeMinutes = java.time.Duration.between(bookedOut, session.getTimeOut()).toMinutes();
                }
            } else {
                String rfidCode = (request.getRfid() != null) ? request.getRfid()
                        : (session.getRfidCard() != null ? session.getRfidCard().getCardCode() : null);

                java.time.LocalDateTime feeStartTime = determineFeeStartTime(session, rfidCode);

                if (feeStartTime.isAfter(session.getTimeIn())) {
                    // Monthly expired mid-session
                    overtimeFee = pricingCalculatorService.calculateParkingFee(session.getVehicleType().getId(),
                            feeStartTime,
                            session.getTimeOut());
                    overtimeMinutes = java.time.Duration.between(feeStartTime, session.getTimeOut()).toMinutes();
                } else {
                    // Walk-in
                    fee = pricingCalculatorService.calculateParkingFee(session.getVehicleType().getId(), feeStartTime,
                            session.getTimeOut());
                }
            }
        }

        BigDecimal penaltyFee = BigDecimal.ZERO;
        List<com.pbms.modules.incident.domain.IncidentTicket> waitingTickets = incidentTicketRepository
                .findBySessionId(session.getId()).stream()
                .filter(t -> "WAITING_CHECKOUT".equals(t.getStatus()) ||
                        ("PENDING".equals(t.getStatus()) && "OVERSTAY".equals(t.getIssueType())))
                .collect(java.util.stream.Collectors.toList());

        for (com.pbms.modules.incident.domain.IncidentTicket t : waitingTickets) {
            if (t.getFineAmount() != null) {
                penaltyFee = penaltyFee.add(t.getFineAmount());
            }
            t.setStatus("RESOLVED");
            t.setResolutionNotes("OVERSTAY".equals(t.getIssueType()) ? "Tự động đóng do xe đã xuất bãi thành công"
                    : "Resolved on checkout");
            t.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
            saveAndBroadcast(t);

            if ("BLACKLIST_VIOLATION".equals(t.getIssueType())) {
                final String currentPlate = session.getPlate();
                vehicleRepository.findByPlateNumber(currentPlate).ifPresent(v -> {
                    v.setIsBlacklisted(false);
                    vehicleRepository.save(v);
                    log.info("Vehicle {} removed from blacklist upon check-out", currentPlate);
                });
            }
        }

        if (session.getDiscount() != null && session.getDiscount().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal remainingDiscount = session.getDiscount();

            // Subtract from fee first
            if (fee.compareTo(remainingDiscount) >= 0) {
                fee = fee.subtract(remainingDiscount);
                remainingDiscount = BigDecimal.ZERO;
            } else {
                remainingDiscount = remainingDiscount.subtract(fee);
                fee = BigDecimal.ZERO;
            }

            // Subtract from overtimeFee if any discount left
            if (remainingDiscount.compareTo(BigDecimal.ZERO) > 0) {
                if (overtimeFee.compareTo(remainingDiscount) >= 0) {
                    overtimeFee = overtimeFee.subtract(remainingDiscount);
                } else {
                    overtimeFee = BigDecimal.ZERO;
                }
            }
        }

        BigDecimal totalParkingFee = fee.add(overtimeFee);

        session.setParkingFee(fee); // Save net base fee
        session.setOvertimeFee(overtimeFee); // Save net overtime fee
        session.setOvertimeMinutes(overtimeMinutes);
        session.setPenaltyFee(penaltyFee);
        session.setStatus("COMPLETED");

        if (card != null) {
            boolean isLost = waitingTickets.stream().anyMatch(t -> "LOST_CARD".equals(t.getIssueType()));
            boolean isDamaged = waitingTickets.stream().anyMatch(t -> "DAMAGED_CARD".equals(t.getIssueType()));
            
            if (isLost) {
                card.setStatus("LOST");
            } else if (isDamaged) {
                card.setStatus("DAMAGED");
            } else {
                card.setStatus("AVAILABLE");
            }
            card.setAssignedPlate(null);
            rfidCardRepository.save(card);
        }

        sessionRepository.save(session);

        BigDecimal totalAmount = totalParkingFee.add(penaltyFee);

        if (request.getCheckoutToken() != null && !request.getCheckoutToken().isEmpty()) {
            if ("CASH".equalsIgnoreCase(request.getPaymentMethod())) {
                try {
                    io.jsonwebtoken.Claims claims = jwtProvider.getCheckoutClaims(request.getCheckoutToken());
                    Double expectedFeeDouble = claims.get("expectedFee", Double.class);
                    if (expectedFeeDouble != null && totalAmount.subtract(BigDecimal.valueOf(expectedFeeDouble)).abs()
                            .compareTo(BigDecimal.ONE) > 0) {
                        throw new IllegalArgumentException("Phí thanh toán thực tế đã thay đổi thành "
                                + String.format("%,d", totalAmount.longValue())
                                + " VNĐ. Vui lòng làm mới trang (refresh) để xem báo giá mới nhất.");
                    }
                } catch (Exception e) {
                    // Already caught above
                }
            }
        } else if (request.getParkingFee() != null) {
            if ("CASH".equalsIgnoreCase(request.getPaymentMethod())
                    && totalAmount.subtract(request.getParkingFee()).abs().compareTo(BigDecimal.ONE) > 0) {
                throw new IllegalArgumentException(
                        "Phí thanh toán thực tế đã thay đổi thành " + String.format("%,d", totalAmount.longValue())
                                + " VNĐ. Vui lòng làm mới trang (refresh) để xem báo giá mới nhất.");
            }
        }
        if (totalAmount.compareTo(BigDecimal.ZERO) > 0) {
            String payMethod = request.getPaymentMethod() != null ? request.getPaymentMethod().toUpperCase() : "CASH";

            com.pbms.modules.identity.domain.StaffWorkSession activeWorkSession = staffWorkSessionRepository
                    .findByGateIdAndStatus(request.getGateId(), "ACTIVE").orElse(null);

            com.pbms.modules.finance.domain.PaymentOrder po = null;
            if (request.getPaymentOrderId() != null) {
                po = new com.pbms.modules.finance.domain.PaymentOrder();
                po.setId(request.getPaymentOrderId());
            }

            Transaction transaction = Transaction.builder()
                    .parkingSession(session)
                    .workSession(activeWorkSession)
                    .paymentOrder(po)
                    .amount(totalAmount)
                    .paymentMethod(payMethod)
                    .status("SUCCESS")
                    .transactionReference("TXN-" + session.getId() + "-"
                            + com.pbms.common.utils.TimeProvider.now().toInstant(java.time.ZoneOffset.UTC)
                                    .toEpochMilli())
                    .build();
            transactionRepository.save(transaction);
            log.info("Transaction recorded: {} {} via {}", totalAmount, "VND", payMethod);
        }

        List<Reservation> activeRes = reservationRepository.findByVehicle_PlateNumberAndStatus(request.getPlateNumber(),
                "ACTIVE");
        if (!activeRes.isEmpty()) {
            Reservation res = activeRes.get(0);
            res.setStatus("COMPLETED");
            reservationRepository.save(res);
        }

        GateResponseDTO response = GateResponseDTO.builder()
                .sessionId(session.getId())
                .plateNumber(session.getPlateOut())
                .status("SUCCESS")
                .checkoutFee(totalAmount)
                .message("Checkout successful")
                .build();
        messagingTemplate.convertAndSend("/topic/gates/" + request.getGateId() + "/out", response);
        return response;
    }

    /**
     * MỤC ĐÍCH CỦA HÀM:
     * Lưu thông tin vé phạt/sự cố vào Database và thông báo cho toàn hệ thống cập nhật lại danh sách.
     * 
     * MÃ GIẢ CHI TIẾT:
     * 1. Lưu đối tượng IncidentTicket vào CSDL thông qua Repository.
     * 2. Gửi tín hiệu WebSocket '/topic/alerts' thông báo tới tất cả nhân viên.
     * 3. Bắt và log lỗi nếu quá trình gửi WebSocket thất bại (không làm sập luồng chính).
     * 4. Trả về IncidentTicket vừa được lưu.
     */
    private com.pbms.modules.incident.domain.IncidentTicket saveAndBroadcast(
            com.pbms.modules.incident.domain.IncidentTicket ticket) {
        com.pbms.modules.incident.domain.IncidentTicket saved = incidentTicketRepository.save(ticket);
        try {
            messagingTemplate.convertAndSend("/topic/alerts",
                    "{\"type\":\"INCIDENT_UPDATE\",\"message\":\"Danh sách sự cố vừa được cập nhật.\"}");
        } catch (Exception e) {
            log.error("Failed to broadcast incident update", e);
        }
        return saved;
    }
}
