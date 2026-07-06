package com.pbms.modules.operation.service;

import com.pbms.modules.infrastructure.domain.Slot;
import com.pbms.modules.infrastructure.domain.Zone;
import com.pbms.modules.infrastructure.repository.SlotRepository;
import com.pbms.modules.operation.dto.IotSlotUpdateRequest;
import com.pbms.modules.incident.repository.IncidentTicketRepository;
import com.pbms.modules.operation.repository.MonthlyTicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


@Service
@RequiredArgsConstructor
@Slf4j
public class IotIntegrationService {

    private final SlotRepository slotRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ZoneTrendService zoneTrendService;
    private final ZoneRoutingService zoneRoutingService;
    private final MonthlyTicketRepository monthlyTicketRepository;
    private final IncidentTicketRepository incidentTicketRepository;

    @Transactional
    public void updateSlotStatus(IotSlotUpdateRequest request) {
        Slot slot = slotRepository.findById(request.getSlotId())
                .orElseThrow(() -> new IllegalArgumentException("Slot not found"));

        slot.setStatus(request.getStatus()); // OCCUPIED, AVAILABLE
        slotRepository.save(slot);

        Zone zone = slot.getZone();

        // 1. Push Map Update to Staff
        messagingTemplate.convertAndSend("/topic/map-updates", request);

        // 2. Push Zone Capacity Update to Manager
        messagingTemplate.convertAndSend("/topic/zone-capacity", 
                "Zone " + zone.getZoneName() + " capacity updated");

        // 3. Record Trend for peak capacity
        zoneTrendService.recordZoneTrend(zone.getId(), zoneRoutingService.calculateZoneOccupancy(zone.getId()), null);

        // 4. Zone Violation Check for Monthly Zone
        if ("MONTHLY".equals(zone.getFunctionType()) && "OCCUPIED".equals(request.getStatus())) {
            Long vehicleTypeId = zone.getVehicleType() != null ? zone.getVehicleType().getId() : null;
            if (vehicleTypeId != null) {
                long monthlyCarsInside = monthlyTicketRepository.countActiveMonthlyTicketsInsideByVehicleType(vehicleTypeId);
                long occupiedMonthlySlots = slotRepository.countByFunctionTypeAndVehicleTypeIdAndStatus("MONTHLY", vehicleTypeId, "OCCUPIED");
                long penalizedCars = incidentTicketRepository.countUnresolvedByIssueTypeAndVehicleTypeId("ZONE_VIOLATION", "RESOLVED", vehicleTypeId);

                if (occupiedMonthlySlots > (monthlyCarsInside + penalizedCars)) {
                    log.warn("ZONE VIOLATION DETECTED in Zone {}! Occupied: {}, Monthly Inside: {}, Penalized: {}", 
                            zone.getZoneName(), occupiedMonthlySlots, monthlyCarsInside, penalizedCars);
                    
                    messagingTemplate.convertAndSend("/topic/alerts", 
                        (Object) java.util.Map.of(
                            "type", "MONTHLY_ZONE_VIOLATION",
                            "zoneId", zone.getId(),
                            "zoneName", zone.getZoneName(),
                            "message", String.format("Phát hiện %d xe đỗ trái phép tại Zone %s! (Tổng chỗ bị chiếm: %d, Tổng vé tháng trong bãi: %d, Số xe đã phạt: %d)", 
                                    occupiedMonthlySlots - monthlyCarsInside - penalizedCars, zone.getZoneName(), occupiedMonthlySlots, monthlyCarsInside, penalizedCars)
                        )
                    );
                }
            }
        }
    }
}

