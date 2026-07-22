package com.pbms.common.config;

// --- CÁC THƯ VIỆN BẢO MẬT NỘI BỘ ---
// Máy quét thẻ (Token) do công ty tự viết để kiểm tra khách gọi điện
import com.pbms.common.security.JwtProvider;

// --- CÁC THƯ VIỆN CỐT LÕI CỦA SPRING BOOT ---
// Dùng để đánh dấu file này là một bản thiết kế cấu hình hệ thống
import org.springframework.context.annotation.Configuration;
// Dùng để đọc cấu hình từ file application.yml (như danh sách trang web được phép gọi tới)
import org.springframework.beans.factory.annotation.Value;

// --- CÁC THƯ VIỆN WEBSOCKET / STOMP (MESSAGING) ---
// Định nghĩa một cục Hàng Hóa (Gói tin) truyền qua đường ống
import org.springframework.messaging.Message;
// Định nghĩa cái Ống Nước (Kênh truyền tải)
import org.springframework.messaging.MessageChannel;
// Dùng để khai báo và cấu hình các trạm kiểm soát trên đường ống
import org.springframework.messaging.simp.config.ChannelRegistration;
// Cuốn sổ đăng ký các Đài Phát Thanh (như /topic, /queue)
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
// Định nghĩa các lệnh mà Frontend gửi lên (Ví dụ lệnh CONNECT, SUBSCRIBE, SEND)
import org.springframework.messaging.simp.stomp.StompCommand;
// Công cụ để bóc tách lớp vỏ gói tin STOMP (Dùng để móc Token ra từ Header)
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
// Định nghĩa "Ông Bảo Vệ" đứng chặn ở giữa đường ống để kiểm tra an ninh
import org.springframework.messaging.support.ChannelInterceptor;
// Công cụ phụ trợ giúp chuyển đổi gói tin thô thành StompHeaderAccessor
import org.springframework.messaging.support.MessageHeaderAccessor;
// Bật tính năng Tổng đài điện thoại (WebSocket STOMP)
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
// Cuốn sổ đăng ký Số điện thoại Tổng đài (Ví dụ số /ws-pbms)
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
// Hợp đồng quy chuẩn bắt buộc phải tuân theo khi thiết kế Tổng đài
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

// --- CÁC THƯ VIỆN BẢO MẬT (SPRING SECURITY) ---
// Chiếc Thẻ Bảng Tên chuẩn của Spring Security để cấp cho người dùng
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
// Định nghĩa chung cho Quyền Hạn (Chức vụ)
import org.springframework.security.core.GrantedAuthority;
// Một cái Băng rôn ghi rõ tên quyền hạn (Ví dụ: "ROLE_STAFF")
import org.springframework.security.core.authority.SimpleGrantedAuthority;
// Bảng Thông Báo Chung - Nơi đeo cái thẻ chức vụ lên ngực khách hàng để lưu trữ
import org.springframework.security.core.context.SecurityContextHolder;

// --- CÁC THƯ VIỆN TIỆN ÍCH CỦA JAVA ---
import java.util.Collections;
import java.util.List;

/**
 * LỚP CẤU HÌNH TỔNG ĐÀI WEBSOCKET
 * - @Configuration: Báo cho Spring Boot biết lúc vừa bật máy chủ lên phải đọc file này đầu tiên.
 * - @EnableWebSocketMessageBroker: Chính thức khai trương Dịch vụ Tổng đài điện thoại STOMP.
 * - implements WebSocketMessageBrokerConfigurer: Ký hợp đồng nhận thầu xây dựng Tổng đài, bắt buộc phải làm theo các bản thiết kế chuẩn.
 * 
 * TÓM TẮT BỨC TRANH TOÀN CẢNH CỦA 4 HÀM TRONG FILE NÀY:
 * 
 * 1. Hàm configureMessageBroker (Thiết lập trạm phát sóng & Nhịp tim):
 *    - Tạo ra nhân viên đo nhịp tim (cứ 10s ping 1 lần để chống sập mạng).
 *    - Mở 2 đài phát thanh chính: `/topic` (Loan tin công cộng) và `/queue` (Nhắn tin riêng tư).
 *    - Đặt hộp thư `/app` để hứng tin nhắn từ Frontend gửi ngược lên Backend.
 * 
 * 2. Hàm registerStompEndpoints (Cấp số điện thoại):
 *    - Công bố số tổng đài chính thức là `/ws-pbms`.
 *    - Áp dụng danh sách khách VIP (CORS) để chặn web lừa đảo.
 *    - Kích hoạt phao cứu sinh `withSockJS()` để chống lại các Tường lửa cấm đường hầm WebSocket.
 * 
 * 3. Hàm configureClientInboundChannel (Lập chốt kiểm tra an ninh):
 *    - Cử ông bảo vệ `ChannelInterceptor` ra chặn đứng mọi gói tin có ý định xin kết nối (`CONNECT`).
 *    - Dùng dao rọc giấy `StompHeaderAccessor` moi thẻ Token ra khỏi gói tin.
 *    - Đưa vào máy quét `JwtProvider` kiểm tra thật giả.
 *    - Nếu thẻ thật: Ép thẻ thành Bảng tên VIP chuẩn Spring Security và cấp phép cho đi tiếp.
 * 
 * 4. Hàm configureWebSocketTransport (Quy định tính chất vật lý của đường ống):
 *    - Thiết lập luật thép để chống Hacker tấn công làm nổ tung máy chủ (DDoS).
 *    - Giới hạn gói hàng tối đa 20MB, kho chứa tạm 20MB, và thời gian giao hàng tối đa 20 giây.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * @Value("${cors.allowed-origins}"): Mở file application.yml ra, đọc danh sách các trang web được phép gọi điện,
     * và nhét vào biến allowedOrigins (Bộ lọc chặn cuộc gọi rác).
     */
    @Value("${cors.allowed-origins}")
    private String[] allowedOrigins;

    /**
     * jwtProvider: Cái máy quét thẻ (Mộc đỏ) cấp phát cho ông Bảo vệ Tổng đài.
     */
    private final JwtProvider jwtProvider;

    public WebSocketConfig(JwtProvider jwtProvider) {
        this.jwtProvider = jwtProvider;
    }

    /**
     * HÀM SỐ 1: THIẾT LẬP CÁC KÊNH PHÁT THANH (BROKER) VÀ NHỊP TIM
     * Nhiệm vụ của hàm này là tạo ra các trạm phát sóng và giữ cho đường dây không bị rớt.
     * 
     * Giải thích logic bên trong (Clean code, không comment inline):
     * - ThreadPoolTaskScheduler: Thuê một nhân viên (Thread) chuyên làm nhiệm vụ bắt mạch nhịp tim.
     * - config.enableSimpleBroker("/topic", "/queue"): Mở 2 đài phát thanh chính.
     * - setHeartbeatValue(new long[]{10000, 10000}): Quy định cứ 10 giây Máy chủ và Trình duyệt phải "ping" nhau 1 lần để báo còn sống.
     * - config.setApplicationDestinationPrefixes("/app"): Nếu Frontend muốn gửi tin nhắn ngược lại cho Backend thì phải dán tem "/app" trước đường dẫn.
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler taskScheduler = new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
        taskScheduler.setPoolSize(1);
        taskScheduler.setThreadNamePrefix("wss-heartbeat-thread-");
        taskScheduler.initialize();

        config.enableSimpleBroker("/topic", "/queue")
              .setHeartbeatValue(new long[]{10000, 10000})
              .setTaskScheduler(taskScheduler);
              
        config.setApplicationDestinationPrefixes("/app");
    }

    /**
     * HÀM SỐ 2: CÔNG BỐ SỐ ĐIỆN THOẠI TỔNG ĐÀI ĐỂ FRONTEND GỌI TỚI
     * 
     * Giải thích logic bên trong:
     * - registry.addEndpoint("/ws-pbms"): Công bố số điện thoại chính thức là "/ws-pbms".
     * - setAllowedOrigins(allowedOrigins): Áp dụng bộ lọc chống gọi rác đã cấu hình ở trên.
     * - withSockJS(): Chức năng cứu hộ. Nếu Frontend dùng điện thoại đời cũ (hoặc mạng chặn WebSocket), 
     *   thì SockJS sẽ giả lập đường ống để vẫn gọi được bình thường.
     * - Đăng ký thêm một số dự phòng y hệt nhưng không có SockJS.
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-pbms")
                .setAllowedOrigins(allowedOrigins)
                .withSockJS();
        
        registry.addEndpoint("/ws-pbms")
                .setAllowedOrigins(allowedOrigins);
    }

    /**
     * HÀM SỐ 3: BỐ TRÍ ÔNG BẢO VỆ CHẶN CUỘC GỌI VÀ KIỂM TRA MẬT KHẨU (TOKEN)
     * Đây là trạm kiểm soát an ninh của Tổng đài vì đường dây WebSocket đi theo đường cáp ngầm.
     * 
     * Giải thích logic bên trong:
     * - Chặn mọi tin nhắn gửi tới bằng ChannelInterceptor.
     * - Nếu lệnh gọi là "CONNECT" (Xin kết nối tổng đài):
     *   + Bóc tách cái vỏ "Authorization" ra.
     *   + Cắt bỏ 7 chữ cái đầu "Bearer " để lấy Token tinh khiết.
     *   + Bỏ vào máy quét (jwtProvider.validateToken).
     *   + Nếu thẻ thật: Móc lấy Email và Chức vụ (Role) từ Token.
     *   + In ra một Bảng tên chuẩn (UsernamePasswordAuthenticationToken).
     *   + Đeo bảng tên đó lên ngực khách hàng (SecurityContextHolder) và gắn vào hồ sơ cuộc gọi (accessor).
     * - Cuối cùng, thả cho gói tin tiếp tục đi vào hệ thống.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    List<String> authorization = accessor.getNativeHeader("Authorization");
                    if (authorization != null && !authorization.isEmpty()) {
                        String authHeader = authorization.get(0);
                        if (authHeader != null && authHeader.startsWith("Bearer ")) {
                            String token = authHeader.substring(7);
                            if (jwtProvider.validateToken(token)) {
                                String email = jwtProvider.getEmailFromToken(token);
                                String role = jwtProvider.getRoleFromToken(token);
                                
                                List<GrantedAuthority> authorities = Collections.singletonList(
                                        new SimpleGrantedAuthority(role.startsWith("ROLE_") ? role : "ROLE_" + role)
                                );
                                
                                UsernamePasswordAuthenticationToken auth =
                                        new UsernamePasswordAuthenticationToken(email, null, authorities);
                                SecurityContextHolder.getContext().setAuthentication(auth);
                                accessor.setUser(auth);
                            }
                        }
                    }
                }
                return message;
            }
        });
    }

    /**
     * HÀM SỐ 4: QUY ĐỊNH KÍCH THƯỚC CỐNG THOÁT NƯỚC (GIỚI HẠN BĂNG THÔNG)
     * 
     * Giải thích logic bên trong:
     * - setMessageSizeLimit: Quy định kích thước 1 cục hàng ném vào đường ống tối đa là 20MB.
     * - setSendBufferSizeLimit: Kho chứa tạm (Buffer) cũng giới hạn ở 20MB.
     * - setSendTimeLimit: Nếu quá 20 giây mà hàng không chuyển tới đích -> Hủy lô hàng (Time out).
     */
    @Override
    public void configureWebSocketTransport(org.springframework.web.socket.config.annotation.WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(20 * 1024 * 1024);
        registration.setSendBufferSizeLimit(20 * 1024 * 1024);
        registration.setSendTimeLimit(20000);
    }
}
