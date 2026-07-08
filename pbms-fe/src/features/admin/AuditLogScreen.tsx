import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Typography, Card, Tag, Modal, Button, DatePicker, Input, Select, Space } from 'antd';
import { HistoryOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface AuditLog {
  id: number;
  action: string;
  resource: string;
  actor: { email: string };
  createdAt: string;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string;
}

import axiosClient from '../../core/api/axiosClient';
import { simulatedDayjs } from '../../core/utils/timeProvider';

export const AuditLogScreen = () => {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  // Filters & Pagination State
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>([simulatedDayjs().subtract(7, 'days').startOf('day'), simulatedDayjs().endOf('day')]);
  const [searchEmail, setSearchEmail] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterResource, setFilterResource] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const formatJsonSafely = (val: string | null) => {
    if (!val) return 'NULL';
    try {
      return JSON.stringify(JSON.parse(val), null, 2);
    } catch (e) {
      return val;
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', currentPage, pageSize, dateRange, searchEmail, filterAction, filterResource],
    queryFn: async () => {
      const params: any = {
        page: currentPage - 1,
        size: pageSize,
      };
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].startOf('day').toISOString();
        params.endDate = dateRange[1].endOf('day').toISOString();
      }
      if (searchEmail) params.email = searchEmail;
      if (filterAction) params.action = filterAction;
      if (filterResource) params.resource = filterResource;

      const res = await axiosClient.get('/system/audit-logs', { params });
      return res.data.data; // Now returns a Page object
    }
  });

  const logs = data?.content || [];
  const totalElements = data?.totalElements || 0;

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { 
      title: 'Action', 
      dataIndex: 'action', 
      key: 'action',
      render: (action: string) => {
        let color = 'default';
        if (action === 'CREATE') color = 'success';
        if (action === 'UPDATE') color = 'processing';
        if (action === 'DELETE') color = 'error';
        return <Tag color={color}>{action}</Tag>;
      }
    },
    { title: 'Resource', dataIndex: 'resource', key: 'resource', render: (text: string) => <Text strong>{text}</Text> },
    { title: 'Performed By', dataIndex: ['actor', 'email'], key: 'performedBy' },
    { title: 'Time', dataIndex: 'createdAt', key: 'timestamp', render: (text: string) => text ? new Date(text).toLocaleString() : '' },
    { title: 'IP', dataIndex: 'ipAddress', key: 'ip' },
    {
      title: 'Details',
      key: 'details',
      render: (_: any, record: AuditLog) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />} 
          onClick={() => setSelectedLog(record)}
        >
          View Diff
        </Button>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <Title level={2} className="m-0 text-gray-800 flex items-center">
            <HistoryOutlined className="mr-3 text-blue-600" /> System Audit Logs
          </Title>
          <Text type="secondary" className="mt-1 block">Track all system changes and administrative actions.</Text>
        </div>

        <Card className="shadow-sm rounded-xl border-gray-200">
          <div className="flex flex-wrap gap-4 justify-between items-center mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <Space size="middle" wrap>
              <div>
                <Text strong className="block mb-1 text-xs text-gray-500 uppercase">Search by Email</Text>
                <Input 
                  placeholder="admin@example.com" 
                  prefix={<SearchOutlined className="text-gray-400" />}
                  allowClear
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  style={{ width: 220 }}
                />
              </div>
              
              <div>
                <Text strong className="block mb-1 text-xs text-gray-500 uppercase">Action</Text>
                <Select
                  placeholder="All Actions"
                  allowClear
                  value={filterAction}
                  onChange={setFilterAction}
                  style={{ width: 140 }}
                  options={[
                    { value: 'CREATE', label: 'CREATE' },
                    { value: 'UPDATE', label: 'UPDATE' },
                    { value: 'DELETE', label: 'DELETE' }
                  ]}
                />
              </div>

              <div>
                <Text strong className="block mb-1 text-xs text-gray-500 uppercase">Resource</Text>
                <Input
                  placeholder="e.g. User, Role..."
                  prefix={<SearchOutlined className="text-gray-400" />}
                  allowClear
                  value={filterResource || ''}
                  onChange={(e) => setFilterResource(e.target.value)}
                  style={{ width: 180 }}
                />
              </div>

              <div>
                <Text strong className="block mb-1 text-xs text-gray-500 uppercase">Date Range</Text>
                <RangePicker 
                  value={dateRange as any}
                  defaultPickerValue={[simulatedDayjs(), simulatedDayjs()]}
                  onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)} 
                  format="YYYY-MM-DD"
                  style={{ width: 280 }}
                />
              </div>
            </Space>
          </div>

          <Table 
            dataSource={logs} 
            columns={columns} 
            rowKey="id"
            loading={isLoading}
            pagination={{ 
              current: currentPage, 
              pageSize: pageSize, 
              total: totalElements,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }
            }}
          />
        </Card>

        <Modal
          title="Audit Log Detail (Diff Viewer)"
          open={!!selectedLog}
          onCancel={() => setSelectedLog(null)}
          footer={[<Button key="close" onClick={() => setSelectedLog(null)}>Close</Button>]}
          width={1000}
        >
          {selectedLog && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <Text strong className="text-gray-700 block mb-2">Old Value</Text>
                  <pre className="text-xs overflow-auto text-gray-800 bg-white p-3 rounded whitespace-pre-wrap break-all border border-gray-100 max-h-96">
                    {formatJsonSafely(selectedLog.oldValue)}
                  </pre>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Text strong className="text-blue-700 block mb-2">New Value / Details</Text>
                  <pre className="text-xs overflow-auto text-blue-900 bg-blue-100/50 p-3 rounded whitespace-pre-wrap break-all max-h-96">
                    {formatJsonSafely(selectedLog.newValue)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};
