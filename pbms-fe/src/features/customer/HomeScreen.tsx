import React, { useState, useEffect } from 'react';
import { Card, Typography, Collapse, List, Tag, Badge, Divider } from 'antd';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../core/api/axiosClient';
import { getImageUrl } from '../../core/utils/imageHelper';
import { 
  CarOutlined, 
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  BookOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  AlertOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// Data structures
type VehicleType = 'CAR' | 'MOTORBIKE' | 'EBIKE';

interface SlotData {
  type: string;
  label: string;
  available: number;
  icon: React.ReactNode;
}

export const HomeScreen = () => {
  // 1. REAL-TIME STATE
  const [slots, setSlots] = useState<SlotData[]>([]);

  const { data: parkingStatusData } = useQuery({
    queryKey: ['public-parking-status'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get('/public/parking-status');
        return res.data.data;
      } catch (err) {
        return [];
      }
    },
    refetchInterval: 5000 // Real-time polling
  });

  const { data: vehicleTypes } = useQuery({
    queryKey: ['public-vehicle-types'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get('/public/vehicle-types');
        return res.data.data;
      } catch (err) {
        return [];
      }
    }
  });

  useEffect(() => {
    if (parkingStatusData && parkingStatusData.length > 0) {
      let filteredData = parkingStatusData;
      if (vehicleTypes) {
        const nonBlockedLabels = vehicleTypes
          .filter((vt: any) => vt.status === 'ACTIVE')
          .map((vt: any) => vt.typeName);
        filteredData = parkingStatusData.filter((d: any) => nonBlockedLabels.includes(d.label));
      }

      setSlots(filteredData.map((d: any) => ({
        type: d.type,
        label: d.label,
        available: d.available,
        icon: d.type === 'FOUR_WHEEL' ? <CarOutlined /> : (d.type === 'TWO_WHEEL' ? <div className="text-xl leading-none">🏍️</div> : <ThunderboltOutlined />)
      })));
    }
  }, [parkingStatusData, vehicleTypes]);

  const { data: pricingPolicies } = useQuery({
    queryKey: ['public-pricing'],
    queryFn: async () => {
      try {
        const res = await axiosClient.get('/public/pricing');
        return res.data.data;
      } catch (err) {
        return [];
      }
    }
  });



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

  // Helpers for Warning UI
  const renderSlotCard = (slot: SlotData) => {
    const isFull = slot.available === 0;
    const isWarning = slot.available > 0 && slot.available <= 5;
    const isNormal = slot.available > 5;

    let cardClasses = "rounded-3xl p-6 transition-all duration-500 relative overflow-hidden flex flex-col justify-between h-44 hover:-translate-y-2 hover:shadow-2xl hover:scale-[1.02] cursor-pointer group";
    let statusBadge = null;

    if (isFull) {
      cardClasses += " bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg border-0 ring-4 ring-red-500/30";
      statusBadge = (
        <div className="absolute top-4 right-4 bg-white/20 px-3 py-1 rounded-full flex items-center animate-pulse">
          <AlertOutlined className="mr-1" />
          <span className="font-bold text-sm tracking-wide">FULL - SOLD OUT</span>
        </div>
      );
    } else if (isWarning) {
      cardClasses += " bg-white/80 backdrop-blur-md border border-orange-200 shadow-xl ring-4 ring-orange-500/20 animate-pulse";
      statusBadge = (
        <div className="absolute top-4 right-4 bg-orange-100 text-orange-700 px-3 py-1 rounded-full flex items-center border border-orange-200">
          <AlertOutlined className="mr-1" />
          <span className="font-bold text-sm tracking-wide">SOON</span>
        </div>
      );
    } else {
      cardClasses += " bg-white/80 backdrop-blur-md border border-green-100 shadow-lg";
    }

    return (
      <div key={slot.type} className={cardClasses}>
        {statusBadge}
        <div className={`flex items-center space-x-3 transition-transform duration-300 group-hover:scale-105 ${isFull ? 'text-red-100' : 'text-gray-500'}`}>
          <div className={`text-3xl p-3 rounded-2xl shadow-inner ${isFull ? 'bg-red-500/50' : 'bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200'}`}>
            {slot.icon}
          </div>
          <span className="font-bold text-lg tracking-wider">[{slot.label}]</span>
        </div>
        
        <div className="mt-4 flex items-baseline space-x-2">
          {isFull ? (
            <span className="text-4xl font-extrabold">0</span>
          ) : (
            <>
              <span className="text-sm font-bold uppercase tracking-widest opacity-70">Available</span>
              <span className={`text-6xl font-black tracking-tighter drop-shadow-md transition-colors duration-300 group-hover:text-blue-600 ${isWarning ? 'text-orange-600' : 'text-green-500'}`}>
                {slot.available}
              </span>
              <span className="text-sm font-medium opacity-80">place</span>
            </>
          )}
        </div>
      </div>
    );
  };

  // 2. PRICING BLOCK (ACCORDION)
  const pricingItems = (vehicleTypes || [])
    .filter((vt: any) => vt.status === 'ACTIVE')
    .map((vt: any, index: number) => {
    const isCar = vt.category === 'FOUR_WHEEL';
    const isEbike = vt.typeName.toLowerCase().includes('electricity');
    const icon = vt.iconUrl ? <img src={getImageUrl(vt.iconUrl)} className="w-6 h-6 mr-2 object-contain inline-block" /> : (isCar ? <CarOutlined className="mr-2 text-blue-600"/> : (isEbike ? <ThunderboltOutlined className="mr-2 text-green-600"/> : <div className="text-xl leading-none mr-2">🏍️</div>));
    const policy = (pricingPolicies || []).find((p: any) => p.vehicleTypeId === vt.id);

    return {
      key: index.toString(),
      label: <div className="font-extrabold text-xl text-slate-800 flex items-center">{icon}  Fee schedule {vt.typeName}</div>,
      children: policy ? (
        <div className="space-y-4">
          
          {(policy.globalBaseFee > 0 || policy.globalBaseMins > 0) && (
            <div>
              <Text className="font-bold text-blue-800">1e Basic Fee (Not yet on shift)</Text>
              <p className="pl-5 mt-1 text-gray-600">
                <span className="font-bold text-gray-800">{policy.globalBaseFee?.toLocaleString()}  VND</span> cho <span className="font-bold text-gray-800">{policy.globalBaseMins}  minute</span>  firste
                                        </p>
            </div>
          )}

          <div>
            <Text className="font-bold text-indigo-800">{(policy.globalBaseFee > 0 || policy.globalBaseMins > 0) ? '2e Fee schedule by shift' : '1e Fee schedule by shift'}</Text>
            {policy.shifts?.map((shift: any, idx: number) => (
              <div key={idx} className="mt-3 ml-2 border-l-2 border-indigo-100 pl-3">
                <Text className="font-bold text-indigo-600">
                  <ClockCircleOutlined className="mr-1" /> Ca {shift.shiftName} ({shift.startTime} - {shift.endTime})
                </Text>
                <ul className="list-disc pl-5 mt-1 text-gray-600">
                  {shift.blocks?.map((block: any, bIdx: number) => (
                    <li key={bIdx}>
                      Block {block.blockOrder} ({block.durationMins}  minute): <span className="font-bold text-gray-800">{block.fee?.toLocaleString()}  VND</span>
                    </li>
                  ))}
                  {(!shift.blocks || shift.blocks.length === 0) && (
                    <li className="italic text-gray-400">No blocks are defined</li>
                  )}
                </ul>
              </div>
            ))}
            {(!policy.shifts || policy.shifts.length === 0) && (
              <p className="pl-5 mt-1 text-gray-500 italic">There are no cases configured</p>
            )}
          </div>

          {policy.maxParkingCap && policy.maxParkingCap > 0 && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex items-start mt-4">
              <DollarOutlined className="text-red-500 text-lg mt-0.5 mr-2" />
              <div>
                <Text className="font-bold text-red-700">Price Ceiling (Max Cap)</Text>
                <p className="text-red-600 text-sm m-0">Max <span className="font-extrabold">{policy.maxParkingCap?.toLocaleString()}  VND</span>  / number of submissions</p>
              </div>
            </div>
          )}

          {policy.monthlyRate && policy.monthlyRate > 0 && (
            <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-start mt-4">
              <SafetyCertificateOutlined className="text-green-500 text-lg mt-0.5 mr-2" />
              <div>
                <Text className="font-bold text-green-700">Monthly Passes</Text>
                <p className="text-green-600 text-sm m-0">Sign up for Monthly Pass only <span className="font-extrabold">{policy.monthlyRate?.toLocaleString()}  VND</span>  /monthe</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-6 text-center text-gray-500">
          
                            No fee schedule has been configured for this vehicle type
                          </div>
      )
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 pb-12 font-sans selection:bg-blue-200">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Zone 1: HERO SECTION */}
        <section className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-[2.5rem] p-10 shadow-2xl text-white relative overflow-hidden border border-white/10">
          <div className="absolute inset-0 bg-[url('/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-4">
              <Badge status="processing" color="#10b981" />
              <div className="border border-green-500/50 bg-green-500/10 px-3 py-1 rounded-full inline-flex items-center backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                <span className="text-green-300 text-xs font-bold uppercase tracking-widest">Active</span>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
              {buildingProfile?.name || "Smart Parking System"}
            </h1>
            
            <div className="flex flex-wrap items-center text-gray-300 mt-4 gap-4">
              <div className="flex items-center">
                <ClockCircleOutlined className="mr-2 text-blue-400" />
                <span className="font-medium text-lg">Active time: <span className="text-white font-bold">{buildingProfile?.operatingHours || "24/7"}</span></span>
              </div>
              <div className="flex items-center">
                <InfoCircleOutlined className="mr-2 text-indigo-400" />
                <span className="font-medium text-lg">Hotline: <span className="text-white font-bold">{buildingProfile?.hotline || "Updating"}</span></span>
              </div>
              <div className="flex items-center w-full mt-2">
                <span className="font-medium text-sm">Address: {buildingProfile?.address || "Updating"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* BLOCK 1: PARKING STATS (KPI CARDS) */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center"><CarOutlined className="mr-3 text-blue-600"/> Parking condition</h2>
            <div className="flex items-center text-xs font-medium text-gray-500 bg-gray-200 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping mr-2"></span>
              
                                        Update directly
                                      </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {slots.map(renderSlotCard)}
          </div>
        </section>

        {/* BLOCK 2: PRICING TRANSPARENCY */}
        <section>
          <div className="flex items-center mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center"><DollarOutlined className="mr-3 text-green-600"/> Parking fee schedule</h2>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
            <Collapse 
              items={pricingItems} 
              defaultActiveKey={['1']} 
              ghost 
              expandIconPosition="end"
              className="text-lg"
            />
          </div>
        </section>

        {/* BLOCK 3: ADMIN & RULES INFO */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="rounded-3xl shadow-lg border-0 hover:shadow-xl transition-shadow duration-300 h-full bg-white/80 backdrop-blur-md" title={<span className="font-black text-xl flex items-center"><SafetyCertificateOutlined className="mr-2 text-indigo-600"/>  Vehicle Type served</span>}>
            <List
              itemLayout="horizontal"
              dataSource={[
                { title: 'Car transports people', desc: 'Under 7 seats, circulation height i= 2e2m' },
                { title: 'Motorcycles, Scooters', desc: 'Types of two-wheeled motorbikes' },
                { title: 'Electric bicycle', desc: 'Supports separate charging zones' },
              ]}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    title={<span className="font-bold text-gray-800">{item.title}</span>}
                    description={item.desc}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card className="rounded-3xl shadow-lg border-0 hover:shadow-xl transition-shadow duration-300 h-full bg-gradient-to-br from-orange-50/50 to-red-50/30 backdrop-blur-md" title={<span className="font-black text-xl flex items-center"><BookOutlined className="mr-2 text-orange-600"/>  Parking lot rules</span>}>
            <List
              size="small"
              dataSource={buildingProfile?.rules ? buildingProfile.rules.split('\n') : [
                'Warning that vehicles left in the parking lot for more than 72 hours will be recorded according to regulations',
                'Reminder NOT to leave valuable assets in the vehicle (Laptop, casheee) e Management Reject compensates in case of loss e',
                'Comply with the speed limit of 5km/h in the tunnel',
                'Park on the right line, do not park in the Zone for disabled people without a card',
              ]}
              renderItem={(item: any, index: number) => (
                <List.Item className="border-b-0 py-2 text-gray-700">
                  <div className="flex items-start">
                    <span className="bg-orange-200 text-orange-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 shrink-0">{index + 1}</span> 
                    <span>{item}</span>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </section>

      </main>
    </div>
  );
};
