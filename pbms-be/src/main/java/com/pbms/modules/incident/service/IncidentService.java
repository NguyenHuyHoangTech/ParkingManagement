package com.pbms.modules.incident.service;

import com.pbms.modules.incident.domain.IncidentTicket;
import com.pbms.modules.incident.dto.IncidentTicketRequest;
import com.pbms.modules.incident.repository.IncidentTicketRepository;
import com.pbms.modules.operation.domain.ParkingSession;
import com.pbms.modules.infrastructure.domain.RfidCard;
import com.pbms.modules.operation.repository.ParkingSessionRepository;
import com.pbms.modules.infrastructure.repository.RfidCardRepository;
import com.pbms.modules.infrastructure.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pbms.modules.incident.dto.IncidentTicketDTO;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentTicketRepository incidentTicketRepository;
    private final ParkingSessionRepository sessionRepository;
    private final RfidCardRepository rfidCardRepository;
    private final ZoneRepository zoneRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.pbms.modules.operation.repository.MonthlyTicketRepository monthlyTicketRepository;
    private final com.pbms.modules.identity.repository.UserRepository userRepository;
    private final com.pbms.modules.system.service.SystemConfigService systemConfigService;
    private final com.pbms.common.service.FileStorageService fileStorageService;
    private final com.pbms.modules.finance.repository.TransactionRepository transactionRepository;
    private final com.pbms.modules.operation.repository.StaffWorkSessionRepository staffWorkSessionRepository;
    private final com.pbms.modules.operation.repository.VehicleRepository vehicleRepository;
    private final org.springframework.context.ApplicationContext applicationContext;

    private com.pbms.modules.identity.domain.User getCurrentUser() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !auth.getName().equals("anonymousUser")) {
            return userRepository.findByEmail(auth.getName()).orElse(null);
        }
        return null;
    }

    private void verifyVehicleOwnership(String plate, String currentUserEmail) {
        if (plate == null || plate.isBlank()) return;
        
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            boolean isStaff = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_STAFF") || a.getAuthority().equals("ROLE_MANAGER"));
            if (isStaff) return;
        }

        String targetPlate = plate.trim().toUpperCase();
        String ownerEmail = null;

        java.util.Optional<com.pbms.modules.operation.domain.MonthlyTicket> mtOpt = monthlyTicketRepository.findByPlateNumberAndStatus(targetPlate, "ACTIVE");
        if (mtOpt.isPresent() && mtOpt.get().getUser() != null) {
            ownerEmail = mtOpt.get().getUser().getEmail();
        }

        if (ownerEmail == null) {
            java.util.Optional<com.pbms.modules.operation.domain.Vehicle> vehOpt = vehicleRepository.findByPlateNumber(targetPlate);
            if (vehOpt.isPresent() && vehOpt.get().getUser() != null) {
                ownerEmail = vehOpt.get().getUser().getEmail();
            }
        }

        if (ownerEmail != null) {
            if (currentUserEmail == null || !ownerEmail.equalsIgnoreCase(currentUserEmail.trim())) {
                throw new IllegalArgumentException("Biển số xe này đã được đăng ký bởi một tài khoản khác. Chỉ chủ sở hữu xe hoặc Nhân viên quản lý mới có quyền báo cáo sự cố cho xe này!");
            }
        }
    }

    @Transactional
    public IncidentTicket createIncident(IncidentTicketRequest request, String email) {
        ParkingSession session = null;
        if (request.getSessionId() != null) {
            session = sessionRepository.findById(request.getSessionId())
                    .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        } else if (request.getPlate() != null && !request.getPlate().isBlank()) {
            if (request.getVehicleTypeId() == null) {
                throw new IllegalArgumentException("Loại phương tiện không được để trống.");
            }
            java.util.List<ParkingSession> activeSessions = sessionRepository.findByPlateAndVehicleTypeIdAndStatus(
                    request.getPlate().trim().toUpperCase(), request.getVehicleTypeId(), "ACTIVE");
            session = activeSessions.isEmpty() ? null : activeSessions.get(0);
        }

        String targetPlate = request.getPlate();
        if ((targetPlate == null || targetPlate.isBlank()) && session != null) {
            targetPlate = session.getPlate();
        }
        verifyVehicleOwnership(targetPlate, email);

        if (session != null) {
            if (request.getVehicleTypeId() == null) {
                if (session.getVehicleType() != null) {
                    request.setVehicleTypeId(session.getVehicleType().getId());
                } else {
                    throw new IllegalArgumentException("Loại phương tiện không được để trống.");
                }
            }
            if (session.getVehicleType() != null && !session.getVehicleType().getId().equals(request.getVehicleTypeId())) {
                throw new IllegalArgumentException("Biển số này thuộc về loại phương tiện khác trong hệ thống. Vui lòng kiểm tra lại loại xe.");
            }
        }
        
        if ("SLOT_OCCUPIED".equals(request.getIssueType())) {
            boolean hasSlotOccupied = false;
            if (session != null) {
                hasSlotOccupied = incidentTicketRepository.existsBySessionIdAndIssueTypeAndStatusIn(
                        session.getId(), "SLOT_OCCUPIED", java.util.Arrays.asList("PENDING", "WAITING_CHECKOUT"));
            } else if (request.getPlate() != null && !request.getPlate().isBlank()) {
            }
            if (hasSlotOccupied) {
                throw new IllegalArgumentException("Xe này đã báo cáo sự cố bị chiếm chỗ đang chờ xử lý!");
            }
        }

        if (session != null) {
            boolean exists = incidentTicketRepository.existsBySessionIdAndIssueTypeAndStatusIn(session.getId(), request.getIssueType(), java.util.Arrays.asList("PENDING", "WAITING_CHECKOUT"));
            if (exists) {
                throw new IllegalArgumentException("Đã tồn tại một sự cố loại " + request.getIssueType() + " đang chờ xử lý cho xe này trong phiên đỗ hiện tại!");
            }
        }
        
        com.pbms.modules.identity.domain.User user = null;
        if (email != null && !email.isBlank()) {
            user = userRepository.findByEmail(email).orElse(null);
        }

        IncidentTicket ticket = IncidentTicket.builder()
                .session(session)
                .user(user)
                .issueType(request.getIssueType())
                .priority(request.getPriority() != null ? request.getPriority() : "MEDIUM")
                .description(request.getDescription())
                .status("PENDING")
                .fineAmount(request.getFineAmount())
                .uploadedDocUrl(fileStorageService.storeBase64File(request.getUploadedDocUrl()))
                .build();

        if (session != null) {
            if ("LPR_MISMATCH".equals(request.getIssueType()) && request.getCorrectPlateNumber() != null) {
                session.setPlate(request.getCorrectPlateNumber());
                if (session.getRfidCard() != null) {
                    session.getRfidCard().setAssignedPlate(request.getCorrectPlateNumber());
                }
                // Keep ticket in PENDING status so staff can add photo and explanation in Phase 1
            } 
            else if ("LOST_CARD".equals(request.getIssueType())) {
                if (session.getRfidCard() != null) {
                    session.getRfidCard().setStatus("LOST");
                    rfidCardRepository.save(session.getRfidCard());
                }
                
                BigDecimal fineToApply = request.getFineAmount();
                if (fineToApply == null) {
                    fineToApply = new BigDecimal("200000"); // default
                    try {
                        fineToApply = new BigDecimal(systemConfigService.getConfigByKey("PENALTY_LOST_CARD").getConfigValue());
                    } catch (Exception e) {
                        log.warn("Could not find PENALTY_LOST_CARD config, using default");
                    }
                }
                session.setPenaltyFee(fineToApply);
                ticket.setFineAmount(fineToApply);
            }
            else if ("DAMAGED_CARD".equals(request.getIssueType())) {
                if (session.getRfidCard() != null) {
                    session.getRfidCard().setStatus("DAMAGED");
                    rfidCardRepository.save(session.getRfidCard());
                }
                
            }
        }

        if ("ZONE_VIOLATION".equals(request.getIssueType())) {
            BigDecimal fineToApply = request.getFineAmount();
            if (fineToApply == null) {
                boolean is2W = false;
                if (session != null && session.getVehicleType() != null && "TWO_WHEEL".equals(session.getVehicleType().getCategory())) {
                    is2W = true;
                }
                String configKey = is2W ? "PENALTY_ZONE_VIOLATION_2W" : "PENALTY_ZONE_VIOLATION_4W";
                fineToApply = is2W ? new BigDecimal("50000") : new BigDecimal("100000");
                try {
                    fineToApply = new BigDecimal(systemConfigService.getConfigByKey(configKey).getConfigValue());
                } catch (Exception e) {
                    log.warn("Could not find {} config, using default", configKey);
                }
            }
            
            ticket.setFineAmount(fineToApply);
            
            if (session != null) {
                BigDecimal currentPenalty = session.getPenaltyFee() != null ? session.getPenaltyFee() : BigDecimal.ZERO;
                session.setPenaltyFee(currentPenalty.add(fineToApply));
                sessionRepository.save(session);
            }

            ticket.setStatus("WAITING_CHECKOUT");
            ticket.setResolutionNotes("[CONSOLE] Processed zone violation, penalty fee applied, waiting for checkout.");
            
            messagingTemplate.convertAndSend("/topic/alerts", "Zone violation warning: " + request.getDescription());
        }

        if ("SLOT_OCCUPIED".equals(request.getIssueType()) && session != null) {
            boolean isMonthly = monthlyTicketRepository.findByPlateNumberAndStatus(session.getPlate(), "ACTIVE").isPresent();
            if (isMonthly) {
                ticket.setPriority("HIGH");
                ticket.setDescription("[MONTHLY PASS CONFLICT] " + ticket.getDescription());
            } else {
                ticket.setPriority("MEDIUM");
            }
            session.setSuggestedZoneId(-1L);
            
            sessionRepository.save(session);
        }

        if ("BLACKLIST_VIOLATION".equals(request.getIssueType())) {
            BigDecimal fineToApply = request.getFineAmount();
            if (fineToApply == null) {
                boolean is2W = false;
                if (session != null && session.getVehicleType() != null && "TWO_WHEEL".equals(session.getVehicleType().getCategory())) {
                    is2W = true;
                }
                String configKey = is2W ? "PENALTY_BLACKLIST_UNPAID_2W" : "PENALTY_BLACKLIST_UNPAID_4W";
                fineToApply = is2W ? new BigDecimal("50000") : new BigDecimal("100000"); // default
                try {
                    fineToApply = new BigDecimal(systemConfigService.getConfigByKey(configKey).getConfigValue());
                } catch (Exception e) {
                    log.warn("Could not find {} config, using default", configKey);
                }
            }
            
            ticket.setFineAmount(fineToApply);
            
            if (session != null) {
                BigDecimal currentPenalty = session.getPenaltyFee() != null ? session.getPenaltyFee() : BigDecimal.ZERO;
                session.setPenaltyFee(currentPenalty.add(fineToApply));
                // Đóng session luôn vì xe đã trốn, set doanh thu = 0, khóa thẻ
                session.setStatus("COMPLETED");
                session.setParkingFee(BigDecimal.ZERO);
                session.setTimeOut(com.pbms.common.utils.TimeProvider.now());
                if (session.getRfidCard() != null) {
                    com.pbms.modules.infrastructure.domain.RfidCard card = session.getRfidCard();
                    card.setStatus("LOST");
                    card.setAssignedPlate(null);
                    rfidCardRepository.save(card);
                }
                sessionRepository.save(session);
            }
        }

        return saveAndBroadcast(ticket);
    }

    // Cronjob running at 2:00 AM every day
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void handleOverstayVehicles() {
        log.info("Starting OVERSTAY checking cronjob...");
        int hoursLimit = 72;
        try {
            hoursLimit = Integer.parseInt(systemConfigService.getConfigByKey("OVERSTAY_HOURS_LIMIT").getConfigValue());
        } catch (Exception e) {
            log.warn("OVERSTAY_HOURS_LIMIT config not found, using default 72");
        }
        
        LocalDateTime cutoff = com.pbms.common.utils.TimeProvider.now().minusHours(hoursLimit);
        List<ParkingSession> overstaySessions = sessionRepository.findActiveSessionsOlderThan(cutoff);

        for (ParkingSession session : overstaySessions) {
            boolean hasAnyOverstay = incidentTicketRepository.findBySessionId(session.getId()).stream()
                    .anyMatch(t -> "OVERSTAY".equals(t.getIssueType()));
            
            if (!hasAnyOverstay) {
                IncidentTicket ticket = IncidentTicket.builder()
                        .session(session)
                        .issueType("OVERSTAY")
                        .priority("HIGH")
                        .description(String.format("Hệ thống tự động ghi nhận xe đỗ quá hạn (Không áp phí phạt) (%s: %s)", 
                                session.getPlate(), session.getTimeIn().toString()))
                        .status("PENDING")
                        .build();
                saveAndBroadcast(ticket);
                log.warn("Created OVERSTAY incident for plate: {}", session.getPlate());
                messagingTemplate.convertAndSend("/topic/alerts", "OVERSTAY incident generated for plate: " + session.getPlate());
            }
        }
    }

    @org.springframework.context.event.EventListener(com.pbms.common.event.TimeFastForwardedEvent.class)
    public void handleTimeFastForward(com.pbms.common.event.TimeFastForwardedEvent event) {
        LocalDateTime oldTime = event.getOldSimulatedTime();
        LocalDateTime newTime = event.getNewSimulatedTime();
        if (hasCrossedTime(oldTime, newTime, 2, 0)) {
            handleOverstayVehicles();
        }
    }

    private boolean hasCrossedTime(LocalDateTime oldTime, LocalDateTime newTime, int targetHour, int targetMinute) {
        if (oldTime == null || newTime == null || !oldTime.isBefore(newTime)) return false;
        
        LocalDateTime targetInOldDay = oldTime.withHour(targetHour).withMinute(targetMinute).withSecond(0).withNano(0);
        if (oldTime.isBefore(targetInOldDay) && !newTime.isBefore(targetInOldDay)) {
            return true;
        }
        
        LocalDateTime targetInNewDay = newTime.withHour(targetHour).withMinute(targetMinute).withSecond(0).withNano(0);
        if (oldTime.isBefore(targetInNewDay) && !newTime.isBefore(targetInNewDay)) {
            return true;
        }
        
        if (java.time.Duration.between(oldTime, newTime).toHours() >= 24) {
            return true;
        }
        return false;
    }

    @Transactional(readOnly = true)
    public List<IncidentTicketDTO> getAllIncidents(String email) {
        List<IncidentTicket> tickets;
        if (email != null && !email.isBlank()) {
            tickets = incidentTicketRepository.findAllByUserEmailOrVehicleOwner(email);
        } else {
            tickets = incidentTicketRepository.findAllByOrderByIdDesc();
        }
        return tickets.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public IncidentTicketDTO acknowledgeOverstay(Long id) {
        IncidentTicket ticket = incidentTicketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found"));

        if (!"PENDING".equals(ticket.getStatus()) && !"OVERSTAY".equals(ticket.getIssueType())) {
            throw new IllegalStateException("Ticket must be PENDING and of type OVERSTAY");
        }

        ticket.setStatus("RESOLVED");
        ticket.setResolutionNotes("Xác nhận đã xem bởi nhân viên");
        ticket.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
        ticket.setStatus("WAITING_CHECKOUT");
        ticket.setStaff(getCurrentUser());
        return mapToDTO(saveAndBroadcast(ticket));
    }

    @Transactional
    public IncidentTicketDTO moveToOverstay(Long id, String uploadedDocUrl) {
        IncidentTicket ticket = incidentTicketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found"));

        if (!"PENDING".equals(ticket.getStatus()) && !"OVERSTAY".equals(ticket.getIssueType())) {
            throw new IllegalStateException("Ticket must be PENDING and of type OVERSTAY");
        }

        ticket.setStatus("RESOLVED");
        ticket.setResolutionNotes("[OVERSTAY] Vehicle moved to overstay zone");
        ticket.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
        ticket.setStaff(getCurrentUser());
        if (uploadedDocUrl != null && !uploadedDocUrl.isBlank()) {
            ticket.setUploadedDocUrl(fileStorageService.storeBase64File(uploadedDocUrl));
        }
        
        return mapToDTO(saveAndBroadcast(ticket));
    }

    @Transactional
    public IncidentTicketDTO resolveIncident(Long id, String resolutionNotes, String resolutionImageUrl, String uploadedPicOutUrl, java.math.BigDecimal parkingFee, java.math.BigDecimal penaltyFee, java.math.BigDecimal discountAmount, String paymentMethod, Long paymentOrderId, String checkoutToken) {
        IncidentTicket ticket = incidentTicketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found"));

        if (!"PENDING".equals(ticket.getStatus()) && !"WAITING_CHECKOUT".equals(ticket.getStatus())) {
            throw new IllegalStateException("Ticket is already resolved or in a different status");
        }

        ParkingSession session = ticket.getSession();

        ticket.setStatus("RESOLVED");
        
        String newNotes = resolutionNotes != null ? resolutionNotes : "[RESOLVED] Đã xử lý hoàn tất.";
        String methodStr = paymentMethod != null ? paymentMethod : "CASH";
        String methodDisplay = methodStr.equals("CASH") ? "Tiền mặt" : methodStr;
        
        if (penaltyFee != null || parkingFee != null) {
            newNotes += "\n💳 Hình thức thanh toán: " + methodDisplay;
        }

        if (ticket.getResolutionNotes() != null && !ticket.getResolutionNotes().isBlank()) {
            ticket.setResolutionNotes(ticket.getResolutionNotes() + "\n[Phase 2] " + newNotes);
        } else {
            ticket.setResolutionNotes("[Phase 2] " + newNotes);
        }
        
        if (resolutionImageUrl != null && !resolutionImageUrl.isBlank()) {
            String storedImgUrl = fileStorageService.storeBase64File(resolutionImageUrl);
            if (ticket.getResolutionImageUrl() != null && !ticket.getResolutionImageUrl().isBlank()) {
                ticket.setResolutionImageUrl(ticket.getResolutionImageUrl() + "|[P2]" + storedImgUrl);
            } else {
                ticket.setResolutionImageUrl("[P2]" + storedImgUrl);
            }
        }

        ticket.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
        ticket.setStaff(getCurrentUser());
        
        if (penaltyFee != null) {
            ticket.setFineAmount(penaltyFee);
        }

        // 2-Layer Validation Check with JWT Token
        if (session != null && ("ACTIVE".equals(session.getStatus()) || "LOCKED".equals(session.getStatus()))) {
            com.pbms.common.security.JwtProvider jwtProvider = applicationContext.getBean(com.pbms.common.security.JwtProvider.class);
            
            if (checkoutToken == null || checkoutToken.isEmpty()) {
                throw new IllegalArgumentException("Vui lòng tải lại (refresh) thông tin sự cố để lấy mã xác thực phí mới nhất trước khi xác nhận thu tiền.");
            }

            try {
                io.jsonwebtoken.Claims claims = jwtProvider.getCheckoutClaims(checkoutToken);
                if (!String.valueOf(session.getId()).equals(claims.get("sessionId", String.class))) {
                    throw new IllegalArgumentException("Mã xác thực không khớp với phiên đỗ xe hiện tại.");
                }

                // Verify the expected fee from token matches the requested total fee
                double tokenExpectedFee = claims.get("expectedFee", Double.class);
                java.math.BigDecimal providedParkingFee = parkingFee != null ? parkingFee : java.math.BigDecimal.ZERO;
                java.math.BigDecimal providedPenaltyFee = penaltyFee != null ? penaltyFee : java.math.BigDecimal.ZERO;
                java.math.BigDecimal providedDiscount = discountAmount != null ? discountAmount : java.math.BigDecimal.ZERO;
                java.math.BigDecimal totalProvidedFee = providedParkingFee.add(providedPenaltyFee).subtract(providedDiscount);
                
                if (java.math.BigDecimal.valueOf(tokenExpectedFee).subtract(totalProvidedFee).abs().compareTo(java.math.BigDecimal.ONE) > 0) {
                     throw new IllegalArgumentException("Phí thanh toán có sự sai lệch với tính toán gốc (Thực tế gốc: " + String.format("%,.0f", tokenExpectedFee) + " VNĐ). Nhấn Cập nhật lại phí và thực hiện thanh toán lại.");
                }

            } catch (io.jsonwebtoken.ExpiredJwtException e) {
                throw new IllegalArgumentException("Báo giá đã hết hạn (quá 5 phút). Vui lòng làm mới trang (refresh) để xem báo giá mới nhất.");
            } catch (Exception e) {
                throw new IllegalArgumentException("Token báo giá không hợp lệ: " + e.getMessage());
            }
        }

        java.math.BigDecimal expectedPenaltyFee = ticket.getFineAmount() != null ? ticket.getFineAmount() : java.math.BigDecimal.ZERO;
        java.math.BigDecimal providedPenaltyFee = penaltyFee != null ? penaltyFee : java.math.BigDecimal.ZERO;
        
        if ("LOST_CARD".equals(ticket.getIssueType()) || "ZONE_VIOLATION".equals(ticket.getIssueType()) || "BLACKLIST_VIOLATION".equals(ticket.getIssueType())) {
            if (expectedPenaltyFee.compareTo(providedPenaltyFee) != 0) {
                throw new IllegalArgumentException("Phí phạt không khớp với hệ thống. Bắt buộc: " + String.format("%,d", expectedPenaltyFee.longValue()) + " VNĐ");
            }
        } else if ("DAMAGED_CARD".equals(ticket.getIssueType())) {
            java.math.BigDecimal systemDamagedFee = new java.math.BigDecimal("50000");
            try {
                systemDamagedFee = new java.math.BigDecimal(systemConfigService.getConfigByKey("PENALTY_DAMAGED_CARD").getConfigValue());
            } catch (Exception e) {}
            
            if (providedPenaltyFee.compareTo(java.math.BigDecimal.ZERO) != 0 && providedPenaltyFee.compareTo(systemDamagedFee) != 0) {
                throw new IllegalArgumentException("Phí phạt đền thẻ không hợp lệ. Chỉ được phép 0 VNĐ (Hao mòn) hoặc " + String.format("%,d", systemDamagedFee.longValue()) + " VNĐ (Lỗi người dùng)");
            }
        }
        if (session != null && ("ACTIVE".equals(session.getStatus()) || "LOCKED".equals(session.getStatus()))) {
            session.setStatus("COMPLETED");
            if (session.getTimeOut() == null) {
                session.setTimeOut(com.pbms.common.utils.TimeProvider.now());
            }
            if (uploadedPicOutUrl != null && !uploadedPicOutUrl.isBlank()) {
                session.setPicOutPanorama(uploadedPicOutUrl);
            }
            
            java.math.BigDecimal netParkingFee = java.math.BigDecimal.ZERO;
            if (parkingFee != null) {
                netParkingFee = parkingFee;
                if (discountAmount != null) {
                    netParkingFee = netParkingFee.subtract(discountAmount);
                    if (netParkingFee.compareTo(java.math.BigDecimal.ZERO) < 0) {
                        netParkingFee = java.math.BigDecimal.ZERO;
                    }
                }
                session.setParkingFee(netParkingFee);
            }
            if (penaltyFee != null) {
                session.setPenaltyFee(penaltyFee);
            }
            
            com.pbms.modules.identity.domain.User staff = getCurrentUser();
            if (staff != null) {
                com.pbms.modules.identity.domain.StaffWorkSession workSession = staffWorkSessionRepository
                        .findByStaffIdAndStatus(staff.getId(), "ACTIVE").orElse(null);
                if (workSession != null && workSession.getGate() != null) {
                    session.setGateOut(workSession.getGate());
                }
            }

            java.math.BigDecimal totalAmount = java.math.BigDecimal.ZERO;
            if (netParkingFee != null) totalAmount = totalAmount.add(netParkingFee);
            if (penaltyFee != null) totalAmount = totalAmount.add(penaltyFee);
            
            if (totalAmount.compareTo(java.math.BigDecimal.ZERO) > 0) {
                com.pbms.modules.identity.domain.StaffWorkSession currentSession = null;
                if (staff != null) {
                    currentSession = staffWorkSessionRepository.findByStaffIdAndStatus(staff.getId(), "ACTIVE").orElse(null);
                }

                com.pbms.modules.finance.domain.PaymentOrder po = null;
                if (paymentOrderId != null) {
                    po = new com.pbms.modules.finance.domain.PaymentOrder();
                    po.setId(paymentOrderId);
                }

                com.pbms.modules.finance.domain.Transaction transaction = com.pbms.modules.finance.domain.Transaction.builder()
                        .parkingSession(session)
                        .workSession(currentSession)
                        .paymentOrder(po)
                        .amount(totalAmount)
                        .paymentMethod(paymentMethod != null ? paymentMethod : "CASH")
                        .status("SUCCESS")
                        .transactionReference("TXN-" + session.getId() + "-" + com.pbms.common.utils.TimeProvider.now().toInstant(java.time.ZoneOffset.UTC).toEpochMilli())
                        .build();
                transactionRepository.save(transaction);
                log.info("Transaction recorded from Incident Desk: {} {} via {}", totalAmount, "VND", transaction.getPaymentMethod());
            }

            // Update the card status based on incident type
            if (session.getRfidCard() != null) {
                RfidCard card = session.getRfidCard();
                if ("LOST_CARD".equals(ticket.getIssueType())) {
                    card.setStatus("LOST");
                } else if ("DAMAGED_CARD".equals(ticket.getIssueType())) {
                    card.setStatus("DAMAGED");
                } else {
                    card.setStatus("AVAILABLE");
                }
                card.setAssignedPlate(null);
                rfidCardRepository.save(card);
            }
            
            sessionRepository.save(session);
        }
        
        // Remove blacklist flag if this was a BLACKLIST_VIOLATION
        if ("BLACKLIST_VIOLATION".equals(ticket.getIssueType())) {
            String plateToUnblacklist = session != null ? session.getPlate() : null;
            if (plateToUnblacklist != null) {
                vehicleRepository.findByPlateNumber(plateToUnblacklist).ifPresent(v -> {
                    v.setIsBlacklisted(false);
                    vehicleRepository.save(v);
                    log.info("Vehicle {} unblacklisted because BLACKLIST_VIOLATION incident was resolved/paid", v.getPlateNumber());
                });
            }
        }
        
        return mapToDTO(saveAndBroadcast(ticket));
    }

    @Transactional
    public IncidentTicketDTO cancelIncident(Long id, String reason, String cancelType, String cancelImageUrl) {
        IncidentTicket ticket = incidentTicketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket #" + id + " does not exist"));

        if ("BLACKLIST_VIOLATION".equals(ticket.getIssueType())) {
            String plateToCheck = ticket.getSession() != null ? ticket.getSession().getPlate() : null;
            if (plateToCheck != null) {
                boolean hasActive = sessionRepository.findByPlateOrderByTimeInDesc(plateToCheck).stream()
                        .anyMatch(s -> "ACTIVE".equals(s.getStatus()) || "LOCKED".equals(s.getStatus()));
                if (hasActive) {
                    throw new IllegalStateException("Không thể hủy sự cố Blacklist khi xe đang ở trong bãi (đã vào bãi). Vui lòng xử lý thanh toán tại cổng ra!");
                }
            }
        }

        ticket.setStatus("CANCELLED");
        ticket.setCancelType(cancelType);
        
        String cancelNotes = "[CANCELLED] " + (reason != null ? reason : "Sự cố đã bị hủy.");
        if (ticket.getResolutionNotes() != null && !ticket.getResolutionNotes().isBlank()) {
            ticket.setResolutionNotes(ticket.getResolutionNotes() + "\n" + cancelNotes);
        } else {
            ticket.setResolutionNotes(cancelNotes);
        }
        if (cancelImageUrl != null && !cancelImageUrl.isBlank()) {
            String storedImgUrl = fileStorageService.storeBase64File(cancelImageUrl);
            if (ticket.getResolutionImageUrl() != null && !ticket.getResolutionImageUrl().isBlank()) {
                ticket.setResolutionImageUrl(ticket.getResolutionImageUrl() + "|[CX]" + storedImgUrl);
            } else {
                ticket.setResolutionImageUrl("[CX]" + storedImgUrl);
            }
        }

        ticket.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
        ticket.setStaff(getCurrentUser());
        ticket.setFineAmount(java.math.BigDecimal.ZERO);

        // Restore the session to normal by clearing penalty if any
        ParkingSession session = ticket.getSession();
        if (session != null) {
            boolean isBlacklistViolation = "BLACKLIST_VIOLATION".equals(ticket.getIssueType());
            boolean isCardIncident = "LOST_CARD".equals(ticket.getIssueType()) || "DAMAGED_CARD".equals(ticket.getIssueType());
            if ("ACTIVE".equals(session.getStatus()) || "LOCKED".equals(session.getStatus()) || (isBlacklistViolation && "COMPLETED".equals(session.getStatus()))) {
                if ("LOCKED".equals(session.getStatus()) || (isBlacklistViolation && "COMPLETED".equals(session.getStatus()))) {
                    session.setStatus("ACTIVE");
                    session.setTimeOut(null);
                    session.setParkingFee(null);
                    if ((isBlacklistViolation || isCardIncident) && session.getRfidCard() != null) {
                        com.pbms.modules.infrastructure.domain.RfidCard card = session.getRfidCard();
                        card.setStatus("IN_USE");
                        card.setAssignedPlate(session.getPlate());
                        rfidCardRepository.save(card);
                    }
                }
                if ("FEE_DISPUTE".equals(ticket.getIssueType())) {
                    session.setDiscount(null);
                }
                if (ticket.getFineAmount() != null && ticket.getFineAmount().compareTo(java.math.BigDecimal.ZERO) > 0) {
                    java.math.BigDecimal currentPenalty = session.getPenaltyFee() != null ? session.getPenaltyFee() : java.math.BigDecimal.ZERO;
                    java.math.BigDecimal newPenalty = currentPenalty.subtract(ticket.getFineAmount());
                    if (newPenalty.compareTo(java.math.BigDecimal.ZERO) < 0) {
                        newPenalty = java.math.BigDecimal.ZERO;
                    }
                    session.setPenaltyFee(newPenalty);
                }
                sessionRepository.save(session);
                log.info("ParkingSession #{} restored to ACTIVE (incident cancelled)", session.getId());
                
                // If it's a BLACKLIST_VIOLATION being cancelled in Phase 2, we should remove the blacklist status
                if (isBlacklistViolation) {
                    vehicleRepository.findByPlateNumber(session.getPlate()).ifPresent(v -> {
                        v.setIsBlacklisted(false);
                        vehicleRepository.save(v);
                        log.info("Vehicle {} unblacklisted because BLACKLIST_VIOLATION incident was cancelled", session.getPlate());
                    });
                }
            }
        }

        log.info("Incident #{} CANCELLED. Reason: {}", id, reason);
        return mapToDTO(saveAndBroadcast(ticket));
    }
    
    @Transactional
    public IncidentTicketDTO pauseFee(Long id) {
        IncidentTicket ticket = incidentTicketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket #" + id + " does not exist"));

        if (!"WAITING_CHECKOUT".equals(ticket.getStatus()) && !"PENDING".equals(ticket.getStatus())) {
            throw new IllegalStateException("Can only calculate fee in phase 1 or 2");
        }

        // Return mapped DTO which calculates the live fee without saving to database.
        return mapToDTO(ticket);
    }

    /**
     * PUT /incidents/{id}/process-phase1
     * Staff duyet giai doan 1: Khoa phien do, chuyen sang cho check-out thu cong (GD2)
     */
    @Transactional
    public IncidentTicketDTO processPhase1(Long id, String resolutionNotes, String resolutionImageUrl, java.math.BigDecimal fineAmount, java.math.BigDecimal discountAmount) {
        IncidentTicket ticket = incidentTicketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket #" + id + " does not exist"));

        if (!"PENDING".equals(ticket.getStatus())) {
            throw new IllegalStateException("Ticket is already resolved or in an invalid state");
        }

        if ("OTHER".equals(ticket.getIssueType()) && !"MANAGER".equals(getCurrentUser().getRole()) && !"SUPER_ADMIN".equals(getCurrentUser().getRole())) {
            throw new IllegalStateException("Chỉ Quản lý mới có quyền duyệt sự cố hình phạt khác (Lý do khác).");
        }

        ticket.setStaff(getCurrentUser());
        
        ParkingSession ticketSession = ticket.getSession();
        if (ticketSession != null && "COMPLETED".equals(ticketSession.getStatus())) {
            ticket.setStatus("RESOLVED");
            ticket.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
        } else {
            ticket.setStatus("WAITING_CHECKOUT");
        }
        
        if (fineAmount != null) {
            java.math.BigDecimal oldFine = ticket.getFineAmount() != null ? ticket.getFineAmount() : java.math.BigDecimal.ZERO;
            ticket.setFineAmount(fineAmount);
            ParkingSession session = ticket.getSession();
            if (session != null) {
                java.math.BigDecimal currentPenalty = session.getPenaltyFee() != null ? session.getPenaltyFee() : java.math.BigDecimal.ZERO;
                session.setPenaltyFee(currentPenalty.subtract(oldFine).add(fineAmount));
                sessionRepository.save(session);
            }
        }

        if ("BLACKLIST_VIOLATION".equals(ticket.getIssueType())) {
            ticket.setStatus("WAITING_CHECKOUT");
            if (ticketSession != null && "ACTIVE".equals(ticketSession.getStatus())) {
                ticketSession.setStatus("COMPLETED");
                ticketSession.setTimeOut(com.pbms.common.utils.TimeProvider.now());
                ticketSession.setParkingFee(java.math.BigDecimal.ZERO);
                if (ticketSession.getRfidCard() != null) {
                    com.pbms.modules.infrastructure.domain.RfidCard card = ticketSession.getRfidCard();
                    card.setStatus("LOST");
                    card.setAssignedPlate(null);
                    rfidCardRepository.save(card);
                }
                sessionRepository.save(ticketSession);
                log.info("Blacklisted vehicle session {} closed with 0 fee and card LOST.", ticketSession.getId());
            }
            // Ensure vehicle is blacklisted
            String plateToBlacklist = ticketSession != null ? ticketSession.getPlate() : null;
            if (plateToBlacklist != null) {
                com.pbms.modules.operation.domain.Vehicle v = vehicleRepository.findByPlateNumber(plateToBlacklist).orElseGet(() -> {
                    com.pbms.modules.operation.domain.Vehicle newV = new com.pbms.modules.operation.domain.Vehicle();
                    newV.setPlateNumber(plateToBlacklist);
                    newV.setStatus("ACTIVE");
                    if (ticketSession != null && ticketSession.getVehicleType() != null) {
                        newV.setVehicleType(ticketSession.getVehicleType());
                    }
                    return newV;
                });
                v.setIsBlacklisted(true);
                vehicleRepository.save(v);
                log.info("Vehicle {} blacklisted in Phase 1.", v.getPlateNumber());
            }
        }

        if ("FEE_DISPUTE".equals(ticket.getIssueType()) && discountAmount != null) {
            ParkingSession session = ticket.getSession();
            if (session != null) {
                session.setDiscount(discountAmount);
                sessionRepository.save(session);
            }
        }


        String notes = resolutionNotes != null && !resolutionNotes.isBlank() ? resolutionNotes : "Đã xác minh thông tin.";
        ticket.setResolutionNotes("[Phase 1] " + notes);

        if (resolutionImageUrl != null && !resolutionImageUrl.isBlank()) {
            ticket.setResolutionImageUrl("[P1]" + fileStorageService.storeBase64File(resolutionImageUrl));
        }

        boolean isCardIncident = "LOST_CARD".equals(ticket.getIssueType()) || "DAMAGED_CARD".equals(ticket.getIssueType());

        if (isCardIncident) {
            messagingTemplate.convertAndSend("/topic/alerts",
                    "[GD1 OK] Phien #" + id + " da xac nhan mat/hong the. Cho thu tien de xu ly.");
        } else {
            messagingTemplate.convertAndSend("/topic/alerts",
                    "[GD1 OK] Ticket #" + id + " dang duoc nhan vien xu ly ho tro.");
        }

        log.info("Incident #{} moved to WAITING_CHECKOUT (Phase 1 approved)", id);
        return mapToDTO(saveAndBroadcast(ticket));
    }

    @Transactional
    public IncidentTicketDTO resolveNonCardIncident(Long id, String resolutionNotes, String docUrl) {
        IncidentTicket ticket = incidentTicketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket #" + id + " does not exist"));

        if (!"WAITING_CHECKOUT".equals(ticket.getStatus())) {
            throw new IllegalStateException("Incident ticket is not in a valid state to be resolved.");
        }

        ticket.setStatus("RESOLVED");
        ticket.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
        ticket.setStaff(getCurrentUser());
        if (docUrl != null) ticket.setResolutionImageUrl(fileStorageService.storeBase64File(docUrl));
        ticket.setResolutionNotes(resolutionNotes != null ? resolutionNotes : "Incident resolved successfully.");

        log.info("Incident #{} RESOLVED (Non-card flow)", id);
        messagingTemplate.convertAndSend("/topic/alerts", "[RESOLVED] Ticket #" + id + " has been successfully resolved.");

        return mapToDTO(saveAndBroadcast(ticket));
    }

    /**
     * PUT /incidents/{id}/reject?reason=...
     * Tu choi xu ly ticket (ly do khong hop le, giay to sai)
     */
    @Transactional
    public IncidentTicketDTO rejectIncident(Long id, String reason) {
        IncidentTicket ticket = incidentTicketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket #" + id + " does not exist"));

        if ("RESOLVED".equals(ticket.getStatus()) || "REJECTED".equals(ticket.getStatus())) {
            throw new IllegalStateException("Ticket da o trang thai cuoi, khong the tu choi");
        }
        
        if ("WAITING_CHECKOUT".equals(ticket.getStatus()) && "STAFF".equals(getCurrentUser().getRole())) {
            throw new IllegalStateException("Sự cố đã qua Phase 1. Chỉ Quản lý mới có quyền Hủy ở giai đoạn này.");
        }

        if (ticket.getFineAmount() != null && ticket.getFineAmount().compareTo(java.math.BigDecimal.ZERO) > 0) {
            ParkingSession session = ticket.getSession();
            if (session != null && session.getPenaltyFee() != null) {
                java.math.BigDecimal newPenalty = session.getPenaltyFee().subtract(ticket.getFineAmount());
                if (newPenalty.compareTo(java.math.BigDecimal.ZERO) < 0) {
                    newPenalty = java.math.BigDecimal.ZERO;
                }
                session.setPenaltyFee(newPenalty);
                sessionRepository.save(session);
            }
        }

        if (("LOST_CARD".equals(ticket.getIssueType()) || "DAMAGED_CARD".equals(ticket.getIssueType())) && ticket.getSession() != null) {
            com.pbms.modules.infrastructure.domain.RfidCard card = ticket.getSession().getRfidCard();
            if (card != null) {
                card.setStatus("IN_USE");
                rfidCardRepository.save(card);
            }
        }

        ticket.setStatus("REJECTED");
        ticket.setResolutionNotes("Từ chối xử lý: " + reason);
        ticket.setStaff(getCurrentUser());
        ticket.setResolvedAt(com.pbms.common.utils.TimeProvider.now());

        log.info("Incident #{} REJECTED. Reason: {}", id, reason);
        return mapToDTO(saveAndBroadcast(ticket));
    }

    /**
     * POST /incidents/lost-card
     * Staff xu ly mat the: Danh dau the LOST + tinh phat
     */
    @Transactional
    public IncidentTicketDTO createLostCardIncident(String plate, BigDecimal fee, String description, String uploadedDocUrl, String email, Long vehicleTypeId) {
        if (vehicleTypeId == null) {
            throw new IllegalArgumentException("Loại phương tiện không được để trống.");
        }
        verifyVehicleOwnership(plate, email);
        java.util.List<ParkingSession> activeSessions = sessionRepository.findByPlateAndVehicleTypeIdAndStatus(plate.trim().toUpperCase(), vehicleTypeId, "ACTIVE");
        ParkingSession session = activeSessions.isEmpty() ? null : activeSessions.get(0);
        
        if (session == null) {
            throw new IllegalArgumentException("Khong tim thay phien do xe ACTIVE cho bien so: " + plate);
        }

        boolean exists = incidentTicketRepository.existsBySessionIdAndIssueTypeAndStatusIn(session.getId(), "LOST_CARD", java.util.Arrays.asList("PENDING", "WAITING_CHECKOUT"));
        if (exists) {
            throw new IllegalArgumentException("Đã tồn tại một sự cố loại LOST_CARD đang chờ xử lý cho xe này trong phiên đỗ hiện tại!");
        }
        if (session.getVehicleType() != null && !session.getVehicleType().getId().equals(vehicleTypeId)) {
             throw new IllegalArgumentException("Biển số này thuộc về loại phương tiện khác trong hệ thống. Vui lòng kiểm tra lại loại xe.");
        }

        // Do NOT change card status here. It will be changed at Phase 2 when the incident is resolved.

        // Cong phi phat vao phien
        BigDecimal defaultFine = new BigDecimal("200000");
        try {
            defaultFine = new BigDecimal(systemConfigService.getConfigByKey("PENALTY_LOST_CARD").getConfigValue());
        } catch (Exception e) {
            log.warn("Could not find PENALTY_LOST_CARD config, using default 200000");
        }
        BigDecimal fineAmount = fee != null ? fee : defaultFine;
        session.setPenaltyFee(fineAmount);
        sessionRepository.save(session);

        com.pbms.modules.identity.domain.User user = null;
        if (email != null && !email.isBlank()) {
            user = userRepository.findByEmail(email).orElse(null);
        }

        IncidentTicket ticket = new IncidentTicket();
        ticket.setSession(session);
        ticket.setUser(user);
        ticket.setIssueType("LOST_CARD");
        ticket.setPriority("HIGH");
        ticket.setDescription(description != null ? description : "Bao mat the, tien phat: " + fineAmount);
        ticket.setStatus("PENDING");
        ticket.setFineAmount(fineAmount);
        ticket.setUploadedDocUrl(fileStorageService.storeBase64File(uploadedDocUrl));

        log.info("LOST_CARD incident created for plate: {}, fine: {}", plate, fineAmount);
        messagingTemplate.convertAndSend("/topic/alerts",
                "[MAT THE] Bien so " + plate + " da bao mat the. Phi phat: " + fineAmount.toPlainString() + " VND");

        return mapToDTO(saveAndBroadcast(ticket));
    }

    /**
     * POST /incidents/adjust-fee
     * Manager can thiep dieu chinh phi cho phien do xe
     */
    @Transactional
    public IncidentTicketDTO adjustFeeIncident(String plate, BigDecimal liveFee, String reason, Long vehicleTypeId) {
        if (vehicleTypeId == null) {
            throw new IllegalArgumentException("Loại phương tiện không được để trống.");
        }
        java.util.List<ParkingSession> activeSessions = sessionRepository.findByPlateAndVehicleTypeIdAndStatus(plate.trim().toUpperCase(), vehicleTypeId, "ACTIVE");
        ParkingSession session = activeSessions.isEmpty() ? null : activeSessions.get(0);
        if (session == null) {
             throw new IllegalArgumentException("Khong tim thay phien do xe ACTIVE cho bien so: " + plate);
        }

        BigDecimal oldFee = session.getParkingFee();
        session.setParkingFee(liveFee);
        sessionRepository.save(session);

        String desc = String.format(
                "Manager dieu chinh phi. Bien so: %s | Phi cu: %s | Phi moi: %s VND | Ly do: %s",
                plate,
                oldFee != null ? oldFee.toPlainString() : "chua tinh",
                liveFee.toPlainString(),
                reason != null ? reason : "Khong co");

        IncidentTicket ticket = IncidentTicket.builder()
                .session(session)
                .issueType("FEE_ADJUSTMENT")
                .priority("MEDIUM")
                .description(desc)
                .status("RESOLVED")
                .fineAmount(liveFee)
                .resolvedAt(com.pbms.common.utils.TimeProvider.now())
                .resolutionNotes("[TU DONG] Gianh quyen can thiep phi boi Manager")
                .build();

        log.info("FEE_ADJUSTMENT incident: plate={}, newFee={}", plate, liveFee);
        return mapToDTO(saveAndBroadcast(ticket));
    }

    private IncidentTicketDTO mapToDTO(IncidentTicket ticket) {
        int phase = 3;
        if ("PENDING".equals(ticket.getStatus())) phase = 1;
        else if ("WAITING_CHECKOUT".equals(ticket.getStatus())) phase = 2;

        ParkingSession session = ticket.getSession();
        String sessionTimeIn = null;
        String sessionPicIn = null;
        java.math.BigDecimal sessionParkingFee = null;
        String sessionVehicleType = null;
        Long sessionId = null;

        String sessionPicOut = null;
        String sessionSuggestedZone = null;
        String sessionPicInPlate = null;

        if (session != null) {
            sessionId = session.getId();
            sessionTimeIn = session.getTimeIn() != null ? session.getTimeIn().toString() : null;
            sessionPicIn = session.getPicInPanorama();
            sessionPicInPlate = session.getPicInFace();
            sessionPicOut = session.getPicOutPanorama();
            sessionParkingFee = session.getParkingFee();
            sessionVehicleType = session.getVehicleType() != null ? session.getVehicleType().getTypeName() : null;
            if (session.getSuggestedZoneId() != null) {
                sessionSuggestedZone = zoneRepository.findById(session.getSuggestedZoneId())
                    .map(zone -> zone.getZoneName())
                    .orElse(session.getSuggestedZoneId() == -1L ? "Khu vực tự do" : "Zone " + session.getSuggestedZoneId());
            } else {
                sessionSuggestedZone = "Khu vực tự do";
            }
        }

        String customerType = null;
        Long durationMinutes = null;
        Long overtimeMinutes = null;
        java.math.BigDecimal expectedFee = null;
        java.math.BigDecimal overtimeFee = null;
        java.math.BigDecimal discountFee = null;
        java.math.BigDecimal sessionPenaltyFee = null;
        String checkoutToken = null;

        if (session != null) {
            java.time.LocalDateTime targetTime = null;
            if ("WAITING_CHECKOUT".equals(ticket.getStatus()) || "PENDING".equals(ticket.getStatus())) {
                targetTime = com.pbms.common.utils.TimeProvider.now();
            } else if ("RESOLVED".equals(ticket.getStatus()) || "REJECTED".equals(ticket.getStatus())) {
                targetTime = session.getTimeOut();
            }
            if (targetTime == null) targetTime = session.getTimeIn();
            if (targetTime == null) targetTime = com.pbms.common.utils.TimeProvider.now();

            try {
                com.pbms.modules.operation.service.GateOperationService gateOperationService = applicationContext.getBean(com.pbms.modules.operation.service.GateOperationService.class);
                com.pbms.modules.operation.dto.CheckOutSessionInfoDTO checkoutInfo = gateOperationService.getCheckOutSessionInfo(session, targetTime);
                customerType = checkoutInfo.getCustomerType();
                durationMinutes = checkoutInfo.getDurationMinutes();
                overtimeMinutes = checkoutInfo.getOvertimeMinutes();
                expectedFee = checkoutInfo.getExpectedFee();
                overtimeFee = checkoutInfo.getOvertimeFee();
                discountFee = checkoutInfo.getDiscountFee();
                sessionPenaltyFee = checkoutInfo.getFeePenalty();
                checkoutToken = checkoutInfo.getCheckoutToken();
            } catch (Exception e) {
                log.warn("Could not calculate checkout info for session: {}", session.getId());
            }
        }

        return IncidentTicketDTO.builder()
                .id(ticket.getId())
                .plateNumber(session != null ? session.getPlate() : null)
                .issueType(ticket.getIssueType())
                .priority(ticket.getPriority())
                .description(ticket.getDescription())
                .status(ticket.getStatus())
                .fineAmount(ticket.getFineAmount())
                .resolutionNotes(ticket.getResolutionNotes())
                .resolutionImageUrl(ticket.getResolutionImageUrl())
                .resolvedAt(ticket.getResolvedAt())
                .createdAt(ticket.getCreatedAt())
                .uploadedDocUrl(ticket.getUploadedDocUrl())
                .staffEmail(ticket.getStaff() != null ? ticket.getStaff().getEmail() : null)
                .type(ticket.getIssueType())
                .phase(phase)
                .plate(session != null ? session.getPlate() : null)
                .time(ticket.getCreatedAt() != null ? ticket.getCreatedAt().toString() : "")
                .sessionId(sessionId)
                .sessionTimeIn(sessionTimeIn)
                .sessionPicInPanorama(sessionPicIn)
                .sessionPicInPlate(sessionPicInPlate)
                .creatorEmail(ticket.getUser() != null ? ticket.getUser().getEmail() : null)
                .sessionPicOutPanorama(sessionPicOut)
                .sessionParkingFee(sessionParkingFee)
                .sessionVehicleType(sessionVehicleType)
                .vehicleTypeId(session != null && session.getVehicleType() != null ? session.getVehicleType().getId() : null)
                .sessionSuggestedZone(sessionSuggestedZone)
                .baseFee(sessionParkingFee)
                .cancelType(ticket.getCancelType())
                .customerType(customerType)
                .durationMinutes(durationMinutes)
                .overtimeMinutes(overtimeMinutes)
                .expectedFee(expectedFee)
                .sessionPenaltyFee(sessionPenaltyFee)
                .overtimeFee(overtimeFee)
                .discountFee(discountFee)
                .checkoutToken(checkoutToken)
                .build();
    }
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> checkPlateActiveInfo(String plate, Long vehicleTypeId) {
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("isActive", false);
        result.put("hasMonthlyTicket", false);
        
        monthlyTicketRepository.findByPlateNumberAndStatus(plate.trim().toUpperCase(), "ACTIVE")
                .ifPresent(ticket -> result.put("hasMonthlyTicket", true));

        if (vehicleTypeId == null) {
            throw new IllegalArgumentException("Loại phương tiện không được để trống.");
        }
        java.util.List<ParkingSession> activeSessions = sessionRepository.findByPlateAndVehicleTypeIdAndStatus(plate.trim().toUpperCase(), vehicleTypeId, "ACTIVE");

        if (!activeSessions.isEmpty()) {
            ParkingSession session = activeSessions.get(0);
            result.put("isActive", true);
            result.put("vehicleType", session.getVehicleType() != null ? session.getVehicleType().getTypeName() : "Unknown");
        }
        return result;
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, Object> checkPlateAndRfidActiveInfo(String plate, String rfid, Long vehicleTypeId) {
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("isActive", false);
        result.put("hasMonthlyTicket", false);
        
        monthlyTicketRepository.findByPlateNumberAndStatus(plate.trim().toUpperCase(), "ACTIVE")
                .ifPresent(ticket -> result.put("hasMonthlyTicket", true));

        if (vehicleTypeId == null) {
            throw new IllegalArgumentException("Loại phương tiện không được để trống.");
        }
        java.util.List<ParkingSession> activeSessions = sessionRepository.findByPlateAndVehicleTypeIdAndStatus(plate.trim().toUpperCase(), vehicleTypeId, "ACTIVE");

        activeSessions.stream()
                .filter(session -> session.getRfidCard() != null && 
                        (session.getRfidCard().getCardCode().equalsIgnoreCase(rfid.trim()) || 
                         session.getRfidCard().getCardId().equalsIgnoreCase(rfid.trim())))
                .findFirst()
                .ifPresent(session -> {
                    result.put("isActive", true);
                    result.put("vehicleType", session.getVehicleType() != null ? session.getVehicleType().getTypeName() : "Unknown");
                });
        return result;
    }

    @Transactional
    public void resolveFeeDispute(Long id, java.math.BigDecimal discountAmount, String resolutionNotes, String resolutionImageUrl) {
        IncidentTicket ticket = incidentTicketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found"));
        
        if (!"WAITING_CHECKOUT".equals(ticket.getStatus())) {
            throw new IllegalStateException("Ticket is not in phase 2");
        }

        if (!"FEE_DISPUTE".equals(ticket.getIssueType())) {
            throw new IllegalStateException("This endpoint is only for FEE_DISPUTE");
        }

        ParkingSession session = ticket.getSession();
        if (session != null) {
            session.setDiscount(discountAmount);
            sessionRepository.save(session);
        }

        ticket.setStatus("RESOLVED");
        ticket.setResolutionNotes(resolutionNotes);
        if (resolutionImageUrl != null && !resolutionImageUrl.isBlank()) {
            ticket.setResolutionImageUrl(fileStorageService.storeBase64File(resolutionImageUrl));
        }
        saveAndBroadcast(ticket);
    }

    private IncidentTicket saveAndBroadcast(IncidentTicket ticket) {
        IncidentTicket saved = incidentTicketRepository.save(ticket);
        try {
            messagingTemplate.convertAndSend("/topic/alerts", "{\"type\":\"INCIDENT_UPDATE\",\"message\":\"Danh sách sự cố vừa được cập nhật.\"}");
        } catch (Exception e) {
            log.error("Failed to broadcast incident update", e);
        }
        return saved;
    }
}

