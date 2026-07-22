package com.pbms.modules.identity.domain;

import com.pbms.modules.infrastructure.domain.Gate;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "staff_work_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaffWorkSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = false)
    private User staff;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gate_id", nullable = false)
    private Gate gate;

    @Column(name = "login_time", nullable = false)
    private LocalDateTime loginTime;

    @Column(name = "logout_time")
    private LocalDateTime logoutTime;

    @Column(nullable = false, length = 50)
    private String status; // ACTIVE, COMPLETED

    @Column(name = "expected_revenue")
    private java.math.BigDecimal expectedRevenue;

    @Column(name = "expected_cash_revenue")
    private java.math.BigDecimal expectedCashRevenue;

    @Column(name = "expected_other_revenue")
    private java.math.BigDecimal expectedOtherRevenue;



    @Column(name = "work_gate_type", length = 50)
    private String workGateType; // ENTRY, EXIT, PATROL
}

