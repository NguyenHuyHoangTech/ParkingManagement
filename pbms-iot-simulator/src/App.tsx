/**
 * ============================================================================
 * [IMPORT LIBRARIES & UTILITIES] - Các thư viện và công cụ tiện ích
 * ============================================================================
 * 1. React & Hooks: useState, useEffect, useRef... quản lý trạng thái, vòng đời ứng dụng.
 * 2. Ant Design (antd): Cung cấp các UI component cho bảng điều khiển giả lập phần cứng.
 * 3. TanStack React Query: useQuery (polling định kỳ /data-sync), useMutation (gửi sự kiện IoT).
 * 4. Axios: Client HTTP gọi trực tiếp các endpoint /api/v1/operation/iot/** kèm X-API-KEY.
 * 5. STOMP & Day.js: Lắng nghe WebSocket đồng bộ thời gian và xử lý mốc thời gian mô phỏng.
 * ============================================================================
 */
import React, { useState } from 'react';
import { Card, Typography, Row, Col, Form, Input, Button, Select, message, Table, Tag, DatePicker, ConfigProvider, theme, Radio } from 'antd';
import { SendOutlined, FastForwardOutlined, CopyOutlined, SyncOutlined, AimOutlined } from '@ant-design/icons';
import { useMutation, useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import dayjs from 'dayjs';
import { Client } from '@stomp/stompjs';
import { SimulatorMap } from './SimulatorMap';
import { DashboardLayout } from './layouts/DashboardLayout';

const { Title, Text } = Typography;

/**
 * ============================================================================
 * MÔ TẢ TỔNG QUAN VỀ LUỒNG DỮ LIỆU & TƯƠNG TÁC CỦA IOT SIMULATOR APP (App.tsx)
 * ============================================================================
 *
 * [PHẦN 1] MỤC ĐÍCH & VAI TRÒ CỦA COMPONENT:
 *    - Ứng dụng giả lập phần cứng IoT độc lập (PBMS IoT Hardware Simulator).
 *    - Chịu trách nhiệm: Mô phỏng thiết bị thực tế tại bãi xe bao gồm camera LPR
 *      nhận diện biển số, đầu đọc thẻ RFID, cảm biến vị trí đỗ (Ultrasonic Slot Sensor),
 *      barie điện tử và hệ thống đồng bộ thời gian (Time-Travel Clock) để phục vụ
 *      kiểm thử tự động hóa và demo luồng nghiệp vụ.
 *
 * [PHẦN 2] GIẢI PHẪU VÒNG ĐỜI DỮ LIỆU (DATA FLOW LIFECYCLE) KÈM MINH CHỨNG:
 *
 * BƯỚC 1: ĐỒNG BỘ TRẠNG THÁI BÃI XE (REAL-TIME DATA SYNC)
 * - Minh chứng (API Sync): Sử dụng `useQuery` gọi định kỳ `GET /api/v1/operation/iot/hardware/data-sync`
 *   để kéo toàn bộ danh sách thẻ RFID, ô đỗ (slots), vé tháng và bảng giá về simulator.
 *
 * BƯỚC 2: GIẢ LẬP XE VÀO CỔNG IN (HARDWARE CHECK-IN & CAMERA SCAN)
 * - Minh chứng (API Check-In): Gửi `POST /api/v1/operation/iot/hardware/check-in`
 *   kèm `rfid`, `plateNumber`, `imageInBase64`, `lprImageInBase64` để kích hoạt
 *   trạng thái "đang quét xe vào" trên màn hình nhân viên `GateInConsoleScreen`.
 *
 * BƯỚC 3: GIẢ LẬP XE RA CỔNG OUT & THANH TOÁN (HARDWARE CHECK-OUT)
 * - Minh chứng (API Check-Out): Gửi `POST /api/v1/operation/iot/hardware/check-out`
 *   kèm ảnh toàn cảnh ra & ảnh cắt LPR ra để kích hoạt tính phí trên `GateOutConsoleScreen`.
 *
 * BƯỚC 4: GIẢ LẬP CẢM BIẾN VỊ TRÍ ĐỖ & ĐỒNG BỘ THỜI GIAN (SLOT SENSORS & TIME TRAVEL)
 * - Minh chứng 1 (API Sensor): Gửi `PUT /api/v1/operation/iot/hardware/slot-status`
 *   đổi trạng thái ô đỗ `OCCUPIED` / `EMPTY` khi xe đỗ vào hoặc rời ô.
 * - Minh chứng 2 (API Time): Gửi `POST /api/v1/operation/iot/hardware/time-travel`
 *   để tua thời gian mô phỏng toàn hệ thống phục vụ kiểm thử quá giờ, vé tháng.
 * ============================================================================
 */

// Mọi request gọi thẳng nhóm endpoint `/api/v1/operation/iot/**` đều bị
// `IoTAuthenticationFilter` (Backend) chặn nếu thiếu header X-API-KEY đúng —
// gắn 1 lần duy nhất ở đây cho TOÀN BỘ request axios của app này.
axios.defaults.headers.common['X-API-KEY'] = 'PBMS-HARDWARE-SECURE-KEY-2024';

// QueryClient dùng chung cho toàn app (bọc ở RootApp cuối file) — quản lý
// cache của mọi `useQuery`/`useMutation`, cho phép gọi `refetchSync()` để làm
// mới dữ liệu ngay sau khi 1 mutation (check-in, sensor, time-travel) thành công.
const queryClient = new QueryClient();

// Dữ liệu Slot giả (48 ô, tên S1..S48, đều đang trống) — CHỈ dùng làm màn
// hình dự phòng khi Backend chưa trả dữ liệu thật (`syncData` còn null lúc
// mới load, hoặc API `/data-sync` đang lỗi) để UI không bị trống trơn/vỡ layout.
const MOCK_SLOTS = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1,
  slotName: `S${i + 1}`,
  status: 'EMPTY',
  currentPlate: null
}));

/**
 * =========================================================================
 * HÀM NỘI BỘ: TẠO ẢNH "CAMERA TOÀN CẢNH" GIẢ LẬP (MOCK PANORAMA CAMERA)
 * =========================================================================
 * MỤC ĐÍCH:
 * Thiết bị camera thật chưa có trong môi trường demo, nên hàm này VẼ TAY một
 * bức ảnh giả (bằng Canvas 2D API của trình duyệt) trông giống ảnh chụp từ
 * camera an ninh: có xe, có biển số, có watermark thời gian — để Backend
 * (vốn lưu `imageBase64` như 1 ảnh thật) và giao diện xem lại (GateConsoleScreen
 * bên pbms-fe) hiển thị được thứ gì đó thay vì ảnh trống.
 *
 * MÃ GIẢ CHI TIẾT:
 * 1. Tạo canvas 640x480, dùng `plateNumber` làm "seed" cho hàm random riêng
 *    (`Math.sin` biến đổi seed) — CỐ Ý để cùng 1 biển số luôn ra cùng 1 bức
 *    ảnh (dễ nhận diện lại khi debug), khác với `Math.random()` thật sự ngẫu
 *    nhiên mỗi lần gọi.
 * 2. Vẽ nền màu ngẫu nhiên (giả lập nền đường/tường) + vài đường nhiễu mờ.
 * 3. Vẽ "đuôi xe" (hình chữ nhật bo góc) — kích thước khác nhau giữa ô tô
 *    (`isCar`, nhận diện qua chuỗi loại xe chứa "4 ch"/"7 ch" hoặc rỗng) và
 *    xe máy, kèm đèn hậu đỏ (2 đèn cho ô tô, 1 đèn giữa cho xe máy).
 * 4. Vẽ biển số nền trắng viền đen, chèn text `plateNumber` chính giữa.
 * 5. Vẽ thanh overlay đen ở mép trên ghi "CAM-01 | <timestamp> | EVENT: ...".
 * 6. Vẽ thêm 1 dấu cộng (crosshair) mờ ở giữa ảnh cho giống watermark camera.
 * 7. Xuất ảnh dạng JPEG base64 (`data:image/jpeg;base64,...`) chất lượng 80%.
 */
const generateMockLicensePlateImage = (plateNumber: string, actionType: string, vehicleType: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  let seed = (plateNumber || 'UNKNOWN').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const random = () => {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  // 1. Random background color (street/wall simulation)
  const r = Math.floor(random() * 100) + 50;
  const g = Math.floor(random() * 100) + 50;
  const b = Math.floor(random() * 100) + 50;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw some random lines/shapes for noise
  for (let i = 0; i < 15; i++) {
    ctx.beginPath();
    ctx.moveTo(random() * canvas.width, random() * canvas.height);
    ctx.lineTo(random() * canvas.width, random() * canvas.height);
    ctx.strokeStyle = `rgba(255,255,255,${random() * 0.2})`;
    ctx.lineWidth = random() * 10;
    ctx.stroke();
  }

  // 3. Draw Vehicle tail (a simple box representing the car rear)
  const isCar = vehicleType?.includes('4 ch') || vehicleType?.includes('7 ch') || !vehicleType;
  const carWidth = isCar ? 400 : 200;
  const carHeight = isCar ? 250 : 300;
  const carX = (canvas.width - carWidth) / 2;
  const carY = canvas.height - carHeight - 40; 
  
  // Randomize car color slightly
  const carR = Math.floor(random() * 155) + 100;
  const carG = Math.floor(random() * 155) + 100;
  const carB = Math.floor(random() * 155) + 100;
  ctx.fillStyle = `rgb(${carR},${carG},${carB})`;
  
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  // Car body
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(carX, carY, carWidth, carHeight, 20) : ctx.fillRect(carX, carY, carWidth, carHeight);
  ctx.fill();
  ctx.shadowBlur = 0; 
  
  // Draw taillights
  ctx.fillStyle = '#e74c3c';
  if (isCar) {
    ctx.fillRect(carX + 20, carY + 40, 60, 30);
    ctx.fillRect(carX + carWidth - 80, carY + 40, 60, 30);
  } else {
    // Motorcycle single tail light
    ctx.fillRect(carX + carWidth / 2 - 25, carY + 40, 50, 30);
  }

  // 4. Draw License Plate
  const plateWidth = 220;
  const plateHeight = 70;
  const plateX = (canvas.width - plateWidth) / 2;
  const plateY = carY + 120;

  ctx.fillStyle = '#ffffff'; 
  ctx.fillRect(plateX, plateY, plateWidth, plateHeight);
  ctx.strokeStyle = '#000000'; 
  ctx.lineWidth = 4;
  ctx.strokeRect(plateX, plateY, plateWidth, plateHeight);

  // 5. Draw Plate Number text
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 38px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(plateNumber || 'NO-PLATE', plateX + plateWidth / 2, plateY + plateHeight / 2 + 5);

  // 6. Draw overlay info
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, 40);
  
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const eventText = `EVENT: ${actionType} | TYPE: ${vehicleType || 'UNKNOWN'}`;
  ctx.fillText(`CAM-01 | ${timestamp} | ${eventText}`, 10, 25);

  // 7. Add a small mock camera watermark/crosshair
  ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 40);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  // Trả về kèm tiền tố `data:image/jpeg;base64,...` (không cắt bỏ) vì
  // Backend/FE hiển thị ảnh bằng thẳng chuỗi này làm `src` của thẻ <img>.
  return canvas.toDataURL('image/jpeg', 0.8);
};

/**
 * HÀM NỘI BỘ: TẠO ẢNH "CAMERA LPR" GIẢ LẬP (MOCK LICENSE PLATE RECOGNITION CROP)
 * MỤC ĐÍCH: vẽ 1 ảnh nhỏ (300x100) chỉ chứa biển số cắt cận — mô phỏng khung
 * hình mà camera nhận diện biển số (LPR) thật sự sẽ crop ra, khác với ảnh
 * toàn cảnh của `generateMockLicensePlateImage`. Nền trắng viền đen, chữ đen
 * căn giữa — không dùng seed ngẫu nhiên vì không cần yếu tố "nhiễu" như ảnh
 * camera toàn cảnh.
 */
const generateMockLprImage = (plateNumber: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff'; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#000000'; 
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(plateNumber || 'NO-PLATE', canvas.width / 2, canvas.height / 2 + 5);

  return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Xác định gốc URL REST API của Backend. Ưu tiên biến môi trường
 * `VITE_IOT_API_URL` (đặt khi build cho môi trường khác localhost, ví dụ
 * demo qua ngrok/mạng LAN); nếu không có thì tự suy ra từ hostname hiện tại
 * của trình duyệt + cổng cố định 8080 — nhờ đó cùng 1 bản build chạy đúng dù
 * mở bằng `localhost` hay bằng IP LAN của máy chạy Backend.
 */
const getBaseApiUrl = () => {
  if (import.meta.env.VITE_IOT_API_URL) return import.meta.env.VITE_IOT_API_URL;
  return `http://${window.location.hostname}:8080/api/v1`;
};

/**
 * Xác định URL kênh WebSocket (STOMP) của Backend — suy ra TỪ CHÍNH
 * `VITE_IOT_API_URL` bằng cách đổi giao thức `http`->`ws` và đường dẫn
 * `/api/v1` -> `/ws-pbms`, đảm bảo luôn trỏ đúng cùng 1 Backend với
 * `getBaseApiUrl()` dù chạy ở môi trường nào.
 */
const getWsUrl = () => {
  if (import.meta.env.VITE_IOT_API_URL) return import.meta.env.VITE_IOT_API_URL.replace('http', 'ws').replace('/api/v1', '/ws-pbms');
  return `ws://${window.location.hostname}:8080/ws-pbms`;
};

/**
 * =========================================================================================
 * COMPONENT GỐC CỦA IOT HARDWARE SIMULATOR
 * =========================================================================================
 *
 * MỤC ĐÍCH:
 * Đóng vai "thiết bị phần cứng giả" (camera LPR, cảm biến ô đỗ, đồng hồ hệ
 * thống) để nhân viên/dev có thể test toàn bộ luồng nghiệp vụ đầu-cuối của
 * `pbms-be` mà KHÔNG cần phần cứng thật: bấm nút ở đây thay vì chờ xe thật
 * chạy qua camera, chọn ngày giờ tương lai thay vì chờ thời gian thực trôi qua.
 *
 * 5 TAB CHÍNH (điều phối bởi `activeMenu`, render tương ứng ở cuối component):
 * - "map": bản đồ trực quan, bấm trực tiếp vào Slot để giả lập cảm biến.
 * - "checkin": form giả lập camera LPR/thẻ RFID quét tại cổng vào.
 * - "checkout": danh sách xe đang đỗ, chọn 1 xe để giả lập quét tại cổng ra.
 * - "vehicles": bảng dữ liệu thô (phiên đỗ đang hoạt động + đặt chỗ).
 * - "time": tua nhanh đồng hồ hệ thống (test các luồng phụ thuộc thời gian).
 *
 * NGUỒN DỮ LIỆU:
 * `syncData` (qua `useQuery` gọi `/operation/iot/hardware/data-sync`, polling
 * mỗi 2 giây) là NGUỒN SỰ THẬT DUY NHẤT cho mọi tab — không tự giữ state
 * riêng cho slots/gates/sessions, luôn đọc lại từ response mới nhất để đảm
 * bảo đồng bộ với dữ liệu thật trên Backend (kể cả khi Backend đổi do có
 * người khác thao tác qua `pbms-fe` cùng lúc).
 *
 * KẾT NỐI WEBSOCKET RIÊNG (KHÔNG DÙNG CHO SLOT/SESSION):
 * `Client` STOMP ở effect đầu tiên CHỈ dùng để nghe kênh `/topic/time-sync`
 * (cập nhật `SIMULATED_OFFSET_SECONDS` toàn cục) và để hiển thị chấm
 * Connected/Disconnected ở Header — không dùng để đẩy dữ liệu Slot/Session
 * (việc đó do polling `/data-sync` đảm nhiệm).
 */
const App = () => {
  const [form] = Form.useForm(); // Form của tab "Gate Check-In".
  const [timeForm] = Form.useForm(); // Form của tab "Time Controller".
  const [lastPayload, setLastPayload] = useState<any>(null); // Payload gọi API gần nhất — hiển thị debug ở cuối mỗi tab để biết chính xác request vừa gửi.
  const [activeMenu, setActiveMenu] = useState('map'); // Tab đang chọn, truyền xuống DashboardLayout.
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected'); // Trạng thái WebSocket, hiển thị ở Header.
  const mapRef = React.useRef<any>(null); // Ref trỏ tới SimulatorMap để gọi handleZoomFit/handleZoomZone từ nút bấm ở tab "map".

  // Mở 1 kết nối WebSocket (STOMP) riêng, chỉ để: (1) biết Backend còn sống
  // hay không (đổi màu chấm Connected/Disconnected), và (2) nghe kênh
  // `/topic/time-sync` — mỗi khi Backend tua giờ hệ thống (qua tab "Time
  // Controller"), nó bắn lại độ lệch giây (`offsetSeconds`) để mọi client
  // đang mở (kể cả tab pbms-fe khác) đồng bộ cùng 1 mốc thời gian giả lập.
  React.useEffect(() => {
    const stompClient = new Client({
      brokerURL: getWsUrl(),
      onConnect: () => {
        setConnectionStatus('connected');
        stompClient.subscribe('/topic/time-sync', (message) => {
          if (message.body) {
            try {
              const data = JSON.parse(message.body);
              if (typeof data.offsetSeconds === 'number') {
                (window as any).SIMULATED_OFFSET_SECONDS = data.offsetSeconds;
              }
            } catch (e) {
              console.error("Failed to parse time-sync message", e);
            }
          }
        });
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
      },
      onDisconnect: () => {
        setConnectionStatus('disconnected');
      },
      onWebSocketClose: () => {
        setConnectionStatus('disconnected');
      }
    });
    stompClient.activate();

    return () => {
      stompClient.deactivate();
    };
  }, []);
  
  // NGUỒN DỮ LIỆU DUY NHẤT của toàn app: gọi lại `/data-sync` mỗi 2 giây để
  // lấy snapshot mới nhất của mọi thực thể liên quan (slot, gate, session,
  // đặt chỗ, vé tháng, thẻ RFID trống, tầng, khu vực). Component không tự
  // quản lý các mảng này bằng `useState` riêng — luôn phái sinh trực tiếp từ
  // `syncData` để tránh lệch pha với dữ liệu thật trên Backend.
  const { data: syncData, refetch: refetchSync } = useQuery({
    queryKey: ['iot-data-sync'],
    queryFn: async () => {
      const res = await axios.get(`${getBaseApiUrl()}/operation/iot/hardware/data-sync`);
      return res.data.data;
    },
    refetchInterval: 2000
  });

  // Mọi mảng bên dưới đều fallback về `[]` (hoặc `MOCK_SLOTS` riêng cho slots)
  // khi `syncData` còn null (lần load đầu tiên, trước khi query trả về lần đầu).
  const slots = syncData?.slots || MOCK_SLOTS;
  const gates = syncData?.gates || [];
  const vehicleTypes = syncData?.vehicleTypes || [];
  // Sắp xếp phiên đỗ đang hoạt động theo giờ vào MỚI NHẤT lên đầu, để bảng
  // "Active Vehicles" và danh sách chọn xe ở tab Check-Out luôn ưu tiên hiển
  // thị xe mới vào gần đây nhất.
  const activeSessions = (syncData?.activeSessions || []).slice().sort((a: any, b: any) => new Date(b.timeIn).getTime() - new Date(a.timeIn).getTime());
  // Lọc đặt chỗ CÒN HIỆU LỰC để hiển thị ở danh sách "Reserved Vehicle": giữ
  // trạng thái ACTIVE/PENDING, và với đơn có giờ hẹn thì loại bỏ luôn đơn đã
  // quá "cửa sổ" (giờ hẹn + thời lượng dự kiến, mặc định 120 phút nếu thiếu)
  // tính theo THỜI GIAN GIẢ LẬP của Backend (`syncData.currentTime`) chứ
  // không phải giờ thật của trình duyệt — quan trọng khi đang test bằng tính
  // năng tua nhanh thời gian ở tab "Time Controller".
  const reservations = (syncData?.reservations || []).filter((r: any) => {
    if (r.status !== 'ACTIVE' && r.status !== 'PENDING') return false;
    if (r.expectedEntryTime) {
      const duration = r.expectedDurationMinutes || 120;
      const expireTime = dayjs(r.expectedEntryTime).add(duration, 'minute');
      const now = syncData?.currentTime ? dayjs(syncData.currentTime) : dayjs();
      if (now.isAfter(expireTime)) {
        return false;
      }
    }
    return true;
  });
    const monthlyTickets = syncData?.monthlyTickets || [];
  const currentTime = syncData?.currentTime ? dayjs(syncData.currentTime).format('DD/MM/YYYY HH:mm:ss') : '--:--:--';

  const availableCards = syncData?.availableCards || []; // Danh sách mã thẻ RFID còn trống (chưa gán xe) — dùng để "bốc ngẫu nhiên" khi giả lập quét thẻ.
  const floors = syncData?.floors || [];
  const zones = syncData?.zones || [];

  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null); // Tầng đang xem ở tab "Sensor Map".
  const [filterPreBookedFloor, setFilterPreBookedFloor] = useState<number | null>(null); // Bộ lọc tầng cho danh sách "Reserved/Monthly Vehicle" ở tab Check-In.
  const [filterPreBookedGate, setFilterPreBookedGate] = useState<number | null>(null); // Bộ lọc cổng (suy ra tầng của cổng đó) cho cùng danh sách trên.
  const [vehicleListType, setVehicleListType] = useState<'PREBOOKED' | 'MONTHLY'>('PREBOOKED'); // Đang xem danh sách xe đặt chỗ trước hay xe vé tháng.

  const [checkoutForm] = Form.useForm();
  const [selectedFloorIdForOut, setSelectedFloorIdForOut] = useState<number | null>(null); // Tầng đang chọn ở tab "Gate Check-Out".
  const [selectedVehicleTypeIdForOut, setSelectedVehicleTypeIdForOut] = useState<number | null>(null); // Loại xe đang chọn ở tab "Gate Check-Out".
  const [selectedSessionIdForOut, setSelectedSessionIdForOut] = useState<number | null>(null); // Phiên đỗ (xe) đang được chọn để check-out.


  const selectedSession = activeSessions.find((s: any) => s.id === selectedSessionIdForOut);

  // Tự động chọn sẵn tầng đầu tiên + loại xe đầu tiên cho tab Check-Out ngay
  // khi dữ liệu tải xong (chỉ chạy 1 lần cho tới khi người dùng tự đổi lựa
  // chọn khác — điều kiện `=== null` chặn việc effect này ghi đè lựa chọn
  // thủ công của người dùng ở lần re-render sau).
  React.useEffect(() => {
    if (floors.length > 0 && selectedFloorIdForOut === null) setSelectedFloorIdForOut(floors[0].id);
    if (vehicleTypes.length > 0 && selectedVehicleTypeIdForOut === null) setSelectedVehicleTypeIdForOut(vehicleTypes[0].id);
  }, [floors, vehicleTypes, selectedFloorIdForOut, selectedVehicleTypeIdForOut]);

  // Khi người dùng chọn 1 xe đang đỗ (`selectedSession` đổi), tự động điền
  // sẵn form Check-Out bằng đúng biển số/thẻ/loại xe của phiên đó — để nhân
  // viên demo không phải gõ tay lại thông tin đã có sẵn trong hệ thống. Bỏ
  // chọn xe (selectedSession null) thì trả form về trạng thái trống.
  React.useEffect(() => {
    if (selectedSession) {
      const typeStr = vehicleTypes.find((v: any) => v.id === selectedSession.vehicleTypeId)?.typeName || '';

      // Auto prefill form
      checkoutForm.setFieldsValue({
        plate: selectedSession.plate,
        rfid: selectedSession.rfidCard?.cardCode,
        vehicleType: typeStr
      });
    } else {
      checkoutForm.resetFields();
    }
  }, [selectedSessionIdForOut, selectedSession?.plate, vehicleTypes.length]);

  const currentCheckoutPlate = Form.useWatch('plate', checkoutForm);
  const currentCheckoutVehicleType = Form.useWatch('vehicleType', checkoutForm);

  // Sinh lại ảnh mock "camera cổng ra" mỗi khi biển số/loại xe trên form đổi
  // (kể cả do người dùng gõ tay sửa, không chỉ do auto-prefill) — dùng
  // `useMemo` để tránh vẽ lại Canvas tốn kém ở mỗi lần re-render không liên quan.
  const checkoutPreviewImages = React.useMemo(() => {
    if (!currentCheckoutPlate && !selectedSession) return { panorama: null, lpr: null };
    const plate = currentCheckoutPlate || selectedSession?.plate;
    const typeStr = currentCheckoutVehicleType || (selectedSession ? vehicleTypes.find((v: any) => v.id === selectedSession.vehicleTypeId)?.typeName : 'CAR');
    return {
      panorama: generateMockLicensePlateImage(plate, 'OUT', typeStr),
      lpr: generateMockLprImage(plate)
    };
  }, [currentCheckoutPlate, currentCheckoutVehicleType, selectedSession, vehicleTypes]);

  /**
   * ============================================================================
   * [TAB CHỨC NĂNG 3] GATE CHECK-OUT - GIẢ LẬP THIẾT BỊ TẠI CỔNG RA (GATE OUT)
   * ============================================================================
   * - Mô phỏng hệ thống quét thẻ RFID và camera LPR tại cổng ra:
   *   + Lọc danh sách xe đang đỗ (`activeSessions`) theo tầng và loại xe.
   *   + Hiển thị đối chứng hình ảnh song song:
   *     * Ảnh khi xe vào (lấy từ dữ liệu thật trên DB: `picInPanorama` / `picInFace`).
   *     * Ảnh giả lập khi xe ra (`checkoutPreviewImages`).
   * - Luồng xử lý giao dịch ra cổng:
   *   + Khi bấm thanh toán/ra cổng: Gọi mutation `triggerApiMutation` với `actionType: 'OUT'`.
   *   + Tự động tính toán vé đỗ xe và giải phóng vị trí ô đỗ trên hệ thống.
   * ============================================================================
   */
  const renderInteractiveCheckoutTab = () => {
    const filteredSessions = activeSessions.filter((s: any) =>
      s.floorId === selectedFloorIdForOut &&
      s.vehicleTypeId === selectedVehicleTypeIdForOut
    );

    const availableCheckoutGates = gates.filter((g: any) =>
      g.floorId === selectedFloorIdForOut &&
      (g.gateType === 'OUT' || g.gateType === 'IN_OUT' || g.gateType === 'EXIT') &&
      (!g.vehicleTypeId || g.vehicleTypeId === selectedVehicleTypeIdForOut)
    );

    return (
      <div className="space-y-6">
        <Card className="bg-white border-gray-200 rounded-xl" title={<span className="text-blue-400 font-mono">1. Select Zone & Vehicle Type</span>}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <div className="mb-2 text-gray-600">Select Floor</div>
              <Select className="w-full" value={selectedFloorIdForOut} onChange={setSelectedFloorIdForOut}>
                {floors.map((f: any) => <Select.Option key={f.id} value={f.id}>{f.floorName}</Select.Option>)}
              </Select>
            </Col>
            <Col xs={24} md={12}>
              <div className="mb-2 text-gray-600">Select Vehicle Type</div>
              <Select className="w-full" value={selectedVehicleTypeIdForOut} onChange={setSelectedVehicleTypeIdForOut}>
                {vehicleTypes.map((v: any) => <Select.Option key={v.id} value={v.id}>{v.typeName}</Select.Option>)}
              </Select>
            </Col>
          </Row>
        </Card>

        <Card className="bg-white border-gray-200 rounded-xl" title={<span className="text-orange-400 font-mono">2. Active Vehicles (Click to select)</span>}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filteredSessions.map((s: any) => (
              <div 
                key={s.id} 
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedSessionIdForOut === s.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-blue-300 bg-slate-50'}`}
                onClick={() => setSelectedSessionIdForOut(s.id)}
              >
                <div className="text-center font-bold text-xl text-gray-800 tracking-widest">{s.plate}</div>
                <div className="text-center text-xs text-gray-500 mt-2">In at: {dayjs(s.timeIn).format('HH:mm DD/MM')}</div>
                <div className="text-center text-xs mt-1"><Tag color="green">{s.slot?.slotName || 'No slot'}</Tag></div>
              </div>
            ))}
            {filteredSessions.length === 0 && (
              <div className="col-span-full text-center text-gray-400 py-4">No parked vehicle matches.</div>
            )}
          </div>
        </Card>

        {selectedSession && (
          <Card className="bg-white border-blue-200 rounded-xl shadow-lg" title={<span className="text-green-500 font-mono font-bold text-lg">3. Check-Out Confirm - Plate: {selectedSession.plate}</span>}>
            <Form 
              form={checkoutForm} 
              layout="vertical"
              onFinish={values => {
                triggerApiMutation.mutate({
                  gateId: values.gateId,
                  actionType: 'OUT',
                  vehicleType: values.vehicleType,
                  plate: values.plate,
                  rfid: values.rfid
                });
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Form.Item name="gateId" label="Select Check-Out Gate" rules={[{ required: true, message: 'Please select checkout gate!' }]}>
                    <Select placeholder="-- Check-Out Gate --" size="large">
                      {availableCheckoutGates.map((g: any) => (
                        <Select.Option key={g.id} value={g.id}>{g.gateName}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item name="plate" label="Auto-recognized Plate" rules={[{ required: true }]}>
                    <Input size="large" className="font-mono" />
                  </Form.Item>
                  <Form.Item name="rfid" label="Recovered RFID Card">
                    <Input size="large" className="font-mono" />
                  </Form.Item>
                  <Form.Item name="vehicleType" hidden><Input /></Form.Item>
                </Col>
                
                <Col xs={24} lg={12}>
                  <div className="flex flex-col gap-4 h-full">
                    {/* IN Images */}
                    <div className="flex-1 bg-gray-100 rounded border border-gray-300 p-2 overflow-hidden flex flex-col relative">
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded z-10">ENTRY CAMERA (DB)</div>
                      <div className="flex flex-col sm:flex-row gap-2 h-full">
                        <div className="flex-1 relative h-32 sm:h-auto">
                          {selectedSession.picInPanorama ? (
                            <img src={selectedSession.picInPanorama.startsWith('/') ? `${getBaseApiUrl().replace('/api/v1', '')}${selectedSession.picInPanorama}` : selectedSession.picInPanorama} alt="IN" className="w-full h-full object-cover rounded opacity-80" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No image</div>
                          )}
                        </div>
                        <div className="w-full sm:w-1/3 relative bg-gray-200 rounded flex items-center justify-center p-1 h-20 sm:h-auto mt-2 sm:mt-0">
                          {selectedSession.picInFace ? (
                            <img src={selectedSession.picInFace.startsWith('/') ? `${getBaseApiUrl().replace('/api/v1', '')}${selectedSession.picInFace}` : selectedSession.picInFace} alt="LPR IN" className="w-full h-auto rounded border border-gray-400" />
                          ) : (
                            <div className="text-[10px] text-gray-400">No plate</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* OUT Images */}
                    <div className="flex-1 bg-blue-50 rounded border-2 border-blue-400 p-2 overflow-hidden flex flex-col relative shadow-inner">
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded z-10 font-bold">EXIT CAMERA (MOCK LPR)</div>
                      <div className="flex flex-col sm:flex-row gap-2 h-full">
                        <div className="flex-1 relative h-32 sm:h-auto">
                          {checkoutPreviewImages.panorama && (
                            <img src={checkoutPreviewImages.panorama} alt="OUT" className="w-full h-full object-cover rounded" />
                          )}
                        </div>
                        <div className="w-full sm:w-1/3 relative bg-white border border-blue-200 rounded flex items-center justify-center p-1 shadow-sm h-20 sm:h-auto mt-2 sm:mt-0">
                          {checkoutPreviewImages.lpr && (
                            <img src={checkoutPreviewImages.lpr} alt="LPR OUT" className="w-full h-auto rounded border-2 border-blue-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>
              
              <div className="mt-6 flex justify-end">
                <Button size="large" type="primary" htmlType="submit" className="bg-red-500 hover:bg-red-400 border-none font-bold text-white" icon={<SendOutlined />}>
                  CONFIRM & CHECK-OUT
                </Button>
              </div>
            </Form>

            {lastPayload && (
              <div className="mt-6 border-t border-gray-200 pt-4">
                <span className="text-gray-500 font-bold mb-2 block">Last API Payload:</span>
                <div className="bg-gray-900 rounded p-3 text-green-400 font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
                  <pre>{JSON.stringify(lastPayload, (key, val) => (key === 'imageBase64' || key === 'lprImageBase64') ? '[BASE64_IMAGE_DATA_HIDDEN]' : val, 2)}</pre>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    );
  };

  // Tự động chọn tầng đầu tiên cho tab "Sensor Map" khi dữ liệu vừa tải xong
  // (cùng kiểu "chỉ set 1 lần" như effect chọn tầng/loại xe cho tab Check-Out).
  React.useEffect(() => {
    if (floors.length > 0 && selectedFloorId === null) {
      setSelectedFloorId(floors[0].id);
    }
  }, [floors, selectedFloorId]);

  const selectedGateId = Form.useWatch('gateId', form);
  const selectedGate = gates.find((g: any) => g.id === selectedGateId);

  // Khi người dùng chọn 1 Gate ở tab Check-In, TỰ ĐỘNG khoá luôn hướng
  // Check-In/Check-Out theo đúng loại cổng (cổng IN chỉ cho vào, cổng OUT chỉ
  // cho ra — tránh gửi nhầm sự kiện IN qua 1 cổng thực chất là lối ra). Cổng
  // IN_OUT (2 chiều) thì không set gì, để người dùng tự chọn `actionType`.
  // Đồng thời XOÁ giá trị `vehicleType` đang chọn, vì đổi cổng có thể đổi
  // luôn danh sách loại xe khả dụng (`availableVehicleTypes` bên dưới lọc
  // theo `selectedGate.floorType`) — chọn cũ có thể không còn hợp lệ nữa.
  React.useEffect(() => {
    if (selectedGate) {
      if (selectedGate.gateType === 'IN' || selectedGate.gateType === 'ENTRY') {
        form.setFieldValue('actionType', 'IN');
      } else if (selectedGate.gateType === 'OUT' || selectedGate.gateType === 'EXIT') {
        form.setFieldValue('actionType', 'OUT');
      }
      form.setFieldValue('vehicleType', undefined);
    }
  }, [selectedGateId, selectedGate, form]);

  const currentPlate = Form.useWatch('plate', form);
  const customerType = Form.useWatch('customerType', form);
  const currentActionType = Form.useWatch('actionType', form);
  const currentVehicleType = Form.useWatch('vehicleType', form);

  // Vẽ lại ảnh mock camera (toàn cảnh + LPR) mỗi khi biển số/hành động/loại
  // xe trên form Check-In đổi — tương tự `checkoutPreviewImages` nhưng cho
  // chiều VÀO. Chưa gõ biển số thì không vẽ gì (tránh ảnh "NO-PLATE" vô nghĩa
  // hiện ra ngay khi mới mở form).
  const previewImages = React.useMemo(() => {
    if (!currentPlate) return { panorama: null, lpr: null };
    return {
      panorama: generateMockLicensePlateImage(currentPlate, currentActionType || 'IN', currentVehicleType || 'CAR'),
      lpr: generateMockLprImage(currentPlate)
    };
  }, [currentPlate, currentActionType, currentVehicleType]);

  // Thu hẹp danh sách loại xe cho phép chọn theo đúng `floorType` của Gate
  // đang chọn (ví dụ cổng chỉ dành cho tầng xe máy thì không cho chọn loại
  // xe 4 bánh) — chưa chọn Gate thì cho phép chọn mọi loại xe.
  const availableVehicleTypes = React.useMemo(() => {
    if (!selectedGate) return vehicleTypes;
    return vehicleTypes.filter((v: any) => {
      if (selectedGate.floorType && selectedGate.floorType !== 'ALL' && v.category !== selectedGate.floorType) {
        return false;
      }
      return true;
    });
  }, [selectedGate, vehicleTypes]);


  /**
   * ============================================================================
   * [HELPER FUNCTION] TẠO BIỂN SỐ XE NGẪU NHIÊN (MOCK PLATE GENERATOR)
   * ============================================================================
   * - Tạo nhanh biển số theo định dạng tiêu chuẩn "30A-xxx.xx" (VD: 30A-123.45):
   *   + Hỗ trợ điền tự động vào form Check-in phục vụ kiểm thử luồng xe vào.
   *   + Tránh việc nhân viên/tester phải tự nhập thủ công lặp đi lặp lại.
   * ============================================================================
   */
  const handleRandomPlate = () => {
    const nums = '0123456789';
    let plate = '30A-';
    plate += nums.charAt(Math.floor(Math.random() * nums.length));
    plate += nums.charAt(Math.floor(Math.random() * nums.length));
    plate += nums.charAt(Math.floor(Math.random() * nums.length));
    plate += '.';
    plate += nums.charAt(Math.floor(Math.random() * nums.length));
    plate += nums.charAt(Math.floor(Math.random() * nums.length));
    form.setFieldValue('plate', plate);
  };

  /**
   * ============================================================================
   * [HELPER FUNCTION] LẤY MÃ THẺ RFID TRỐNG NGẪU NHIÊN (RANDOM RFID SELECTOR)
   * ============================================================================
   * - Bốc chọn ngẫu nhiên 1 mã RFID từ danh sách thẻ trống (`availableCards`):
   *   + Dữ liệu thẻ trống được đồng bộ từ Backend qua endpoint `/data-sync`.
   *   + Nếu kho hết thẻ trống: Hiển thị cảnh báo (warning) để người dùng nắm rõ.
   * ============================================================================
   */
  const handleFetchRandomRFID = () => {
    if (availableCards.length > 0) {
      const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
      form.setFieldValue('rfid', randomCard);
      message.success('Successfully got RFID: ' + randomCard);
    } else {
      message.warning('No empty RFID card in inventory!');
    }
  };

  /**
   * ============================================================================
   * [API MUTATION] BẮN SỰ KIỆN QUÉT CỔNG IOT (HARDWARE CHECK-IN / CHECK-OUT)
   * ============================================================================
   * - Dùng chung cho cả 2 luồng chức năng Gate Check-in và Gate Check-out:
   *   + Định tuyến tự động: Xác định lượt VÀO/RA dựa trên `gate.gateType` và `actionType`.
   *   + Gọi endpoint: `POST /api/v1/operation/iot/hardware/gates/checkin` (xe vào) hoặc `/checkout` (xe ra).
   *   + Payload gửi đi: Bao gồm ảnh biển số giả lập, RFID, mã cổng và loại xe.
   * - Sau khi thành công:
   *   + Gọi `refetchSync()` để đồng bộ lập tức sang các tab Sensor Map & Active Vehicles.
   * ============================================================================
   */
  const triggerApiMutation = useMutation({
    mutationFn: async (values: any) => {
      const gate = gates.find((g: any) => g.id === values.gateId);
      const isOut = gate?.gateType === 'OUT' || gate?.gateType === 'EXIT' || (gate?.gateType === 'IN_OUT' && values.actionType === 'OUT');
      const baseUrl = getBaseApiUrl();
      const url = isOut ? `${baseUrl}/operation/iot/hardware/gates/checkout` : `${baseUrl}/operation/iot/hardware/gates/checkin`;

      const base64Img = generateMockLicensePlateImage(values.plate, values.actionType, values.vehicleType);

      const payload = {
        gateId: values.gateId,
        plateNumber: values.plate,
        vehicleType: values.vehicleType,
        rfcode: values.rfid,
        imageBase64: base64Img,
        lprImageBase64: generateMockLprImage(values.plate)
      };

      setLastPayload({
        method: "POST",
        url: url,
        data: payload
      });

      return axios.post(url, payload).then(res => res.data);
    },
    onSuccess: (_, variables) => {
      message.success(`[Gate ID ${variables.gateId}] API fired! Plate: ${variables.plate || 'N/A'}`);
      refetchSync();
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Error calling IoT API');
    }
  });

  /**
   * ============================================================================
   * [API MUTATION] BẮN SỰ KIỆN CẢM BIẾN Ô ĐỖ (ULTRASONIC SENSOR UPDATE)
   * ============================================================================
   * - Kích hoạt khi bấm chọn vào 1 ô đỗ (Slot) trên sơ đồ "Sensor Map":
   *   + Gửi `POST /api/v1/operation/iot/hardware/sensors/update` lên Backend.
   *   + Chuyển trạng thái ô đỗ giữa có xe (`OCCUPIED`) và trống (`EMPTY`).
   *   + Giả lập tín hiệu phát hiện có xe đậu từ cảm biến siêu âm gắn tại ô đỗ.
   * ============================================================================
   */
  const triggerSensorMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const payload = {
        sensorId: id,
        status: status
      };
      setLastPayload({ method: "POST", url: `${getBaseApiUrl()}/operation/iot/hardware/sensors/update`, data: payload });
      return axios.post(`${getBaseApiUrl()}/operation/iot/hardware/sensors/update`, payload).then(res => res.data);
    },
    onSuccess: (_, variables) => {
      message.success(`Updated slot ID ${variables.id} to ${variables.status}`);
      refetchSync();
    },
    onError: () => {
      message.error('Error calling Sensor API');
    }
  });

  /**
   * ============================================================================
   * [API MUTATION] TUA NHANH ĐỒNG HỒ HỆ THỐNG (SYSTEM TIME FAST-FORWARD)
   * ============================================================================
   * - Kích hoạt từ bảng điều khiển "Time Controller":
   *   + Gửi `POST /api/v1/operation/iot/hardware/time/fast-forward` với thời gian mới.
   *   + Giúp kiểm tra tự động các luồng bị ràng buộc thời gian (hết hạn vé tháng, quá giờ đỗ...).
   *   + Đồng bộ mốc thời gian giả lập cho toàn bộ Backend và Client.
   * ============================================================================
   */
  const timeTravelMutation = useMutation({
    mutationFn: async (values: any) => {
      const targetTimeStr = values.targetTime.format('YYYY-MM-DDTHH:mm:ss');
      const payload = { targetTime: targetTimeStr };
      setLastPayload({ method: "POST", url: `${getBaseApiUrl()}/operation/iot/hardware/time/fast-forward`, data: payload });
      return axios.post(`${getBaseApiUrl()}/operation/iot/hardware/time/fast-forward`, payload).then(res => res.data);
    },
    onSuccess: () => {
      message.success('Successfully fast-forwarded system time!');
      refetchSync();
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Error fast-forwarding time');
    }
  });

  /**
   * ============================================================================
   * [HELPER FUNCTION] ĐẢO TRẠNG THÁI Ô ĐỖ KHI BẤM TRÊN BẢN ĐỒ (TOGGLE SLOT STATUS)
   * ============================================================================
   * - Đổi trạng thái (`OCCUPIED` <-> `EMPTY`) và gọi mutation `triggerSensorMutation`:
   *   + Truyền trực tiếp xuống component `SimulatorMap` qua prop `toggleSlot`.
   * ============================================================================
   */
  const toggleSlot = (slot: any) => {
    const newStatus = slot.status === 'OCCUPIED' ? 'EMPTY' : 'OCCUPIED';
    triggerSensorMutation.mutate({
      id: slot.id,
      status: newStatus
    });
  };

  /**
   * ============================================================================
   * [HELPER FUNCTION] SAO CHÉP VĂN BẢN VÀO CLIPBOARD (COPY TO CLIPBOARD)
   * ============================================================================
   * - Hỗ trợ sao chép nhanh biển số xe hoặc mã thẻ từ bảng danh sách:
   *   + Tăng hiệu suất thao tác khi tester muốn dán biển số sang form thanh toán.
   * ============================================================================
   */
  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    message.info(`Copied: ${text}`);
  };

  // Định nghĩa cột cho 2 bảng ở tab "Active Vehicles" (renderDataTab).
  const activeSessionsColumns = [
    { title: 'Plate Number', dataIndex: 'plate', key: 'plate', render: (text: string) => <Tag color="blue">{text}</Tag> },
    { title: 'Card ID', dataIndex: ['rfidCard', 'cardId'], key: 'cardId', render: (text: string) => text ? <Tag color="cyan">{text}</Tag> : <span className="text-gray-400">N/A</span> },
    // Cột "Zone Suggest": zone gợi ý có thể lấy trực tiếp từ session
    // (`suggestedZoneId`), hoặc nếu thiếu (session cũ/chưa gán) thì suy ra
    // gián tiếp qua Slot mà xe đang đỗ -> tra zoneId của Slot đó.
    { title: 'Zone Suggest', key: 'suggestedZone', render: (_: any, record: any) => {
        let targetZoneId = record.suggestedZoneId;
        if (!targetZoneId && record.slot?.id) {
            const slotInfo = slots?.find((s: any) => s.id === record.slot.id);
            if (slotInfo) targetZoneId = slotInfo.zoneId;
        }
        if (!targetZoneId) return <span className="text-gray-400">None</span>;
        const zone = zones?.find((z: any) => z.id === targetZoneId);
        return zone ? <b className="text-purple-600">{zone.zoneName}</b> : <span className="text-gray-600">ID: {targetZoneId}</span>;
      }
    },
    { title: 'Time in', dataIndex: 'timeIn', key: 'timeIn', render: (text: string) => text ? dayjs(text).format('DD/MM/YYYY HH:mm:ss') : '' },
    { title: 'Vehicle Type', dataIndex: ['vehicleType', 'typeName'], key: 'vehicleType' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (text: string) => <Tag color="green">{text}</Tag> },
    { title: 'Action', key: 'action', render: (_: any, record: any) => <Button icon={<CopyOutlined />} size="small" onClick={() => copyToClipboard(record.plate)}>Copy Plate</Button> }
  ];

  const reservationsColumns = [
    { title: 'Plate Number', dataIndex: ['vehicle', 'plateNumber'], key: 'plate', render: (text: string) => <Tag color="orange">{text || 'Unknown'}</Tag> },
    { title: 'Zone', dataIndex: ['zone', 'zoneName'], key: 'zoneName', render: (text: string) => text || 'Unknown' },
    { title: 'Expected Entry', dataIndex: 'expectedEntryTime', key: 'expectedEntryTime', render: (text: string) => text ? dayjs(text).format('DD/MM/YYYY HH:mm:ss') : '' },
    { title: 'Booking Fee', dataIndex: 'reservationFee', key: 'reservationFee', render: (text: number) => text ? `${text.toLocaleString()} VND` : '0 VND' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (text: string) => <Tag color={text === 'ACTIVE' ? 'blue' : 'orange'}>{text}</Tag> },
    { title: 'Action', key: 'action', render: (_: any, record: any) => <Button icon={<CopyOutlined />} size="small" onClick={() => copyToClipboard(record.vehicle?.plateNumber)}>Copy Plate</Button> }
  ];

  /**
   * ============================================================================
   * [TAB CHỨC NĂNG 2] GATE CHECK-IN - GIẢ LẬP THIẾT BỊ TẠI CỔNG VÀO (GATE IN)
   * ============================================================================
   * - Mô phỏng thiết bị phần cứng tại cổng vào bãi đỗ:
   *   + Camera LPR nhận diện biển số xe (với khả năng tạo biển số ngẫu nhiên).
   *   + Đầu đọc thẻ RFID (bốc thẻ trống ngẫu nhiên từ danh sách `availableCards`).
   * - Bảng danh sách xe ưu tiên bên phải (Guest / Monthly Vehicle List):
   *   + Cho phép bấm chọn xe đã đặt chỗ trước (`reservations`) hoặc xe vé tháng (`monthlyTickets`).
   *   + Tự động điền dữ liệu biển số, loại xe và gán thẻ RFID trống vào form Check-in.
   * - Logic định tuyến cổng thông minh (`allowedGates`):
   *   + Chỉ cho phép chọn các cổng thuộc chiều VÀO (`ENTRY`, `IN_OUT`).
   *   + Tự động lọc danh sách cổng khớp với tầng của Zone đã được đặt chỗ trước.
   * ============================================================================
   */
  const renderHardwareTab = () => {
    const activeReservations = reservations; // Already filtered above
    const filteredReservations = activeReservations.filter((r: any) => {
        let match = true;
        if (filterPreBookedFloor) {
            match = match && r.zone?.floorId === filterPreBookedFloor;
        }
        if (filterPreBookedGate) {
           const gate = gates.find((g: any) => g.id === filterPreBookedGate);
           if (gate) match = match && r.zone?.floorId === gate.floorId;
        }
        return match;
    });

    let allowedGates = gates.filter((g: any) => g.gateType === 'IN' || g.gateType === 'IN_OUT' || g.gateType === 'ENTRY');
    // Filter by selected reservation floor
    if (customerType === 'PREBOOKED' && currentPlate) {
       const res = reservations.find((r: any) => r.vehicle?.plateNumber === currentPlate && (r.status === 'ACTIVE' || r.status === 'PENDING'));
       if (res && res.zone?.floorId) {
           allowedGates = allowedGates.filter((g: any) => g.floorId === res.zone.floorId);
       }
    }

    return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card className="bg-white border-gray-200 rounded-xl" title={<span className="text-blue-400 font-mono">Camera LPR & RFID Trigger</span>}>
          <Form 
            form={form} 
            layout="vertical" 
            onFinish={values => {
                triggerApiMutation.mutate(values);
            }}
            initialValues={{ confidence: 95, actionType: 'IN' }}
          >
            <Form.Item name="customerType" hidden><Input /></Form.Item>
            
            <Form.Item name="gateId" label={<span className="text-gray-600">Gate</span>} rules={[{ required: true, message: 'Please select gate' }]}>
              <Select className="bg-gray-100 text-gray-800 border-none rounded" placeholder="-- Select Gate --" size="large">
                {allowedGates.map((g: any) => (
                  <Select.Option key={g.id} value={g.id}>
                    {g.gateName || g.name} ({g.gateType || g.type})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item name="actionType" label={<span className="text-gray-600">Action</span>} initialValue="IN">
                  <Select 
                    className="bg-gray-100 text-gray-800 border-none rounded" size="large"
                    disabled={selectedGate && (selectedGate.gateType === 'IN' || selectedGate.gateType === 'ENTRY' || selectedGate.gateType === 'OUT' || selectedGate.gateType === 'EXIT')}
                  >
                    <Select.Option value="IN"><span className="text-blue-400 font-bold">Check-In</span></Select.Option>
                    <Select.Option value="OUT"><span className="text-red-400 font-bold">Check-Out</span></Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="vehicleType" label={<span className="text-gray-600">Vehicle Type</span>} rules={[{ required: true, message: 'Please select Vehicle Type' }]}>
                  <Select className="bg-gray-100 text-gray-800 border-none rounded" placeholder="-- Select Vehicle Type --" size="large">
                    {availableVehicleTypes.map((v: any) => (
                      <Select.Option key={v.id} value={v.typeName}>
                        {v.typeName} ({v.category === 'FOUR_WHEEL' ? 'Car' : 'Motorbike'})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label={<span className="text-gray-600">License Plate</span>}>
              <div className="flex gap-2">
                <Form.Item name="plate" noStyle>
                  <Input placeholder="51G-123.45" className="bg-gray-100 text-gray-800 border-gray-300 font-mono text-lg w-full" onChange={() => form.setFieldsValue({customerType: undefined})} />
                </Form.Item>
                <Button size="large" onClick={handleRandomPlate} className="bg-gray-200 text-gray-800 border-none shrink-0" icon={<SyncOutlined />}>Random</Button>
              </div>
            </Form.Item>

            <Form.Item label={<span className="text-gray-600">RFID Card (Optional)</span>}>
              <div className="flex gap-2">
                <Form.Item name="rfid" noStyle>
                  <Input placeholder="RFID-100001" className="bg-gray-100 text-gray-800 border-gray-300 font-mono text-lg w-full" />
                </Form.Item>
                <Button size="large" onClick={handleFetchRandomRFID} className="bg-gray-200 text-gray-800 border-none shrink-0" icon={<SyncOutlined />}>Get empty card</Button>
              </div>
            </Form.Item>



            {previewImages.panorama && (
              <div className="mb-4 bg-slate-50 border-4 border-gray-200 rounded-xl overflow-hidden shadow-lg p-2 flex flex-col sm:flex-row gap-2 h-auto sm:h-48">
                <div className="flex-1 relative border-b-2 sm:border-r-2 sm:border-b-0 border-gray-200 h-32 sm:h-full">
                  <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded z-10 uppercase tracking-widest">
                    Panorama Camera
                  </div>
                  <img src={previewImages.panorama} alt="Preview" className="w-full h-full object-cover opacity-90 rounded" />
                </div>
                <div className="w-full sm:w-1/3 h-24 sm:h-full relative bg-gray-50 flex flex-col items-center justify-center p-2 rounded">
                  <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded z-10 uppercase tracking-widest">
                    LPR Crop
                  </div>
                  <div className="w-full aspect-[3/1] border-2 border-blue-500 rounded relative overflow-hidden shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                    <img src={previewImages.lpr!} alt="LPR Preview" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-gray-500 text-[9px] mt-2 font-bold tracking-widest uppercase">Mock LPR Snapshot</span>
                </div>
              </div>
            )}

            <div className="mt-4">
              <Button 
                type="primary" 
                htmlType="submit" 
                size="large" 
                icon={<SendOutlined />} 
                loading={triggerApiMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 border-none font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)]"
              >
                FIRE EVENT
              </Button>
            </div>
          </Form>

          {lastPayload && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <span className="text-gray-500 font-bold mb-2 block">Last API Payload:</span>
              <div className="bg-gray-900 rounded p-3 text-green-400 font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
                <pre>{JSON.stringify(lastPayload, (key, val) => (key === 'imageBase64' || key === 'lprImageBase64') ? '[BASE64_IMAGE_DATA_HIDDEN]' : val, 2)}</pre>
              </div>
            </div>
          )}
        </Card>
      </Col>
      
      <Col xs={24} lg={10}>
          <Card className="bg-white border-gray-200 rounded-xl h-full shadow-lg" title={
            <div className="flex justify-between items-center">
              <span className="text-purple-500 font-mono">Guest Vehicle List</span>
              <Radio.Group value={vehicleListType} onChange={e => setVehicleListType(e.target.value)} size="small" buttonStyle="solid">
                <Radio.Button value="PREBOOKED">Reserved Vehicle</Radio.Button>
                <Radio.Button value="MONTHLY">Monthly Pass Vehicle</Radio.Button>
              </Radio.Group>
            </div>
          }>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Select placeholder="Filter by Floor" allowClear className="flex-1" value={filterPreBookedFloor} onChange={setFilterPreBookedFloor}>
                  {floors.map((f: any) => <Select.Option key={f.id} value={f.id}>{f.floorName}</Select.Option>)}
                </Select>
                <Select placeholder="Filter by Gate" allowClear className="flex-1" value={filterPreBookedGate} onChange={setFilterPreBookedGate}>
                  {gates.filter((g: any) => g.gateType === 'IN' || g.gateType === 'IN_OUT' || g.gateType === 'ENTRY').map((g: any) => <Select.Option key={g.id} value={g.id}>{g.gateName}</Select.Option>)}
                </Select>
              </div>

              <div className="overflow-y-auto max-h-[600px] border border-gray-200 rounded-lg p-2 bg-slate-50">
                {vehicleListType === 'PREBOOKED' ? (
                  filteredReservations.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">No matching reserved vehicle</div>
                  ) : filteredReservations.map((r: any) => (
                    <div 
                      key={r.id} 
                      className={`p-3 mb-2 rounded-lg border cursor-pointer transition-all ${currentPlate === r.vehicle?.plateNumber ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300 bg-white'}`}
                      onClick={() => {
                        let randomCard = undefined;
                        if (availableCards.length > 0) {
                          randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
                        }
                        form.setFieldsValue({
                          plate: r.vehicle?.plateNumber,
                          vehicleType: r.vehicle?.vehicleType?.typeName,
                          customerType: undefined,
                          rfcode: randomCard,
                          gateId: undefined
                        });
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-purple-700 text-lg border border-purple-200 px-2 py-0.5 rounded bg-white shadow-sm">{r.vehicle?.plateNumber}</span>
                        <span className="text-xs text-blue-500 font-bold bg-blue-100 px-2 rounded-full">{r.vehicle?.vehicleType?.typeName}</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1"><span className="font-bold">Guest:</span> {r.customer?.name || r.customer?.phone}</div>
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>Reserved zone: <b className="text-purple-600">{r.zone?.zoneName}</b></span>
                        <span>Floor: {floors.find((f: any) => f.id === r.zone?.floorId)?.floorName}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  monthlyTickets.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">No monthly vehicle</div>
                  ) : monthlyTickets.map((m: any) => (
                    <div 
                      key={m.id} 
                      className={`p-3 mb-2 rounded-lg border cursor-pointer transition-all ${currentPlate === m.plate ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300 bg-white'}`}
                      onClick={() => {
                        let cardToUse = m.rfidCardId || undefined;
                        if (!cardToUse && availableCards.length > 0) {
                          cardToUse = availableCards[Math.floor(Math.random() * availableCards.length)];
                        }
                        form.setFieldsValue({
                          plate: m.plate,
                          vehicleType: m.vehicleType?.typeName,
                          customerType: undefined,
                          rfcode: cardToUse,
                          gateId: undefined
                        });
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-purple-700 text-lg border border-purple-200 px-2 py-0.5 rounded bg-white shadow-sm">{m.plate}</span>
                        <span className="text-xs text-blue-500 font-bold bg-blue-100 px-2 rounded-full">{m.vehicleType?.typeName}</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1"><span className="font-bold">Guest:</span> {m.customerName}</div>
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>Expiry: <b className="text-purple-600">{dayjs(m.validUntil).format('DD/MM/YYYY')}</b></span>
                        <span className="text-green-500 font-bold">Monthly Pass</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </Col>
    </Row>
    );
  };


  /**
   * ============================================================================
   * [TAB CHỨC NĂNG 1] SENSOR MAP - SƠ ĐỒ TRỰC QUAN CẢM BIẾN Ô ĐỖ (KONVA CANVAS)
   * ============================================================================
   * - Hiển thị sơ đồ bãi đỗ 2D thời gian thực qua `SimulatorMap`:
   *   + Màu sắc ô đỗ phản ánh trạng thái (`EMPTY`: xanh, `OCCUPIED`: đỏ, `DISABLED`: vàng).
   *   + Cho phép nhấp chọn trực tiếp vào ô đỗ để giả lập tín hiệu cảm biến IoT.
   * - Thanh công cụ điều khiển phía trên:
   *   + Nút "Fit to Screen" & "Zoom to Zone": Điều hướng viewport bản đồ (gọi qua `mapRef`).
   *   + Dropdown "Select Floor": Bộ lọc hiển thị khu vực và ô đỗ theo tầng.
   * ============================================================================
   */
  const renderSensorTab = () => {
    const visibleZones = zones.filter((z: any) => z.floorId === selectedFloorId);
    return (
      <Card className="bg-white border-gray-200 rounded-xl shadow-lg" 
            title={
              <div className="flex justify-between items-center w-full">
                <span className="text-yellow-400 font-mono text-xl">Visual Sensor Map</span>
                <div className="flex gap-3">
                  <Button size="large" type="primary" icon={<AimOutlined />} onClick={() => mapRef.current?.handleZoomFit()} className="font-semibold shadow-sm bg-blue-600 hover:bg-blue-500">Fit to Screen</Button>
                  <Select
                    size="large"
                    placeholder="-- Zoom to Zone --"
                    options={visibleZones.map((z: any) => ({ label: z.zoneName || z.name, value: z.id }))}
                    onChange={(val) => mapRef.current?.handleZoomZone(val)}
                    allowClear
                    className="w-64 font-medium shadow-sm"
                  />
                  <Select
                    size="large"
                    className="w-64 bg-gray-100 text-gray-800 border-none rounded font-medium shadow-sm"
                    value={selectedFloorId}
                    onChange={(val) => setSelectedFloorId(val)}
                    options={floors.map((f: any) => ({ label: `${f.floorName} (${f.floorType})`, value: f.id }))}
                    placeholder="-- Select Floor --"
                  />
                </div>
              </div>
            }>
        
        <SimulatorMap 
          ref={mapRef}
          floors={floors}
          zones={zones}
          gates={gates}
          slots={slots}
          vehicleTypes={vehicleTypes}
          selectedFloorId={selectedFloorId}
          toggleSlot={toggleSlot}
        />
        {lastPayload && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <span className="text-gray-500 font-bold mb-2 block">Last API Payload:</span>
            <div className="bg-gray-900 rounded p-3 text-green-400 font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
              <pre>{JSON.stringify(lastPayload, null, 2)}</pre>
            </div>
          </div>
        )}
      </Card>
    );
  };

  /**
   * ============================================================================
   * [TAB CHỨC NĂNG 4] ACTIVE VEHICLES - BẢNG ĐỐI CHỨNG DỮ LIỆU ĐỒNG BỘ THỜI GIAN THỰC
   * ============================================================================
   * - Liệt kê dữ liệu thô đồng bộ từ Backend để dễ dàng kiểm chứng khi kiểm thử:
   *   + Bảng Active Parking Sessions: Các xe đang thực tế đỗ trong bãi (có gắn thẻ/biển số).
   *   + Bảng Reservations: Các xe khách mời / đặt chỗ trước chưa Check-in.
   * - Tiện ích kiểm thử:
   *   + Tích hợp nút "Copy Plate": Cho phép tester sao chép nhanh biển số vào Clipboard.
   * ============================================================================
   */
  const renderDataTab = () => (
    <div className="space-y-6">
      <Card className="bg-white border-gray-200 rounded-xl" title={<span className="text-blue-400 font-mono">Active Parking Sessions</span>}>
        <div className="bg-slate-50 p-2 rounded-lg">
          <Table dataSource={activeSessions} columns={activeSessionsColumns} rowKey="id" pagination={{ pageSize: 5 }} scroll={{ x: true }} />
        </div>
      </Card>

      <Card className="bg-white border-gray-200 rounded-xl" title={<span className="text-orange-400 font-mono">Reservations</span>}>
        <div className="bg-slate-50 p-2 rounded-lg">
          <Table dataSource={reservations} columns={reservationsColumns} rowKey="id" pagination={{ pageSize: 5 }} scroll={{ x: true }} />
        </div>
      </Card>
    </div>
  );

  /**
   * ============================================================================
   * [TAB CHỨC NĂNG 5] TIME CONTROLLER - ĐIỀU KHIỂN TUA THỜI GIAN HỆ THỐNG (TIME TRAVEL)
   * ============================================================================
   * - Quản lý mốc thời gian ảo của hệ thống (`currentTime` từ `/data-sync`):
   *   + Cho phép chọn một mốc thời gian trong tương lai để tua đồng hồ (gọi `timeTravelMutation`).
   *   + Nút "Now (System Time)" điền sẵn thời gian ảo hiện tại làm điểm mốc để tính toán tua.
   *   + Giúp kiểm thử các trường hợp: Hết hạn vé tháng, tự động hủy đặt chỗ quá giờ, tính phí đỗ qua đêm...
   * ============================================================================
   */
  const renderTimeControllerTab = () => (
    <Card className="bg-white border-gray-200 rounded-xl" title={<span className="text-purple-400 font-mono">System Time Controller</span>}>
      <div className="mb-8 bg-slate-50 p-6 rounded-lg text-center border border-gray-300 shadow-inner">
        <Text className="text-gray-500 block mb-2 text-lg">Current System Virtual Time</Text>
        <Title level={1} className="!text-purple-400 m-0 font-mono tracking-widest">{currentTime}</Title>
      </div>

      <Form form={timeForm} layout="vertical" onFinish={values => timeTravelMutation.mutate(values)}>
        <Form.Item name="targetTime" label={<span className="text-gray-600 text-base">Select Fast-Forward Target</span>} rules={[{ required: true, message: 'Please select target time' }]}>
          <DatePicker 
            showTime 
            className="w-full" 
            size="large" 
            format="YYYY-MM-DD HH:mm:ss" 
            showNow={false}
            renderExtraFooter={() => (
              <Button 
                type="link" 
                onClick={() => {
                  if (syncData?.currentTime) {
                    timeForm.setFieldsValue({ targetTime: dayjs(syncData.currentTime) });
                  }
                }}
              >
                Now (System Time)
              </Button>
            )}
          />
        </Form.Item>
        <div className="mt-8">
          <Button type="primary" htmlType="submit" size="large" icon={<FastForwardOutlined />} className="w-full bg-purple-600 hover:bg-purple-500 border-none font-bold text-lg h-12" loading={timeTravelMutation.isPending}>
            CONFIRM TIME TRAVEL
          </Button>
        </div>
      </Form>
      {lastPayload && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <span className="text-gray-500 font-bold mb-2 block">Last API Payload:</span>
          <div className="bg-gray-900 rounded p-3 text-green-400 font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
            <pre>{JSON.stringify(lastPayload, null, 2)}</pre>
          </div>
        </div>
      )}
    </Card>
  );

  /**
   * ============================================================================
   * [GIAO DIỆN CHÍNH CỦA IOT SIMULATOR APP - RENDER PANEL]
   * ============================================================================
   * - Bao gồm khung điều hướng chung `DashboardLayout` và 5 tab chức năng được
   *   chuyển đổi thông qua state `activeMenu`:
   *   + Tab 1 ('map'): Sensor Map - Bản đồ trực quan bấm vào Slot giả lập cảm biến.
   *   + Tab 2 ('checkin'): Hardware Check-in - Quét thẻ RFID & ảnh vào cổng In.
   *   + Tab 3 ('checkout'): Hardware Check-out - Quét thẻ RFID & ảnh ra cổng Out.
   *   + Tab 4 ('vehicles'): Data Sync Table - Xem dữ liệu đồng bộ từ Backend.
   *   + Tab 5 ('time'): Time Controller - Tua thời gian mô phỏng (Time Travel).
   * - Cơ chế tối ưu Render:
   *   + Chỉ mount tab đang kích hoạt (active), unmount các tab ẩn để tiết kiệm bộ nhớ.
   *   + Toàn bộ state toàn cục được giữ tại component cha (`App`) để không bị mất dữ liệu.
   * ============================================================================
   */
  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <DashboardLayout
        activeKey={activeMenu}
        onMenuSelect={setActiveMenu}
        connectionStatus={connectionStatus}
      >
        {/* 
         * ============================================================================
         * [TAB 1] SENSOR MAP - GIẢ LẬP CẢM BIẾN ULTRASONIC TỪNG Ô ĐỖ
         * ============================================================================
         * Hiển thị sơ đồ ô đỗ (SimulatorMap). Khi bấm vào một ô, simulator gửi
         * request PUT /api/v1/operation/iot/hardware/slot-status chuyển trạng thái
         * OCCUPIED / EMPTY, lập tức báo động trên sơ đồ không gian của Manager.
         * ============================================================================
         */}
        {activeMenu === 'map' && <div className="animate-fade-in">{renderSensorTab()}</div>}

        {/* 
         * ============================================================================
         * [TAB 2] HARDWARE CHECK-IN - GIẢ LẬP THIẾT BỊ TẠI CỔNG VÀO (GATE IN)
         * ============================================================================
         * Cho phép chọn thẻ RFID, tạo biển số và ảnh toàn cảnh vào để gửi POST
         * /api/v1/operation/iot/hardware/check-in sang Backend.
         * ============================================================================
         */}
        {activeMenu === 'checkin' && <div className="animate-fade-in">{renderHardwareTab()}</div>}

        {/* 
         * ============================================================================
         * [TAB 3] HARDWARE CHECK-OUT - GIẢ LẬP THIẾT BỊ TẠI CỔNG RA (GATE OUT)
         * ============================================================================
         * Cho phép chọn lượt đỗ đang hoạt động, gửi POST /api/v1/operation/iot/hardware/check-out
         * kèm ảnh ra để kích hoạt tính phí trên GateOutConsoleScreen.
         * ============================================================================
         */}
        {activeMenu === 'checkout' && <div className="animate-fade-in">{renderInteractiveCheckoutTab()}</div>}

        {/* 
         * ============================================================================
         * [TAB 4] DATA SYNC TABLE - BẢNG DỮ LIỆU ĐỒNG BỘ TỪ BACKEND
         * ============================================================================
         * Hiển thị bảng danh sách các thẻ RFID, ô đỗ, bảng giá và vé tháng tải về
         * từ GET /api/v1/operation/iot/hardware/data-sync.
         * ============================================================================
         */}
        {activeMenu === 'vehicles' && <div className="animate-fade-in">{renderDataTab()}</div>}

        {/* 
         * ============================================================================
         * [TAB 5] TIME CONTROLLER - ĐỒNG HỒ TUA THỜI GIAN MÔ PHỞNG (TIME TRAVEL)
         * ============================================================================
         * Cho phép tua nhanh thời gian (ví dụ: +1 giờ, +1 ngày) qua POST time-travel
         * để test tính phí đỗ qua đêm, hết hạn vé tháng.
         * ============================================================================
         */}
        {activeMenu === 'time' && <div className="animate-fade-in">{renderTimeControllerTab()}</div>}
      </DashboardLayout>
    </ConfigProvider>
  );
};

// Bọc `App` bằng `QueryClientProvider` ở tầng ngoài cùng — bắt buộc phải có
// để mọi `useQuery`/`useMutation` bên trong `App` hoạt động được (React Query
// đọc `queryClient` qua Context, không truyền qua props).
const RootApp = () => (
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);

export default RootApp;
