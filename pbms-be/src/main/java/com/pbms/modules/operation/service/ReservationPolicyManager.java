package com.pbms.modules.operation.service;

import com.pbms.modules.system.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReservationPolicyManager {

    private final SystemConfigService systemConfigService;

    public int getEarlyWindowMins() {
        try {
            return Integer.parseInt(systemConfigService.getConfigByKey("RESERVATION_EARLY_MINS").getConfigValue());
        } catch (Exception e) {
            log.warn("Failed to parse RESERVATION_EARLY_MINS, falling back to 30: {}", e.getMessage());
            return 30; // default 30 mins
        }
    }

    public BigDecimal getRefundLatePercent() {
        try {
            return new BigDecimal(systemConfigService.getConfigByKey("RESERVATION_REFUND_LATE_PERCENT").getConfigValue());
        } catch (Exception e) {
            log.warn("Failed to parse RESERVATION_REFUND_LATE_PERCENT, falling back to 0.5: {}", e.getMessage());
            return new BigDecimal("0.5"); // default 50%
        }
    }

    public BigDecimal getRefundEarlyPercent() {
        try {
            return new BigDecimal(systemConfigService.getConfigByKey("RESERVATION_REFUND_EARLY_PERCENT").getConfigValue());
        } catch (Exception e) {
            log.warn("Failed to parse RESERVATION_REFUND_EARLY_PERCENT, falling back to 1.0: {}", e.getMessage());
            return BigDecimal.ONE; // default 100%
        }
    }

    public int getDefaultDurationMins() {
        try {
            return Integer.parseInt(systemConfigService.getConfigByKey("RESERVATION_DEFAULT_DURATION_MINS").getConfigValue());
        } catch (Exception e) {
            log.warn("Failed to parse RESERVATION_DEFAULT_DURATION_MINS, falling back to 120: {}", e.getMessage());
            return 120; // default 120 mins
        }
    }
}
