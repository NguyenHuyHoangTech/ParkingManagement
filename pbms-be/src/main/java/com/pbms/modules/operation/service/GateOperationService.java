
package com.pbms.modules.operation.service;

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

    private final SystemConfigService systemConfigService;

    private final com.pbms.common.service.FileStorageService fileStorageService;

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

    private String determineCustomerType(String plate, String rfid, VehicleType type) {
        java.time.LocalDateTime now = com.pbms.common.utils.TimeProvider.now();
        if (plate != null && !plate.trim().isEmpty()) {
            Optional<MonthlyTicket> mt = monthlyTicketRepository.findByPlateAndStatus(plate, "ACTIVE");
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
        if (rfid != null && !rfid.trim().isEmpty()) {
            Optional<MonthlyTicket> mt = monthlyTicketRepository.findByRfidCard_CardCodeAndStatus(rfid, "ACTIVE");
            if (mt.isPresent() && mt.get().getValidUntil().isAfter(now)) {
                if (type == null || (mt.get().getVehicleType() != null
                        && mt.get().getVehicleType().getId().equals(type.getId()))) {
                    return "MONTHLY";
                }
            }
        }
        return "WALK-IN";
    }

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
        String blacklistReason = null;
        if (request.getPlateNumber() != null) {
            java.util.Optional<com.pbms.modules.operation.domain.Vehicle> vOpt = vehicleRepository.findByPlateNumber(request.getPlateNumber());
            if (vOpt.isPresent() && Boolean.TRUE.equals(vOpt.get().getIsBlacklisted())) {
                isBlacklisted = true;
                blacklistReason = vOpt.get().getBlacklistReason();
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
                .blacklistReason(blacklistReason)
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

    private java.time.LocalDateTime determineFeeStartTime(ParkingSession session, String rfidCode) {
        java.time.LocalDateTime feeStartTime = session.getTimeIn();
        java.util.Optional<com.pbms.modules.operation.domain.MonthlyTicket> relevantTicket = java.util.Optional.empty();

        if (session.getPlate() != null && !session.getPlate().isEmpty()) {
            relevantTicket = monthlyTicketRepository.findByPlateAndStatus(session.getPlate(), "ACTIVE");
            if (relevantTicket.isEmpty()) {
                relevantTicket = monthlyTicketRepository.findTopByPlateAndStatusOrderByUpdatedAtDesc(session.getPlate(),
                        "EXPIRED");
            }
        }
        if (relevantTicket.isEmpty() && rfidCode != null && !rfidCode.isEmpty()) {
            relevantTicket = monthlyTicketRepository.findByRfidCard_CardCodeAndStatus(rfidCode, "ACTIVE");
            if (relevantTicket.isEmpty()) {
                relevantTicket = monthlyTicketRepository
                        .findTopByRfidCard_CardCodeAndStatusOrderByUpdatedAtDesc(rfidCode, "EXPIRED");
            }
        }

        if (relevantTicket.isPresent() && relevantTicket.get().getValidUntil().isAfter(session.getTimeIn())
                && relevantTicket.get().getValidUntil().isBefore(com.pbms.common.utils.TimeProvider.now())) {
            if (session.getVehicleType() != null && relevantTicket.get().getVehicleType() != null
                    && session.getVehicleType().getId().equals(relevantTicket.get().getVehicleType().getId())) {
                feeStartTime = relevantTicket.get().getValidUntil();
            }
        }

        return feeStartTime;
    }

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
                    session = s;
                    break;
                }
            }
        }

        if (session == null) {
            throw new IllegalArgumentException("No active parking session found for the provided vehicle");
        }

        return getCheckOutSessionInfo(session, com.pbms.common.utils.TimeProvider.now());
    }

    public com.pbms.modules.operation.dto.CheckOutSessionInfoDTO getCheckOutSessionInfo(ParkingSession session, java.time.LocalDateTime targetTime) {
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

        if (session.getSlot() != null && session.getSlot().getZone() != null) {
            info.setSuggestedZoneName(session.getSlot().getZone().getZoneName());
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
        if (session.getSlot() != null && session.getSlot().getZone() != null) {
            String fType = session.getSlot().getZone().getFunctionType();
            if ("IMPOUNDED".equalsIgnoreCase(fType)) {
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
                                .calculateTotalFee(session.getVehicleType().getId(), bookedOut, now);
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
                java.math.BigDecimal fee = pricingCalculatorService.calculateTotalFee(session.getVehicleType().getId(),
                        feeStartTime, now);
                log.info("CALCULATED FEE: " + fee + " for duration: " + duration);
                
                // If feeStartTime is strictly after session timeIn, it means the Monthly ticket expired during the session
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
        String token = jwtProvider.generateCheckoutToken(String.valueOf(session.getId()), totalAmountForToken.doubleValue());
        info.setCheckoutToken(token);
        info.setExpiresInSeconds(300L); // 5 minutes

        return info;
    }

    public java.math.BigDecimal calculateTotalAmount(com.pbms.modules.operation.dto.CheckOutSessionInfoDTO info) {
        java.math.BigDecimal parkingFee = info.getExpectedFee() != null ? info.getExpectedFee() : java.math.BigDecimal.ZERO;
        java.math.BigDecimal overtimeFee = info.getOvertimeFee() != null ? info.getOvertimeFee() : java.math.BigDecimal.ZERO;
        java.math.BigDecimal penaltyFee = info.getFeePenalty() != null ? info.getFeePenalty() : java.math.BigDecimal.ZERO;
        java.math.BigDecimal discount = info.getDiscountFee() != null ? info.getDiscountFee() : java.math.BigDecimal.ZERO;
        
        java.math.BigDecimal finalAmount = parkingFee.add(overtimeFee).add(penaltyFee).subtract(discount);
        if (finalAmount.compareTo(java.math.BigDecimal.ZERO) < 0) {
            finalAmount = java.math.BigDecimal.ZERO;
        }
        return finalAmount;
    }


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

        if ("Free".equalsIgnoreCase(request.getSuggestedZoneName())) {
            suggestedZone = null;
        } else if (type != null) {
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

        if (!"IN".equals(gate.getGateType()) && !"ENTRY".equals(gate.getGateType())
                && !"IN_OUT".equals(gate.getGateType())) {
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Invalid gate type for check-in")
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
            String statusVN = "LOST".equals(card.getStatus()) ? "Đã bị báo mất" : ("DAMAGED".equals(card.getStatus()) ? "Đã bị báo hỏng" : "Không hợp lệ");
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Thẻ RFID " + statusVN + ". Không thể mở cổng. Vui lòng liên hệ Quản lý (Manager) để xử lý thẻ này!")
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
        String[] blacklistReasonRef = { "" };
        vehicleRepository.findByPlateNumber(request.getPlateNumber()).ifPresent(v -> {
            if (Boolean.TRUE.equals(v.getIsBlacklisted())) {
                isBlacklistedRef[0] = true;
                blacklistReasonRef[0] = v.getBlacklistReason();

                // Theo yêu cầu: Tự động gỡ cờ blacklist ngay khi check-in vì đã áp phí phạt vào session
                v.setIsBlacklisted(false);
                v.setBlacklistReason(null);
                v.setBlacklistEvidenceUrl(null);
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
                .findBySessionPlateAndVehicleTypeIdAndStatus(request.getPlateNumber(), type.getId(), "WAITING_CHECKOUT");
            
            java.math.BigDecimal penaltyFeeToAdd = java.math.BigDecimal.ZERO;
            boolean hasBlacklistViolation = false;
            
            for (com.pbms.modules.incident.domain.IncidentTicket oldTicket : oldTickets) {
                if ("BLACKLIST_VIOLATION".equals(oldTicket.getIssueType())) {
                    hasBlacklistViolation = true;
                }
                oldTicket.setSession(session);
                saveAndBroadcast(oldTicket);
                penaltyFeeToAdd = penaltyFeeToAdd.add(oldTicket.getFineAmount() != null ? oldTicket.getFineAmount() : java.math.BigDecimal.ZERO);
            }
            
            if (!hasBlacklistViolation) {
                java.math.BigDecimal penaltyFee;
                try {
                    boolean is2W = type != null && "TWO_WHEEL".equals(type.getCategory());
                    String configKey = is2W ? "PENALTY_BLACKLIST_UNPAID_2W" : "PENALTY_BLACKLIST_UNPAID_4W";
                    penaltyFee = new java.math.BigDecimal(systemConfigService.getConfigByKey(configKey).getConfigValue());
                } catch (Exception e) {
                    penaltyFee = new java.math.BigDecimal("500000");
                }

                com.pbms.modules.incident.domain.IncidentTicket ticket = com.pbms.modules.incident.domain.IncidentTicket
                        .builder()
                        .session(session)
                        .issueType("BLACKLIST_VIOLATION")
                        .priority("HIGH")
                        .description("Vehicle is blacklisted: " + blacklistReasonRef[0])
                        .status("WAITING_CHECKOUT")
                        .fineAmount(penaltyFee)
                        .build();
                saveAndBroadcast(ticket);
                penaltyFeeToAdd = penaltyFeeToAdd.add(penaltyFee);
            }
            
            if (penaltyFeeToAdd.compareTo(java.math.BigDecimal.ZERO) > 0) {
                java.math.BigDecimal currentPenalty = session.getPenaltyFee() != null ? session.getPenaltyFee() : java.math.BigDecimal.ZERO;
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

    @Transactional
    public GateResponseDTO processCheckOut(CheckOutRequestDTO request) {
        Gate gate = gateRepository.findById(request.getGateId())
                .orElseThrow(() -> new IllegalArgumentException("Gate not found"));

        messagingTemplate.convertAndSend("/topic/gates/" + gate.getId() + "/scans", request);

        if (!"OUT".equals(gate.getGateType()) && !"EXIT".equals(gate.getGateType())
                && !"IN_OUT".equals(gate.getGateType())) {
            return GateResponseDTO.builder()
                    .status("ERROR")
                    .message("Invalid gate type for check-out")
                    .build();
        }

        ParkingSession session = sessionRepository
                .findByRfidCard_CardCodeAndStatusIn(request.getRfid(), java.util.Arrays.asList("ACTIVE"))
                .orElseThrow(() -> new IllegalArgumentException("No active session found for this card"));

        RfidCard card = session.getRfidCard();
        
        boolean hasBlockingIncident = incidentTicketRepository.existsBySessionIdAndIssueTypeInAndStatusIn(
                session.getId(),
                java.util.Arrays.asList("LOST_CARD", "DAMAGED_CARD"),
                java.util.Arrays.asList("PENDING", "WAITING_CHECKOUT"));
                
        if (hasBlockingIncident || (card != null && ("LOST".equals(card.getStatus()) || "DAMAGED".equals(card.getStatus())))) {
            return GateResponseDTO.builder()
                    .sessionId(session.getId())
                    .status("ERROR")
                    .message("Xe đang có sự cố hoặc nợ phí phạt chưa được xử lý. Giao dịch bị khóa, Barrier không mở. Vui lòng nộp phí tại quầy!")
                    .build();
        }

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
                    checkOutTime = java.time.LocalDateTime.ofInstant(claims.getIssuedAt().toInstant(), java.time.ZoneId.systemDefault());
                } else {
                    throw new IllegalArgumentException("Báo giá đã hết hạn. Vui lòng làm mới trang (refresh) để xem báo giá mới nhất.");
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
        MonthlyTicket monthlyTicket = monthlyTicketRepository.findByPlateAndStatus(session.getPlate(), "ACTIVE")
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
            if (request.getTotalFee() != null) {
                // If FE sends explicit fee, assume it's expectedFee (or combined). 
                // We'll recalculate exactly to properly split it.
            } 
            
            if (session.getReservation() != null) {
                java.time.LocalDateTime bookedIn = session.getReservation().getExpectedEntryTime();
                java.time.LocalDateTime bookedOut = bookedIn
                        .plusMinutes(session.getReservation().getExpectedDurationMinutes());
                if (session.getTimeOut().isAfter(bookedOut)) {
                    overtimeFee = pricingCalculatorService.calculateTotalFee(session.getVehicleType().getId(), bookedOut,
                            session.getTimeOut());
                    overtimeMinutes = java.time.Duration.between(bookedOut, session.getTimeOut()).toMinutes();
                }
            } else {
                String rfidCode = (request.getRfid() != null) ? request.getRfid()
                        : (session.getRfidCard() != null ? session.getRfidCard().getCardCode() : null);

                java.time.LocalDateTime feeStartTime = determineFeeStartTime(session, rfidCode);
                
                if (feeStartTime.isAfter(session.getTimeIn())) {
                    // Monthly expired mid-session
                    overtimeFee = pricingCalculatorService.calculateTotalFee(session.getVehicleType().getId(), feeStartTime,
                            session.getTimeOut());
                    overtimeMinutes = java.time.Duration.between(feeStartTime, session.getTimeOut()).toMinutes();
                } else {
                    // Walk-in
                    fee = pricingCalculatorService.calculateTotalFee(session.getVehicleType().getId(), feeStartTime,
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
            
            // If it was a blacklist violation, they have now paid/resolved it by checking out
            if ("BLACKLIST_VIOLATION".equals(t.getIssueType())) {
                vehicleRepository.findByPlateNumber(session.getPlate()).ifPresent(v -> {
                    v.setIsBlacklisted(false);
                    v.setBlacklistReason(null);
                    v.setBlacklistEvidenceUrl(null);
                    vehicleRepository.save(v);
                    log.info("Vehicle {} removed from blacklist upon check-out", session.getPlate());
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

        session.setTotalFee(fee); // Save net base fee
        session.setOvertimeFee(overtimeFee); // Save net overtime fee
        session.setOvertimeMinutes(overtimeMinutes);
        session.setPenaltyFee(penaltyFee);
        session.setStatus("COMPLETED");

        if (card != null) {
            card.setStatus("AVAILABLE");
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
                    if (expectedFeeDouble != null && totalAmount.subtract(BigDecimal.valueOf(expectedFeeDouble)).abs().compareTo(BigDecimal.ONE) > 0) {
                        throw new IllegalArgumentException("Phí thanh toán thực tế đã thay đổi thành " + String.format("%,d", totalAmount.longValue()) + " VNĐ. Vui lòng làm mới trang (refresh) để xem báo giá mới nhất.");
                    }
                } catch (Exception e) {
                     // Already caught above
                }
            }
        } else if (request.getTotalFee() != null) {
            if ("CASH".equalsIgnoreCase(request.getPaymentMethod()) && totalAmount.subtract(request.getTotalFee()).abs().compareTo(BigDecimal.ONE) > 0) {
                throw new IllegalArgumentException("Phí thanh toán thực tế đã thay đổi thành " + String.format("%,d", totalAmount.longValue()) + " VNĐ. Vui lòng làm mới trang (refresh) để xem báo giá mới nhất.");
            }
        }
        if (totalAmount.compareTo(BigDecimal.ZERO) > 0) {
            String payMethod = request.getPaymentMethod() != null ? request.getPaymentMethod().toUpperCase() : "CASH";
            Transaction transaction = Transaction.builder()
                    .parkingSession(session)
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
                .message("Checkout successful")
                .build();
        messagingTemplate.convertAndSend("/topic/gates/" + request.getGateId() + "/out", response);
        return response;
    }

    private com.pbms.modules.incident.domain.IncidentTicket saveAndBroadcast(com.pbms.modules.incident.domain.IncidentTicket ticket) {
        com.pbms.modules.incident.domain.IncidentTicket saved = incidentTicketRepository.save(ticket);
        try {
            messagingTemplate.convertAndSend("/topic/alerts", "{\"type\":\"INCIDENT_UPDATE\",\"message\":\"Danh sách sự cố vừa được cập nhật.\"}");
        } catch (Exception e) {
            log.error("Failed to broadcast incident update", e);
        }
        return saved;
    }
}
