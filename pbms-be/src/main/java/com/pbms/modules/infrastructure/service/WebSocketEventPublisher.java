package com.pbms.modules.infrastructure.service;

// --- CÁC THƯ VIỆN ĐƯỢC SỬ DỤNG ---
// Định nghĩa "Cái phong bì chuẩn" do dự án tự thiết kế để đựng thông báo
import com.pbms.common.dto.WsMessageWrapper;
// Cái Micro phát thanh do Spring Boot cung cấp để hét vào đường ống WebSocket
import org.springframework.messaging.simp.SimpMessagingTemplate;
// Đánh dấu đây là một Chuyên viên (Service) làm việc ngầm trong Tòa nhà Backend
import org.springframework.stereotype.Service;

/**
 * LỚP PHÁT THANH VIÊN (MC CỦA HỆ THỐNG WEBSOCKET)
 * 
 * - Vai trò: Đây là người duy nhất trong toàn bộ hệ thống được cấp quyền cầm Micro (SimpMessagingTemplate).
 * - Các phòng ban khác (như phòng xử lý xe ra vào, phòng thanh toán) khi có sự kiện gì xảy ra, 
 *   họ không tự hét vào đường ống, mà họ viết giấy đưa cho ông MC này đọc.
 * - @Service: Báo cho Giám đốc Spring Boot biết hãy thuê ông này làm nhân viên chính thức.
 * 
 * TÓM TẮT BỨC TRANH TOÀN CẢNH CỦA 3 HÀM TRONG FILE NÀY:
 * 
 * 1. Hàm broadcastEvent (Phát thanh loa phường):
 *    - Dùng để thông báo một tin tức chung cho tất cả các nhân viên đang kết nối (Ví dụ: Trạng thái chỗ trống bãi xe thay đổi).
 *    - Ai cũng có thể nghe thấy.
 * 
 * 2. Hàm broadcastCriticalEvent (Phát thanh báo động đỏ):
 *    - Giống hệt hàm trên, nhưng có gắn thêm cờ "CRITICAL" để phân loại mức độ nghiêm trọng.
 *    - Dùng cho các sự kiện khẩn cấp (Báo cháy, lỗi thiết bị) để Frontend kích hoạt còi hú hoặc hiển thị cảnh báo đỏ trên màn hình.
 * 
 * 3. Hàm unicastEvent (Gọi điện thoại riêng tư):
 *    - Thay vì phát loa cho cả làng nghe, hàm này nhắm đích danh một cá nhân (dựa vào Email/Username) để gửi tin nhắn.
 *    - Dùng khi muốn báo lỗi riêng tư, hoặc gửi hình ảnh camera biển số xe cho đúng cái ông bảo vệ đang ngồi ở cái cổng đó, các cổng khác không được xem.
 */
@Service
public class WebSocketEventPublisher {

    /**
     * Chiếc Micro (SimpMessagingTemplate) được Giám đốc (Spring Boot) giao cho ông MC 
     * thông qua cơ chế Tiêm phụ thuộc (Dependency Injection).
     */
    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * HÀM 1: PHÁT THANH CÔNG CỘNG (BROADCAST)
     * - Giống như loa phường. Ông MC hét lên đài FM, tất cả mọi người đang vặn đài đó đều nghe thấy.
     * 
     * Cách thức hoạt động:
     * - topic: Tên đài FM muốn phát (Ví dụ: "/topic/slots/status").
     * - eventType: Loại tin tức (Ví dụ: "SLOT_UPDATED").
     * - payload: Nội dung chi tiết (Ví dụ: Thông tin ô đậu xe A5).
     * -> Ông MC lấy tin tức bỏ vào Phong bì chuẩn (WsMessageWrapper), sau đó bấm Micro phát đi!
     */
    public void broadcastEvent(String topic, String eventType, Object payload) {
        WsMessageWrapper<Object> message = WsMessageWrapper.of(eventType, payload);
        messagingTemplate.convertAndSend(topic, message);
    }

    /**
     * HÀM 2: PHÁT THANH KHẨN CẤP (CRITICAL BROADCAST)
     * - Giống hệt hàm số 1, nhưng ông MC dán thêm chữ "CRITICAL" (Khẩn cấp) màu đỏ chót lên cái Phong bì.
     * - Dùng khi có cháy nổ, báo động đỏ, hoặc hệ thống bãi xe gặp sự cố nghiêm trọng.
     * - Frontend nhận được phong bì này sẽ lập tức réo còi hoặc bật Pop-up đỏ lên màn hình.
     */
    public void broadcastCriticalEvent(String topic, String eventType, Object payload) {
        WsMessageWrapper<Object> message = WsMessageWrapper.of(eventType, "CRITICAL", payload);
        messagingTemplate.convertAndSend(topic, message);
    }

    /**
     * HÀM 3: GỌI ĐIỆN RIÊNG TƯ (UNICAST)
     * - Thay vì dùng Loa phường, ông MC dùng điện thoại bàn gọi thẳng cho Bốt gác số 1.
     * - Chỉ người được gọi mới nghe thấy tin tức này, những người khác không hề biết.
     * 
     * Cách thức hoạt động:
     * - username: Tên người nhận (Ví dụ Email của bảo vệ Cổng số 1).
     * - queue: Số điện thoại máy lẻ (Ví dụ: "/queue/gates/GATE_IN_01").
     * -> Ông MC dùng lệnh "convertAndSendToUser" để ném thẳng cái phong bì vào hòm thư cá nhân của nhân viên đó.
     */
    public void unicastEvent(String username, String queue, String eventType, Object payload) {
        WsMessageWrapper<Object> message = WsMessageWrapper.of(eventType, payload);
        messagingTemplate.convertAndSendToUser(username, queue, message);
    }
}
