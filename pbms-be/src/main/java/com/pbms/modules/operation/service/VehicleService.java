package com.pbms.modules.operation.service;

import com.pbms.modules.operation.domain.Vehicle;
import com.pbms.modules.operation.dto.VehicleDTO;
import com.pbms.modules.operation.repository.VehicleRepository;
import com.pbms.modules.infrastructure.repository.RfidCardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
public class VehicleService {

    private final VehicleRepository vehicleRepository;
    private final com.pbms.modules.operation.repository.ParkingSessionRepository parkingSessionRepository;
    private final com.pbms.modules.incident.repository.IncidentTicketRepository incidentTicketRepository;
    private final RfidCardRepository rfidCardRepository;
    private final com.pbms.common.service.FileStorageService fileStorageService;
    private final com.pbms.modules.identity.repository.UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private com.pbms.modules.identity.domain.User getCurrentUser() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !auth.getName().equals("anonymousUser")) {
            return userRepository.findByEmail(auth.getName()).orElse(null);
        }
        return null;
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

    @Transactional(readOnly = true)
    public List<VehicleDTO> getAllVehicles() {
        return vehicleRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public VehicleDTO getVehicleByPlate(String plate) {
        return vehicleRepository.findByPlateNumber(plate.trim().toUpperCase())
                .map(this::mapToDTO)
                .orElseGet(() -> {
                    java.util.List<com.pbms.modules.operation.domain.ParkingSession> sessions = parkingSessionRepository.findByPlateOrderByTimeInDesc(plate.trim().toUpperCase());
                    if (!sessions.isEmpty()) {
                        com.pbms.modules.operation.domain.ParkingSession lastSession = sessions.get(0);
                        return VehicleDTO.builder()
                                .plateNumber(lastSession.getPlate())
                                .vehicleTypeName(lastSession.getVehicleType() != null ? lastSession.getVehicleType().getTypeName() : "Unknown")
                                .status("GUEST")
                                .isBlacklisted(false)
                                .build();
                    }
                    throw new RuntimeException("Vehicle not found");
                });
    }

    @Transactional
    public VehicleDTO setBlacklist(Long id, String reason) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Vehicle not found"));
        vehicle.setIsBlacklisted(true);
        vehicle.setBlacklistReason(reason);
        vehicleRepository.save(vehicle);
        return mapToDTO(vehicle);
    }

    @Transactional
    public VehicleDTO setBlacklistByPlate(String plate, String reason, String evidenceUrl) {
        Vehicle vehicle = vehicleRepository.findByPlateNumber(plate.trim().toUpperCase())
                .orElseGet(() -> {
                    Vehicle newVehicle = new Vehicle();
                    newVehicle.setPlateNumber(plate.trim().toUpperCase());
                    newVehicle.setStatus("ACTIVE");
                    return newVehicle;
                });
        vehicle.setIsBlacklisted(true);
        vehicle.setBlacklistReason(reason);
        vehicle.setBlacklistEvidenceUrl(evidenceUrl);
        vehicleRepository.save(vehicle);
        return mapToDTO(vehicle);
    }

    @Transactional
    public VehicleDTO removeBlacklist(Long id) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Vehicle not found"));
        vehicle.setIsBlacklisted(false);
        // Note: keeping the reason/evidence for history, or clearing them. User said "khôi phục lại như cũ". Let's clear them.
        vehicle.setBlacklistReason(null);
        vehicle.setBlacklistEvidenceUrl(null);
        vehicleRepository.save(vehicle);

        // Find the session that was closed due to blacklist
        parkingSessionRepository.findByPlateAndStatus(vehicle.getPlateNumber(), "CLOSED_BLACKLISTED")
            .ifPresent(session -> {
                session.setStatus("ACTIVE");
                session.setTimeOut(null);
                session.setTotalFee(null);
                session.setGateOut(null);
                
                if (session.getRfidCard() != null) {
                    session.getRfidCard().setStatus("IN_USE");
                    rfidCardRepository.save(session.getRfidCard());
                }
                parkingSessionRepository.save(session);
                
                // Find the incident ticket and mark it as RESOLVED
                incidentTicketRepository.findBySessionId(session.getId()).stream()
                    .filter(t -> "BLACKLIST_VIOLATION".equals(t.getIssueType()))
                    .forEach(t -> {
                        t.setStatus("RESOLVED");
                        t.setDescription(t.getDescription() + " | Unblacklisted due to mistake.");
                        t.setResolutionNotes("Unblacklisted and returned to ACTIVE");
                        t.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
                        t.setStaff(getCurrentUser());
                        saveAndBroadcast(t);
                    });
            });

        return mapToDTO(vehicle);
    }

    @Transactional
    public VehicleDTO unblacklistVehicleByPlate(String plate, String reason, String evidenceUrl, Long incidentId) {
        Vehicle vehicle = vehicleRepository.findByPlateNumber(plate.trim().toUpperCase())
                .orElseThrow(() -> new RuntimeException("Vehicle not found"));
        vehicle.setIsBlacklisted(false);
        // We keep the old reason/evidence or we can clear them. Since they unblacklisted, let's keep history in the IncidentTicket instead.
        vehicle.setBlacklistReason(null);
        vehicle.setBlacklistEvidenceUrl(null);
        vehicleRepository.save(vehicle);

        if (incidentId != null) {
            incidentTicketRepository.findById(incidentId).ifPresent(t -> {
                String existingUrl = t.getUploadedDocUrl();
                if (evidenceUrl != null && !evidenceUrl.isBlank()) {
                    String storedUrl = fileStorageService.storeBase64File(evidenceUrl);
                    t.setUploadedDocUrl(existingUrl != null && !existingUrl.isBlank() ? existingUrl + "|" + storedUrl : storedUrl);
                }
                String resolution = t.getResolutionNotes();
                t.setResolutionNotes((resolution != null ? resolution + "\n" : "") + "UNBLACKLISTED: " + reason);
                t.setStatus("RESOLVED");
                t.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
                t.setStaff(getCurrentUser());
                saveAndBroadcast(t);
            });
        }
        
        return mapToDTO(vehicle);
    }

    @Transactional
    public void blacklistSession(Long sessionId, String reason, String evidenceUrl, Long incidentId) {
        com.pbms.modules.operation.domain.ParkingSession session = parkingSessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        
        // 1. Close session -> CLOSED_BLACKLISTED
        session.setStatus("CLOSED_BLACKLISTED");
        session.setTimeOut(com.pbms.common.utils.TimeProvider.now());
        session.setTotalFee(java.math.BigDecimal.ZERO);
        
        // 2. Card -> LOST
        if (session.getRfidCard() != null) {
            session.getRfidCard().setStatus("LOST");
            rfidCardRepository.save(session.getRfidCard());
        }
        
        parkingSessionRepository.save(session);

        // 3. Update Vehicle -> isBlacklisted = true
        Vehicle vehicle = vehicleRepository.findByPlateNumber(session.getPlate().trim().toUpperCase())
                .orElseGet(() -> {
                    Vehicle newVehicle = new Vehicle();
                    newVehicle.setPlateNumber(session.getPlate().trim().toUpperCase());
                    newVehicle.setStatus("ACTIVE");
                    if (session.getVehicleType() != null) {
                        newVehicle.setVehicleType(session.getVehicleType());
                    }
                    return newVehicle;
                });
        vehicle.setIsBlacklisted(true);
        vehicle.setBlacklistReason(reason);
        vehicle.setBlacklistEvidenceUrl(evidenceUrl);
        vehicleRepository.save(vehicle);

        // 4. Update the IncidentTicket to record this action
        if (incidentId != null) {
            incidentTicketRepository.findById(incidentId).ifPresent(ticket -> {
                ticket.setResolutionNotes(reason);
                String storedUrl = evidenceUrl;
                if (evidenceUrl != null && !evidenceUrl.isBlank()) {
                    storedUrl = fileStorageService.storeBase64File(evidenceUrl);
                }
                String existingUrl = ticket.getUploadedDocUrl();
                ticket.setUploadedDocUrl(existingUrl != null && !existingUrl.isBlank() && storedUrl != null ? existingUrl + "|" + storedUrl : storedUrl);
                ticket.setResolvedAt(com.pbms.common.utils.TimeProvider.now());
                ticket.setStatus("RESOLVED");
                saveAndBroadcast(ticket);
            });
        }
    }

    @Transactional
    public VehicleDTO assignVehicleToUser(String plate, Long vehicleTypeId, String rfid, String targetEmail) {
        String plateUpper = plate.trim().toUpperCase();
        List<com.pbms.modules.operation.domain.ParkingSession> sessions = parkingSessionRepository.findByPlateOrderByTimeInDesc(plateUpper);
        
        com.pbms.modules.operation.domain.ParkingSession matchedSession = sessions.stream()
            .filter(s -> s.getVehicleType() != null && s.getVehicleType().getId().equals(vehicleTypeId) &&
                         s.getRfidCard() != null && s.getRfidCard().getCardCode().equals(rfid.trim()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Thông tin biển số, loại xe và thẻ RFID không khớp với bất kỳ lượt đỗ nào trong hệ thống."));

        com.pbms.modules.identity.domain.User targetUser;
        if (targetEmail != null && !targetEmail.isBlank()) {
            targetUser = userRepository.findByEmail(targetEmail)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với email: " + targetEmail));
        } else {
            targetUser = getCurrentUser();
            if (targetUser == null) {
                throw new IllegalStateException("Bạn phải đăng nhập để tự gán xe.");
            }
        }

        Vehicle vehicle = vehicleRepository.findByPlateNumber(plateUpper)
            .orElseGet(() -> {
                Vehicle v = new Vehicle();
                v.setPlateNumber(plateUpper);
                v.setStatus("ACTIVE");
                v.setIsBlacklisted(false);
                return v;
            });
        
        vehicle.setVehicleType(matchedSession.getVehicleType());
        vehicle.setUser(targetUser);
        vehicleRepository.save(vehicle);

        for (com.pbms.modules.operation.domain.ParkingSession session : sessions) {
            List<com.pbms.modules.incident.domain.IncidentTicket> tickets = incidentTicketRepository.findBySessionId(session.getId());
            for (com.pbms.modules.incident.domain.IncidentTicket t : tickets) {
                t.setUser(targetUser);
                saveAndBroadcast(t);
            }
        }

        return mapToDTO(vehicle);
    }

    private VehicleDTO mapToDTO(Vehicle vehicle) {
        return VehicleDTO.builder()
                .id(vehicle.getId())
                .plateNumber(vehicle.getPlateNumber())
                .color(vehicle.getColor())
                .brand(vehicle.getBrand())
                .vehicleTypeName(vehicle.getVehicleType() != null ? vehicle.getVehicleType().getTypeName() : null)
                .vehicleTypeId(vehicle.getVehicleType() != null ? vehicle.getVehicleType().getId() : null)
                .ownerName(vehicle.getUser() != null ? vehicle.getUser().getFullName() : null)
                .ownerId(vehicle.getUser() != null ? vehicle.getUser().getId() : null)
                .status(vehicle.getStatus())
                .isBlacklisted(vehicle.getIsBlacklisted())
                .blacklistReason(vehicle.getBlacklistReason())
                .blacklistEvidenceUrl(vehicle.getBlacklistEvidenceUrl())
                .build();
    }

    // Removed old lock/force-checkout logic
}

