package com.pbms.common.dto;

// --- CÁC THƯ VIỆN ĐƯỢC SỬ DỤNG ---
// Bộ công cụ Lombok giúp Lập trình viên lười biếng, không cần gõ các hàm Getter/Setter nhàm chán
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * BẢN THIẾT KẾ PHONG BÌ THƯ CHUẨN DÀNH CHO WEBSOCKET
 * 
 * - Mọi thông báo (Event) ném vào đường ống WebSocket bắt buộc phải bỏ vào phong bì này.
 * - Chữ <T> (Generic): Đây là cái túi thần kỳ. Tức là cái phong bì này có thể chứa 
 *   bất cứ loại đồ vật gì (Chứa String, chứa Số, hay chứa cả 1 cái Object Xe Hơi).
 * 
 * Ý nghĩa các công cụ của Lombok:
 * - @Data: Tự động đúc ra các hàm Getter/Setter (Ví dụ: getEventType(), setPriority()).
 * - @Builder: Cung cấp 1 nhà máy lắp ráp để tạo phong bì một cách thanh lịch (Builder Pattern).
 * - @AllArgsConstructor & @NoArgsConstructor: Tự động đúc ra các Hàm khởi tạo (Có và Không có tham số).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WsMessageWrapper<T> {
    
    /**
     * Thuộc tính 1: MÃ SỐ BƯU PHẨM (Mã định danh duy nhất)
     * - @Builder.Default: Trừ khi có người cố tình nhập mã, nếu không tôi sẽ tự động sinh ra.
     * - Mỗi cái phong bì sinh ra sẽ có một mã ngẫu nhiên kiểu: EVT_123e4567-e89b...
     * - Dùng để Frontend không bị nhận trùng lặp 1 tin nhắn 2 lần.
     */
    @Builder.Default
    private String eventId = "EVT_" + UUID.randomUUID().toString();
    
    /**
     * Thuộc tính 2: DẤU BƯU ĐIỆN (Thời gian gửi thư)
     * - Tự động lấy giờ chuẩn của máy chủ đóng dấu phập vào phong bì lúc vừa sinh ra.
     * - Dùng để Frontend biết tin nhắn này là tin cũ hay tin mới.
     */
    @Builder.Default
    private LocalDateTime timestamp = com.pbms.common.utils.TimeProvider.now();
    
    /**
     * Thuộc tính 3: LOẠI TIN TỨC
     * - (Ví dụ: "SLOT_UPDATED", "GATE_OPENED"). 
     * - Dùng để Frontend biết nên bật tính năng nào (Ví dụ thấy GATE_OPENED thì vẽ cửa mở).
     */
    private String eventType;
    
    /**
     * Thuộc tính 4: MỨC ĐỘ ƯU TIÊN (Độ nghiêm trọng)
     * - Mặc định luôn là "NORMAL" (Bình thường).
     * - Các mức độ thường dùng: LOW (Thấp), NORMAL (Bình thường), HIGH (Cao), CRITICAL (Khẩn cấp).
     */
    @Builder.Default
    private String priority = "NORMAL";
    
    /**
     * Thuộc tính 5: HÀNG HÓA THỰC SỰ (Payload)
     * - Chữ T đại diện cho "Type". Nó có thể là cục dữ liệu Biển Số Xe, Giá Tiền,...
     */
    private T data;
    
    /**
     * HÀM ẢO THUẬT SỐ 1: ĐÓNG GÓI PHONG BÌ CƠ BẢN (Method Overloading)
     * - Hàm này chỉ bắt lập trình viên nhập 2 thứ: Loại tin (eventType) và Hàng hóa (data).
     * - Những thứ còn lại (Mã số, Thời gian, Mức độ NORMAL) thì nhà máy @Builder tự động làm.
     */
    public static <T> WsMessageWrapper<T> of(String eventType, T data) {
        return WsMessageWrapper.<T>builder()
                .eventType(eventType)
                .data(data)
                .build();
    }
    
    /**
     * HÀM ẢO THUẬT SỐ 2: ĐÓNG GÓI PHONG BÌ KHẨN CẤP (Method Overloading)
     * - Giống y chang hàm trên, nhưng bắt lập trình viên nhập thêm cái Mức độ (priority).
     * - Dùng khi muốn đè cái chữ "NORMAL" mặc định thành chữ "CRITICAL" hoặc "HIGH".
     */
    public static <T> WsMessageWrapper<T> of(String eventType, String priority, T data) {
        return WsMessageWrapper.<T>builder()
                .eventType(eventType)
                .priority(priority)
                .data(data)
                .build();
    }
}
