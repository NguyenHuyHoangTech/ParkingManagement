import React from 'react';
import { Form, Select, Input, Button, message, Typography, Card } from 'antd';
import { CarOutlined, QrcodeOutlined, MailOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../../core/api/axiosClient';

const { Title, Text } = Typography;

interface VehicleAssignmentTabProps {
  isManager?: boolean;
}

export const VehicleAssignmentTab: React.FC<VehicleAssignmentTabProps> = ({ isManager }) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ['vehicleTypes'],
    queryFn: async () => {
      const res = await axiosClient.get('/operation/vehicle-types');
      return res.data?.data || [];
    }
  });

  const assignVehicleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await axiosClient.post('/operation/vehicles/assign', payload);
      return res.data;
    },
    onSuccess: () => {
      message.success('Gán xe thành công! Lịch sử sự cố đã được đồng bộ.');
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Gán xe thất bại. Vui lòng kiểm tra lại thông tin.');
    }
  });

  const handleSubmit = (values: any) => {
    assignVehicleMutation.mutate(values);
  };

  return (
    <Card className="max-w-2xl mx-auto mt-6 shadow-sm border-slate-200">
      <div className="text-center mb-6">
        <Title level={4} className="text-blue-700">Gán Xe Vào Tài Khoản</Title>
        <Text type="secondary">
          {isManager 
            ? 'Cung cấp thông tin xe (Biển số, Loại xe, Mã thẻ RFID đang giữ) để gán xe cho Khách hàng.' 
            : 'Cung cấp thông tin xe (Biển số, Loại xe, Mã thẻ RFID đang giữ) để nhận xe vào tài khoản của bạn.'}
        </Text>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item 
          name="plateNumber" 
          label="Biển số xe" 
          rules={[{ required: true, message: 'Vui lòng nhập biển số xe' }]}
        >
          <Input size="large" prefix={<CarOutlined />} placeholder="Ví dụ: 30A-12345" className="uppercase" />
        </Form.Item>

        <Form.Item 
          name="vehicleTypeId" 
          label="Loại xe" 
          rules={[{ required: true, message: 'Vui lòng chọn loại xe' }]}
        >
          <Select size="large" placeholder="Chọn loại xe">
            {vehicleTypes.map((vt: any) => (
              <Select.Option key={vt.id} value={vt.id}>{vt.typeName}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item 
          name="rfid" 
          label="Mã thẻ RFID" 
          rules={[{ required: true, message: 'Vui lòng nhập mã thẻ RFID' }]}
          extra="Mã thẻ cứng đang được gắn với lượt đỗ xe này."
        >
          <Input size="large" prefix={<QrcodeOutlined />} placeholder="Ví dụ: E200408507110196" />
        </Form.Item>

        {isManager && (
          <Form.Item 
            name="email" 
            label="Email Khách hàng" 
            rules={[{ type: 'email', message: 'Email không hợp lệ' }, { required: true, message: 'Vui lòng nhập email khách hàng' }]}
            extra="Nhập email của Khách hàng để gán xe vào tài khoản của họ."
          >
            <Input size="large" prefix={<MailOutlined />} placeholder="Ví dụ: khachhang@gmail.com" />
          </Form.Item>
        )}

        <Button 
          type="primary" 
          htmlType="submit" 
          size="large" 
          block 
          loading={assignVehicleMutation.isPending}
          className="mt-4"
        >
          Xác nhận Gán xe
        </Button>
      </Form>
    </Card>
  );
};
