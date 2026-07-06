package com.pbms.modules.operation.controller;

import com.pbms.common.dto.ApiResponse;

import com.pbms.modules.operation.dto.MonthlyTicketDTO;
import com.pbms.modules.operation.service.MonthlyTicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

@RestController
@RequestMapping("/api/v1/operation/monthly-tickets")
@RequiredArgsConstructor
public class MonthlyTicketController {

    private final MonthlyTicketService monthlyTicketService;
    private final com.pbms.modules.infrastructure.repository.RfidCardRepository rfidCardRepository;
    private final com.pbms.modules.system.service.SystemConfigService systemConfigService;
    private final com.pbms.modules.system.repository.SystemConfigRepository configRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MonthlyTicketDTO>>> getAllTickets() {
        return ResponseEntity.ok(ApiResponse.success(
                monthlyTicketService.getAllTickets(),
                "Retrieve monthly tickets"
        ));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MonthlyTicketDTO>> createTicket(@RequestBody java.util.Map<String, Object> payload) {
        try {
            MonthlyTicketDTO dto = monthlyTicketService.createTicket(payload);
            return ResponseEntity.ok(ApiResponse.success(dto, "Success"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/renew")
    public ResponseEntity<ApiResponse<MonthlyTicketDTO>> renewTicket(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @RequestBody java.util.Map<String, Object> payload) {
        try {
            int duration = payload.get("duration") != null ? Integer.parseInt(payload.get("duration").toString()) : 1;
            MonthlyTicketDTO dto = monthlyTicketService.renewTicket(id, duration);
            return ResponseEntity.ok(ApiResponse.success(dto, "Ticket renewed successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/assign-rfid")
    public ResponseEntity<ApiResponse<MonthlyTicketDTO>> assignRfidCard(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @RequestBody java.util.Map<String, String> payload) {
        try {
            String rfidCode = payload.get("rfidCode");
            if (rfidCode == null || rfidCode.isBlank()) {
                throw new IllegalArgumentException("rfidCode is required");
            }
            MonthlyTicketDTO dto = monthlyTicketService.assignRfidCard(id, rfidCode, rfidCardRepository);
            return ResponseEntity.ok(ApiResponse.success(dto, "RFID card assigned successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "Error:" + e.getMessage()));
        }
    }

    @PutMapping("/{id}/plate")
    public ResponseEntity<ApiResponse<MonthlyTicketDTO>> updatePlate(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @RequestBody java.util.Map<String, String> payload) {
        try {
            String newPlate = payload.get("plate");
            if (newPlate == null || newPlate.isBlank()) {
                throw new IllegalArgumentException("Plate is required");
            }
            MonthlyTicketDTO dto = monthlyTicketService.updateTicketPlate(id, newPlate);
            return ResponseEntity.ok(ApiResponse.success(dto, "Plate updated successfully"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(500, "Error: " + e.getMessage()));
        }
    }

    @GetMapping("/config-threshold")
    public ResponseEntity<ApiResponse<Integer>> getThreshold() {
        int threshold = 90;
        try {
            String val = systemConfigService.getConfigByKey("MONTHLY_TICKET_ALERT_THRESHOLD").getConfigValue();
            if (val != null) threshold = Integer.parseInt(val);
        } catch (Exception e) {}
        return ResponseEntity.ok(ApiResponse.success(threshold, "Success"));
    }

    @PostMapping("/config-threshold")
    public ResponseEntity<ApiResponse<Integer>> setThreshold(
            @RequestBody java.util.Map<String, Integer> payload) {
        Integer threshold = payload.get("threshold");
        if (threshold == null) return ResponseEntity.badRequest().body(ApiResponse.error(400, "Threshold required"));
        
        try {
            com.pbms.modules.system.domain.SystemConfig config = configRepo.findByConfigKey("MONTHLY_TICKET_ALERT_THRESHOLD")
                    .orElseGet(() -> {
                        com.pbms.modules.system.domain.SystemConfig c = new com.pbms.modules.system.domain.SystemConfig();
                        c.setConfigKey("MONTHLY_TICKET_ALERT_THRESHOLD");
                        return c;
                    });
            config.setConfigValue(String.valueOf(threshold));
            configRepo.save(config);
            return ResponseEntity.ok(ApiResponse.success(threshold, "Success"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(500, "Error: " + e.getMessage()));
        }
    }
    @GetMapping("/config-discounts")
    public ResponseEntity<ApiResponse<java.util.Map<String, Double>>> getDiscounts() {
        java.util.Map<String, Double> discounts = new java.util.HashMap<>();
        discounts.put("1", 0.0);
        discounts.put("3", 0.05);
        discounts.put("6", 0.10);
        discounts.put("12", 0.15);
        
        try {
            String val1 = systemConfigService.getConfigByKey("MONTHLY_DISCOUNT_1").getConfigValue();
            if (val1 != null) discounts.put("1", Double.parseDouble(val1));
            String val3 = systemConfigService.getConfigByKey("MONTHLY_DISCOUNT_3").getConfigValue();
            if (val3 != null) discounts.put("3", Double.parseDouble(val3));
            String val6 = systemConfigService.getConfigByKey("MONTHLY_DISCOUNT_6").getConfigValue();
            if (val6 != null) discounts.put("6", Double.parseDouble(val6));
            String val12 = systemConfigService.getConfigByKey("MONTHLY_DISCOUNT_12").getConfigValue();
            if (val12 != null) discounts.put("12", Double.parseDouble(val12));
        } catch (Exception e) {}
        
        return ResponseEntity.ok(ApiResponse.success(discounts, "Success"));
    }

    @PostMapping("/config-discounts")
    public ResponseEntity<ApiResponse<Void>> setDiscounts(
            @RequestBody java.util.Map<String, Double> payload) {
        try {
            for (java.util.Map.Entry<String, Double> entry : payload.entrySet()) {
                String key = "MONTHLY_DISCOUNT_" + entry.getKey();
                com.pbms.modules.system.domain.SystemConfig config = configRepo.findByConfigKey(key)
                        .orElseGet(() -> {
                            com.pbms.modules.system.domain.SystemConfig c = new com.pbms.modules.system.domain.SystemConfig();
                            c.setConfigKey(key);
                            return c;
                        });
                config.setConfigValue(String.valueOf(entry.getValue()));
                configRepo.save(config);
            }
            return ResponseEntity.ok(ApiResponse.success(null, "Success"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(500, "Error: " + e.getMessage()));
        }
    }
}
