package com.pbms.modules.operation.domain;

import com.pbms.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "reservations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reservation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id")
    private Vehicle vehicle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "zone_id")
    private com.pbms.modules.infrastructure.domain.Zone zone;

    @Column(name = "expected_entry_time", nullable = false)
    private LocalDateTime expectedEntryTime;

    @Column(name = "expected_duration_minutes", nullable = false)
    private Integer expectedDurationMinutes;

    @Column(nullable = false, length = 50)
    private String status; // PENDING, ACTIVE, COMPLETED, CANCELLED, NO_SHOW

    @Column(name = "reservation_fee", nullable = false, precision = 18, scale = 2)
    private BigDecimal reservationFee;


    @Column(name = "notified_early_arrival")
    private Boolean notifiedEarlyArrival;


}

