package com.pbms.modules.infrastructure.domain;

import jakarta.persistence.*;
import lombok.*;



@Entity
@Table(name = "gates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Gate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id")
    private Floor floor;


    @Column(name = "gate_name", nullable = false, length = 100)
    private String gateName;



    @Column(length = 50)
    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE, INACTIVE

    @Column(name = "layout_x")
    private Double layoutX;

    @Column(name = "layout_y")
    private Double layoutY;

    private Integer rotation;
}

