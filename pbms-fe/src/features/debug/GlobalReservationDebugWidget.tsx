import React, { useState } from 'react';
import { Card, Table, Typography, Tag, Space, Button, Input, Select, Modal } from 'antd';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../core/api/axiosClient';
import { simulatedDayjs } from '../../core/utils/timeProvider';
import { ClockCircleOutlined, SyncOutlined, BugOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

export const GlobalReservationDebugWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchPlate, setSearchPlate] = useState('');
  const [searchVehicleTypeId, setSearchVehicleTypeId] = useState<number | null>(null);
  
  const [submittedPlate, setSubmittedPlate] = useState('');
  const [submittedVehicleTypeId, setSubmittedVehicleTypeId] = useState<number | null>(null);

  const { data: vehicleTypes } = useQuery({
    queryKey: ['public-vehicle-types'],
    queryFn: () => axiosClient.get('/public/vehicle-types').then(res => res.data.data),
  });

  const { data: timersData, isLoading } = useQuery({
    queryKey: ['debug-timers'],
    queryFn: () => axiosClient.get('/public/debug/reservations/timers').then(res => res.data.data),
    refetchInterval: 1000,
    enabled: isOpen,
  });

  // Need to force re-render every second to update countdowns if not loading from API
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleSearch = () => {
    if (!searchVehicleTypeId) {
      import('antd').then(({ message }) => {
        message.error('Vui lòng chọn loại phương tiện để tìm kiếm');
      });
      return;
    }
    setSubmittedPlate(searchPlate);
    setSubmittedVehicleTypeId(searchVehicleTypeId);
  };

  const filteredData = React.useMemo(() => {
    if (!timersData) return [];
    if (!submittedPlate && !submittedVehicleTypeId) return []; // Require search to show anything to avoid clutter
    
    return timersData.filter((t: any) => {
      const matchPlate = submittedPlate ? (t.plateNumber || '').toLowerCase().includes(submittedPlate.toLowerCase()) : true;
      const matchType = submittedVehicleTypeId ? t.vehicleTypeId === submittedVehicleTypeId : true;
      return matchPlate && matchType;
    });
  }, [timersData, submittedPlate, submittedVehicleTypeId]);

  const columns = [
    {
      title: 'Task Type',
      dataIndex: 'taskType',
      key: 'taskType',
      render: (type: string) => {
        let color = 'blue';
        if (type === 'ENTRY') color = 'orange';
        if (type === 'EXPIRE') color = 'red';
        return <Tag color={color}>{type}</Tag>;
      }
    },
    {
      title: 'Target Time',
      dataIndex: 'targetTime',
      key: 'targetTime',
      render: (time: string) => dayjs(time).format('HH:mm:ss DD/MM/YYYY')
    },
    {
      title: 'Countdown',
      key: 'countdown',
      render: (_: any, record: any) => {
        const now = simulatedDayjs();
        const target = dayjs(record.targetTime);
        const diffSeconds = target.diff(now, 'second');
        
        if (diffSeconds <= 0) {
          return <Text type="secondary">0s (Passed)</Text>;
        }
        
        const h = Math.floor(diffSeconds / 3600);
        const m = Math.floor((diffSeconds % 3600) / 60);
        const s = diffSeconds % 60;
        
        return <Text strong className="text-blue-600">{`${h}h ${m}m ${s}s`}</Text>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'isTriggered',
      key: 'isTriggered',
      render: (isTriggered: boolean) => (
        isTriggered 
          ? <Tag color="default">Triggered</Tag>
          : <Tag color="green" icon={<SyncOutlined spin />}>Waiting</Tag>
      )
    }
  ];

  return (
    <>
      <Button
        type="default"
        shape="circle"
        icon={<BugOutlined className="text-blue-500" />}
        className="border-blue-200 hover:border-blue-400 bg-blue-50"
        onClick={() => setIsOpen(true)}
        title="Debug Reservation Timers"
      />

      {/* Modal Popup */}
      <Modal
        title={
          <Space>
            <BugOutlined className="text-blue-500" />
            <Text strong className="text-blue-700">Reservation Timers Monitor</Text>
          </Space>
        }
        open={isOpen}
        onCancel={() => setIsOpen(false)}
        footer={null}
        width={600}
        mask={false}
        style={{ position: 'fixed', bottom: 80, right: 24, margin: 0, padding: 0 }}
      >
        <div className="flex space-x-2 mb-4 mt-4">
          <Select
            placeholder="Select Vehicle Type"
            className="w-1/3"
            allowClear
            value={searchVehicleTypeId}
            onChange={(val) => setSearchVehicleTypeId(val)}
            options={(vehicleTypes || []).map((vt: any) => ({ label: vt.typeName, value: vt.id }))}
          />
          <Input 
            placeholder="Enter License Plate"
            className="flex-1"
            value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            Check
          </Button>
        </div>

        <Table 
          dataSource={filteredData} 
          columns={columns} 
          rowKey={(r) => `${r.reservationId}-${r.taskType}`}
          size="small"
          pagination={false}
          loading={isLoading}
          locale={{ emptyText: (submittedPlate || submittedVehicleTypeId) ? 'No active timers found for this vehicle.' : 'Enter vehicle details to check timers.' }}
        />
      </Modal>
    </>
  );
};
