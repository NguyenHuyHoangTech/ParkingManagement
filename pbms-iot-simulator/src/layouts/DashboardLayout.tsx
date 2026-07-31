import React from 'react';
import { Layout, Menu, Typography, Space, Tag, Avatar } from 'antd'; // Bộ khung UI Ant Design: Layout (khung trang), Menu (thanh điều hướng), Tag (huy hiệu trạng thái kết nối).
import {
  AppstoreOutlined,   // Icon cho tab "Sensor Map".
  VideoCameraOutlined, // Icon cho tab "Gate Check-In" (camera mô phỏng cổng vào).
  CarOutlined,        // Icon cho tab "Gate Check-Out".
  HistoryOutlined,    // Icon cho tab "Active Vehicles" (lịch sử/danh sách xe).
  SettingOutlined,    // Icon cho tab "Time Controller".
  ApiOutlined         // Icon logo API ở góc trái Header.
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title } = Typography;

/**
 * Props điều khiển layout từ component cha (App.tsx):
 * - children: nội dung của tab đang active, do App.tsx tự quyết định render gì.
 * - activeKey/onMenuSelect: layout không tự giữ state tab đang chọn — nó chỉ
 *   hiển thị theo `activeKey` và báo ngược lên App.tsx qua `onMenuSelect` khi
 *   người dùng bấm tab khác (controlled component, không phải uncontrolled).
 * - connectionStatus: trạng thái kết nối WebSocket (STOMP) tới Backend, do
 *   App.tsx theo dõi và truyền xuống để hiển thị chấm Connected/Disconnected.
 */
interface DashboardLayoutProps {
  children: React.ReactNode;
  activeKey: string;
  onMenuSelect: (key: string) => void;
  connectionStatus: 'connected' | 'disconnected';
}

/**
 * =========================================================================================
 * KHUNG GIAO DIỆN CHUNG CỦA IOT HARDWARE SIMULATOR (DASHBOARD LAYOUT)
 * =========================================================================================
 *
 * MỤC ĐÍCH:
 * Component thuần hiển thị (presentational), không gọi API, không giữ state
 * nghiệp vụ. Vẽ khung cố định gồm: Header (logo + menu ngang + trạng thái kết
 * nối) và Content (vùng nội dung thay đổi theo tab đang chọn — do App.tsx bơm
 * vào qua `children`).
 *
 * MÃ GIẢ CHI TIẾT:
 * 1. Dựng danh sách `menuItems` cố định gồm 5 tab: Sensor Map, Gate Check-In,
 *    Gate Check-Out, Active Vehicles, Time Controller — mỗi tab gắn 1 `key`
 *    duy nhất mà App.tsx dùng làm giá trị `activeMenu` để quyết định render gì.
 * 2. Header chia 3 vùng: logo + tên app (trái), menu ngang co giãn theo màn
 *    hình (giữa, có thanh cuộn ngang trên mobile), và cụm trạng thái kết nối +
 *    thông tin "System Admin" giả lập (phải).
 * 3. `Tag` đổi màu xanh/đỏ theo `connectionStatus` để nhân viên demo biết ngay
 *    WebSocket còn sống hay đã rớt kết nối tới Backend.
 * 4. `Menu` dùng `selectedKeys={[activeKey]}` để tô sáng đúng tab đang chọn,
 *    và `onSelect` gọi ngược `onMenuSelect(info.key)` để App.tsx đổi tab.
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeKey,
  onMenuSelect,
  connectionStatus
}) => {
  const menuItems = [
    { key: 'map', icon: <AppstoreOutlined />, label: 'Sensor Map' },
    { key: 'checkin', icon: <VideoCameraOutlined />, label: 'Gate Check-In' },
    { key: 'checkout', icon: <CarOutlined />, label: 'Gate Check-Out' },
    { key: 'vehicles', icon: <HistoryOutlined />, label: 'Active Vehicles' },
    { key: 'time', icon: <SettingOutlined />, label: 'Time Controller' },
  ];

  return (
    <Layout className="min-h-screen bg-slate-50">
      <Header className="!bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm sticky top-0 z-10 h-16 w-full">
        <Space className="mr-2 md:mr-8 shrink-0">
          <ApiOutlined className="text-blue-600 text-2xl" />
          <Title level={4} className="!mb-0 !text-slate-800 font-bold hidden md:block">
            IoT Simulator
          </Title>
        </Space>
        
        <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <Menu 
            theme="light"
            mode="horizontal" 
            selectedKeys={[activeKey]} 
            items={menuItems}
            onSelect={(info) => onMenuSelect(info.key)}
            className="border-none h-16 leading-[4rem] text-sm font-medium bg-transparent"
          />
        </div>

        <Space size="middle" className="ml-2 md:ml-8 shrink-0">
          {connectionStatus === 'connected' ? (
            <Tag color="success" className="rounded-full px-3 py-1 text-xs">
              ● Connected
            </Tag>
          ) : (
            <Tag color="error" className="rounded-full px-3 py-1 text-xs">
              ● Disconnected
            </Tag>
          )}
          <div className="text-right leading-tight hidden md:block">
            <div className="text-sm font-semibold text-slate-800">System Admin</div>
            <div className="text-xs text-slate-500">Local Environment</div>
          </div>
          <Avatar className="bg-blue-600">SA</Avatar>
        </Space>
      </Header>
      <Content className="p-6 overflow-auto">
        {children}
      </Content>
    </Layout>
  );
};
