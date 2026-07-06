package com.pbms.modules.operation.controller;

import com.pbms.common.dto.ApiResponse;
import com.pbms.modules.operation.dto.ZoneTrendDTO;
import com.pbms.modules.operation.service.ZoneTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/manager/zone-trends")
@RequiredArgsConstructor
public class ZoneTrendController {

    private final ZoneTrendService zoneTrendService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ZoneTrendDTO>>> getZoneTrends(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long vehicleTypeId) {
        
        if (startDate == null) {
            startDate = com.pbms.common.utils.TimeProvider.now().toLocalDate();
        }
        if (endDate == null) {
            endDate = startDate;
        }
        if (endDate.isBefore(startDate)) {
            endDate = startDate;
        }

        if (java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) > 31) {
            throw new IllegalArgumentException("Khoảng thời gian xem biểu đồ mật độ bãi đỗ (Zone Trends) không được vượt quá 31 ngày để đảm bảo hiệu suất.");
        }
        
        return ResponseEntity.ok(ApiResponse.success(
                zoneTrendService.getZoneTrends(startDate, endDate, vehicleTypeId),
                "Success"
        ));
    }
}
