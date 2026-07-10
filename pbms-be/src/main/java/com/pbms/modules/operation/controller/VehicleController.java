package com.pbms.modules.operation.controller;

import com.pbms.common.dto.ApiResponse;
import com.pbms.modules.operation.dto.VehicleDTO;
import com.pbms.modules.operation.service.VehicleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/operation/vehicles")
@RequiredArgsConstructor
public class VehicleController {

    private final VehicleService vehicleService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<VehicleDTO>>> getAllVehicles() {
        return ResponseEntity.ok(ApiResponse.success(
                vehicleService.getAllVehicles(),
                "Retrieve vehicle list"
        ));
    }

    @com.pbms.common.annotation.LogAudit(action = "UPDATE", resource = "Vehicle", description = "Manual Vehicle Assignment")
    @PostMapping("/assign")
    public ResponseEntity<ApiResponse<VehicleDTO>> assignVehicleToUser(@RequestBody Map<String, String> payload) {
        try {
            String plate = payload.get("plateNumber");
            Long vehicleTypeId = payload.get("vehicleTypeId") != null ? Long.parseLong(payload.get("vehicleTypeId")) : null;
            String rfid = payload.get("rfid");
            String email = payload.get("email");
            
            if (plate == null || plate.isBlank() || vehicleTypeId == null || rfid == null || rfid.isBlank()) {
                throw new IllegalArgumentException("Biển số, loại xe và mã thẻ không được bỏ trống.");
            }

            VehicleDTO dto = vehicleService.assignVehicleToUser(plate, vehicleTypeId, rfid, email);
            return ResponseEntity.ok(ApiResponse.success(dto, "Gán xe thành công."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        }
    }

    @GetMapping("/check")
    public ResponseEntity<ApiResponse<VehicleDTO>> checkVehicleByPlate(@RequestParam String plate) {
        try {
            return ResponseEntity.ok(ApiResponse.success(vehicleService.getVehicleByPlate(plate), "Success"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @com.pbms.common.annotation.LogAudit(action = "UPDATE", resource = "Vehicle", description = "Blacklist vehicle")
    @PostMapping("/{id}/blacklist")
    public ResponseEntity<ApiResponse<VehicleDTO>> blacklistVehicle(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        try {
            String reason = payload.get("reason");
            VehicleDTO dto = vehicleService.setBlacklist(id, reason);
            return ResponseEntity.ok(ApiResponse.success(dto, "Vehicle blacklisted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @com.pbms.common.annotation.LogAudit(action = "UPDATE", resource = "Vehicle", description = "Blacklist vehicle by plate")
    @PostMapping("/blacklist-by-plate")
    public ResponseEntity<ApiResponse<VehicleDTO>> blacklistVehicleByPlate(
            @RequestBody Map<String, String> payload) {
        try {
            String plate = payload.get("plate");
            String reason = payload.get("reason");
            String evidenceUrl = payload.get("evidenceUrl");
            if (plate == null || plate.isBlank()) throw new IllegalArgumentException("Plate is required");
            VehicleDTO dto = vehicleService.setBlacklistByPlate(plate, reason, evidenceUrl);
            return ResponseEntity.ok(ApiResponse.success(dto, "Vehicle blacklisted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @com.pbms.common.annotation.LogAudit(action = "UPDATE", resource = "Vehicle", description = "Unblacklist vehicle by plate")
    @PostMapping("/unblacklist-by-plate")
    public ResponseEntity<ApiResponse<VehicleDTO>> unblacklistVehicleByPlate(
            @RequestBody Map<String, String> payload) {
        try {
            String plate = payload.get("plate");
            String reason = payload.get("reason");
            String evidenceUrl = payload.get("evidenceUrl");
            String incidentIdStr = payload.get("incidentId");
            if (plate == null || plate.isBlank()) throw new IllegalArgumentException("Plate is required");
            
            Long incidentId = incidentIdStr != null ? Long.parseLong(incidentIdStr) : null;
            
            VehicleDTO dto = vehicleService.unblacklistVehicleByPlate(plate, reason, evidenceUrl, incidentId);
            return ResponseEntity.ok(ApiResponse.success(dto, "Vehicle unblacklisted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }
    @com.pbms.common.annotation.LogAudit(action = "UPDATE", resource = "Vehicle", description = "Blacklist active session")
    @PostMapping("/sessions/{sessionId}/blacklist")
    public ResponseEntity<ApiResponse<Void>> blacklistSession(
            @PathVariable Long sessionId,
            @RequestBody Map<String, String> payload) {
        try {
            String reason = payload.get("reason");
            String evidenceUrl = payload.get("evidenceUrl");
            String incidentIdStr = payload.get("incidentId");
            Long incidentId = incidentIdStr != null ? Long.parseLong(incidentIdStr) : null;
            vehicleService.blacklistSession(sessionId, reason, evidenceUrl, incidentId);
            return ResponseEntity.ok(ApiResponse.success(null, "Session blacklisted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @com.pbms.common.annotation.LogAudit(action = "UPDATE", resource = "Vehicle", description = "Unblacklist vehicle")
    @PostMapping("/{id}/unblacklist")
    public ResponseEntity<ApiResponse<VehicleDTO>> unblacklistVehicle(@PathVariable Long id) {
        try {
            VehicleDTO dto = vehicleService.removeBlacklist(id);
            return ResponseEntity.ok(ApiResponse.success(dto, "Success"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }
}

