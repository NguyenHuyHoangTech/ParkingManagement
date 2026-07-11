package com.pbms.modules.incident.controller;

import com.pbms.common.dto.ApiResponse;
import com.pbms.modules.incident.domain.IncidentTicket;
import com.pbms.modules.incident.dto.IncidentTicketRequest;
import com.pbms.modules.incident.service.IncidentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/v1/incident/incidents")
@RequiredArgsConstructor
public class IncidentTicketController {

    private final IncidentService incidentService;

    @PostMapping
    public ResponseEntity<ApiResponse<IncidentTicket>> createIncident(
            @RequestBody IncidentTicketRequest request,
            org.springframework.security.core.Authentication authentication) {
        try {
            String email = authentication != null ? authentication.getName() : null;
            IncidentTicket ticket = incidentService.createIncident(request, email);
            return ResponseEntity.ok(ApiResponse.success(ticket, "Incident created successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<ApiResponse<java.util.List<com.pbms.modules.incident.dto.IncidentTicketDTO>>> getAllIncidents(
            org.springframework.security.core.Authentication authentication) {
        
        boolean isCustomer = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_CUSTOMER"));
        
        String email = (isCustomer && authentication != null) ? authentication.getName() : null;
        
        return ResponseEntity.ok(ApiResponse.success(incidentService.getAllIncidents(email), "Fetched successfully"));
    }

    @PutMapping("/{id}/move-to-overstay")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> moveToOverstay(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Object> requestBody) {
        try {
            String uploadedDocUrl = (String) requestBody.get("uploadedDocUrl");
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.moveToOverstay(id, uploadedDocUrl);
            return ResponseEntity.ok(ApiResponse.success(dto, "Moved to overstay zone successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/acknowledge")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> acknowledgeOverstay(@PathVariable Long id) {
        try {
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.acknowledgeOverstay(id);
            return ResponseEntity.ok(ApiResponse.success(dto, "Incident acknowledged successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> resolveIncident(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Object> requestBody) {
        try {
            String resolutionNotes = (String) requestBody.get("resolutionNotes");
            String resolutionImageUrl = (String) requestBody.get("resolutionImageUrl");
            String uploadedPicOutUrl = (String) requestBody.get("uploadedPicOutUrl");
            java.math.BigDecimal parkingFee = requestBody.get("parkingFee") != null
                    ? new java.math.BigDecimal(requestBody.get("parkingFee").toString())
                    : null;
            java.math.BigDecimal penaltyFee = requestBody.get("penaltyFee") != null
                    ? new java.math.BigDecimal(requestBody.get("penaltyFee").toString())
                    : null;
            java.math.BigDecimal discountAmount = requestBody.get("discountAmount") != null
                    ? new java.math.BigDecimal(requestBody.get("discountAmount").toString())
                    : null;
            String paymentMethod = (String) requestBody.get("paymentMethod");
            if (paymentMethod == null || paymentMethod.isBlank()) {
                paymentMethod = "CASH";
            }
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.resolveIncident(id, 
                    resolutionNotes, resolutionImageUrl, uploadedPicOutUrl, parkingFee, penaltyFee, discountAmount, paymentMethod);
            return ResponseEntity.ok(ApiResponse.success(dto, "Incident resolved successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> cancelIncident(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> requestBody) {
        try {
            String reason = requestBody.get("reason");
            String cancelType = requestBody.get("cancelType");
            String cancelImageUrl = requestBody.get("cancelImageUrl");
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.cancelIncident(id, reason, cancelType, cancelImageUrl);
            return ResponseEntity.ok(ApiResponse.success(dto, "Incident cancelled successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/pause-fee")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> pauseFee(@PathVariable Long id) {
        try {
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.pauseFee(id);
            return ResponseEntity.ok(ApiResponse.success(dto, "Success"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/process-phase1")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> processPhase1(
            @PathVariable Long id,
            @RequestBody(required = false) java.util.Map<String, Object> requestBody) {
        try {
            String resolutionNotes = requestBody != null ? (String) requestBody.get("resolutionNotes") : null;
            String resolutionImageUrl = requestBody != null ? (String) requestBody.get("resolutionImageUrl") : null;
            java.math.BigDecimal fineAmount = (requestBody != null && requestBody.get("fineAmount") != null)
                    ? new java.math.BigDecimal(requestBody.get("fineAmount").toString())
                    : null;
            java.math.BigDecimal discountAmount = (requestBody != null && requestBody.get("discountAmount") != null)
                    ? new java.math.BigDecimal(requestBody.get("discountAmount").toString())
                    : null;
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.processPhase1(id, resolutionNotes, resolutionImageUrl, fineAmount, discountAmount);
            return ResponseEntity.ok(ApiResponse.success(dto, "Transitioning to the 2nd stage"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> rejectIncident(
            @PathVariable Long id,
            @RequestParam String reason) {
        try {
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.rejectIncident(id, reason);
            return ResponseEntity.ok(ApiResponse.success(dto, "Success"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/resolve-non-card")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> resolveNonCard(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        try {
            String resolutionNotes = body.get("resolutionNotes");
            String docUrl = body.get("resolutionImageUrl");
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.resolveNonCardIncident(id, resolutionNotes, docUrl);
            return ResponseEntity.ok(ApiResponse.success(dto, "The price of the fish is too low."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @GetMapping("/check-plate")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> checkPlateActive(
            @RequestParam String plate,
            @RequestParam(required = false) Long vehicleTypeId) {
        return ResponseEntity.ok(ApiResponse.success(incidentService.checkPlateActiveInfo(plate, vehicleTypeId), "Check the status"));
    }

    @GetMapping("/check-plate-rfid")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> checkPlateAndRfidActive(
            @RequestParam String plate, 
            @RequestParam String rfid,
            @RequestParam(required = false) Long vehicleTypeId) {
        return ResponseEntity.ok(ApiResponse.success(incidentService.checkPlateAndRfidActiveInfo(plate, rfid, vehicleTypeId), "Check the status"));
    }

    @PostMapping("/lost-card")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> reportLostCard(
            @RequestBody java.util.Map<String, Object> requestBody,
            org.springframework.security.core.Authentication authentication) {
        try {
            String email = authentication != null ? authentication.getName() : null;
            String plate = (String) requestBody.get("plate");
            java.math.BigDecimal fee = requestBody.get("fee") != null 
                    ? new java.math.BigDecimal(requestBody.get("fee").toString()) 
                    : null;
            String description = (String) requestBody.get("description");
            String uploadedDocUrl = (String) requestBody.get("uploadedDocUrl");
            Long vehicleTypeId = requestBody.get("vehicleTypeId") != null 
                    ? Long.parseLong(requestBody.get("vehicleTypeId").toString()) 
                    : null;
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.createLostCardIncident(plate, fee, description, uploadedDocUrl, email, vehicleTypeId);
            return ResponseEntity.ok(ApiResponse.success(dto, "How cool is that?"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Leave a comment:" + e.getMessage()));
        }
    }

    @PutMapping("/{id}/adjust-fee-dispute")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<Boolean>> adjustFeeDispute(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Object> requestBody) {
        try {
            java.math.BigDecimal discountAmount = new java.math.BigDecimal(requestBody.get("discountAmount").toString());
            String resolutionNotes = (String) requestBody.get("resolutionNotes");
            String resolutionImageUrl = (String) requestBody.get("resolutionImageUrl");
            
            incidentService.resolveFeeDispute(id, discountAmount, resolutionNotes, resolutionImageUrl);
            return ResponseEntity.ok(ApiResponse.success(true, "15 minutes"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Leave a comment:" + e.getMessage()));
        }
    }

    @PostMapping("/adjust-fee")
    public ResponseEntity<ApiResponse<com.pbms.modules.incident.dto.IncidentTicketDTO>> adjustFee(
            @RequestBody java.util.Map<String, Object> requestBody) {
        try {
            String plate = (String) requestBody.get("plate");
            java.math.BigDecimal liveFee = new java.math.BigDecimal(requestBody.get("liveFee").toString());
            String reason = (String) requestBody.get("reason");
            Object vtIdObj = requestBody.get("vehicleTypeId");
            Long vehicleTypeId = vtIdObj != null ? Long.valueOf(vtIdObj.toString()) : null;
            com.pbms.modules.incident.dto.IncidentTicketDTO dto = incidentService.adjustFeeIncident(plate, liveFee, reason, vehicleTypeId);
            return ResponseEntity.ok(ApiResponse.success(dto, "What's the difference?"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Leave a comment:" + e.getMessage()));
        }
    }
}

