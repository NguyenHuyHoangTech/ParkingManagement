package com.pbms.modules.operation.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class ReservationDTO {
    private Long id;
    private String plateNumber;
    private String vehicleType;
    private Long vehicleTypeId;
    private String rfid;
    private String zoneName;
    private String slotName;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime expectedEntryTime;
    
    private Integer expectedDurationMinutes;
    private String status; // PENDING, ACTIVE, COMPLETED, CANCELLED
    private BigDecimal reservationFee;
    
    private String actualIn;
    private String actualOut;
    private BigDecimal penaltyFee;
    private String userEmail;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
    
    // Refund related fields
    private String refundStatus;
    private BigDecimal refundAmount;
    private Long refundRequestId;
    private String rejectReason;
}

