import React, { useState } from 'react';
import { Card, Typography, Button, Table, Tag, Alert, Modal } from 'antd';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../core/api/axiosClient';
import dayjs from 'dayjs';
import { 
  CustomerServiceOutlined, 
  CheckCircleFilled,
  WarningOutlined,
  MessageOutlined,
  BookOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { IncidentSubmitForm } from '../incident/components/IncidentSubmitForm';
import { IncidentDetailPanel } from '../incident/components/IncidentDetailPanel';

const { Title, Text } = Typography;

export const HelpdeskScreen = () => {
  const [systemMessage, setSystemMessage] = useState<{ type: 'success' | 'warning' | 'info'; title: string; desc: string } | null>(null);
  const [isRulesExpanded, setIsRulesExpanded] = useState<boolean>(false);
  
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const { data: buildingProfile } = useQuery({
    queryKey: ['public-building-profile'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get('/public/building-profile');
        return res.data.data;
      } catch (err) {
        return null;
      }
    }
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get('/incident/incidents');
        return res.data.data || [];
      } catch (err) {
        return [];
      }
    }
  });

  const handleIncidentSuccess = (category: string, plate: string) => {
    switch (category) {
      case 'SLOT_OCCUPIED':
        setSystemMessage({
          type: 'warning',
          title: 'Record Report - Please move to Waiting Zone',
          desc: `The System has received the Incident Slote Report. Please move the vehicle to the Temporary Waiting Zonee Staff will verify and regulate the new location and send the results via the tracking table belowe`
        });
        const bg = document.getElementById('helpdesk-container');
        if (bg) {
          bg.classList.add('bg-orange-50');
          setTimeout(() => bg.classList.remove('bg-orange-50'), 2000);
        }
        break;
      case 'FIND_CAR':
        setSystemMessage({
          type: 'info',
          title: 'System coordinated Staff',
          desc: `Please stay where you are and we will send staff to assist you`
        });
        break;
      case 'LOST_CARD':
        setSystemMessage({
          type: 'warning',
          title: 'Lock gate Emergency Check-OUT',
          desc: `Parking session for Vehicle [${plate}] has been added to RED LIST for theft prevention. System logged. Please provide evidence to staff at check-out.`
        });
        break;
      case 'DAMAGED_CARD':
        setSystemMessage({
          type: 'info',
          title: 'Report of damaged card has been received',
          desc: `System logged card for vehicle [${plate}] as physically damaged. Please bring to counter at check-out for verification.`
        });
        break;
      case 'FEE_DISPUTE':
        setSystemMessage({
          type: 'info',
          title: 'Fee check request has been sent',
          desc: 'Tickets have been transferred to Management for review. Note: Fees are still being calculated until Management decides to freeze or reduce them.'
        });
        break;
      default:
        setSystemMessage({
          type: 'success',
          title: 'Thank you for your comments',
          desc: 'Your feedback has been sent to the Management Board for service improvement'
        });
    }
  };

  const columns = [
    { title: 'Ticket code', dataIndex: 'id', key: 'id', render: (text: string) => <Text strong>{text || 'NEW'}</Text> },
    { title: 'Classify', dataIndex: 'type', key: 'type' },
    { title: 'License Plate', dataIndex: 'plate', key: 'plate' },
    { title: 'Describe', dataIndex: 'description', key: 'description' },
    { title: 'Time created', dataIndex: 'time', key: 'time', render: (text: string) => <Text>{text ? dayjs(text).format('HH:mm DD/MM/YYYY') : '-'}</Text> },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        let label = status;
        if (status === 'PENDING') { color = 'warning'; label = 'Pending'; }
        else if (status === 'WAITING_CHECKOUT') { color = 'processing'; label = 'Processing'; }
        else if (status === 'RESOLVED') { color = 'success'; label = 'Resolved'; }
        else if (status === 'REJECTED' || status === 'CANCELLED') { color = 'error'; label = status; }
        return <Tag color={color}>{label}</Tag>;
      }
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => setSelectedTicket(record)}>
          Xem chi tiết
        </Button>
      )
    }
  ];

  return (
    <div id="helpdesk-container" className="min-h-screen bg-gray-50/50 p-4 md:p-6 transition-colors duration-700 ease-in-out">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <CustomerServiceOutlined className="text-2xl text-white" />
            </div>
            <div>
              <Title level={2} className="m-0 text-gray-800 tracking-tight">Incident Support</Title>
              <Text type="secondary" className="text-gray-500">Center for receiving and processing exceptions automatically</Text>
            </div>
          </div>
          <Button 
            type={isRulesExpanded ? "primary" : "default"} 
            icon={<BookOutlined />} 
            onClick={() => setIsRulesExpanded(!isRulesExpanded)}
            className="rounded-full shadow-sm"
          >
            Xem quy định bãi xe {isRulesExpanded ? '(Thu gọn)' : ''}
          </Button>
        </div>

        {isRulesExpanded && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-fade-in-up transition-all">
            <Title level={4} className="text-slate-800 mb-4"><SafetyCertificateOutlined className="mr-2 text-blue-600" /> Quy định bãi đỗ xe</Title>
            <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
              {buildingProfile?.rules || "Hiện tại chưa có quy định nào được thiết lập."}
            </div>
          </div>
        )}

        {/* Request Form */}
        <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
          {systemMessage ? (
            <div className="animate-fade-in-up p-4">
              <Alert
                message={<span className="font-semibold text-lg">{systemMessage.title}</span>}
                description={<span className="text-base mt-1 block">{systemMessage.desc}</span>}
                type={systemMessage.type}
                showIcon
                icon={systemMessage.type === 'success' ? <CheckCircleFilled className="mt-1" /> : undefined}
                className="rounded-xl border-2 py-4 px-5 shadow-sm"
                action={
                  <Button onClick={() => setSystemMessage(null)} type="link" className="font-medium">
                    Create New Request
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-2">
              <IncidentSubmitForm onSuccess={handleIncidentSuccess} userRole="CUSTOMER" />
            </div>
          )}
        </Card>
        
        {/* Ticket History */}
        <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden mt-6 md:mt-8">
          <Title level={5} className="mb-4 text-gray-600 uppercase text-xs tracking-wider font-bold">Recent Request History</Title>
          <div className="overflow-x-auto">
            <Table 
              dataSource={tickets} 
              columns={columns} 
              rowKey="id" 
              pagination={false} 
              size="small" 
              className="min-w-[600px]"
            />
          </div>
        </Card>

      </div>

      <Modal
        open={!!selectedTicket}
        onCancel={() => setSelectedTicket(null)}
        footer={null}
        width={700}
        destroyOnClose
        styles={{ body: { padding: 0 } }}
        closeIcon={false}
      >
        {selectedTicket && (
          <IncidentDetailPanel 
            ticket={selectedTicket} 
            userRole="CUSTOMER" 
            onClose={() => setSelectedTicket(null)} 
          />
        )}
      </Modal>

    </div>
  );
};
