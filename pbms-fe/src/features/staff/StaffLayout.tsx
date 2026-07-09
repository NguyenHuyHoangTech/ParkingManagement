import React, { useMemo } from 'react';
import { Layout, Typography, Avatar, Dropdown, Button, Modal, Badge } from 'antd';
import {
  LogoutOutlined,
  UserOutlined,
  AlertOutlined,
  DollarOutlined,
  SettingOutlined,
  DesktopOutlined,
  ClockCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../core/store/useAuthStore';
import { UserProfileSettingsModal } from '../shared/components/UserProfileSettingsModal';
import { useState } from 'react';
import { useSystemTime } from '../../core/utils/timeProvider';
import { NotificationDropdown } from '../shared/components/NotificationDropdown';
import { MonthlyZoneConflictModal } from './MonthlyZoneConflictModal';
import { useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import { notification } from 'antd';
import axiosClient from '../../core/api/axiosClient';
import { useQuery } from '@tanstack/react-query';

const { Header, Content } = Layout;
const { Text } = Typography;

export const StaffLayout = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const email = useAuthStore((state) => state.email);
  const shiftStatus = useAuthStore((state) => state.shiftStatus);
  const name = useAuthStore((state) => state.name);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const systemTime = useSystemTime();

  // Conflict state
  const [pendingConflicts, setPendingConflicts] = useState<any[]>([]);

  const [monthlyConflictVisible, setMonthlyConflictVisible] = useState(false);
  const [monthlyConflictData, setMonthlyConflictData] = useState<any>(null);

  // QUERY: GET /finance/dashboard/operational for live sensor monitoring
  const { data: operationalData } = useQuery({
    queryKey: ['operational_dashboard'],
    queryFn: async () => {
      const res = await axiosClient.get('/finance/dashboard/operational');
      return res.data?.data || {};
    },
    refetchInterval: 5000 // Poll every 5 seconds for sensor changes
  });

  const violations = useMemo(() => {
    if (!operationalData?.liveData?.floorViolations) return [];
    return operationalData.liveData.floorViolations
      .map((stat: any) => {
        const occSlots = stat.occupied_slots || 0;
        const assignedMonthly = stat.assigned_monthly || 0;
        const wrongZoneTickets = stat.wrong_zone_tickets_count || 0;
        const diff = occSlots - wrongZoneTickets - assignedMonthly;
        return { name: `${stat.floor_name} - ${stat.vehicle_type}`, diff: diff > 0 ? diff : 0, occSlots, assignedMonthly, wrongZoneTickets };
      });
  }, [operationalData]);

  useEffect(() => {
    const client = new Client({
      brokerURL: 'ws://localhost:8080/ws-pbms',
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = function () {
      client.subscribe('/topic/staff/notifications', (message) => {
        try {
          const data = JSON.parse(message.body);
          if (data.type === 'ZONE_CONFLICT') {
            setPendingConflicts((prev) => {
              if (prev.find(p => p.reservationId === data.reservationId)) return prev;
              return [...prev, data];
            });
            notification.error({
              message: '🚨 Zone Capacity Conflict!',
              description: data.message + ' (Check the queue to retry)',
              placement: 'topRight',
              duration: 0
            });
          } else if (data.type === 'ZONE_RESERVED') {
            setPendingConflicts((prev) => prev.filter(p => p.reservationId !== data.reservationId));
            notification.success({
              message: '✅ Virtual Slot Reserved!',
              description: `Reservation for ${data.plate} in ${data.zoneName} has been successfully assigned.`,
              placement: 'topRight',
              duration: 5
            });
            window.dispatchEvent(new CustomEvent('add-notification', {
              detail: {
                message: `[Assigned] ${data.plate} in ${data.zoneName} has been assigned a slot successfully.`,
                type: 'success'
              }
            }));
          } else if (data.type === 'RESERVATION_ARRIVED') {
            setPendingConflicts((prev) => prev.filter(p => p.reservationId !== data.reservationId));
          }
        } catch (e) { }
      });

      client.subscribe('/topic/alerts', (message) => {
        try {
          const data = JSON.parse(message.body);
          if (data.type === 'MONTHLY_ZONE_VIOLATION') {
            notification.warning({
              message: '🚨 Monthly Zone Violation',
              description: data.message,
              placement: 'topRight',
              duration: 5
            });
          }
        } catch (e) { }
      });
    };

    client.activate();
    return () => {
      client.deactivate();
    };
  }, []);

  const handleResolveConflict = async (reservationId: number) => {
    try {
      await axiosClient.post(`/operation/gates/reservations/${reservationId}/retry-zone`);
    } catch (err: any) {
      notification.error({
        message: 'Resolution Failed',
        description: err.response?.data?.message || 'Zone is still full.',
        placement: 'topRight'
      });
    }
  };

  const handleLogout = () => {
    if (shiftStatus === 'OPEN') {
      Modal.warning({
        title: 'Shift not ended!',
        content: 'The system requires you to confirm ending the shift before logging out safely.',
        okText: 'Go to End Shift page',
        onOk: () => navigate('/staff/shift-management')
      });
      return;
    }
    logout();
    navigate('/login');
  };

  const userMenu: any = {
    items: [
      { key: 'shift', icon: <ClockCircleOutlined />, label: 'Shift Management', onClick: () => navigate('/staff/shift-management') },
      { key: 'settings', icon: <SettingOutlined />, label: 'Setting', onClick: () => setIsSettingsOpen(true) },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: handleLogout, danger: true },
    ],
  };

  const conflictMenu: any = {
    items: pendingConflicts.length === 0 ? [{ key: 'empty', label: <span className="text-gray-400 italic px-2">No capacity conflicts</span> }] : pendingConflicts.map(c => ({
      key: c.reservationId,
      label: (
        <div className="flex flex-col gap-1 w-64 py-1 rounded transition-colors border-b border-gray-100 last:border-0">
          <span className="font-bold text-red-600 flex items-center gap-1"><AlertOutlined /> {c.zoneName} is FULL</span>
          <span className="text-xs text-gray-600">Plate: <b className="font-mono uppercase">{c.plate}</b> - {c.customer}</span>
          <Button size="small" type="primary" className="mt-1 bg-blue-500 text-xs w-full" onClick={() => handleResolveConflict(c.reservationId)}>Retry assignment</Button>
        </div>
      )
    }))
  };

  const activeGateType = sessionStorage.getItem('activeGateType');

  return (
    <Layout className="h-screen flex flex-col">
      <Header className="bg-white px-4 py-2 sm:px-6 flex flex-wrap justify-between items-center gap-y-2 shadow-sm z-10 w-full h-auto min-h-[64px] shrink-0 border-b border-gray-100" style={{ backgroundColor: '#ffffff', lineHeight: 'normal' }}>
        <div className="flex items-center gap-4 shrink-0">
          <Text strong className="text-xl text-gray-800 tracking-widest cursor-pointer whitespace-nowrap" onClick={() => navigate('/staff/shift-management')}>
            PBMS <span className="text-blue-600">STAFF</span>
          </Text>
          <div className="hidden sm:flex items-center gap-1 ml-4 border-l border-gray-200 pl-4">
            <Button
              type="text"
              className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 font-medium px-3"
              icon={<DesktopOutlined />}
              onClick={() => navigate('/staff/gate-console')}
              disabled={shiftStatus !== 'OPEN' || activeGateType === 'PATROL'}
              title={
                shiftStatus !== 'OPEN'
                  ? "Please start a shift to perform this action"
                  : activeGateType === 'PATROL'
                    ? "Patrol staff do not have access to gate booths"
                    : "Gate Console"
              }
            >
              Gate Console
            </Button>
            <Button
              type="text"
              icon={<AlertOutlined />}
              onClick={() => navigate('/staff/exception-desk')}
              className="text-slate-600 hover:text-red-600 hover:bg-red-50 font-medium px-3"
              disabled={shiftStatus !== 'OPEN'}
              title={shiftStatus !== 'OPEN' ? "Please start a shift to perform this action" : "Resolve Incident"}
            >
              Exception Desk
            </Button>
          </div>
        </div>

        <div className="flex flex-1"></div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* System Clock */}
          <div className="flex items-center gap-2 bg-slate-50 text-slate-700 px-3 py-1.5 rounded border border-slate-200 shadow-sm font-mono text-sm select-none">
            <ClockCircleOutlined className="text-blue-500 animate-pulse text-lg" />
            <div className="flex flex-col leading-none">
              <span className="text-slate-800 font-bold text-sm tracking-widest">
                {systemTime.format('HH:mm:ss')}
              </span>
              <span className="text-slate-500 text-[10px]">{systemTime.format('DD/MM/YYYY')}</span>
            </div>
          </div>

          {/* Wrong Zone Alert Box */}
          {(
            <Dropdown
              placement="bottomRight"
              arrow
              menu={{
                items: [
                  {
                    key: 'info',
                    label: (
                      <div className="flex flex-col gap-2 p-2 w-64">
                        <span className="font-bold text-red-600 border-b border-red-100 pb-1">🚨 Monthly Zone Status</span>
                        {violations.length === 0 && (
                          <div className="text-sm text-center text-slate-500 py-2">0 xe đỗ sai zone</div>
                        )}
                        {violations.map((v: any, idx: number) => (
                          <div key={idx} className={`p-2 rounded border ${v.diff > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="text-sm text-center"><b>{v.name}</b>: <span className={v.diff > 0 ? 'text-red-600 font-bold' : 'text-slate-500'}>{v.diff} xe đỗ sai zone</span></div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                ]
              }}
            >
              <div className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border transition-colors ${violations.reduce((acc: number, v: any) => acc + v.diff, 0) > 0 ? 'bg-red-50 hover:bg-red-100 border-red-300 animate-pulse' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                <WarningOutlined className={`text-lg ${violations.reduce((acc: number, v: any) => acc + v.diff, 0) > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                <div className="flex flex-col hidden sm:flex">
                  <span className={`text-xs font-bold leading-none ${violations.reduce((acc: number, v: any) => acc + v.diff, 0) > 0 ? 'text-red-600' : 'text-slate-600'}`}>Wrong Zone</span>
                  <span className={`text-[10px] mt-0.5 whitespace-nowrap font-medium ${violations.reduce((acc: number, v: any) => acc + v.diff, 0) > 0 ? 'text-red-500' : 'text-slate-500'}`}>
                    {violations.reduce((acc: number, v: any) => acc + v.diff, 0)} violations
                  </span>
                </div>
              </div>
            </Dropdown>
          )}

          <Dropdown menu={conflictMenu} placement="bottomRight" arrow trigger={['click']}>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors bg-white">
              <Badge count={pendingConflicts.length} showZero size="small">
                <AlertOutlined className="text-red-500 text-lg" />
              </Badge>
              <div className="flex flex-col hidden sm:flex">
                <span className="text-xs font-bold text-red-600 leading-none">Pre-booked Queue</span>
                <span className="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">
                  {pendingConflicts.length === 0 ? 'No cars in queue' : `${pendingConflicts.length} cars waiting for slot`}
                </span>
              </div>
            </div>
          </Dropdown>

          <NotificationDropdown />

          <Dropdown menu={userMenu} placement="bottomRight" arrow>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-3 py-1 rounded transition-colors border border-gray-200">
              <Avatar icon={<UserOutlined />} className="bg-blue-600" />
              <Text strong className="text-gray-700 hidden sm:block">{name || email || 'Staff'}</Text>
            </div>
          </Dropdown>
        </div>
      </Header>

      <Content className="bg-gray-100 m-0 w-full flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </Content>


      <UserProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />


    </Layout>
  );
};
