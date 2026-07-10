import React from 'react';
import { Layout, Menu, Typography, Space, Tag, Avatar } from 'antd';
import { 
  AppstoreOutlined, 
  VideoCameraOutlined, 
  CarOutlined, 
  HistoryOutlined, 
  SettingOutlined,
  ApiOutlined
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title } = Typography;

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeKey: string;
  onMenuSelect: (key: string) => void;
  connectionStatus: 'connected' | 'disconnected';
}

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
        <Space className="mr-8">
          <ApiOutlined className="text-blue-600 text-2xl" />
          <Title level={4} className="!mb-0 !text-slate-800 font-bold">
            IoT Simulator
          </Title>
        </Space>
        
        <div className="flex-1 overflow-hidden">
          <Menu 
            theme="light"
            mode="horizontal" 
            selectedKeys={[activeKey]} 
            items={menuItems}
            onSelect={(info) => onMenuSelect(info.key)}
            className="border-none h-16 leading-[4rem] text-sm font-medium bg-transparent"
          />
        </div>

        <Space size="large" className="ml-8">
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
