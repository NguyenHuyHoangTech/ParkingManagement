import { simulatedDayjs } from '../../core/utils/timeProvider';
import React, { useState } from 'react';
import { Card, Typography, Button, Modal, InputNumber, Tag, message, Spin, Radio, Space, Input } from 'antd';
import { LoginOutlined, LogoutOutlined, DollarOutlined, CarOutlined, SafetyCertificateOutlined, SelectOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../core/store/useAuthStore';
import axiosClient from '../../core/api/axiosClient';

const { Title, Text } = Typography;

interface Gate {
  id: number;
  name: string;
  status: string;
  type: string;
  floor: string;
  staffName?: string;
  staffEmail?: string;
}

export const ShiftManagementScreen = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const shiftStatus = useAuthStore(state => state.shiftStatus);
  const setAuthShiftStatus = useAuthStore(state => state.setShiftStatus);

  const [isStartModalVisible, setIsStartModalVisible] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [selectedPostType, setSelectedPostType] = useState<'GATE' | 'PATROL'>('GATE');
  const [selectedGateId, setSelectedGateId] = useState<number>(0);
  const [selectedGateFunction, setSelectedGateFunction] = useState<string>('ENTRY');

  // Temporary state for display during duty
  const activeGateName = sessionStorage.getItem('activeGateName') || 'Unknown';
  const activeGateType = sessionStorage.getItem('activeGateType') || 'GATE';

  const [isCloseModalVisible, setIsCloseModalVisible] = useState(false);
  const [declaredCash, setDeclaredCash] = useState<number | null>(null);
  const [cashMatchMode, setCashMatchMode] = useState<'MATCH' | 'DIFFERENT' | null>(null);
  const [varianceReason, setVarianceReason] = useState<string>('');

  const { data: gates = [] } = useQuery({
    queryKey: ['gates'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get('/infrastructure/gates');
        return res.data.data || [];
      } catch (err) {
        return [];
      }
    }
  });

  // Automatically fetch active session on load
  useQuery({
    queryKey: ['active-session-sync'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get('/identity/work-sessions/current');
        if (res.data?.data?.hasActiveSession) {
          const { gateName, gateId, gateType } = res.data.data;
          setAuthShiftStatus('OPEN');
          const currentGateType = sessionStorage.getItem('activeGateType');
          sessionStorage.setItem('activeGateName', gateName || '');
          if (!currentGateType || (currentGateType !== 'ENTRY' && currentGateType !== 'EXIT')) {
            sessionStorage.setItem('activeGateType', gateType || '');
          }
          if (gateId) {
            sessionStorage.setItem('activeGateId', String(gateId));
          }
        } else if (shiftStatus === 'OPEN') {
          // Wait, don't auto close here unless we are sure, but for now just sync 'OPEN'
        }
        return res.data;
      } catch (e) {
        return null;
      }
    }
  });

  React.useEffect(() => {
    if (gates.length > 0 && isStartModalVisible && !selectedFloor) {
      const floors = Array.from(new Set(gates.map((g: Gate) => g.floor))).filter(Boolean) as string[];
      if (floors.length > 0) {
        const firstFloor = floors[0];
        setSelectedFloor(firstFloor);
        const firstGate = gates.find((g: Gate) => g.floor === firstFloor && (g.type === 'IN' || g.type === 'OUT' || g.type === 'ENTRY' || g.type === 'EXIT' || g.type === 'IN_OUT' || g.type === 'ENTRY_EXIT'));
        if (firstGate) setSelectedGateId(firstGate.id);
      }
    }
  }, [gates, isStartModalVisible, selectedFloor]);

  // Fetch the current preview settlement
  const { data: settlementPreview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['shift-settlement-preview'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get('/identity/work-sessions/current/preview-settlement');
        return res.data;
      } catch (e) {
        return null;
      }
    },
    enabled: shiftStatus === 'OPEN' && isCloseModalVisible
  });

  const startShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.post('/identity/work-sessions/start', { gateId: selectedGateId, gateType: selectedGateFunction });
      return res.data;
    },
    onSuccess: () => {
      message.success('Shift started successfully!');

      const gate = gates.find((g: Gate) => String(g.id) === String(selectedGateId));
      if (gate) {
        sessionStorage.setItem('activeGateId', String(gate.id));
        sessionStorage.setItem('activeGateName', gate.name);
        sessionStorage.setItem('activeGateType', selectedGateFunction || gate.type);
      } else if (selectedPostType === 'PATROL') {
        sessionStorage.removeItem('activeGateId');
        sessionStorage.setItem('activeGateName', 'Patrol (No Gate)');
        sessionStorage.setItem('activeGateType', 'PATROL');
      }

      setAuthShiftStatus('OPEN');
      setIsStartModalVisible(false);

      if (selectedPostType === 'PATROL') {
        navigate('/staff/exception-desk');
      } else {
        navigate('/staff/gate-console');
      }
    },
    onError: (error) => {
      message.error('Failed to start shift: ' + (error as any)?.response?.data?.message || 'Unknown error');
    }
  });

  // Cash is now blind-dropped, no systemCash or variance reasoning shown here.
  const endShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.put('/identity/work-sessions/end', {
        declaredCash: declaredCash !== null ? declaredCash : 0,
        varianceReason: varianceReason || null
      });
      return res.data;
    },
    onSuccess: () => {
      message.success('Shift closed and finances handed over successfully!');
      setAuthShiftStatus('CLOSED');
      sessionStorage.removeItem('activeGateId');
      sessionStorage.removeItem('activeGateName');
      sessionStorage.removeItem('activeGateType');
      setIsCloseModalVisible(false);
      setDeclaredCash(null);
      setCashMatchMode(null);
      setVarianceReason('');
      queryClient.invalidateQueries({ queryKey: ['shift-settlement-preview'] });
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      // Automatically open new shift selection form
      setIsStartModalVisible(true);
    },
    onError: (error) => {
      message.error('Failed to close shift: ' + (error as any)?.response?.data?.message || 'Unknown error');
    }
  });

  const handleStartShift = () => {
    if (selectedPostType === 'GATE' && !selectedGateId) {
      message.error('Please select a Gate!');
      return;
    }
    startShiftMutation.mutate();
  };

  const handleCloseShift = () => {
    if (activeGateType === 'OUT' || activeGateType === 'EXIT' || activeGateType === 'IN_OUT' || activeGateType === 'ENTRY_EXIT' || activeGateType === 'PATROL') {
      if (cashMatchMode === null) {
        message.error('Please confirm your cash balance');
        return;
      }
      if (cashMatchMode === 'DIFFERENT' && (declaredCash === null || declaredCash < 0)) {
        message.error('Please enter the actual cash amount you counted');
        return;
      }
      if (cashMatchMode === 'DIFFERENT' && !varianceReason.trim()) {
        message.error('Please enter a reason for the discrepancy');
        return;
      }
    }
    endShiftMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
          <div>
            <Title level={2} className="m-0 text-gray-800">Shift Management & Assignment</Title>
            <Text type="secondary">Select Gate Duty Position or Patrol Duty</Text>
          </div>
          <Tag color={shiftStatus === 'OPEN' ? 'success' : 'default'} className="px-4 py-1 text-sm font-bold rounded-full">
            {shiftStatus === 'OPEN' ? 'ON Shift' : 'NOT IN Shift'}
          </Tag>
        </div>

        <Card className="shadow-sm border-gray-200 rounded-2xl mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center bg-blue-50 p-6 rounded-xl border border-blue-100 mb-8">
            <div className="mb-4 md:mb-0">
              <Text className="block text-blue-600 font-medium mb-1">Current time:</Text>
              <Title level={3} className="m-0 text-blue-800">{simulatedDayjs().format('HH:mm - DD/MM/YYYY')}</Title>
            </div>

            {shiftStatus === 'CLOSED' ? (
              <Button
                type="primary"
                size="large"
                icon={<LoginOutlined />}
                onClick={() => setIsStartModalVisible(true)}
                className="bg-blue-600 px-4 sm:px-8 h-12 font-medium shadow-md w-full md:w-auto text-sm sm:text-base"
              >

                STARTING NEW ONLINE SHIFT
              </Button>
            ) : (
              <Button
                type="primary"
                danger
                size="large"
                icon={<LogoutOutlined />}
                onClick={() => setIsCloseModalVisible(true)}
                className="px-4 sm:px-8 h-12 font-medium animate-pulse w-full md:w-auto text-sm sm:text-base"
              >

                FINAL SHIFT & HANDover
              </Button>
            )}
          </div>

          {shiftStatus === 'OPEN' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <Text className="block text-green-700 font-bold uppercase tracking-widest text-xs mb-1">Current shift</Text>
              <div className="flex items-center space-x-3">
                {activeGateType === 'PATROL' ? <SafetyCertificateOutlined className="text-2xl text-green-600" /> : <CarOutlined className="text-2xl text-green-600" />}
                <Title level={4} className="m-0 text-green-800">{activeGateName}</Title>
              </div>
            </div>
          )}

          <Title level={4} className="mb-4">Status Lanes & Patrols</Title>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {gates.map((gate: Gate) => (
              <div
                key={gate.id}
                className={`p-4 rounded-xl border-2 transition-all ${gate.status === 'IDLE' ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50'
                  }`}
              >
                <div className="flex items-center space-x-2 mb-3">
                  {gate.type === 'IN' || gate.type === 'OUT' ? (
                    <CarOutlined className={`text-xl ${gate.status === 'IDLE' ? 'text-green-600' : 'text-gray-400'}`} />
                  ) : (
                    <SafetyCertificateOutlined className={`text-xl ${gate.status === 'IDLE' ? 'text-green-600' : 'text-gray-400'}`} />
                  )}
                  <Text strong className="text-base truncate">{gate.name}</Text>
                </div>
                <Tag color={gate.status === 'IDLE' ? 'success' : 'default'}>{gate.status}</Tag>
                {gate.status === 'OCCUPIED' && gate.staffName && (
                  <div>
                    <Text className="block mt-2 text-xs text-gray-500">Operator: <span className="font-medium text-gray-800">{gate.staffName}</span></Text>
                    {gate.staffEmail && (
                      <Text className="block text-xs text-gray-400">({gate.staffEmail})</Text>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Select Shift Start Location Modal */}
        <Modal
          title={<span className="text-xl font-bold"><SelectOutlined className="mr-2 text-blue-600" />Choose Work Location</span>}
          open={isStartModalVisible}
          onCancel={() => setIsStartModalVisible(false)}
          footer={[
            <Button key="back" onClick={() => setIsStartModalVisible(false)}>Cancel</Button>,
            <Button key="submit" type="primary" className="bg-blue-600 font-bold px-6" loading={startShiftMutation.isPending} onClick={handleStartShift}>

              Confirm Start
            </Button>,
          ]}
          width={600}
          style={{ top: 40 }}
          styles={{ body: { maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' } }}
        >
          <div className="py-4">
            <Text className="block mb-4 text-gray-600">You are assigned to a shift. Please select a position or task to begin.</Text>

            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <Text className="block mb-2 font-bold text-gray-700">1. Select Working Floor:</Text>
              <Radio.Group
                value={selectedFloor}
                onChange={e => {
                  setSelectedFloor(e.target.value);
                  // Reset selected gate
                  const firstGate = gates.find((g: Gate) => g.floor === e.target.value && (g.type === 'IN' || g.type === 'OUT' || g.type === 'ENTRY' || g.type === 'EXIT' || g.type === 'IN_OUT' || g.type === 'ENTRY_EXIT'));
                  if (firstGate) setSelectedGateId(firstGate.id);
                }}
                buttonStyle="solid"
                size="large"
                className="flex flex-wrap gap-2"
              >
                {Array.from(new Set(gates.map((g: Gate) => g.floor))).filter(Boolean).map((floor: any) => (
                  <Radio.Button key={floor} value={floor}>{floor}</Radio.Button>
                ))}
              </Radio.Group>
            </div>

            <Text className="block mb-2 font-bold text-gray-700">2. Select Task:</Text>
            <div className="w-full flex flex-col gap-4">
              <div
                className={`cursor-pointer h-auto p-4 rounded-xl border-2 flex items-center transition-all ${selectedPostType === 'GATE' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => {
                  setSelectedPostType('GATE');
                  const firstGate = gates.find((g: Gate) => g.floor === selectedFloor && (g.type === 'IN' || g.type === 'OUT' || g.type === 'ENTRY' || g.type === 'EXIT' || g.type === 'IN_OUT' || g.type === 'ENTRY_EXIT'));
                  if (firstGate) setSelectedGateId(firstGate.id);
                }}
              >
                <div className="flex items-start w-full">
                  <CarOutlined className={`text-3xl mt-1 mr-2 sm:mr-4 shrink-0 ${selectedPostType === 'GATE' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <Text strong className="block text-base sm:text-lg mb-1 truncate">Manning Gate (IN / OUT)</Text>
                    <Text type="secondary" className="text-sm">Process tickets, collect fees, control vehicle access at booths.</Text>
                    {selectedPostType === 'GATE' && (
                      <div className="mt-4 p-3 bg-white border border-blue-200 rounded-lg" onClick={e => e.stopPropagation()}>
                        <Text className="block mb-2 text-xs font-bold text-gray-500 uppercase">Select Specific Gate:</Text>
                        <Radio.Group onChange={(e) => setSelectedGateId(e.target.value)} value={selectedGateId}>
                          <Space direction="vertical">
                            {gates.filter((g: Gate) => g.floor === selectedFloor && (g.type === 'IN' || g.type === 'OUT' || g.type === 'ENTRY' || g.type === 'EXIT' || g.type === 'IN_OUT' || g.type === 'ENTRY_EXIT')).map((g: Gate) => (
                              <Radio key={g.id} value={g.id} disabled={g.status !== 'IDLE'}>
                                {g.name} {g.status !== 'IDLE' && <Text type="danger" className="text-xs ml-2">(Active Operator: {g.staffName} - {g.staffEmail})</Text>}
                              </Radio>
                            ))}
                          </Space>
                        </Radio.Group>

                        <div className="mt-4 pt-3 border-t border-blue-100">
                          <Text className="block mb-2 text-xs font-bold text-gray-500 uppercase">Gate Function:</Text>
                          <Radio.Group
                            value={selectedGateFunction}
                            onChange={e => setSelectedGateFunction(e.target.value)}
                            className="flex"
                          >
                            <Radio.Button value="ENTRY" className="flex-1 text-center">AS ENTRY GATE</Radio.Button>
                            <Radio.Button value="EXIT" className="flex-1 text-center">AS EXIT GATE</Radio.Button>
                          </Radio.Group>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`cursor-pointer h-auto p-4 rounded-xl border-2 flex items-center transition-all ${selectedPostType === 'PATROL' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}
                onClick={() => {
                  setSelectedPostType('PATROL');
                  const patrolGate = gates?.find((g: Gate) => g.type === 'PATROL' || g.name?.toLowerCase().includes('patrol') || g.name?.toLowerCase().includes('tuần tra'));
                  if (patrolGate) {
                    setSelectedGateId(patrolGate.id);
                    setSelectedGateFunction('PATROL');
                  } else {
                    setSelectedGateId(0);
                    setSelectedGateFunction('PATROL');
                  }
                }}
              >
                <div className="flex items-start">
                  <SafetyCertificateOutlined className={`text-3xl mt-1 mr-2 sm:mr-4 shrink-0 ${selectedPostType === 'PATROL' ? 'text-green-600' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <Text strong className="block text-base sm:text-lg mb-1 truncate">Patrol Task</Text>
                    <Text type="secondary" className="text-sm">Handle parking exceptions (wrong parking, lost cards, barrier errors).</Text>
                    {selectedPostType === 'PATROL' && (
                      <div className="mt-2">
                        <Tag color="green" className="mt-2 font-bold">Access: Exception Desk</Tag>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </Modal>

        {/* Close Shift Modal */}
        <Modal
          title={<span className="text-xl font-bold"><DollarOutlined className="mr-2 text-green-600" />Financial handover</span>}
          open={isCloseModalVisible}
          onCancel={() => setIsCloseModalVisible(false)}
          footer={[
            <Button key="back" onClick={() => setIsCloseModalVisible(false)}>Cancel</Button>,
            <Button key="submit" type="primary" danger loading={endShiftMutation.isPending} onClick={handleCloseShift} disabled={(activeGateType === 'OUT' || activeGateType === 'EXIT' || activeGateType === 'IN_OUT' || activeGateType === 'ENTRY_EXIT' || activeGateType === 'PATROL') && (cashMatchMode === null || (cashMatchMode === 'DIFFERENT' && (declaredCash === null || declaredCash < 0 || !varianceReason.trim())))}>

              Confirm Handover & Close shift
            </Button>,
          ]}
          width={500}
        >
          {isLoadingPreview ? <Spin className="block mx-auto my-8" /> : (
            <div className="py-4">
              {activeGateType === 'OUT' || activeGateType === 'EXIT' || activeGateType === 'IN_OUT' || activeGateType === 'ENTRY_EXIT' || activeGateType === 'PATROL' ? (
                <>
                  <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <Text className="block text-slate-500 mb-1">System Calculated Cash Revenue</Text>
                    <Title level={2} className="m-0 text-green-600 font-bold">{settlementPreview?.cashRevenue?.toLocaleString() || '0'} VND</Title>
                  </div>

                  <div className="mb-6">
                    <Text className="block font-bold text-gray-800 mb-2">Do you confirm this amount in your drawer?</Text>
                    <Radio.Group onChange={(e) => {
                      setCashMatchMode(e.target.value);
                      if (e.target.value === 'MATCH') {
                        setDeclaredCash(settlementPreview?.cashRevenue || 0);
                        setVarianceReason('');
                      } else {
                        setDeclaredCash(null);
                        setVarianceReason('');
                      }
                    }} value={cashMatchMode}>
                      <Space direction="vertical">
                        <Radio value="MATCH" className="font-medium">Yes, the cash in drawer matches exactly</Radio>
                        <Radio value="DIFFERENT" className="font-medium text-orange-600">No, the cash in drawer is different</Radio>
                      </Space>
                    </Radio.Group>
                  </div>

                  {cashMatchMode === 'DIFFERENT' && (
                    <div className="mb-6 bg-orange-50 p-4 rounded-xl border border-orange-200">
                      <Text className="block font-bold text-gray-800 mb-2">Enter Actual Cash in Drawer (VND):</Text>
                      <InputNumber
                        className="w-full text-lg"
                        size="large"
                        formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => Number(value?.replace(/\$\s?|(,*)/g, ''))}
                        onChange={(val) => setDeclaredCash(val as number)}
                        value={declaredCash}
                        placeholder="e.g. 500,000"
                        min={0}
                      />
                      <Text className="block font-bold text-gray-800 mt-4 mb-2">Reason for discrepancy:</Text>
                      <Input.TextArea
                        rows={2}
                        placeholder="E.g. Customer gave short change, Fake note, etc."
                        value={varianceReason}
                        onChange={(e) => setVarianceReason(e.target.value)}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                  <SafetyCertificateOutlined className="text-4xl text-green-500 mb-4" />
                  <Title level={4} className="m-0 text-green-700">Confirm Close Ca</Title>
                  <Text className="text-green-600 block mt-2">Location ({activeGateName}) does not generate cash revenuee Can close shifts directlye</Text>
                </div>
              )}
            </div>
          )}
        </Modal>

      </div>
    </div>
  );
};
// HMR Trigger
