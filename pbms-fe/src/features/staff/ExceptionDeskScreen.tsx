import { useState, useMemo } from 'react';
import { Typography, Button, Badge, List, Tag, Modal, InputNumber, Card, Select } from 'antd';
import { WarningOutlined, PlusOutlined, CreditCardOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../core/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../core/api/axiosClient';

import { IncidentSubmitForm } from '../incident/components/IncidentSubmitForm';
import { IncidentDetailPanel } from '../incident/components/IncidentDetailPanel';

const { Title, Text } = Typography;

export const ExceptionDeskScreen = () => {
  const shiftStatus = useAuthStore(state => state.shiftStatus);
  const role = useAuthStore(state => state.role);
  const isManager = role === 'ROLE_MANAGER';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [queueFilter, setQueueFilter] = useState<string>('ALL');

  // System config
  const { data: configsData = [] } = useQuery({
    queryKey: ['system_configs'],
    queryFn: async () => {
      const res = await axiosClient.get('/system/configs');
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const getPenaltyConfig = (key: string, fallback: number) => {
    const config = configsData.find((c: any) => c.configKey === key);
    if (config && config.configValue) {
       return parseInt(config.configValue, 10) || fallback;
    }
    return fallback;
  };

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, value }: { id: number, value: string }) => {
      await axiosClient.put(`/system/configs/${id}`, {
        configValue: value
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_configs'] });
    }
  });

  // Incidents
  const { data: ticketsData = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const res = await axiosClient.get('/incident/incidents');
      return res.data?.data || [];
    },
    refetchInterval: 3000
  });

  const { data: vehiclesData = [] } = useQuery({
    queryKey: ['vehicles_blacklist'],
    queryFn: async () => {
      const res = await axiosClient.get('/operation/vehicles');
      return res.data?.data || [];
    },
    enabled: selectedCategory === 'BLACKLIST'
  });

  const blacklistedVehicles = vehiclesData.filter((v: any) => v.isBlacklisted);
  const filteredTickets = ticketsData.filter((t: any) => {
    const catMatch = selectedCategory === 'ALL' || selectedCategory === 'CREATE_INCIDENT' || t.type === selectedCategory || (selectedCategory === 'BLACKLIST' && t.type === 'BLACKLIST_VIOLATION');
    if (!catMatch) return false;
    
    if (queueFilter === 'PHASE_1') return t.phase === 1 && t.status !== 'CANCELLED' && t.status !== 'REJECTED';
    if (queueFilter === 'PHASE_2') return t.phase === 2 && t.status !== 'CANCELLED' && t.status !== 'REJECTED';
    if (queueFilter === 'PHASE_3') return t.status === 'RESOLVED';
    if (queueFilter === 'CANCELLED') return t.status === 'CANCELLED' || t.status === 'REJECTED';
    return true;
  });

  const handleIncidentSuccess = () => {
    setSelectedCategory('ALL');
  };

  if (!isManager && shiftStatus !== 'OPEN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center max-w-md">
          <WarningOutlined className="text-6xl text-orange-400 mb-4" />
          <Title level={3} className="text-slate-800">Not Open On Duty yet</Title>
          <Button type="primary" size="large" onClick={() => navigate('/staff/shift-management')}>Back to Shift Management</Button>
        </div>
      </div>
    );
  }

  const renderCardDispute = () => (
    <div className="flex flex-col lg:flex-row flex-1 lg:h-full animate-fade-in bg-gray-100 p-2 lg:p-4 gap-4 overflow-hidden">
      {/* Pane 1: Category Sidebar */}
      <div className={`w-full lg:w-64 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col lg:overflow-hidden shrink-0 ${selectedTicket && selectedCategory !== 'BLACKLIST' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center shrink-0">
          <Text strong className="text-gray-700 text-base">Incident classification</Text>
        </div>
        <div className="flex-1 overflow-x-auto lg:overflow-y-auto p-3 flex flex-row lg:flex-col gap-2 pb-1 lg:pb-3">
          {[
            { id: 'ALL', label: 'All Incidents', icon: '📋', count: ticketsData.length },
            { id: 'CREATE_INCIDENT', label: 'Tạo Sự Cố (Quầy)', icon: '➕', count: 0 },
            { id: 'ZONE_VIOLATION', label: 'Wrong Zone Parking', icon: '🚨', count: ticketsData.filter((t: any) => t.type === 'ZONE_VIOLATION').length },
            { id: 'OVERSTAY', label: 'Overstay Vehicles', icon: '🕒', count: ticketsData.filter((t: any) => t.type === 'OVERSTAY').length },
            { id: 'LOST_CARD', label: 'Lost Card Report', icon: '🔥', count: ticketsData.filter((t: any) => t.type === 'LOST_CARD').length },
            { id: 'DAMAGED_CARD', label: 'Damaged Card', icon: '💳', count: ticketsData.filter((t: any) => t.type === 'DAMAGED_CARD').length },
            { id: 'LPR_MISMATCH', label: 'LPR Mismatch', icon: '🤖', count: ticketsData.filter((t: any) => t.type === 'LPR_MISMATCH').length },
            { id: 'SLOT_OCCUPIED', label: 'Slot Occupied', icon: '🚗', count: ticketsData.filter((t: any) => t.type === 'SLOT_OCCUPIED').length },
            { id: 'FIND_CAR', label: 'Find Car', icon: '🔍', count: ticketsData.filter((t: any) => t.type === 'FIND_CAR').length },
            { id: 'FEE_DISPUTE', label: 'Fee Dispute', icon: '💰', count: ticketsData.filter((t: any) => t.type === 'FEE_DISPUTE').length },
            { id: 'OTHER_FEEDBACK', label: 'Other Feedback', icon: '💬', count: ticketsData.filter((t: any) => t.type === 'OTHER_FEEDBACK').length },
            { id: 'BLACKLIST', label: 'Blacklist', icon: '🚫', count: blacklistedVehicles.length }
          ].filter(cat => cat.id !== 'OTHER_FEEDBACK' || isManager).map(cat => (
             <div 
               key={cat.id} 
               className={`p-3 rounded-xl cursor-pointer transition-all font-medium flex justify-between items-center gap-3 shrink-0 ${selectedCategory === cat.id ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200'}`} 
               onClick={() => { setSelectedCategory(cat.id); setSelectedTicket(null); }}
             >
               <div className="flex items-center gap-3">
                 <span className="text-lg">{cat.icon}</span>
                 <span className="whitespace-nowrap">{cat.label}</span>
               </div>
               {cat.count > 0 && (
                 <Badge 
                   count={cat.count} 
                   style={{ backgroundColor: selectedCategory === cat.id ? '#fff' : '#1890ff', color: selectedCategory === cat.id ? '#1890ff' : '#fff' }} 
                 />
               )}
             </div>
          ))}
        </div>
      </div>

      {/* Pane 2: Ticket Queue */}
      <div className={`w-full lg:w-80 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col lg:overflow-hidden shrink-0 ${selectedTicket || selectedCategory === 'CREATE_INCIDENT' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-2 shrink-0">
          <div className="flex justify-between items-center">
            <Text strong className="text-gray-700 text-sm lg:text-base">Queue ({filteredTickets.length})</Text>
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => setSelectedCategory('CREATE_INCIDENT')}>Tại quầy</Button>
          </div>
          <Select size="small" value={queueFilter} onChange={setQueueFilter} className="w-full" options={[
            {value: 'ALL', label: 'Tất cả trạng thái'},
            {value: 'PHASE_1', label: 'Phase 1 (Tiếp nhận)'},
            {value: 'PHASE_2', label: 'Phase 2 (Xử lý)'},
            {value: 'PHASE_3', label: 'Phase 3 (Hoàn tất)'},
            {value: 'CANCELLED', label: 'Đã Hủy/Từ chối'},
          ]} />
        </div>
        <div className="flex-1 max-h-48 lg:max-h-none overflow-y-auto p-2">
          <List dataSource={filteredTickets} renderItem={(item: any) => (
              <div className={`p-3 mb-2 rounded-xl cursor-pointer border transition-all ${selectedTicket?.id === item.id ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100' : 'bg-white border-gray-200 hover:border-blue-300'}`} onClick={() => setSelectedTicket(item)}>
                <div className="flex justify-between items-start mb-1"><Text strong className="text-gray-800 tracking-wider">{item.plate || item.rfid || 'HOLLOW'}</Text><Text type="secondary" className="text-xs">{item.time}</Text></div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Tag color={item.type === 'LOST_CARD' ? 'volcano' : item.type === 'BLACKLIST_VIOLATION' ? 'red' : 'orange'} className="m-0 border-0 text-[10px] sm:text-xs">{item.type}</Tag>
                  {item.status === 'CANCELLED' || item.status === 'REJECTED' ? (
                    <Tag color="default" className="m-0 border-0 text-[10px] sm:text-xs">Đã hủy</Tag>
                  ) : item.status === 'RESOLVED' ? (
                    <Tag color="success" className="m-0 border-0 text-[10px] sm:text-xs">Hoàn tất (P3)</Tag>
                  ) : (
                    <Tag color={item.phase === 1 ? 'processing' : 'warning'} className="m-0 border-0 text-[10px] sm:text-xs">Phase {item.phase}</Tag>
                  )}
                  {item.sessionVehicleType && (
                    <Tag color="purple" className="m-0 border-0 text-[10px] sm:text-xs">{item.sessionVehicleType}</Tag>
                  )}
                </div>
              </div>
            )} />
        </div>
      </div>

      {/* Pane 3: Details */}
      <div className={`w-full lg:flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-col ${!selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
        {selectedCategory === 'OVERSTAY' && (
          <div className="p-4 border-b border-gray-200 bg-blue-50/50 flex items-center justify-between shrink-0">
            <div>
              <Text strong className="text-gray-700 block text-sm">Overstay Configuration</Text>
              <Text className="text-xs text-gray-500">The system scans overstay vehicles at 2:00 AM daily.</Text>
            </div>
            <div className="flex items-center gap-2">
              <Text className="text-sm text-gray-600">Threshold (Hours):</Text>
              <InputNumber 
                style={{ width: 100 }}
                defaultValue={getPenaltyConfig('OVERSTAY_HOURS_LIMIT', 72)}
                min={1}
                onPressEnter={(e: any) => {
                  const config = configsData.find((c: any) => c.configKey === 'OVERSTAY_HOURS_LIMIT');
                  if (config) {
                    updateConfigMutation.mutate({ id: config.id, value: e.target.value });
                  }
                }}
              />
            </div>
          </div>
        )}
        
        {selectedCategory === 'CREATE_INCIDENT' && !selectedTicket ? (
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="p-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <Title level={4} className="m-0 text-blue-700">Tạo sự cố mới tại quầy</Title>
                <Text className="text-sm text-gray-500">Hỗ trợ khách hàng gửi báo cáo hoặc ghi nhận sự cố thủ công</Text>
              </div>
            </div>
            <div className="p-4 md:p-6 lg:p-8 flex-1">
              <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <IncidentSubmitForm onSuccess={handleIncidentSuccess} userRole="STAFF" isManager={isManager} />
              </div>
            </div>
          </div>
        ) : selectedTicket ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="lg:hidden p-2 bg-blue-50 border-b border-blue-100 flex items-center shrink-0">
              <Button type="text" onClick={() => setSelectedTicket(null)} className="font-medium text-blue-700 flex items-center">
                <span className="text-xl mr-2">⬅</span> Back to queue
              </Button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <IncidentDetailPanel 
                ticket={selectedTicket} 
                userRole="STAFF" 
                isManager={isManager} 
                onClose={() => setSelectedTicket(null)} 
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-slate-50"><CreditCardOutlined className="text-6xl text-slate-300 mb-4" /><Title level={4} className="text-slate-400">No Incident selected</Title><Text>Please select a Ticket from the Queue</Text></div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {renderCardDispute()}
    </div>
  );
};
