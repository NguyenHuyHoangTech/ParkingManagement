# Cấu trúc Cơ sở dữ liệu (Database Schema)

## Bảng: payment_orders (Class: PaymentOrder)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `reservation` | Reservation | Khóa ngoại (FK), JoinColumn(name = "reservation_id") |
| `monthlyTicket` | MonthlyTicket | Khóa ngoại (FK), JoinColumn(name = "monthly_ticket_id") |
| `userId` | Long | Column(name = "user_id") |
| `actionType` | String | Column(name = "action_type", length = 50) |
| `payload` | String | Column(columnDefinition = "VARCHAR(MAX) |
| `orderCode` | String | Column(name = "order_code", nullable = false, unique = true, length = 100) |
| `amount` | BigDecimal | Column(nullable = false, precision = 18, scale = 2) |
| `status` | String | Column(nullable = false, length = 50) |
| `paymentMethod` | String | Column(name = "payment_method", length = 50) |

---

## Bảng: pricing_blocks (Class: PricingBlock)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `shift` | PricingShift | Khóa ngoại (FK), JoinColumn(name = "shift_id", nullable = false) |
| `blockOrder` | Integer | Column(name = "block_order", nullable = false) |
| `durationMins` | Integer | Column(name = "duration_mins", nullable = false) |
| `fee` | BigDecimal | Column(nullable = false, precision = 18, scale = 2) |

---

## Bảng: pricing_policies (Class: PricingPolicy)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `policyName` | String | Column(name = "policy_name", nullable = false) |
| `vehicleType` | com.pbms.modules.operation.domain.VehicleType | Khóa ngoại (FK), JoinColumn(name = "vehicle_type_id", nullable = false) |
| `globalBaseMins` | Integer | Column(name = "global_base_mins", nullable = false) |
| `globalBaseFee` | BigDecimal | Column(name = "global_base_fee", nullable = false, precision = 18, scale = 2) |
| `status` | String | Column(nullable = false, length = 50) |
| `monthlyRate` | BigDecimal | Column(name = "monthly_rate", nullable = false, precision = 18, scale = 2) |
| `createdAt` | LocalDateTime | Column(name = "created_at", updatable = false) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") |
| `shifts` | List<PricingShift> | Quan hệ (List) |

---

## Bảng: pricing_shifts (Class: PricingShift)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `policy` | PricingPolicy | Khóa ngoại (FK), JoinColumn(name = "policy_id", nullable = false) |
| `shiftName` | String | Column(name = "shift_name", nullable = false, length = 100) |
| `startTime` | LocalTime | Column(name = "start_time", nullable = false) |
| `endTime` | LocalTime | Column(name = "end_time", nullable = false) |
| `totalDurationMins` | Integer | Column(name = "total_duration_mins", nullable = false) |
| `blocks` | List<PricingBlock> | Quan hệ (List) |

---

## Bảng: refund_requests (Class: RefundRequest)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `user` | User | Khóa ngoại (FK), JoinColumn(name = "user_id", nullable = false) |
| `referenceType` | String | Column(name = "reference_type", nullable = false, length = 50) |
| `referenceId` | String | Column(name = "reference_id", nullable = false, length = 50) |
| `paidAmount` | BigDecimal | Column(name = "paid_amount", precision = 18, scale = 2, nullable = false) |
| `penaltyFee` | BigDecimal | Column(name = "penalty_fee", precision = 18, scale = 2, nullable = false) |
| `refundAmount` | BigDecimal | Column(name = "refund_amount", precision = 18, scale = 2, nullable = false) |
| `bankName` | String | Column(name = "bank_name", columnDefinition = "NVARCHAR(100) |
| `accountNumber` | String | Column(name = "account_number", length = 100) |
| `accountName` | String | Column(name = "account_name", columnDefinition = "NVARCHAR(100) |
| `status` | String | Column(nullable = false, length = 50) |
| `cancelTime` | LocalDateTime | Column(name = "cancel_time", nullable = false) |
| `rejectReason` | String | Column(name = "reject_reason", columnDefinition = "NVARCHAR(MAX) |
| `proofUrl` | String | Column(name = "proof_url", length = 500) |

---

## Bảng: transactions (Class: Transaction)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `parkingSession` | ParkingSession | Khóa ngoại (FK), JoinColumn(name = "parking_session_id") |
| `monthlyTicket` | MonthlyTicket | Khóa ngoại (FK), JoinColumn(name = "monthly_ticket_id") |
| `paymentOrder` | PaymentOrder | Khóa ngoại (FK), JoinColumn(name = "payment_order_id") |
| `workSession` | com.pbms.modules.identity.domain.StaffWorkSession | Khóa ngoại (FK), JoinColumn(name = "work_session_id") |
| `amount` | BigDecimal | Column(nullable = false, precision = 18, scale = 2) |
| `paymentMethod` | String | Column(name = "payment_method", nullable = false, length = 50) |
| `status` | String | Column(nullable = false, length = 50) |
| `transactionReference` | String | Column(name = "transaction_reference") |

---

## Bảng: staff_work_sessions (Class: StaffWorkSession)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `staff` | User | Khóa ngoại (FK), JoinColumn(name = "staff_id", nullable = false) |
| `gate` | Gate | Khóa ngoại (FK), JoinColumn(name = "gate_id", nullable = false) |
| `loginTime` | LocalDateTime | Column(name = "login_time", nullable = false) |
| `logoutTime` | LocalDateTime | Column(name = "logout_time") |
| `status` | String | Column(nullable = false, length = 50) |
| `expectedRevenue` | java.math.BigDecimal | Column(name = "expected_revenue") |
| `expectedCashRevenue` | java.math.BigDecimal | Column(name = "expected_cash_revenue") |
| `expectedOtherRevenue` | java.math.BigDecimal | Column(name = "expected_other_revenue") |
| `actualRevenue` | java.math.BigDecimal | Column(name = "actual_revenue") |
| `revenueVariance` | java.math.BigDecimal | Column(name = "revenue_variance") |
| `varianceReason` | String | Column(name = "variance_reason", length = 255) |
| `discrepancyStatus` | String | Column(name = "discrepancy_status", length = 50) |

---

## Bảng: users (Class: User)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `passwordHash` | String | Column(name = "password_hash") |
| `googleId` | String | Column(name = "google_id", length = 100) |
| `isVerified` | Boolean | Column(name = "is_verified", nullable = false) |
| `fullName` | String | Column(name = "full_name", columnDefinition = "NVARCHAR(255) |
| `email` | String | Column(nullable = false, unique = true) |
| `role` | String | Column(nullable = false, length = 50) |
| `status` | String | Column(length = 50) |

---

## Bảng: incident_tickets (Class: IncidentTicket)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `user` | User | Khóa ngoại (FK), JoinColumn(name = "user_id") |
| `staff` | User | Khóa ngoại (FK), JoinColumn(name = "staff_id") |
| `session` | com.pbms.modules.operation.domain.ParkingSession | Khóa ngoại (FK), JoinColumn(name = "session_id") |
| `issueType` | String | Column(name = "issue_type", nullable = false, length = 50) |
| `priority` | String | Column(nullable = false, length = 50) |
| `description` | String | Column(nullable = false, columnDefinition = "VARCHAR(MAX) |
| `status` | String | Column(nullable = false, length = 50) |
| `uploadedDocUrl` | String | Column(name = "uploaded_doc_url", columnDefinition = "VARCHAR(MAX) |
| `uploadedCardUrl` | String | Column(name = "uploaded_card_url", length = 255) |
| `expectedZone` | Zone | Khóa ngoại (FK), JoinColumn(name = "expected_zone_id") |
| `actualZone` | Zone | Khóa ngoại (FK), JoinColumn(name = "actual_zone_id") |
| `resolutionNotes` | String | Column(name = "resolution_notes", columnDefinition = "VARCHAR(MAX) |
| `resolutionImageUrl` | String | Column(name = "resolution_image_url", columnDefinition = "VARCHAR(MAX) |
| `resolvedAt` | LocalDateTime | Column(name = "resolved_at") |
| `fineAmount` | java.math.BigDecimal | Column(name = "fine_amount") |
| `feePausedAt` | LocalDateTime | Column(name = "fee_paused_at") |
| `reportedPlate` | String | Column(name = "reported_plate", length = 50) |
| `cancelType` | String | Column(name = "cancel_type", length = 50) |

---

## Bảng: floors (Class: Floor)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `building` | BuildingProfile | Khóa ngoại (FK), JoinColumn(name = "building_id", nullable = false) |
| `floorName` | String | Column(name = "floor_name", nullable = false, length = 100) |
| `floorLevel` | Integer | Column(name = "floor_level", nullable = false) |
| `capacity` | Integer | Column(nullable = false) |
| `floorType` | String | Column(name = "floor_type", length = 50) |
| `mapCols` | Integer | Column(name = "map_cols") |
| `mapRows` | Integer | Column(name = "map_rows") |

---

## Bảng: gates (Class: Gate)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `floor` | Floor | Khóa ngoại (FK), JoinColumn(name = "floor_id") |
| `vehicleType` | VehicleType | Khóa ngoại (FK), JoinColumn(name = "vehicle_type_id") |
| `gateName` | String | Column(name = "gate_name", nullable = false, length = 100) |
| `gateType` | String | Column(name = "gate_type", nullable = false, length = 50) |
| `liveOverrideMode` | String | Column(name = "live_override_mode", length = 50) |
| `status` | String | Column(length = 50) |
| `layoutX` | Double | Column(name = "layout_x") |
| `layoutY` | Double | Column(name = "layout_y") |
| `rotation` | Integer |  |

---

## Bảng: rfid_cards (Class: RfidCard)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `cardId` | String | Column(name = "card_id", unique = true) |
| `cardCode` | String | Column(name = "card_code", unique = true, nullable = false) |
| `status` | String | Column(name = "status") |
| `assignedPlate` | String | Column(name = "assigned_plate", length = 50) |

---

## Bảng: routing_rules (Class: RoutingRule)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `zone` | Zone | Khóa ngoại (FK), JoinColumn(name = "zone_id", nullable = false) |
| `ruleName` | String | Column(name = "rule_name", nullable = false) |
| `fillThresholdPct` | Integer | Column(name = "fill_threshold_pct", nullable = false) |
| `suggestedZone` | Zone | Khóa ngoại (FK), JoinColumn(name = "suggested_zone_id") |
| `startTime` | java.time.LocalTime | Column(name = "start_time") |
| `endTime` | java.time.LocalTime | Column(name = "end_time") |
| `isDefault` | Boolean | Column(name = "is_default") |
| `isActive` | Boolean | Column(name = "is_active") |

---

## Bảng: slots (Class: Slot)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `zone` | Zone | Khóa ngoại (FK), JoinColumn(name = "zone_id", nullable = false) |
| `slotName` | String | Column(name = "slot_name", nullable = false, length = 50) |
| `status` | String | Column(length = 50) |
| `currentPlate` | String | Column(name = "current_plate", length = 50) |
| `version` | Integer |  |

---

## Bảng: zones (Class: Zone)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `floor` | Floor | Khóa ngoại (FK), JoinColumn(name = "floor_id", nullable = false) |
| `vehicleType` | VehicleType | Khóa ngoại (FK), JoinColumn(name = "vehicle_type_id", nullable = false) |
| `zoneName` | String | Column(name = "zone_name", nullable = false, length = 100) |
| `functionType` | String | Column(name = "function_type", nullable = false, length = 50) |
| `layoutX` | Double | Column(name = "layout_x") |
| `layoutY` | Double | Column(name = "layout_y") |
| `rotation` | Integer |  |
| `overflowThreshold` | Integer | Column(name = "overflow_threshold") |
| `status` | String | Column(name = "status", length = 50) |

---

## Bảng: monthly_tickets (Class: MonthlyTicket)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `user` | User | Khóa ngoại (FK), JoinColumn(name = "user_id") |
| `vehicleType` | VehicleType | Khóa ngoại (FK), JoinColumn(name = "vehicle_type_id", nullable = false) |
| `plate` | String | Column(name = "plate", length = 50, nullable = false) |
| `vehicle` | Vehicle | Khóa ngoại (FK), JoinColumn(name = "vehicle_id") |
| `rfidCard` | RfidCard | Khóa ngoại (FK), JoinColumn(name = "rfid_card_id") |
| `validFrom` | LocalDateTime | Column(name = "valid_from", nullable = false) |
| `validUntil` | LocalDateTime | Column(name = "valid_until", nullable = false) |
| `status` | String | Column(nullable = false, length = 50) |
| `autoRenew` | Boolean | Column(name = "auto_renew") |

---

## Bảng: parking_sessions (Class: ParkingSession)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `plate` | String | Column(name = "plate", length = 50) |
| `plateOut` | String | Column(name = "plate_out", length = 50) |
| `vehicleType` | VehicleType | Khóa ngoại (FK), JoinColumn(name = "vehicle_type_id") |
| `rfidCard` | RfidCard | Khóa ngoại (FK), JoinColumn(name = "rfid_card_id") |
| `gateIn` | Gate | Khóa ngoại (FK), JoinColumn(name = "gate_in_id") |
| `gateOut` | Gate | Khóa ngoại (FK), JoinColumn(name = "gate_out_id") |
| `reservation` | Reservation | Khóa ngoại (FK), JoinColumn(name = "reservation_id") |
| `slot` | com.pbms.modules.infrastructure.domain.Slot | Khóa ngoại (FK), JoinColumn(name = "slot_id") |
| `timeIn` | LocalDateTime | Column(name = "time_in", nullable = false) |
| `timeOut` | LocalDateTime | Column(name = "time_out") |
| `picInPanorama` | String | Column(name = "pic_in_panorama", columnDefinition = "VARCHAR(MAX) |
| `picInFace` | String | Column(name = "pic_in_face", columnDefinition = "VARCHAR(MAX) |
| `picOutPanorama` | String | Column(name = "pic_out_panorama", columnDefinition = "VARCHAR(MAX) |
| `picOutFace` | String | Column(name = "pic_out_face", columnDefinition = "VARCHAR(MAX) |
| `suggestedZoneId` | Long | Column(name = "suggested_zone_id") |
| `globalBaseFee` | BigDecimal | Column(name = "global_base_fee", precision = 18, scale = 2) |
| `penaltyFee` | BigDecimal | Column(name = "penalty_fee", precision = 18, scale = 2) |
| `discount` | BigDecimal | Column(precision = 18, scale = 2) |
| `totalFee` | BigDecimal | Column(name = "total_fee", precision = 18, scale = 2) |
| `overtimeMinutes` | Long | Column(name = "overtime_minutes") |
| `overtimeFee` | BigDecimal | Column(name = "overtime_fee", precision = 18, scale = 2) |
| `status` | String | Column(nullable = false, length = 50) |

---

## Bảng: reservations (Class: Reservation)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `vehicle` | Vehicle | Khóa ngoại (FK), JoinColumn(name = "vehicle_id") |
| `zone` | com.pbms.modules.infrastructure.domain.Zone | Khóa ngoại (FK), JoinColumn(name = "zone_id") |
| `expectedEntryTime` | LocalDateTime | Column(name = "expected_entry_time", nullable = false) |
| `expectedDurationMinutes` | Integer | Column(name = "expected_duration_minutes", nullable = false) |
| `status` | String | Column(nullable = false, length = 50) |
| `reservationFee` | BigDecimal | Column(name = "reservation_fee", nullable = false, precision = 18, scale = 2) |
| `notifiedEarlyArrival` | Boolean | Column(name = "notified_early_arrival") |
| `refundStatus` | String | Column(name = "refund_status", length = 50) |
| `refundAmount` | BigDecimal | Column(name = "refund_amount", precision = 18, scale = 2) |
| `refundedBy` | User | Khóa ngoại (FK), JoinColumn(name = "refunded_by") |
| `refundProofUrl` | String | Column(name = "refund_proof_url", length = 500) |
| `refundRejectReason` | String | Column(name = "refund_reject_reason", columnDefinition = "VARCHAR(MAX) |

---

## Bảng: vehicles (Class: Vehicle)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `user` | User | Khóa ngoại (FK), JoinColumn(name = "user_id") |
| `vehicleType` | VehicleType | Khóa ngoại (FK), JoinColumn(name = "vehicle_type_id") |
| `plateNumber` | String | Column(name = "plate_number", nullable = false, unique = true, length = 50) |
| `color` | String | Column(length = 50) |
| `brand` | String | Column(length = 100) |
| `status` | String | Column(length = 50) |
| `isBlacklisted` | Boolean | Column(name = "is_blacklisted", nullable = false) |
| `blacklistReason` | String | Column(name = "blacklist_reason", columnDefinition = "VARCHAR(MAX) |
| `blacklistEvidenceUrl` | String | Column(name = "blacklist_evidence_url", columnDefinition = "VARCHAR(MAX) |

---

## Bảng: vehicle_types (Class: VehicleType)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `typeName` | String | Column(name = "type_name", nullable = false, unique = true, length = 100) |
| `matrixWidth` | Integer | Column(name = "matrix_width", nullable = false) |
| `matrixHeight` | Integer | Column(name = "matrix_height", nullable = false) |
| `category` | String | Column(name = "category", length = 50) |
| `status` | String | Column(name = "status", length = 20) |
| `iconUrl` | String | Column(name = "icon_url", length = 255) |

---

## Bảng: zone_hourly_trends (Class: ZoneHourlyTrend)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) |
| `zone` | Zone | Khóa ngoại (FK), JoinColumn(name = "zone_id") |
| `timeWindow` | LocalDateTime | Column(name = "time_window", nullable = false) |
| `occupancyPct` | BigDecimal | Column(name = "occupancy_pct", nullable = false, precision = 5, scale = 2) |
| `revenueGenerated` | BigDecimal | Column(name = "revenue_generated", nullable = false, precision = 18, scale = 2) |
| `entriesCount` | Integer | Column(name = "entries_count", nullable = false) |
| `exitsCount` | Integer | Column(name = "exits_count", nullable = false) |

---

## Bảng: audit_logs (Class: AuditLog)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `actor` | User | Khóa ngoại (FK), JoinColumn(name = "actor_id") |
| `action` | String | Column(nullable = false, length = 100) |
| `resource` | String | Column(length = 500) |
| `oldValue` | String | Column(name = "old_value", columnDefinition = "NVARCHAR(MAX) |
| `newValue` | String | Column(name = "new_value", columnDefinition = "NVARCHAR(MAX) |
| `ipAddress` | String | Column(name = "ip_address", length = 50) |
| `description` | String | Column(columnDefinition = "NVARCHAR(MAX) |

---

## Bảng: building_profiles (Class: BuildingProfile)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `name` | String | Column(nullable = false) |
| `address` | String | Column(nullable = false, length = 500) |
| `hotline` | String | Column(length = 50) |
| `contactEmail` | String | Column(name = "contact_email", length = 100) |
| `is247` | Boolean | Column(name = "is_247", columnDefinition = "BIT DEFAULT 0") |
| `operatingStart` | String | Column(name = "operating_start", length = 5) |
| `operatingEnd` | String | Column(name = "operating_end", length = 5) |
| `rules` | String | Column(columnDefinition = "VARCHAR(MAX) |

---

## Bảng: system_configs (Class: SystemConfig)

| Thuộc tính (Property) | Kiểu dữ liệu (Java) | Thông tin thêm |
| :--- | :--- | :--- |
| `id` | Long | Khóa chính (PK) (Thừa kế từ BaseEntity) |
| `createdAt` | LocalDateTime | Column(name = "created_at") (Thừa kế từ BaseEntity) |
| `updatedAt` | LocalDateTime | Column(name = "updated_at") (Thừa kế từ BaseEntity) |
| `configKey` | String | Column(name = "config_key", nullable = false, unique = true) |
| `configValue` | String | Column(name = "config_value", nullable = false, columnDefinition = "VARCHAR(MAX) |
| `description` | String | Column(length = 500) |

---

