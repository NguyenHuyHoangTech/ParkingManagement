# 📖 CẨM NANG CHI TIẾT: HỆ THỐNG WEBSOCKET (REAL-TIME) TRONG PBMS
*Tài liệu này là bản mổ xẻ chi tiết nhất về cách Frontend và Backend giao tiếp Thời gian thực (Real-time) trong dự án. Chúng ta sẽ dùng hình tượng **"Trạm Phát Thanh và Chiếc Radio"** để giải thích toàn bộ mã nguồn.*

---

## 1. KHỞI TẠO ĐƯỜNG DÂY Ở FRONTEND (Hook `useWebSocket`)
**📍 Địa điểm:** `src/core/websocket/useWebSocket.ts`

Khác với HTTP (gửi thư rồi ngắt kết nối), WebSocket đòi hỏi chúng ta phải cầm ống nghe lên, bấm số và duy trì đường dây liên tục. Toàn bộ quá trình "Nhấc máy" này được gói gọn trong một Custom Hook.

### Phân tích chi tiết mã nguồn:

```typescript
export const useWebSocket = () => {
  const [stompClient, setStompClient] = useState<Client | null>(null);
  const [connected, setConnected] = useState(false);
  
  // 1. RÚT THẺ BẢO VỆ TỪ KÉT SẮT
  // Dùng selector (state) => state.token để React không bị giật lag (Re-render) khi các thông tin khác trong két thay đổi.
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) return; // Không có thẻ thì không cho phép gọi điện

    // 2. MUA MỘT CHIẾC ĐIỆN THOẠI MỚI (Cấu hình Client)
    const client = new Client({
      // brokerURL (Số điện thoại): Tự động dùng ws:// hoặc wss:// tùy môi trường mạng (HTTP/HTTPS)
      brokerURL: window.location.protocol === 'https:' ? `wss://${window.location.host}/ws-pbms` : `ws://${window.location.host}/ws-pbms`,
      
      // connectHeaders (Chìa khóa bảo mật): Nộp thẻ Token có chữ Bearer đằng trước
      connectHeaders: { Authorization: `Bearer ${token}` },
      
      // reconnectDelay: Nếu bị đứt cáp, tự động gọi lại sau 5 giây (Không cần F5 trang web)
      reconnectDelay: 5000,
      
      // heartbeat: Cam kết cứ 4 giây sẽ PING Máy chủ 1 lần để báo "Tôi còn sống". 
      // (Khi kết nối, hệ thống sẽ lấy Max giữa 4s và cấu hình của Backend để chốt nhịp tim chung).
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    // 3. DÁN GIẤY GHI CHÚ SỰ KIỆN LÊN ĐIỆN THOẠI
    client.onConnect = () => setConnected(true); // Nhấc máy thành công -> Bật đèn Xanh
    client.onWebSocketClose = () => setConnected(false); // Cúp máy -> Bật đèn Đỏ
    
    // 4. KÍCH NỔ CUỘC GỌI
    client.activate(); 
    setStompClient(client);

    // 5. HÀM DỌN DẸP (CLEANUP)
    // Tự động cúp máy khi nhân viên F5 hoặc đóng Tab, giúp Máy chủ không bị đầy RAM bởi các "kết nối ma".
    return () => {
      client.deactivate();
      setConnected(false);
    };
  }, [token]);

  // Trả cái khay chứa Điện thoại và Đèn trạng thái ra cho các Màn hình bốt gác xài
  return { stompClient, connected };
};
```

---

## 2. TỔNG ĐÀI NHẬN CUỘC GỌI Ở BACKEND (`WebSocketConfig.java`)
**📍 Địa điểm:** `src/main/java/com/pbms/common/config/WebSocketConfig.java`

Để Frontend gọi được số `/ws-pbms`, trên Máy chủ (Backend) phải xây dựng một **Tổng đài** để tiếp nhận.

### A. Dựng Ăng-ten & Mở Đài Phát Thanh
```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Cắm cây Ăng-ten mang tên "/ws-pbms". Frontend phải gọi đúng tên này.
        // withSockJS(): Hỗ trợ mạng chặn WebSocket bằng cách giả lập kết nối.
        registry.addEndpoint("/ws-pbms").setAllowedOrigins("*").withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Mở 2 dải tần số để phát sóng:
        // - "/topic": Loa phường (Phát cho toàn bộ bãi xe, ví dụ: Cập nhật bản đồ).
        // - "/queue": Điện thoại riêng tư (Chỉ gọi đích danh 1 bốt gác, ví dụ: Ảnh camera Cổng 1).
        config.enableSimpleBroker("/topic", "/queue");
        
        // "/app": (Chưa dùng) Hòm thư ngầm để Frontend gửi lệnh lên Backend.
        config.setApplicationDestinationPrefixes("/app"); 
    }
}
```

### B. Bằng chứng kết nối không qua trung gian: "Ông Bảo vệ Tổng đài"
Một sự thật thú vị: Dữ liệu bay **THẲNG TẮP** từ Frontend qua cáp quang Internet tới Backend mà không thông qua bất kỳ file trung gian nào. Dưới đây là bằng chứng thép chỉ ra điểm chạm khớp nhau 100%:

**1. Bàn tay gởi đi (Frontend - `useWebSocket.ts`):**
Lập trình viên nhét tấm thẻ vào túi `connectHeaders` với nhãn dán là `Authorization`.
```typescript
connectHeaders: {
  Authorization: `Bearer ${token}`,
}
```
Khối dữ liệu này được ép thành một gói tin thô mang tên Lệnh `CONNECT` và ném bay qua Internet.

**2. Bàn tay đón lấy (Backend - `WebSocketConfig.java`):**
Vì đường dây WebSocket chạy ngầm, không lọt qua cổng bảo vệ chính của API (`JwtAuthFilter`), nên Máy chủ bố trí một ông bảo vệ ngầm `ChannelInterceptor` thò tay chộp lấy gói tin vừa bay tới:

```java
@Override
public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(new ChannelInterceptor() {
        @Override
        public Message<?> preSend(Message<?> message, MessageChannel channel) {
            StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
            
            // 1. CHẶN BẮT GÓI TIN: Hỏi xem có phải đây là gói tin CONNECT do Frontend vừa ném qua không?
            if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                
                // 2. TÌM VÀ KHUI HÀNG: Thò tay vào túi, móc đúng cái nhãn có chữ "Authorization" mà Frontend dán lúc nãy!
                List<String> authorization = accessor.getNativeHeader("Authorization");
                String authHeader = authorization.get(0);
                
                // 3. KIỂM TRA THẺ: Cắt bỏ 7 ký tự "Bearer " để lấy Token tinh khiết
                String token = authHeader.substring(7);
                
                // 4. QUÉT THẺ: Đưa vào máy quét (jwtProvider). Nếu thẻ thật -> Cho qua!
                if (jwtProvider.validateToken(token)) {
                    // Cấp bảng tên VIP của Spring Security và gắn vào hồ sơ đường ống
                    accessor.setUser(authentication);
                }
            }
            return message;
        }
    });
}
```
Sự trùng khớp chính xác của chữ `Authorization` ở 2 đầu cáp quang chính là minh chứng rõ ràng nhất cho việc chúng giao tiếp thẳng với nhau!

---

## 3. CÁI PHONG BÌ CHUẨN VÀ ÔNG MC PHÁT THANH

### A. Bản thiết kế Phong Bì (`WsMessageWrapper.java`)
Mọi tin tức đẩy qua WebSocket **bắt buộc** phải gói trong phong bì này để Frontend dễ lột vỏ JSON.

```java
@Data
@Builder
public class WsMessageWrapper<T> {
    // 1. MÃ VẬN ĐƠN: Tạo tự động. Chống Frontend bắt trùng 1 tin nhắn do mạng chập chờn.
    @Builder.Default
    private String eventId = "EVT_" + UUID.randomUUID().toString();
    
    // 2. LOẠI SỰ KIỆN: Ví dụ "VEHICLE_SCAN" (Xe đi qua cổng).
    private String eventType;
    
    // 3. MỨC ĐỘ ƯU TIÊN: Nếu Lập trình viên lười gõ, Lombok tự động nhét chữ "NORMAL" vào.
    @Builder.Default
    private String priority = "NORMAL";
    
    // 4. HÀNG HÓA CỐT LÕI (PAYLOAD): Cục dữ liệu thật sự (Biển số xe, Ảnh Camera).
    private T data;
    
    // Nạp chồng hàm (Method Overloading) để lười biếng một cách thông minh:
    // Hàm 2 tham số: Tự ngầm hiểu priority = "NORMAL"
    public static <T> WsMessageWrapper<T> of(String eventType, T data) { ... }
}
```

### B. Ông MC Phát thanh (`WebSocketEventPublisher.java`)
Người duy nhất được cấp quyền dùng Micro (`SimpMessagingTemplate`) để hét vào đường ống.
```java
// PHÁT THANH LOA PHƯỜNG: Hét vào dải tần số "/topic" -> Tất cả cùng nghe.
public void broadcastEvent(String topic, String eventType, Object payload) {
    WsMessageWrapper<Object> message = WsMessageWrapper.of(eventType, payload);
    messagingTemplate.convertAndSend(topic, message);
}

// GỌI ĐIỆN RIÊNG TƯ: Ném phong bì thẳng vào hòm thư cá nhân của 1 nhân viên.
public void unicastEvent(String username, String queue, String eventType, Object payload) { ... }
```

---

## 4. MÔ HÌNH GHÉP NỐI TỪ A-Z (Ví dụ Màn hình Cổng Vào)

Dưới đây là chuỗi hành động cực kỳ mượt mà xảy ra trong thực tế (Ví dụ tại `GateInConsoleScreen.tsx`):

1. **Xây ăng-ten:** Backend mở cổng `/ws-pbms` và dải sóng `/topic`.
2. **Mua Radio (Mượn ống nghe):** 
   ```typescript
   // Lấy ống nghe và đèn xanh đỏ từ khay bằng cú pháp Destructuring
   const { connected, stompClient } = useWebSocket();
   ```
3. **Phát tin (Backend):** Camera chụp ảnh xe. Ông MC lấy cục Payload (Biển số xe) ném vào rãnh sóng `/topic/gates/GATE_1/scans`.
4. **Dò đài chính xác & Khui hàng (Frontend):** 
   ```typescript
   useEffect(() => {
     if (stompClient && connected) {
       // Vặn núm radio dò đài
       const destination = `/topic/gates/GATE_1/scans`;
       
       const subscription = stompClient.subscribe(destination, (msg) => {
         // Lột vỏ JSON để lấy cái phong bì
         const payload = JSON.parse(msg.body);
         
         // Thò tay móc cục Hàng Hóa Cốt Lõi (Payload.data) ra vẽ lên giao diện!
         setScanData({ plateNumber: payload.data.plateNumber }); 
       });

       // Cúp máy khi đóng màn hình
       return () => subscription.unsubscribe();
     }
   }, [stompClient, connected]);
   ```
*Toàn bộ quá trình từ lúc xe qua vạch đến lúc biển số hiện lên màn hình chỉ tốn chưa tới 1 giây!*

---

## 5. NHỮNG QUYẾT ĐỊNH KIẾN TRÚC ĐỈNH CAO CỦA TEAM (ARCHITECTURE)

### A. Tại sao "Chỗ nào xài, Chỗ đó dò" (Decentralized Subscription)?
Tại sao không gom tất cả lệnh `subscribe` vào chung file `useWebSocket.ts` cho code Frontend ngắn lại?
- **Câu trả lời là HIỆU NĂNG.** Ý tưởng gom chung giống như dùng *Truyền hình Cáp* (Bắt mạng nhà bạn tải cả 200 kênh dù bạn chỉ xem 1 kênh).
- Team áp dụng tư duy **On-Demand (Giống YouTube)**: Khi bảo vệ mở màn hình Cổng 1, màn hình đó mới `subscribe` vào kênh Cổng 1. Khi bảo vệ chuyển tab đi chơi game, hàm `unsubscribe()` lập tức chạy, cắt luồng dữ liệu, giải phóng 100% RAM và Băng thông mạng 4G. 

### B. Tại sao Frontend không dùng WebSocket để gửi dữ liệu lên Backend?
Lập trình viên hoàn toàn có quyền gọi `stompClient.publish()` để nhắn tin ngược lên Backend. Nhưng trong dự án PBMS, thao tác này KHÔNG HỀ TỒN TẠI. Tại sao?
- Team đang áp dụng mô hình kiến trúc **CQRS (Command-Event Separation)**.
- **Chiều Gửi Lên (Mệnh lệnh - Command):** Khi bảo vệ bấm "Cho xe vào", họ cần biết ngay tức khắc là Database lưu thành công hay báo lỗi đỏ. Do đó bắt buộc phải dùng **HTTP (Axios)** để chờ phản hồi đồng bộ (Request-Response).
- **Chiều Phóng Xuống (Sự kiện - Event):** Hình ảnh camera chụp hàng loạt, trạng thái bãi xe nhảy số liên tục. Dùng HTTP để ngồi hỏi "Có xe chưa?" sẽ làm sập máy chủ. Do đó phải dùng **WebSocket** để Máy chủ rảnh tay phóng ảnh xuống bốt gác với tốc độ xé gió.

*Sự rạch ròi giữa Chiều Gửi Lên (HTTP) và Chiều Phóng Xuống (WebSocket) chính là chìa khóa giúp hệ thống Bãi Giữ Xe vận hành 24/7 không bao giờ sập!*
