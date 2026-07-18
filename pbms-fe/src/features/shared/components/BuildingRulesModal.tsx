import React from 'react';
import { Modal, Typography, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../../core/api/axiosClient';
import { ReadOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface BuildingRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BuildingRulesModal: React.FC<BuildingRulesModalProps> = ({ isOpen, onClose }) => {
  const { data: buildingProfile, isLoading } = useQuery({
    queryKey: ['public-building-profile'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get('/public/building-profile');
        return res.data.data;
      } catch (err) {
        return null;
      }
    },
    enabled: isOpen,
  });

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-blue-700">
          <ReadOutlined className="text-xl" />
          <span className="text-lg">Nội Quy Tòa Nhà</span>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={700}
      centered
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
    >
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spin size="large" />
        </div>
      ) : buildingProfile ? (
        <div className="py-2">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
            <Title level={5} className="m-0 text-slate-800 flex items-center gap-2">
              <InfoCircleOutlined className="text-blue-500" /> 
              {buildingProfile.name}
            </Title>
            <div className="mt-2 text-sm text-slate-600 flex flex-col gap-1">
              <Text><strong className="text-slate-500">Địa chỉ:</strong> {buildingProfile.address}</Text>
              <Text><strong className="text-slate-500">Hotline:</strong> {buildingProfile.hotline}</Text>
              <Text><strong className="text-slate-500">Email:</strong> {buildingProfile.contactEmail}</Text>
            </div>
          </div>
          
          <Title level={5} className="text-slate-800 border-b pb-2 mb-4">Danh sách nội quy & quy định bãi đỗ xe</Title>
          <div className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm bg-white p-4 rounded border border-gray-100 shadow-inner min-h-[200px]">
            {buildingProfile.rules ? buildingProfile.rules : <Text type="secondary" italic>Chưa có nội quy nào được cấu hình.</Text>}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center">
          <Text type="secondary">Không thể tải thông tin tòa nhà.</Text>
        </div>
      )}
    </Modal>
  );
};
