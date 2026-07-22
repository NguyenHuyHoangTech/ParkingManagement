// --- CÁC THƯ VIỆN GỐC CỦA REACT ---
// useEffect: Dùng để bắt khoảnh khắc nhân viên vừa mở trang web lên là nhấc máy gọi điện ngay.
// useState: Dùng để lưu trữ "Ống nghe" và Trạng thái đèn báo (Xanh/Đỏ).
import { useEffect, useState } from 'react';

// --- THƯ VIỆN KẾT NỐI TỔNG ĐÀI ---
// Client: Mô hình chiếc Máy điện thoại bàn chuẩn STOMP để giao tiếp mượt mà với Tổng đài Spring Boot.
import { Client } from '@stomp/stompjs';

// --- KHO LƯU TRỮ TRẠNG THÁI (ZUSTAND) ---
// Nơi lưu trữ thông tin đăng nhập và Thẻ bảo vệ (Token) của người dùng hiện tại.
import { useAuthStore } from '../store/useAuthStore';

/**
 * HOOK KẾT NỐI TỔNG ĐÀI (WEBSOCKET CLIENT)
 * 
 * TÓM TẮT BỨC TRANH TOÀN CẢNH TRONG FILE NÀY:
 * Đây là "Chiếc điện thoại bàn" đặt tại máy tính của ông Bảo vệ (Frontend).
 * 
 * 1. Khởi tạo trạng thái ban đầu: 
 *    - Chuẩn bị "Ống nghe" (stompClient) và đèn báo trạng thái (connected).
 *    - Lấy Thẻ bảo vệ (Token) từ trong ví (useAuthStore) cầm sẵn trên tay.
 * 
 * 2. Cấu hình chiếc điện thoại (Bên trong useEffect):
 *    - brokerURL: Bấm số gọi lên Máy chủ (URL /ws-pbms). Tự động nhận diện web đang chạy HTTP hay HTTPS để chọn cáp mạng phù hợp (ws hoặc wss).
 *    - connectHeaders: Xòe Thẻ bảo vệ ra trước ống kính để máy chủ kiểm tra danh tính.
 *    - reconnectDelay: Lên lịch hẹn, nếu rớt mạng thì cứ 5 giây bấm nút tự động gọi lại 1 lần.
 *    - heartbeat: Cam kết nhịp tim, hứa cứ 4 giây sẽ gõ ống nghe 1 lần để máy chủ biết mình chưa ngủ.
 * 
 * 3. Đăng ký các bộ phận xử lý sự kiện:
 *    - onConnect: Khi đầu dây bên kia nhấc máy -> Đổi đèn trạng thái sang màu Xanh.
 *    - onStompError: Khi bị máy chủ chửi (Ví dụ: Thẻ hết hạn) -> Ghi lại nhật ký lỗi.
 *    - onWebSocketError: Khi đứt cáp quang hoặc bị Tường lửa chặn -> Ghi lại nhật ký lỗi.
 *    - onWebSocketClose: Khi gập Laptop đi ngủ -> Đổi đèn trạng thái sang màu Đỏ.
 * 
 * 4. Hành động thực tế:
 *    - client.activate(): Quyết định nhấc máy lên và bắt đầu gọi!
 *    - client.deactivate(): Cúp máy và dọn dẹp khi nhân viên tắt trang web hoặc đăng xuất.
 */
export const useWebSocket = () => {
  const [stompClient, setStompClient] = useState<Client | null>(null);
  const [connected, setConnected] = useState(false);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) return;

    const client = new Client({
      brokerURL: window.location.protocol === 'https:' ? `wss://${window.location.host}/ws-pbms` : `ws://${window.location.host}/ws-pbms`,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: function (str) {
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = () => {
      setConnected(true);
    };

    client.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    client.onWebSocketError = (event) => {
      console.error('WebSocket Transport Error:', event);
    };

    client.onWebSocketClose = (event) => {
      console.warn('WebSocket Connection Closed:', event);
      setConnected(false);
    };

    client.activate();
    setStompClient(client);

    return () => {
      client.deactivate();
      setConnected(false);
    };
  }, [token]);

  return { stompClient, connected };
};
