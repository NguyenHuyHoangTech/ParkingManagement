import React, { useState, useEffect } from 'react';
import { Card, Typography, Steps, Button, Tag, Input, Upload, message, InputNumber, Modal, Select, Divider, Form, Radio, Table } from 'antd';
import { 
  CameraOutlined, CheckCircleOutlined, CloseCircleOutlined, UploadOutlined, LockOutlined, WarningOutlined
} from '@ant-design/icons';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import axiosClient from '../../../core/api/axiosClient';
import { getImageUrl } from '../../../core/utils/imageHelper';
import { FeeBreakdown } from '../../../components/FeeBreakdown';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface IncidentDetailPanelProps {
  ticket: any;
  userRole: 'CUSTOMER' | 'STAFF';
  isManager?: boolean;
  onClose: () => void;
}

export const IncidentDetailPanel: React.FC<IncidentDetailPanelProps> = ({ ticket, userRole, isManager, onClose }) => {
  const queryClient = useQueryClient();

  // Common States
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelType, setCancelType] = useState('GUEST_FOUND_CARD');
  const [cancelFile, setCancelFile] = useState<any>(null);

  // Phase 1 Staff States
  const [p1Notes, setP1Notes] = useState('');
  const [p1File, setP1File] = useState<any>(null);
  const [p1FineAmount, setP1FineAmount] = useState<number | undefined>(ticket.fineAmount || 0);

  // Phase 2 Staff States
  const [p2Notes, setP2Notes] = useState('');
  const [p2File, setP2File] = useState<any>(null);
  const [feeDiscount, setFeeDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [damageCausePhase2, setDamageCausePhase2] = useState<'NATURAL' | 'USER'>('NATURAL');
  const [isFeeVisible, setIsFeeVisible] = useState(false);

  // Zone Violation Monthly Ticket Lookup States
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedVType, setSelectedVType] = useState<number | null>(null);

  const { data: mapConfig } = useQuery({
    queryKey: ['mapConfig'],
    queryFn: async () => {
      const res = await axiosClient.get('/infrastructure/map/config');
      return res.data?.data || {};
    },
    enabled: ticket?.type === 'ZONE_VIOLATION' && userRole === 'STAFF'
  });

  const floors = mapConfig?.floors || [];
  const zones = mapConfig?.zones || [];

  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ['vehicle_types'],
    queryFn: async () => {
      const res = await axiosClient.get('/operation/vehicle-types');
      return res.data?.data || [];
    },
    enabled: ticket?.type === 'ZONE_VIOLATION' && userRole === 'STAFF'
  });

  const { data: monthlyTickets = [] } = useQuery({
    queryKey: ['monthly_tickets'],
    queryFn: async () => {
      const res = await axiosClient.get('/operation/monthly-tickets');
      return res.data?.data || [];
    },
    enabled: ticket?.type === 'ZONE_VIOLATION' && userRole === 'STAFF'
  });

  const filteredMonthlyTickets = monthlyTickets.filter((mt: any) => {
    if (mt.status !== 'ACTIVE' && mt.status !== 'EXPIRING_SOON') return false;
    if (selectedVType && mt.vehicleTypeId !== selectedVType) return false;
    if (selectedFloor) {
      const monthlyZonesOnFloor = zones.filter((z: any) => z.floorId === selectedFloor && z.functionType === 'MONTHLY');
      const allowedVTypes = monthlyZonesOnFloor.map((z: any) => z.vehicleTypeId);
      if (!allowedVTypes.includes(mt.vehicleTypeId)) return false;
    }
    return true;
  });

  const monthlyTicketColumns = [
    { title: 'Biển số', dataIndex: 'plate', key: 'plate', render: (t: string) => <Text strong>{t}</Text> },
    { title: 'Loại xe', dataIndex: 'type', key: 'type' },
    { title: 'Khách hàng', dataIndex: 'user', key: 'user' },
    { title: 'SĐT', dataIndex: 'phone', key: 'phone' },
  ];

  const { data: systemConfigs } = useQuery({
    queryKey: ['systemConfigs'],
    queryFn: async () => {
      const res = await axiosClient.get('/system/configs');
      return res.data.data;
    },
    enabled: ticket.type === 'DAMAGED_CARD' && ticket.phase === 2
  });

  const getDamagedCardPenalty = () => {
    if (!systemConfigs) return 50000;
    const cfg = systemConfigs.find((c: any) => c.configKey === 'PENALTY_DAMAGED_CARD');
    return cfg ? Number(cfg.configValue) : 50000;
  };

  useEffect(() => {
    if (ticket && ticket.type === 'DAMAGED_CARD' && ticket.fineAmount > 0) {
      setDamageCausePhase2('USER');
    }
    setP1FineAmount(ticket.fineAmount || 0);
  }, [ticket]);

  const isAutoCheckoutType = ['ZONE_VIOLATION', 'OVERSTAY', 'LPR_MISMATCH', 'SLOT_OCCUPIED', 'FIND_CAR', 'FEE_DISPUTE', 'BLACKLIST_VIOLATION'].includes(ticket.type);

  const effectivePenaltyFee = (ticket.type === 'DAMAGED_CARD') 
    ? (damageCausePhase2 === 'USER' ? getDamagedCardPenalty() : 0)
    : (ticket.fineAmount || 0);

  useEffect(() => {
    // Reset states when ticket changes
    setP1Notes('');
    setP1File(null);
    setP1FineAmount(ticket.fineAmount || 0);
    setP2Notes('');
    setP2File(null);
    setFeeDiscount(0);
    setPaymentMethod('CASH');
    setIsFeeVisible(false);
  }, [ticket.id]);

  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  // Mutations
  const processPhase1Mutation = useMutation({
    mutationFn: async () => {
      const docUrl = p1File ? await getBase64(p1File) : '';
      const payload: any = {
        resolutionNotes: p1Notes,
        resolutionImageUrl: docUrl,
      };
      if (isAutoCheckoutType && p1FineAmount !== undefined) {
        payload.fineAmount = p1FineAmount;
      }
      await axiosClient.put(`/incident/incidents/${ticket.id}/process-phase1`, payload);
    },
    onSuccess: () => {
      message.success('Đã xác nhận Giai đoạn 1');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      onClose();
    }
  });

  const resolvePhase2Mutation = useMutation({
    mutationFn: async () => {
      const docUrl = p2File ? await getBase64(p2File) : '';
      const payload: any = {
        resolutionNotes: p2Notes,
        resolutionImageUrl: docUrl,
        parkingFee: calculatedParkingFee,
        penaltyFee: effectivePenaltyFee,
        paymentMethod: paymentMethod
      };
      
      if (ticket.type === 'FEE_DISPUTE' && feeDiscount > 0) {
        payload.discountAmount = feeDiscount;
      }
      
      await axiosClient.put(`/incident/incidents/${ticket.id}/resolve`, payload);
    },
    onSuccess: () => {
      message.success('Đã hoàn tất xử lý sự cố');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      onClose();
    }
  });

  const pauseFeeMutation = useMutation({
    mutationFn: async () => {
      await axiosClient.put(`/incident/incidents/${ticket.id}/pause-fee`);
    },
    onSuccess: () => {
      message.success('Đã tính tổng phí đỗ xe hiện tại');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const docUrl = cancelFile ? await getBase64(cancelFile) : '';
      await axiosClient.put(`/incident/incidents/${ticket.id}/cancel`, {
        reason: cancelReason,
        cancelType: cancelType,
        cancelImageUrl: docUrl
      });
    },
    onSuccess: () => {
      message.success('Đã hủy sự cố thành công');
      setCancelModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      onClose();
    }
  });

  // Render Helpers
  const renderImages = (urlsStr: string, phases: string[] = []) => {
    if (!urlsStr) return null;
    let urls = urlsStr.split('|').filter(u => u);

    if (phases.length > 0) {
      const hasAnyPrefix = urls.some(u => /^\[(P1|P2|CX)\]/.test(u));
      if (hasAnyPrefix) {
        urls = urls.filter(u => {
          if (/^\[(P1|P2|CX)\]/.test(u)) {
            return phases.some(p => u.startsWith(`[${p}]`));
          }
          // Legacy backward compatibility: If it has no prefix, assume it's P1
          return phases.includes('P1');
        });
      } else {
        // If there are no prefixes at all, assume all images belong to P1
        if (!phases.includes('P1')) {
          urls = [];
        }
      }
    }

    urls = urls.map(u => u.replace(/^\[(P1|P2|CX)\]/, ''));
    if (urls.length === 0) return null;

    return (
      <div className="flex gap-2 mt-2 overflow-x-auto">
        {urls.map((url, idx) => (
          <img key={idx} src={getImageUrl(url)} alt="proof" className="h-20 w-auto rounded border object-cover" />
        ))}
      </div>
    );
  };

  const currentStep = ticket.status === 'CANCELLED' || ticket.status === 'REJECTED' 
    ? 2 
    : (ticket.phase === 1 ? 0 : ticket.phase === 2 ? 1 : 2);

  const calculatedParkingFee = ticket.expectedFee !== undefined
    ? ((ticket.expectedFee || 0) + (ticket.overtimeFee || 0) - (ticket.discountFee || 0))
    : (ticket.sessionParkingFee || 0);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-4 border-b bg-slate-50 flex justify-between items-center rounded-t-xl shrink-0">
        <div>
          <Title level={4} className="m-0 text-slate-800 flex items-center gap-2">
            Chi tiết Sự cố #{ticket.id}
            <Tag color={ticket.status === 'CANCELLED' ? 'default' : ticket.status === 'RESOLVED' ? 'success' : 'processing'}>
              {ticket.status}
            </Tag>
          </Title>
          <Text type="secondary">Loại: <Tag color="blue">{ticket.type}</Tag> | BKS: <Text strong>{ticket.plate}</Text></Text>
        </div>
        <Button onClick={onClose} type="text">Đóng</Button>
      </div>

      {/* Body - Timeline */}
      <div className="flex-1 p-6 overflow-y-auto">
        <Steps
          direction="vertical"
          current={currentStep}
          status={ticket.status === 'CANCELLED' || ticket.status === 'REJECTED' ? 'error' : 'process'}
          items={[
            // BƯỚC 1: TẠO SỰ CỐ
            {
              title: <span className="font-bold text-lg">Giai đoạn 1: Tiếp nhận báo cáo</span>,
              description: (
                <Card size="small" className="mt-2 bg-slate-50 border-slate-200 shadow-sm">
                  <div className="mb-2">
                    <Text type="secondary">Người tạo sự cố:</Text>
                    <div className="font-medium text-slate-700">{ticket.creatorEmail || 'Hệ thống / Vô danh'}</div>
                  </div>
                  <div className="mb-2">
                    <Text type="secondary">Thời gian tạo:</Text>
                    <div className="font-medium text-slate-700">{ticket.time ? new Date(ticket.time).toLocaleString('vi-VN') : 'Không có'}</div>
                  </div>
                  <div className="mb-2">
                    <Text type="secondary">Nội dung báo cáo:</Text>
                    <div className="font-medium break-all whitespace-pre-wrap">{ticket.description}</div>
                  </div>
                  {ticket.fineAmount !== undefined && ticket.fineAmount !== null && (
                    <div className="mb-2">
                      <Text type="secondary">Phí phạt dự kiến:</Text>
                      <div className="font-medium text-red-600 text-lg">{ticket.fineAmount.toLocaleString('vi-VN')} đ</div>
                    </div>
                  )}
                  {ticket.uploadedDocUrl && (
                    <div className="mb-2">
                      <Text type="secondary">Ảnh minh chứng từ khách:</Text>
                      {renderImages(ticket.uploadedDocUrl)}
                    </div>
                  )}
                  {ticket.sessionId && (
                    <div className="mb-2 p-3 bg-white border border-slate-200 rounded-lg">
                      <Text type="secondary" className="font-semibold block mb-2 text-slate-800">Thông tin xe vào bãi:</Text>
                      <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
                        <div>
                          <Text type="secondary">Giờ vào:</Text>
                          <div className="font-medium">{ticket.sessionTimeIn ? new Date(ticket.sessionTimeIn).toLocaleString('vi-VN') : 'N/A'}</div>
                        </div>
                        <div>
                          <Text type="secondary">Zone gợi ý:</Text>
                          <div className="font-medium text-blue-600">{ticket.sessionSuggestedZone || 'N/A'}</div>
                        </div>
                      </div>
                      {(ticket.sessionPicInPanorama || ticket.sessionPicInPlate) && (
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-100">
                          {ticket.sessionPicInPanorama && renderImages(ticket.sessionPicInPanorama)}
                          {ticket.sessionPicInPlate && renderImages(ticket.sessionPicInPlate)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STAFF ACTION: Duyệt GĐ1 */}
                  {userRole === 'STAFF' && ticket.phase === 1 && ticket.status === 'PENDING' && (
                    <div className="mt-4 pt-4 border-t border-slate-200 bg-white p-4 rounded-lg border">
                      <Title level={5} className="text-blue-700">Thao tác của Nhân viên</Title>
                      <Form layout="vertical">
                        <Form.Item label="Ghi chú (gửi cho khách)">
                          <TextArea rows={2} style={{ wordBreak: 'break-all' }} value={p1Notes} onChange={e => setP1Notes(e.target.value)} placeholder="Nhập ghi chú hoặc hướng dẫn cho khách hàng" />
                        </Form.Item>
                        <Form.Item label="Tải ảnh lên (Tùy chọn)">
                          <Upload beforeUpload={f => { setP1File(f); return false; }} maxCount={1} listType="picture">
                            <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
                          </Upload>
                        </Form.Item>
                        <Button type="primary" onClick={() => processPhase1Mutation.mutate()} loading={processPhase1Mutation.isPending} className="w-full">
                          Xác nhận thông tin & Xử lý (Phase 1)
                        </Button>
                      </Form>
                    </div>
                  )}
                </Card>
              )
            },
            
            // BƯỚC 2: XỬ LÝ & THU TIỀN
            {
              title: <span className="font-bold text-lg">Giai đoạn 2: Xử lý và Chờ ra bãi</span>,
              description: ticket.phase >= 2 || ticket.status === 'RESOLVED' ? (
                <Card size="small" className="mt-2 bg-blue-50 border-blue-100 shadow-sm">
                  {(() => {
                    const notes = ticket.resolutionNotes || '';
                    const p1Match = notes.match(/\[Phase 1\]([\s\S]*?)(?=\[Phase 2\]|\[CANCELLED\]|$)/);
                    const p2Match = notes.match(/\[Phase 2\]([\s\S]*?)(?=\[CANCELLED\]|$)/);
                    
                    const p1Note = p1Match ? p1Match[1].trim() : '';
                    const p2Note = p2Match ? p2Match[1].trim() : '';
                    
                    if (p1Note || p2Note) {
                      return (
                        <>
                          {p1Note && (
                            <div className="mb-3 p-3 bg-white rounded border border-blue-200">
                              <Text type="secondary" className="block mb-1 font-semibold text-blue-700">Thông tin xử lý Giai đoạn 1:</Text>
                              <div className="font-medium text-slate-700 break-all whitespace-pre-wrap">{p1Note}</div>
                              {renderImages(ticket.resolutionImageUrl, ['P1'])}
                            </div>
                          )}
                          {p2Note && (
                            <div className="mb-3 p-3 bg-white rounded border border-green-200">
                              <Text type="secondary" className="block mb-1 font-semibold text-green-700">Thông tin xử lý Giai đoạn 2 (Hoàn tất):</Text>
                              <div className="font-medium text-slate-700 break-all whitespace-pre-wrap">{p2Note}</div>
                              {renderImages(ticket.resolutionImageUrl, ['P2'])}
                              {ticket.status === 'RESOLVED' && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <FeeBreakdown 
                                    durationMinutes={ticket.durationMinutes || 0}
                                    customerType={ticket.customerType || 'GUEST'}
                                    expectedFee={ticket.expectedFee || ticket.sessionParkingFee || 0}
                                    overtimeMinutes={ticket.overtimeMinutes || 0}
                                    overtimeFee={ticket.overtimeFee || 0}
                                    penaltyFee={ticket.fineAmount || 0}
                                    discountFee={(ticket.discountFee || 0) + (ticket.feeDiscount || 0)}
                                    totalFee={calculatedParkingFee + (ticket.fineAmount || 0) - (ticket.feeDiscount || 0)}
                                    isLightMode={true}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    }
                    
                    // Fallback for older data format
                    return (
                      <>
                        <div className="mb-2 whitespace-pre-wrap">
                          <Text type="secondary">Quá trình xử lý (Notes):</Text>
                          <div className="font-medium text-blue-800 break-all">
                            {(ticket.resolutionNotes || 'Chưa có ghi chú')
                              .replace(/\[CANCELLED\][\s\S]*$/, '')
                              .trim() || 'Chưa có ghi chú'
                            }
                          </div>
                        </div>
                        {ticket.resolutionImageUrl && (
                          <div className="mb-2">
                            <Text type="secondary">Ảnh xử lý từ nhân viên:</Text>
                            {renderImages(ticket.resolutionImageUrl, ['P1', 'P2'])}
                          </div>
                        )}
                        {ticket.status === 'RESOLVED' && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <FeeBreakdown 
                                    durationMinutes={ticket.durationMinutes || 0}
                                    customerType={ticket.customerType || 'GUEST'}
                                    expectedFee={ticket.expectedFee || ticket.sessionParkingFee || 0}
                                    overtimeMinutes={ticket.overtimeMinutes || 0}
                                    overtimeFee={ticket.overtimeFee || 0}
                                    penaltyFee={ticket.fineAmount || 0}
                                    discountFee={ticket.discountFee || 0}
                                    totalFee={(ticket.sessionParkingFee || 0) + (ticket.fineAmount || 0) - (ticket.discountFee || 0)}
                                    isLightMode={true}
                                  />
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {userRole === 'STAFF' && ticket.type === 'ZONE_VIOLATION' && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <Title level={5} className="text-slate-700">Tra cứu danh sách vé tháng</Title>
                      <Text type="secondary" className="block mb-2 text-sm">Tra cứu danh sách vé tháng để dễ dàng liên hệ với chủ xe đỗ sai vị trí.</Text>
                      <div className="flex gap-4 mb-4">
                        <Select 
                          placeholder="Chọn tầng" 
                          className="w-48"
                          value={selectedFloor}
                          onChange={setSelectedFloor}
                          options={floors.map((f: any) => ({ label: f.name, value: f.id }))}
                          allowClear
                        />
                        <Select 
                          placeholder="Chọn loại xe" 
                          className="w-48"
                          value={selectedVType}
                          onChange={setSelectedVType}
                          options={vehicleTypes.map((v: any) => ({ label: v.typeName, value: v.id }))}
                          allowClear
                        />
                      </div>
                      <Table 
                        dataSource={filteredMonthlyTickets} 
                        columns={monthlyTicketColumns} 
                        rowKey="id" 
                        size="small"
                        pagination={{ pageSize: 5 }}
                        bordered
                      />
                    </div>
                  )}
                  {/* Giao diện Thanh toán & Hoàn tất GĐ2 */}
                  {userRole === 'STAFF' && ticket.phase === 2 && ticket.status === 'WAITING_CHECKOUT' && (
                    <div className="mt-4 pt-4 border-t border-blue-200 bg-white p-4 rounded-lg border border-blue-100">
                      {isAutoCheckoutType ? (
                        <div className="text-center p-4 bg-blue-50 text-blue-800 rounded font-medium border border-blue-200">
                          <Title level={5} className="text-blue-700 m-0 mb-2">Chờ xe ra bãi</Title>
                          Hệ thống sẽ không tính phí và cho xe ra tại bước này. Vui lòng chờ xe ra bãi, sự cố sẽ tự động hoàn thành và chuyển sang Giai đoạn 3 cùng với phần phí phạt đã xác nhận.
                          <div className="text-sm mt-2 text-slate-500 italic">Bạn chỉ có thể hủy sự cố (nút bên dưới) nếu có sai sót.</div>
                        </div>
                      ) : ticket.type === 'FEE_DISPUTE' && !isManager ? (
                        <div className="text-center p-3 bg-red-50 text-red-600 rounded font-medium">
                          Chỉ Quản lý (Manager) mới có quyền giảm phí và hoàn tất sự cố này.
                        </div>
                      ) : (
                        <>
                          <Title level={5} className="text-green-700">Chi tiết Phí ra bãi</Title>
                          {!isFeeVisible ? (
                            <div className="bg-slate-50 p-6 rounded-lg mb-4 border border-slate-200 text-center">
                              <Button size="large" type="primary" onClick={() => { setIsFeeVisible(true); pauseFeeMutation.mutate(); }} loading={pauseFeeMutation.isPending}>
                                Tính phí đỗ xe hiện tại
                              </Button>
                              <div className="text-xs text-amber-600 italic mt-3">
                                Ấn để tra cứu mức phí. Phí đỗ xe vẫn tiếp tục tính bình thường.
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200">
                                  <FeeBreakdown 
                                    durationMinutes={ticket.durationMinutes || 0}
                                    customerType={ticket.customerType || 'GUEST'}
                                    expectedFee={ticket.expectedFee || ticket.sessionParkingFee || 0}
                                    overtimeMinutes={ticket.overtimeMinutes || 0}
                                    overtimeFee={ticket.overtimeFee || 0}
                                    penaltyFee={effectivePenaltyFee}
                                    discountFee={(ticket.discountFee || 0) + (feeDiscount || 0)}
                                    totalFee={calculatedParkingFee + effectivePenaltyFee - (feeDiscount || 0)}
                                    isLightMode={true}
                                  />
                                  <div className="text-center mt-3">
                                    <Button size="small" type="primary" ghost onClick={() => pauseFeeMutation.mutate()} loading={pauseFeeMutation.isPending}>
                                      Cập nhật lại phí hiện tại
                                    </Button>
                                    <div className="text-[10px] text-slate-500 italic mt-1">
                                      Lưu ý: Phí đỗ xe sẽ không bị đóng băng và tiếp tục được tính cho đến khi bạn hoàn tất sự cố.
                                    </div>
                                  </div>
                              </div>

                              <Form layout="vertical">
                                {ticket.type === 'DAMAGED_CARD' && (
                                  <Form.Item label="Xác nhận nguyên nhân hỏng thẻ (Cập nhật phí phạt)">
                                    <Radio.Group 
                                      value={damageCausePhase2} 
                                      onChange={(e) => setDamageCausePhase2(e.target.value)}
                                      className="flex flex-col gap-2"
                                    >
                                      <Radio value="NATURAL"><span className="text-base text-green-600 font-medium">Hao mòn tự nhiên (Miễn phí)</span></Radio>
                                      <Radio value="USER"><span className="text-base text-red-600 font-medium">Do khách hàng (Thu phí đền thẻ: {getDamagedCardPenalty().toLocaleString()}đ)</span></Radio>
                                    </Radio.Group>
                                  </Form.Item>
                                )}
                                {ticket.type === 'FEE_DISPUTE' && (
                                  <Form.Item label="Số tiền giảm (VND) - Trừ thẳng vào Tổng thanh toán">
                                    <InputNumber 
                                      className="w-full" 
                                      size="large" 
                                      min={0} 
                                      value={feeDiscount} 
                                      onChange={v => setFeeDiscount(v || 0)} 
                                    />
                                  </Form.Item>
                                )}
                                <Form.Item label="Ghi chú hoàn tất">
                                  <TextArea rows={2} style={{ wordBreak: 'break-all' }} value={p2Notes} onChange={e => setP2Notes(e.target.value)} placeholder="Ghi chú lại quá trình thu tiền & cho xe ra bãi" />
                                </Form.Item>
                                <Form.Item label="Tải ảnh bằng chứng (Biên lai thu tiền, CCCD,...)">
                                  <Upload beforeUpload={f => { setP2File(f); return false; }} maxCount={1} listType="picture">
                                    <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
                                  </Upload>
                                </Form.Item>
                                <Button 
                                  type="primary" 
                                  className="bg-green-600" 
                                  onClick={() => resolvePhase2Mutation.mutate()} 
                                  loading={resolvePhase2Mutation.isPending} 
                                  block
                                >
                                  Xác nhận đã thu đủ tiền & Cho xe ra bãi

                                </Button>
                              </Form>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Card>
              ) : ticket.status === 'CANCELLED' || ticket.status === 'REJECTED' ? (
                <div className="text-slate-400 italic mt-1">Sự cố bị hủy trước khi đến giai đoạn này</div>
              ) : <div className="text-slate-400 italic mt-1">Đang chờ xử lý xong Giai đoạn 1</div>
            },

            // BƯỚC 3: LƯU LỊCH SỬ / KẾT THÚC
            {
              title: <span className="font-bold text-lg">Giai đoạn 3: Kết thúc</span>,
              description: ticket.status === 'RESOLVED' ? (
                <Card size="small" className="mt-2 bg-green-50 border-green-200 shadow-sm">
                  <Tag color="success" className="text-base py-1 px-3 mb-2">Đã hoàn tất toàn bộ quy trình</Tag>
                  <div className="mb-2">
                    <Text type="secondary">Người giải quyết:</Text>
                    <div className="font-medium text-green-800">{ticket.staffEmail || 'Hệ thống'}</div>
                  </div>
                  <div className="mb-2">
                    <Text type="secondary">Thời gian giải quyết:</Text>
                    <div className="font-medium text-green-800">{ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString('vi-VN') : 'Không có'}</div>
                  </div>
                </Card>
              ) : ticket.status === 'CANCELLED' || ticket.status === 'REJECTED' ? (
                <Card size="small" className="mt-2 bg-gray-50 border-gray-200 shadow-sm">
                  <Tag color="default" className="text-base py-1 px-3 mb-2">Sự cố đã bị hủy / Từ chối</Tag>
                  <div className="mb-2">
                    <Text type="secondary">Người hủy / giải quyết:</Text>
                    <div className="font-medium text-gray-700">{ticket.staffEmail || 'Hệ thống'}</div>
                  </div>
                  <div className="mb-2">
                    <Text type="secondary">Thời gian hủy / giải quyết:</Text>
                    <div className="font-medium text-gray-700">{ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString('vi-VN') : 'Không có'}</div>
                  </div>
                  {ticket.cancelType && (
                    <div className="mb-2">
                      <Text type="secondary">Phân loại hủy:</Text>
                      <div className="font-medium text-gray-700">{ticket.cancelType}</div>
                    </div>
                  )}
                  <div className="mb-2 whitespace-pre-wrap">
                    <Text type="secondary">Ghi chú hủy / xử lý:</Text>
                    <div className="font-medium text-red-700 break-all">{
                      ticket.resolutionNotes?.includes('[CANCELLED]') 
                        ? ticket.resolutionNotes.substring(ticket.resolutionNotes.indexOf('[CANCELLED]')) 
                        : (ticket.resolutionNotes || 'Không có ghi chú thêm')
                    }</div>
                  </div>
                  {ticket.resolutionImageUrl && (
                    <div className="mb-2">
                      <Text type="secondary">Ảnh đính kèm (Bao gồm ảnh Hủy nếu có):</Text>
                      {renderImages(ticket.resolutionImageUrl, ['CX'])}
                    </div>
                  )}
                </Card>
              ) : (
                <div className="text-slate-400 italic mt-1">Chờ xe ra bãi và thu phí xong</div>
              )
            }
          ]}
        />
      </div>

      {/* Footer - Hủy */}
      {(ticket.status === 'PENDING' || ticket.status === 'WAITING_CHECKOUT') && ticket.type !== 'LPR_MISMATCH' && (
        <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end">
          {userRole === 'STAFF' ? (
            <Button danger icon={<CloseCircleOutlined />} onClick={() => setCancelModalVisible(true)}>
              Hủy báo cáo sự cố (Cancel)
            </Button>
          ) : (
            <Button danger onClick={() => setCancelModalVisible(true)}>Hủy yêu cầu</Button>
          )}
        </div>
      )}

      <Modal
        title="Hủy / Từ chối sự cố"
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
        onOk={() => cancelMutation.mutate()}
        confirmLoading={cancelMutation.isPending}
        okText="Xác nhận Hủy"
        okButtonProps={{ danger: true }}
      >
        <Form layout="vertical">
          <Form.Item label="Lý do hủy" required>
            <Select value={cancelType} onChange={setCancelType}>
              <Select.Option value="GUEST_FOUND_CARD">Khách yêu cầu hủy</Select.Option>
              <Select.Option value="INFO_INCORRECT">Thông tin cung cấp sai</Select.Option>
              <Select.Option value="OTHER">Lý do khác</Select.Option>
            </Select>
          </Form.Item>
            <Form.Item label="Lý do chi tiết" required>
              <TextArea rows={3} style={{ wordBreak: 'break-all' }} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Mô tả rõ tại sao lại hủy/từ chối" />
            </Form.Item>
          {userRole === 'STAFF' && (
            <Form.Item label="Ảnh minh chứng (nếu có)">
              <Upload beforeUpload={f => { setCancelFile(f); return false; }} maxCount={1} listType="picture">
                <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
              </Upload>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};
