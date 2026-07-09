import React, { useState } from 'react';
import { Form, Select, Input, Button, message, Upload } from 'antd';
import { 
  CameraOutlined, CarOutlined, QrcodeOutlined, 
  LockOutlined, WarningOutlined, SearchOutlined, 
  ClockCircleOutlined, MessageOutlined, SafetyCertificateOutlined 
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import axiosClient from '../../../core/api/axiosClient';

const { TextArea } = Input;

interface IncidentSubmitFormProps {
  onSuccess: (category: string, plate: string) => void;
  userRole: 'CUSTOMER' | 'STAFF';
  isManager?: boolean;
}

export const IncidentSubmitForm: React.FC<IncidentSubmitFormProps> = ({ onSuccess, userRole, isManager }) => {
  const [form] = Form.useForm();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isPlateVerified, setIsPlateVerified] = useState<boolean>(false);
  const [isCheckingPlate, setIsCheckingPlate] = useState<boolean>(false);
  
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [uploadedFile2, setUploadedFile2] = useState<any>(null);

  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ['vehicleTypes'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get(userRole === 'STAFF' ? '/operation/vehicle-types' : '/public/vehicle-types');
        return res.data.data || [];
      } catch (err) {
        return [];
      }
    }
  });

  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const createIncidentMutation = useMutation({
    mutationFn: async (payload: any) => {
      let res;
      if (payload.issueType === 'LOST_CARD') {
        res = await axiosClient.post('/incident/incidents/lost-card', { 
          plate: payload.plate, 
          description: payload.description,
          uploadedDocUrl: payload.uploadedDocUrl,
          vehicleTypeId: payload.vehicleTypeId,
          fee: payload.fee
        });
      } else {
        res = await axiosClient.post('/incident/incidents', payload);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      form.resetFields();
      setUploadedFile(null);
      setUploadedFile2(null);
      setIsPlateVerified(false);
      setSelectedCategory('');
      onSuccess(variables.issueType, variables.plate);
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Lỗi khi gửi yêu cầu hỗ trợ');
    }
  });

  const handleCheckPlate = async () => {
    const plate = form.getFieldValue('plate');
    if (!plate) {
      message.warning('Vui lòng nhập Biển số xe để kiểm tra');
      return;
    }
    
    const vehicleTypeId = form.getFieldValue('vehicleTypeId');
    if (!vehicleTypeId) {
      message.warning('Vui lòng chọn Loại xe để kiểm tra');
      return;
    }

    const isLostOrDamaged = selectedCategory === 'LOST_CARD' || selectedCategory === 'DAMAGED_CARD' || selectedCategory === 'ZONE_VIOLATION' || selectedCategory === 'BLACKLIST_VIOLATION';
    let rfid = '';
    if (!isLostOrDamaged) {
      rfid = form.getFieldValue('code');
      if (!rfid) {
        message.warning('Vui lòng nhập mã thẻ để kiểm tra');
        return;
      }
    }

    setIsCheckingPlate(true);
    try {
      let res;
      if (isLostOrDamaged) {
        res = await axiosClient.get(`/incident/incidents/check-plate`, { params: { plate: plate.toUpperCase(), vehicleTypeId } });
      } else {
        res = await axiosClient.get(`/incident/incidents/check-plate-rfid`, { params: { plate: plate.toUpperCase(), rfid, vehicleTypeId } });
      }
      
      if (res.data?.data?.isActive) {
        setIsPlateVerified(true);
        message.success('Xác thực thành công! Vui lòng cung cấp chi tiết sự cố bên dưới.');
      } else {
        setIsPlateVerified(false);
        message.error(isLostOrDamaged ? 'Không tìm thấy xe có biển số này trong bãi!' : 'Biển số và Mã thẻ không khớp hoặc không tìm thấy trong bãi!');
      }
    } catch (err) {
      setIsPlateVerified(false);
      message.error('Lỗi khi kiểm tra thông tin xe!');
    } finally {
      setIsCheckingPlate(false);
    }
  };

  const handleIncidentSubmit = async (values: any) => {
    let mockUrl = '';
    
    if (['LOST_CARD', 'DAMAGED_CARD', 'SLOT_OCCUPIED', 'BLACKLIST_VIOLATION'].includes(values.category) && !uploadedFile) {
      message.error('Vui lòng tải lên ảnh minh chứng bắt buộc');
      return;
    }

    try {
      if (values.category === 'DAMAGED_CARD') {
        const urls = [];
        if (uploadedFile) urls.push(await getBase64(uploadedFile));
        if (uploadedFile2) urls.push(await getBase64(uploadedFile2));
        mockUrl = urls.join('|');
      } else {
        if (uploadedFile) {
          mockUrl = await getBase64(uploadedFile);
        }
      }

      await createIncidentMutation.mutateAsync({
        issueType: values.category,
        plate: values.plate?.toUpperCase() || '',
        vehicleTypeId: values.vehicleTypeId,
        description: `BKS: ${values.plate || 'N/A'} - ${values.description || ''}`,
        priority: values.category === 'LOST_CARD' || values.category === 'BLACKLIST_VIOLATION' ? 'HIGH' : 'MEDIUM',
        uploadedDocUrl: mockUrl
      });
      
    } catch (error) {
      // Handled in mutation onError
    }
  };

  let options = [
    { value: 'LOST_CARD', label: 'Báo mất thẻ (Yêu cầu khóa xe)', icon: <LockOutlined className="text-red-500" /> },
    { value: 'DAMAGED_CARD', label: 'Báo thẻ hỏng / Không đọc được', icon: <WarningOutlined className="text-orange-500" /> },
    { value: 'SLOT_OCCUPIED', label: 'Chỗ đỗ đặt trước bị chiếm dụng', icon: <CarOutlined className="text-blue-500" /> },
    { value: 'FIND_CAR', label: 'Tìm xe không thấy', icon: <SearchOutlined className="text-green-500" /> },
    { value: 'FEE_DISPUTE', label: 'Sai lệch phí', icon: <ClockCircleOutlined className="text-purple-500" /> },
    { value: 'OTHER_FEEDBACK', label: 'Góp ý chất lượng dịch vụ', icon: <MessageOutlined className="text-gray-500" /> },
  ];

  if (userRole === 'STAFF') {
    options = [
      ...options,
      { value: 'ZONE_VIOLATION', label: 'Báo cáo Đỗ sai Zone (Nội bộ)', icon: <WarningOutlined className="text-red-600" /> },
      { value: 'BLACKLIST_VIOLATION', label: 'Thêm vào Blacklist (Nội bộ)', icon: <WarningOutlined className="text-gray-800" /> }
    ];
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleIncidentSubmit} className="animate-fade-in">
      <Form.Item 
        name="category" 
        label={<span className="font-medium text-gray-700 text-base">Bạn đang gặp sự cố gì?</span>}
        rules={[{ required: true, message: 'Vui lòng chọn loại sự cố' }]}
      >
        <Select 
          size="large"
          placeholder="-- Chọn loại sự cố --"
          onChange={(val) => {
            setSelectedCategory(val);
            setIsPlateVerified(false);
          }}
          className="h-14 font-medium"
          options={options}
          optionRender={(option) => (
            <div className="flex items-center gap-3 text-base">
              {option.data.icon} {option.data.label}
            </div>
          )}
        />
      </Form.Item>

      <div className="transition-all duration-300">
        {selectedCategory && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 bg-slate-50 p-4 md:p-6 rounded-xl border border-slate-200 mb-6 animate-fade-in-up">
            
            {selectedCategory !== 'OTHER_FEEDBACK' && (
              <Form.Item 
                name="vehicleTypeId" 
                label="Loại xe" 
                rules={[{ required: true, message: 'Vui lòng chọn loại xe' }]}
                className="mb-0 col-span-1 md:col-span-2"
              >
                <Select 
                  size="large" 
                  placeholder="Chọn loại xe" 
                  className="h-12"
                  options={vehicleTypes.map((vt: any) => ({ value: vt.id, label: vt.typeName }))}
                  disabled={isCheckingPlate} 
                  onChange={() => setIsPlateVerified(false)}
                />
              </Form.Item>
            )}

            {selectedCategory !== 'OTHER_FEEDBACK' && (
              <Form.Item 
                label="Biển số xe thực tế"
                required
                className={`mb-0 col-span-1 ${selectedCategory === 'LOST_CARD' || selectedCategory === 'DAMAGED_CARD' || selectedCategory === 'ZONE_VIOLATION' || selectedCategory === 'BLACKLIST_VIOLATION' ? 'md:col-span-2' : ''}`}
              >
                <div className="flex gap-2">
                  <Form.Item name="plate" rules={[{ required: true, message: 'Vui lòng nhập biển số' }]} noStyle>
                    <Input size="large" prefix={<CarOutlined className="text-gray-400 mr-2" />} placeholder="VD: 51G-123.45" className="h-12 font-mono uppercase" disabled={isCheckingPlate} onChange={() => setIsPlateVerified(false)} />
                  </Form.Item>
                  {(selectedCategory === 'LOST_CARD' || selectedCategory === 'DAMAGED_CARD' || selectedCategory === 'ZONE_VIOLATION' || selectedCategory === 'BLACKLIST_VIOLATION') && (
                    <Button type="primary" size="large" className="h-12" loading={isCheckingPlate} onClick={handleCheckPlate}>
                      Kiểm tra
                    </Button>
                  )}
                </div>
              </Form.Item>
            )}

            {(selectedCategory !== 'LOST_CARD' && selectedCategory !== 'DAMAGED_CARD' && selectedCategory !== 'OTHER_FEEDBACK' && selectedCategory !== 'ZONE_VIOLATION' && selectedCategory !== 'BLACKLIST_VIOLATION') && (
              <Form.Item 
                label="Mã thẻ / Mã Booking"
                required
                className="mb-0 col-span-1"
              >
                <div className="flex gap-2">
                  <Form.Item name="code" rules={[{ required: true, message: 'Vui lòng nhập mã thẻ để xác thực' }]} noStyle>
                    <Input size="large" prefix={<QrcodeOutlined className="text-gray-400 mr-2" />} placeholder="Nhập mã in trên thẻ..." className="h-12" disabled={isCheckingPlate} onChange={() => setIsPlateVerified(false)} />
                  </Form.Item>
                  <Button type="primary" size="large" className="h-12" loading={isCheckingPlate} onClick={handleCheckPlate}>
                    Kiểm tra
                  </Button>
                </div>
              </Form.Item>
            )}

            {(isPlateVerified || selectedCategory === 'OTHER_FEEDBACK') && (
              <>
            {selectedCategory === 'DAMAGED_CARD' ? (
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item label="Tải lên ảnh Thẻ bị hỏng" className="mb-0">
                    <Upload maxCount={1} beforeUpload={(file) => { setUploadedFile(file); return false; }} onRemove={() => setUploadedFile(null)} className="w-full block" listType="picture">
                      <div className="w-full h-32 border-2 border-dashed border-orange-300 rounded-lg flex flex-col items-center justify-center bg-white text-orange-500 hover:bg-orange-50 hover:border-orange-500 cursor-pointer transition-colors group">
                        <CameraOutlined className="text-3xl mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Bấm mở Camera / Tải ảnh thẻ lên</span>
                      </div>
                    </Upload>
                </Form.Item>
                <Form.Item label="Tải lên ảnh CCCD/Giấy tờ chủ xe" className="mb-0">
                    <Upload maxCount={1} beforeUpload={(file) => { setUploadedFile2(file); return false; }} onRemove={() => setUploadedFile2(null)} className="w-full block" listType="picture">
                      <div className="w-full h-32 border-2 border-dashed border-orange-300 rounded-lg flex flex-col items-center justify-center bg-white text-orange-500 hover:bg-orange-50 hover:border-orange-500 cursor-pointer transition-colors group">
                        <CameraOutlined className="text-3xl mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Bấm mở Camera / Tải CCCD lên</span>
                      </div>
                    </Upload>
                </Form.Item>
              </div>
            ) : (
              <Form.Item label={`Tải lên ảnh đính kèm minh chứng (${
                selectedCategory === 'SLOT_OCCUPIED' ? 'Xe vi phạm' : 
                selectedCategory === 'FEE_DISPUTE' ? 'Minh chứng sai phí' : 
                selectedCategory === 'FIND_CAR' ? 'Ảnh Zone đang đứng' : 
                selectedCategory === 'OTHER_FEEDBACK' ? 'Ảnh góp ý nếu có' : 
                'Cà vẹt / Ảnh thẻ lỗi / Bằng chứng'
              })`} className="mb-0 col-span-1 md:col-span-2">
                  <Upload 
                    maxCount={1} 
                    beforeUpload={(file) => {
                      setUploadedFile(file);
                      return false;
                    }}
                    onRemove={() => setUploadedFile(null)}
                    className="w-full block" 
                    listType="picture"
                  >
                    <div className="w-full h-32 border-2 border-dashed border-blue-300 rounded-lg flex flex-col items-center justify-center bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-500 cursor-pointer transition-colors group">
                      <CameraOutlined className="text-3xl mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium">Bấm mở Camera / Tải ảnh lên</span>
                    </div>
                  </Upload>
              </Form.Item>
            )}

            <Form.Item 
              name="description" 
              label={selectedCategory === 'FIND_CAR' ? "Manh mối vị trí (Tầng, Gần cột nào...)" : "Mô tả chi tiết sự cố"} 
              rules={[{ required: true, message: 'Vui lòng nhập mô tả' }]}
              className="mb-0 col-span-1 md:col-span-2 mt-2"
            >
              <TextArea rows={3} style={{ wordBreak: 'break-all' }} placeholder={selectedCategory === 'FIND_CAR' ? "VD: Tôi đang đứng gần thang máy khu C..." : "Trình bày rõ sự việc để Nhân viên hỗ trợ bạn nhanh nhất có thể"} className="rounded-lg text-base p-3" />
            </Form.Item>
              </>
            )}
          </div>
        )}
      </div>

      <Button 
        type="primary" 
        htmlType="submit" 
        loading={createIncidentMutation.isPending}
        disabled={!selectedCategory || (!isPlateVerified && selectedCategory !== 'OTHER_FEEDBACK')}
        className={`w-full h-14 rounded-xl font-bold text-lg shadow-lg transition-all duration-300 flex items-center justify-center ${
          selectedCategory === 'LOST_CARD' ? 'bg-red-600 hover:bg-red-700' :
          selectedCategory === 'SLOT_OCCUPIED' ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-0' :
          'bg-blue-600 hover:bg-blue-700'
        }`}
        icon={selectedCategory === 'LOST_CARD' ? <SafetyCertificateOutlined /> : undefined}
      >
        {selectedCategory === 'LOST_CARD' ? 'GỬI YÊU CẦU & KHÓA XE KHẨN CẤP' : 
         selectedCategory === 'SLOT_OCCUPIED' ? 'BÁO CÁO & ĐỔI CHỖ' : 
         'GỬI YÊU CẦU XỬ LÝ'}
      </Button>
    </Form>
  );
};
