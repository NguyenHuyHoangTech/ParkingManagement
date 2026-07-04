package com.pbms.modules.incident.service;

import com.pbms.modules.incident.domain.ZoneHourlyTrend;
import com.pbms.modules.incident.dto.ZoneTrendDTO;
import com.pbms.modules.incident.repository.ZoneHourlyTrendRepository;
import com.pbms.modules.infrastructure.repository.ZoneRepository;
import com.pbms.modules.operation.service.ZoneRoutingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ZoneTrendService {

    private final ZoneHourlyTrendRepository zoneHourlyTrendRepository;
    private final ZoneRepository zoneRepository;
    private final ZoneRoutingService zoneRoutingService;

    @Transactional
    public void recordZoneTrend(Long zoneId, BigDecimal occupancyPct, LocalDateTime timeWindow) {
        LocalDateTime window = timeWindow != null ? timeWindow : com.pbms.common.utils.TimeProvider.now().withMinute(0).withSecond(0).withNano(0);

        List<ZoneHourlyTrend> trends = zoneHourlyTrendRepository.findByTimeWindowBetween(window, window.plusHours(1).minusNanos(1));
        List<ZoneHourlyTrend> matchingTrends = trends.stream().filter(t -> t.getZone().getId().equals(zoneId)).collect(Collectors.toList());
        ZoneHourlyTrend trend;
        
        if (matchingTrends.isEmpty()) {
            trend = ZoneHourlyTrend.builder()
                    .zone(zoneRepository.findById(zoneId).orElse(null))
                    .timeWindow(window)
                    .occupancyPct(occupancyPct)
                    .revenueGenerated(BigDecimal.ZERO)
                    .entriesCount(0)
                    .exitsCount(0)
                    .build();
            zoneHourlyTrendRepository.save(trend);
        } else {
            trend = matchingTrends.get(0);
            // Keep the peak occupancy for this hour
            if (occupancyPct.compareTo(trend.getOccupancyPct()) > 0) {
                trend.setOccupancyPct(occupancyPct);
                zoneHourlyTrendRepository.save(trend);
            }
            // Clean up duplicates caused by race conditions
            if (matchingTrends.size() > 1) {
                for (int i = 1; i < matchingTrends.size(); i++) {
                    ZoneHourlyTrend dup = matchingTrends.get(i);
                    if (dup.getOccupancyPct().compareTo(trend.getOccupancyPct()) > 0) {
                        trend.setOccupancyPct(dup.getOccupancyPct());
                        zoneHourlyTrendRepository.save(trend);
                    }
                    zoneHourlyTrendRepository.delete(dup);
                }
            }
        }
    }

    public List<ZoneTrendDTO> getZoneTrends(LocalDate startDate, LocalDate endDate, Long vehicleTypeId) {
        LocalDateTime startWindow = startDate.atStartOfDay();
        LocalDateTime endWindow = endDate.atTime(LocalTime.MAX);

        List<ZoneHourlyTrend> trends = zoneHourlyTrendRepository.findByTimeWindowBetween(startWindow, endWindow);
        List<com.pbms.modules.infrastructure.domain.Zone> activeZones = zoneRepository.findAll().stream()
                .filter(z -> "ACTIVE".equals(z.getStatus()))
                .filter(z -> vehicleTypeId == null || (z.getVehicleType() != null && z.getVehicleType().getId().equals(vehicleTypeId)))
                .collect(Collectors.toList());

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:00 dd/MM");
        List<ZoneTrendDTO> result = new java.util.ArrayList<>();

        LocalDateTime now = com.pbms.common.utils.TimeProvider.now();
        LocalDateTime currentHourWindow = now.withMinute(0).withSecond(0).withNano(0);

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            for (int h = 0; h < 24; h++) {
                LocalDateTime window = date.atStartOfDay().plusHours(h);
                // Biểu đồ không cần vẽ trước tương lai
                if (window.isAfter(currentHourWindow)) {
                    continue;
                }
                String timeStr = window.format(formatter);
                for (com.pbms.modules.infrastructure.domain.Zone z : activeZones) {
                    List<ZoneHourlyTrend> matchingT = trends.stream()
                            .filter(tr -> tr.getZone().getId().equals(z.getId()) && tr.getTimeWindow().equals(window))
                            .collect(Collectors.toList());
                    ZoneHourlyTrend t = null;
                    if (!matchingT.isEmpty()) {
                        t = matchingT.stream().max((t1, t2) -> t1.getOccupancyPct().compareTo(t2.getOccupancyPct())).get();
                    }
                    
                    BigDecimal occupancy = null;
                    if (window.equals(currentHourWindow)) {
                        occupancy = zoneRoutingService.calculateZoneOccupancy(z.getId());
                    } else if (t != null) {
                        occupancy = t.getOccupancyPct();
                    } else if (window.isBefore(currentHourWindow)) {
                        occupancy = BigDecimal.ZERO;
                    }

                    result.add(ZoneTrendDTO.builder()
                            .timeWindow(timeStr)
                            .zoneId(z.getId())
                            .zoneName(z.getZoneName())
                            .occupancyPct(occupancy)
                            .build());
                }
            }
        }
        return result;
    }
}

