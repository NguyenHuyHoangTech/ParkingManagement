package com.pbms.common.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;


import java.time.LocalDateTime;

@Getter
@Setter
@MappedSuperclass
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = com.pbms.common.utils.TimeProvider.now();
        updatedAt = com.pbms.common.utils.TimeProvider.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = com.pbms.common.utils.TimeProvider.now();
    }
}

