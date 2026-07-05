/**
 * @Author: Nguyen Huy Hoang
 * @Date: 2026-07-03
 * @Description: Lớp DTO phản hồi chung cho các thao tác tại cổng (Check-in, Check-out).
 * Gửi trả kết quả xử lý từ server về cho thiết bị đầu cuối hoặc giao diện nhân viên.
 * @Dependencies: Không có
 */
package com.pbms.modules.operation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GateResponseDTO {
    /** ID của phiên đỗ xe (Parking Session) vừa được tạo hoặc cập nhật */
    private Long sessionId;

    /** Biển số xe được ghi nhận */
    private String plateNumber;

    /**
     * Trạng thái phản hồi.
     * Quy tắc giá trị:
     * - "SUCCESS": Thành công
     * - "WARNING": Cảnh báo (Ví dụ: Biển số không khớp, xe nằm trong blacklist)
     * - "ERROR": Lỗi (Ví dụ: Thẻ không hợp lệ)
     */
    private String status;

    /** Thông báo chi tiết đi kèm với trạng thái */
    private String message;
    
    /** (Dành cho Check-in) ID của khu vực đỗ xe được gợi ý */
    private Long suggestedZoneId;

    /** (Dành cho Check-in) Tên của khu vực đỗ xe được gợi ý */
    private String suggestedZoneName;
    
    /** Phí dự kiến tính đến thời điểm hiện tại (Dành cho Check-out) */
    private BigDecimal checkoutFee;
    
    /** Notice for early arrivals if they have a pending booking that is not yet active */
    private String earlyBookingNotice;
}
