package com.pbms.modules.operation.controller;

import com.pbms.common.dto.ApiResponse;
import com.pbms.modules.operation.domain.ParkingSession;
import com.pbms.modules.operation.repository.ParkingSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.math.BigDecimal;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import org.springframework.transaction.annotation.Transactional;
import java.util.stream.Stream;

import com.pbms.common.utils.TimeProvider;
import com.pbms.modules.finance.service.PricingCalculatorService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import com.pbms.modules.incident.repository.IncidentTicketRepository;

@RestController
@RequestMapping("/api/v1/operation/parking-sessions")
@RequiredArgsConstructor
public class ParkingSessionController {

    private final ParkingSessionRepository parkingSessionRepository;
    private final PricingCalculatorService pricingCalculatorService;
    private final IncidentTicketRepository incidentTicketRepository;
    private final com.pbms.modules.infrastructure.repository.ZoneRepository zoneRepository;
    private final com.pbms.modules.operation.service.GateOperationService gateOperationService;

    /**
     * GET /api/v1/parking-sessions/my-active
     * Get active parking session by plate or RFID
     */
    @GetMapping("/my-active")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMyActiveSession(
            @RequestParam(required = false) String plate,
            @RequestParam(required = false) String rfid) {

        ParkingSession session = null;

        if (plate != null && !plate.isBlank() && rfid != null && !rfid.isBlank()) {
            java.util.List<ParkingSession> list = parkingSessionRepository.findByPlateOrderByTimeInDesc(plate.trim().toUpperCase());
            for (ParkingSession s : list) {
                if (("ACTIVE".equals(s.getStatus()) || "LOCKED".equals(s.getStatus())) 
                        && s.getRfidCard() != null 
                        && s.getRfidCard().getCardCode().equals(rfid.trim())) {
                    session = s;
                    break;
                }
            }
        } else if (plate != null && !plate.isBlank()) {
            java.util.List<ParkingSession> list = parkingSessionRepository.findByPlateOrderByTimeInDesc(plate.trim().toUpperCase());
            for (ParkingSession s : list) {
                if ("ACTIVE".equals(s.getStatus()) || "LOCKED".equals(s.getStatus())) {
                    session = s;
                    break;
                }
            }
        } else if (rfid != null && !rfid.isBlank()) {
            session = parkingSessionRepository.findByRfidCard_CardCodeAndStatus(rfid.trim(), "ACTIVE").orElse(null);
            if (session == null) {
                session = parkingSessionRepository.findByRfidCard_CardCodeAndStatus(rfid.trim(), "LOCKED").orElse(null);
            }
        }

        if (session == null) {
            Map<String, Object> empty = new HashMap<>();
            empty.put("found", false);
            empty.put("message", "No active session found for this vehicle");
            return ResponseEntity.ok(ApiResponse.success(empty, "Success"));
        }

        Map<String, Object> result = toSessionMap(session);
        result.put("found", true);
        return ResponseEntity.ok(ApiResponse.success(result, "Session found"));
    }

    /**
     * GET /api/v1/parking-sessions/history?plate=...
     * Get parking history by license plate
     */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getHistory(
            @RequestParam String plate) {

        List<Map<String, Object>> history = parkingSessionRepository
                .findByPlateOrderByTimeInDesc(plate.trim().toUpperCase())
                .stream()
                .map(this::toSessionMap)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(history, "Fetched parking history"));
    }

    /**
     * GET /api/v1/parking-sessions/all
     * Get all parking sessions with pagination
     */
    @GetMapping("/all")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAllSessions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timeIn"));
        Page<ParkingSession> sessionPage;
        
        if (startDate != null && endDate != null) {
            LocalDateTime start = startDate.atStartOfDay();
            LocalDateTime end = endDate.atTime(LocalTime.MAX);
            sessionPage = parkingSessionRepository.findByTimeInBetween(start, end, pageRequest);
        } else {
            sessionPage = parkingSessionRepository.findAll(pageRequest);
        }
        
        List<Map<String, Object>> content = sessionPage.getContent().stream()
                .map(this::toSessionMap)
                .collect(Collectors.toList());
                
        Map<String, Object> result = new HashMap<>();
        result.put("content", content);
        result.put("totalPages", sessionPage.getTotalPages());
        result.put("totalElements", sessionPage.getTotalElements());
        result.put("currentPage", page);
        
        return ResponseEntity.ok(ApiResponse.success(result, "Fetched all sessions"));
    }

    /**
     * GET /api/v1/operation/parking-sessions/export
     * Stream CSV export of parking sessions
     */
    @GetMapping("/export")
    @Transactional(readOnly = true)
    public ResponseEntity<StreamingResponseBody> exportTable(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
            
        StreamingResponseBody stream = out -> {
            try (PrintWriter writer = new PrintWriter(out, false, StandardCharsets.UTF_8)) {
                writer.write('\ufeff'); // BOM for Excel
                writer.println("ID,License Plate,Vehicle Type,RFID,Entry Time,Entry Gate,Exit Time,Exit Gate,Total Fee,Status");
                
                LocalDateTime start = startDate != null ? startDate.atStartOfDay() : LocalDate.of(2000, 1, 1).atStartOfDay();
                LocalDateTime end = endDate != null ? endDate.atTime(LocalTime.MAX) : TimeProvider.now().plusDays(1);
                
                try (Stream<ParkingSession> sessionStream = parkingSessionRepository.readByTimeInBetweenOrderByTimeInDesc(start, end)) {
                    sessionStream.forEach(ps -> {
                        String timeIn = ps.getTimeIn() != null ? ps.getTimeIn().toString() : "";
                        String timeOut = ps.getTimeOut() != null ? ps.getTimeOut().toString() : "";
                        String vType = ps.getVehicleType() != null ? ps.getVehicleType().getTypeName() : "";
                        String rfid = ps.getRfidCard() != null ? ps.getRfidCard().getCardCode() : "";
                        String gateIn = ps.getGateIn() != null ? ps.getGateIn().getGateName() : "";
                        String gateOut = ps.getGateOut() != null ? ps.getGateOut().getGateName() : "";
                        String fee = ps.getTotalFee() != null ? ps.getTotalFee().toString() : "0";
                        
                        writer.printf("%d,%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                                ps.getId(),
                                escapeCsv(ps.getPlate()),
                                escapeCsv(vType),
                                escapeCsv(rfid),
                                timeIn,
                                escapeCsv(gateIn),
                                timeOut,
                                escapeCsv(gateOut),
                                fee,
                                ps.getStatus()
                        );
                    });
                }
                writer.flush();
            }
        };

        String filename = "history_export.csv";
        if (startDate != null && endDate != null) {
            filename = "history_export_" + startDate + "_to_" + endDate + ".csv";
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(stream);
    }

    private String escapeCsv(String data) {
        if (data == null) return "";
        String escapedData = data.replaceAll("\\R", " ");
        if (data.contains(",") || data.contains("\"") || data.contains("'")) {
            escapedData = "\"" + escapedData.replace("\"", "\"\"") + "\"";
        }
        return escapedData;
    }


    private Map<String, Object> toSessionMap(ParkingSession ps) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", ps.getId());
        map.put("plate", ps.getPlate());
        map.put("vehicleType", ps.getVehicleType() != null ? ps.getVehicleType().getTypeName() : null);
        map.put("rfid", ps.getRfidCard() != null ? ps.getRfidCard().getCardCode() : null);
        map.put("timeIn", ps.getTimeIn());
        map.put("timeOut", ps.getTimeOut());
        map.put("gateInName", ps.getGateIn() != null ? ps.getGateIn().getGateName() : null);
        map.put("gateOutName", ps.getGateOut() != null ? ps.getGateOut().getGateName() : null);

        String suggestedZoneName = "N/A";
        Long suggestedZoneId = ps.getSuggestedZoneId();
        
        if (ps.getSlot() != null && ps.getSlot().getZone() != null) {
            suggestedZoneName = ps.getSlot().getZone().getZoneName();
            suggestedZoneId = ps.getSlot().getZone().getId();
        } else if (ps.getSuggestedZoneId() != null) {
            suggestedZoneName = zoneRepository.findById(ps.getSuggestedZoneId()).map(z -> z.getZoneName()).orElse("N/A");
            suggestedZoneId = ps.getSuggestedZoneId();
        } else if (ps.getReservation() != null && ps.getReservation().getZone() != null) {
            suggestedZoneName = ps.getReservation().getZone().getZoneName();
            suggestedZoneId = ps.getReservation().getZone().getId();
        }
        map.put("suggestedZoneName", suggestedZoneName);
        map.put("suggestedZoneId", suggestedZoneId);
        
        BigDecimal currentFee = ps.getTotalFee();
        if (currentFee == null && ps.getVehicleType() != null && ps.getTimeIn() != null && 
            ("ACTIVE".equals(ps.getStatus()) || "LOCKED".equals(ps.getStatus()))) {
            try {
                String rfidCode = ps.getRfidCard() != null ? ps.getRfidCard().getCardCode() : null;
                com.pbms.modules.operation.dto.CheckOutSessionInfoDTO checkoutInfo = gateOperationService.getCheckOutSessionInfo(rfidCode, ps.getPlate());
                if (checkoutInfo != null && checkoutInfo.getExpectedFee() != null) {
                    currentFee = checkoutInfo.getExpectedFee();
                } else {
                    currentFee = pricingCalculatorService.calculateTotalFee(
                        ps.getVehicleType().getId(), 
                        ps.getTimeIn(), 
                        TimeProvider.now());
                }
            } catch (Exception e) {
                currentFee = pricingCalculatorService.calculateTotalFee(
                    ps.getVehicleType().getId(), 
                    ps.getTimeIn(), 
                    TimeProvider.now());
            }
        }

        List<com.pbms.modules.incident.domain.IncidentTicket> incidentTickets = incidentTicketRepository.findBySessionId(ps.getId());
        BigDecimal totalPenalty = BigDecimal.ZERO;
        if (incidentTickets != null && !incidentTickets.isEmpty()) {
            totalPenalty = incidentTickets.stream()
                .map(t -> t.getFineAmount())
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, (a, b) -> a.add(b));
        }

        if (currentFee != null) {
            currentFee = currentFee.add(totalPenalty);
        }
        
        map.put("totalFee", currentFee);
        map.put("status", ps.getStatus());

        if (incidentTickets != null && !incidentTickets.isEmpty()) {
            List<Map<String, Object>> incidentDetails = incidentTickets.stream()
                .map(t -> {
                    Map<String, Object> inc = new HashMap<>();
                    inc.put("type", t.getIssueType());
                    if (t.getUploadedDocUrl() != null) {
                        inc.put("urls", java.util.Arrays.asList(t.getUploadedDocUrl().split("\\|")));
                    }
                    inc.put("fineAmount", t.getFineAmount());
                    inc.put("status", t.getStatus());
                    inc.put("description", t.getDescription());
                    return inc;
                })
                .collect(Collectors.toList());
            if (!incidentDetails.isEmpty()) {
                map.put("incidentDetails", incidentDetails);
            }
        }
        return map;
    }
    @GetMapping("/active/search")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> searchActiveSessions(
            @RequestParam String plate,
            @RequestParam Long vehicleTypeId) {
        List<ParkingSession> sessions = parkingSessionRepository.findByPlateAndVehicleTypeIdAndStatus(plate.trim().toUpperCase(), vehicleTypeId, "ACTIVE");
        
        List<Map<String, Object>> result = sessions.stream().map(s -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId());
            map.put("plate", s.getPlate());
            map.put("vehicleType", s.getVehicleType() != null ? s.getVehicleType().getTypeName() : "UNKNOWN");
            map.put("timeIn", s.getTimeIn());
            map.put("picInPanorama", s.getPicInPanorama());
            map.put("picInFace", s.getPicInFace());
            map.put("rfid", s.getRfidCard() != null ? s.getRfidCard().getCardCode() : "N/A");
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(result, "Found " + result.size() + " active sessions"));
    }
}

