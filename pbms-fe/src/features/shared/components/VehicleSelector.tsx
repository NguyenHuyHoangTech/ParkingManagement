import React, { useEffect } from 'react';
import { Typography, Spin, Empty } from 'antd';
import { CarOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../../core/api/axiosClient';
import { getImageUrl } from '../../../core/utils/imageHelper';

const { Text } = Typography;

export interface PredefinedVehicle {
  id: number;
  vehicleTypeId: number;
  plateNumber: string;
  isDefault: boolean;
}

interface VehicleSelectorProps {
  availableTypes: any[];
  onSelect: (vehicleTypeId: number, plateNumber: string) => void;
  selectedPlate?: string;
}

export const VehicleSelector: React.FC<VehicleSelectorProps> = ({ availableTypes, onSelect, selectedPlate }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['customerVehicles'],
    queryFn: async () => {
      const res = await axiosClient.get('/customer/vehicles');
      return res.data?.data as PredefinedVehicle[];
    }
  });

  const vehicles = data || [];

  // Auto select default vehicle on load if none selected
  useEffect(() => {
    if (!selectedPlate && vehicles.length > 0) {
      const defaultVehicle = vehicles.find(v => v.isDefault) || vehicles[0];
      onSelect(defaultVehicle.vehicleTypeId, defaultVehicle.plateNumber);
    }
  }, [vehicles, selectedPlate, onSelect]);

  if (isLoading) return <div className="p-4 flex justify-center"><Spin /></div>;
  if (isError) return <div className="p-4"><Text type="danger">Lỗi tải danh sách xe.</Text></div>;
  if (vehicles.length === 0) return <Empty description="Chưa có xe nào được cấu hình" />;

  return (
    <div className="w-full">
      <div className="flex overflow-x-auto pb-4 space-x-3 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {vehicles.map(v => {
          const typeInfo = availableTypes.find(t => t.id === v.vehicleTypeId);
          const isSelected = selectedPlate === v.plateNumber;
          
          return (
            <div 
              key={v.id}
              onClick={() => onSelect(v.vehicleTypeId, v.plateNumber)}
              className={`snap-start shrink-0 w-36 h-28 p-3 rounded-2xl border-0 shadow-sm transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                isSelected ? 'ring-2 ring-blue-500 bg-blue-50/80 shadow-md transform scale-[1.02]' : 'bg-white hover:ring-2 hover:ring-blue-300'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 text-blue-500 z-10">
                  <CheckCircleFilled className="text-lg" />
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center p-1.5">
                  {typeInfo?.iconUrl ? (
                    <img src={getImageUrl(typeInfo.iconUrl)} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <CarOutlined className="text-lg text-slate-500" />
                  )}
                </div>
              </div>
              
              <div>
                <Text className="block text-[10px] text-slate-500 truncate">{typeInfo?.typeName || 'Xe'}</Text>
                <Text className="block font-mono font-bold text-sm text-slate-800 uppercase tracking-wider truncate">{v.plateNumber}</Text>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
