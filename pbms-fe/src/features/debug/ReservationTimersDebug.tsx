import React from 'react';
import { Card, Table, Typography, Tag, Space, Button } from 'antd';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../core/api/axiosClient';
import { simulatedDayjs } from '../../core/utils/timeProvider';
import { ClockCircleOutlined, SyncOutlined, BugOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface DebugTimer {
  reservationId: number;
  taskType: string;
  targetTime: string;
  isTriggered: boolean;
}

export const ReservationTimersDebug = ({ reservationId, defaultExpanded = false }: { reservationId?: string | number, defaultExpanded?: boolean }) => {
  const { data: timersData, isLoading, refetch } = useQuery({
    queryKey: ['debug-timers'],
    queryFn: () => axiosClient.get('/public/debug/reservations/timers').then(res => res.data.data),
    refetchInterval: 1000,
  });

  const [expanded, setExpanded] = React.useState(defaultExpanded);
  
  // Need to force re-render every second to update countdowns if not loading from API
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!expanded) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [expanded]);
  const filteredData = React.useMemo(() => {
    if (!timersData) return [];
    if (!reservationId) return timersData;
    return timersData.filter((t: any) => String(t.reservationId) === String(reservationId));
  }, [timersData, reservationId]);

  if (!expanded) {
    return (
      <Button 
        type="dashed" 
        icon={<BugOutlined />} 
        onClick={() => setExpanded(true)}
        className="w-full mt-4"
      >
        Show Timers Debug
      </Button>
    );
  }

  const columns = [
    {
      title: 'Res ID',
      dataIndex: 'reservationId',
      key: 'reservationId',
      width: 80,
      render: (id: number) => <Text strong>#{id}</Text>
    },
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
      render: (_: any, record: DebugTimer) => {
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

  const now = simulatedDayjs();

  return (
    <Card 
      className="mt-4 border border-dashed border-blue-400 bg-blue-50/30" 
      size="small"
      title={
        <div className="flex justify-between items-center">
          <Space>
            <BugOutlined className="text-blue-500" />
            <Text strong className="text-blue-700">Reservation Timers Monitor {reservationId ? `#${reservationId}` : ''}</Text>
          </Space>
          <Space>
            <Text type="secondary" className="text-xs">
              <ClockCircleOutlined className="mr-1" />
              Simulated Time: <strong className="text-blue-600">{now.format('HH:mm:ss DD/MM')}</strong>
            </Text>
            <Button size="small" type="text" danger onClick={() => setExpanded(false)}>Hide</Button>
          </Space>
        </div>
      }
    >
      <Table 
        dataSource={filteredData} 
        columns={columns} 
        rowKey={(r) => `${r.reservationId}-${r.taskType}`}
        size="small"
        pagination={false}
        loading={isLoading}
        locale={{ emptyText: 'No active timers running.' }}
      />
    </Card>
  );
};
