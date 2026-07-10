import React, { useState } from 'react';
import { Layout, Menu, Typography, Space, Tag, Avatar } from 'antd';
import { 
  AppstoreOutlined, 
  VideoCameraOutlined, 
  CarOutlined, 
  HistoryOutlined, 
  SettingOutlined,
  ApiOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
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
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { key: 'map', icon: <AppstoreOutlined />, label: 'Sensor Map' },
    { key: 'checkin', icon: <VideoCameraOutlined />, label: 'Gate Check-In' },
    { key: 'checkout', icon: <CarOutlined />, label: 'Gate Check-Out' },
    { key: 'vehicles', icon: <HistoryOutlined />, label: 'Active Vehicles' },
    { key: 'time', icon: <SettingOutlined />, label: 'Time Controller' },
  ];

  return (
    <Layout className="min-h-screen bg-slate-50">
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        theme="light"
        className="border-r border-slate-200 shadow-sm"
        width={250}
      >
        <div className="h-16 flex items-center justify-center border-b border-slate-100">
          <Space>
            <ApiOutlined className="text-blue-600 text-2xl" />
            {!collapsed && (
              <Title level={4} className="!mb-0 !text-slate-800 font-bold">
                IoT Simulator
              </Title>
            )}
          </Space>
        </div>
        <div className="p-4 flex justify-center">
          {connectionStatus === 'connected' ? (
            <Tag color="success" className="rounded-full w-full text-center">
              ● Connected
            </Tag>
          ) : (
            <Tag color="error" className="rounded-full w-full text-center">
              ● Disconnected
            </Tag>
          )}
        </div>
        <Menu 
          theme="light" 
          mode="inline" 
          selectedKeys={[activeKey]} 
          items={menuItems}
          onSelect={(info) => onMenuSelect(info.key)}
          className="border-none"
        />
      </Sider>
      <Layout>
        <Header className="bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm sticky top-0 z-10 h-16">
          <div className="text-slate-500 font-medium">
            PBMS Hardware Interface Simulator
          </div>
          <Space size="large">
            <div className="text-right leading-tight">
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
    </Layout>
  );
};
