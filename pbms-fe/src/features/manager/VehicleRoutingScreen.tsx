import { useState, useEffect, useMemo } from 'react';
import { 
  Typography, Select, Button, InputNumber, Input, 
  Card, message, Space, Tooltip, Spin, DatePicker, Switch, Modal, Table 
} from 'antd';
import { 
  SaveOutlined, 
  NodeIndexOutlined,
  CaretLeftOutlined,
  CaretRightOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Legend, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import axiosClient from '../../core/api/axiosClient';
import { simulatedDayjs, useSystemTime } from '../../core/utils/timeProvider';

const { Title, Text } = Typography;

// --- DTOs ---
interface ZoneTrendDTO {
  timeWindow: string;
  zoneId: number;
  zoneName: string;
  occupancyPct: number;
}

interface RuleItemDTO {
  id?: number;
  zoneId: number;
  zoneName: string;
  fillThresholdPct: number;
  suggestedZoneId?: number;
  suggestedZoneName?: string;
}

interface TimeFrameRuleDTO {
  timeFrameId: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  isDefault: boolean;
  rules: RuleItemDTO[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

export const VehicleRoutingScreen = () => {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  
  const [floors, setFloors] = useState<any[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  
  const [confirmedFloor, setConfirmedFloor] = useState<number | null>(null);
  const [confirmedVehicle, setConfirmedVehicle] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timeFrames, setTimeFrames] = useState<TimeFrameRuleDTO[]>([]);
  const [chartDataRaw, setChartDataRaw] = useState<ZoneTrendDTO[]>([]);
  const [selectedTrendDateRange, setSelectedTrendDateRange] = useState<any>([simulatedDayjs().subtract(1, 'day'), simulatedDayjs()]);
  const simulatedToday = useSystemTime().format('YYYY-MM-DD');
  const [displayRouting, setDisplayRouting] = useState<boolean>(true);

  // AI State
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
  const [extraContext, setExtraContext] = useState('');
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    setSelectedTrendDateRange([simulatedDayjs().subtract(1, 'day'), simulatedDayjs()]);
  }, [simulatedToday]);

  const fetchSystemConfig = async () => {
    try {
      const res = await axiosClient.get('/system/configs');
      const config = res.data.data.find((c: any) => c.configKey === 'DISPLAY_ROUTING');
      if (config && config.configValue === 'FALSE') {
        setDisplayRouting(false);
      } else {
        setDisplayRouting(true);
      }
    } catch (error) {
      console.error("Error fetching system configs", error);
    }
  };

  const toggleDisplayRouting = async (checked: boolean) => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/system/configs');
      const config = res.data.data.find((c: any) => c.configKey === 'DISPLAY_ROUTING');
      if (config) {
        await axiosClient.put(`/system/configs/${config.id}`, { ...config, configValue: checked ? 'TRUE' : 'FALSE' });
      } else {
        await axiosClient.post('/system/configs', { configKey: 'DISPLAY_ROUTING', configValue: checked ? 'TRUE' : 'FALSE', description: 'Enable or disable suggested zone routing display' });
      }
      setDisplayRouting(checked);
      message.success(`Routing display ${checked ? 'enabled' : 'disabled'}. Incoming vehicles will ${checked ? 'show suggested zone' : 'show FREE'}.`);
    } catch (error) {
      message.error("Failed to update routing display config");
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async (vehicleType: string, floorId?: number) => {
    try {
      setLoading(true);
      let url = `/manager/routing-rules?vehicleType=${encodeURIComponent(vehicleType)}`;
      if (floorId) url += `&floorId=${floorId}`;
      const res = await axiosClient.get(url);
      const data: TimeFrameRuleDTO[] = res.data.data || [];
      setTimeFrames(data);
    } catch (error) {
      message.error("Error loading dispatcher configuration");
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async () => {
    try {
      const targetVehicleTypeId = vehicleTypes.find(v => v.typeName === confirmedVehicle)?.id;
      const startDateStr = selectedTrendDateRange?.[0]?.format('YYYY-MM-DD') || simulatedDayjs().format('YYYY-MM-DD');
      const endDateStr = selectedTrendDateRange?.[1]?.format('YYYY-MM-DD') || simulatedDayjs().format('YYYY-MM-DD');
      
      let url = `/manager/zone-trends?startDate=${startDateStr}&endDate=${endDateStr}`;
      if (targetVehicleTypeId) {
        url += `&vehicleTypeId=${targetVehicleTypeId}`;
      }
      
      const res = await axiosClient.get(url);
      setChartDataRaw(res.data.data || []);
    } catch (error) {
      console.error("Error when loading chart", error);
    }
  };

  const fetchMapConfig = async () => {
    try {
      const res = await axiosClient.get('/infrastructure/map/config');
      const data = res.data.data;
      if (data) {
        if (data.floors) setFloors(data.floors);
        if (data.vehicleTypes) setVehicleTypes(data.vehicleTypes);
        if (data.zones) setZones(data.zones);
        
        if (data.floors && data.floors.length > 0) {
          setSelectedFloor(data.floors[0].id);
          setConfirmedFloor(data.floors[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading map configuration", error);
    }
  };

  // Removed automatic fetch on selectedVehicle and selectedTrendDate change.
  // We will fetch via a Confirm button.
  
  const handleConfirm = () => {
    setConfirmedFloor(selectedFloor);
    setConfirmedVehicle(selectedVehicle);
    if (selectedVehicle) {
      fetchRules(selectedVehicle, selectedFloor ?? undefined);
    }
    fetchTrends();
  };

  useEffect(() => {
    fetchMapConfig();
    fetchSystemConfig();
  }, []);

  useEffect(() => {
    if (selectedTrendDateRange) {
      fetchTrends();
    }
  }, [selectedTrendDateRange]);

  const handleFloorChange = (val: number) => {
    setSelectedFloor(val);
  };

  // Whenever selectedFloor changes, update selectedVehicle to the first matching category
  useEffect(() => {
    if (selectedFloor && floors.length > 0 && vehicleTypes.length > 0) {
      const floorObj = floors.find(f => f.id === selectedFloor);
      if (floorObj) {
        const validVehicles = vehicleTypes.filter(v => v.category === floorObj.type);
        if (validVehicles.length > 0) {
          setSelectedVehicle(validVehicles[0].typeName);
          if (!confirmedVehicle) setConfirmedVehicle(validVehicles[0].typeName);
        } else {
          setSelectedVehicle('');
        }
      }
    }
  }, [selectedFloor, floors, vehicleTypes]);

  // --- CHART DATA TRANSFORMATION ---
  const { chartData, zoneNames } = useMemo(() => {
    const timeMap = new Map<string, any>();
    const zIds = new Set<number>();
    const zNamesMap = new Map<number, string>();
    const targetVehicleTypeId = vehicleTypes.find(v => v.typeName === confirmedVehicle)?.id;

    zones.forEach(zoneObj => {
      if (zoneObj.floorId === confirmedFloor && zoneObj.vehicleTypeId === targetVehicleTypeId && zoneObj.functionType === 'WALK_IN') {
        zIds.add(zoneObj.id);
        zNamesMap.set(zoneObj.id, zoneObj.name || zoneObj.zoneName);
      }
    });

    chartDataRaw.forEach(item => {
      if (zIds.has(item.zoneId)) {
        if (!timeMap.has(item.timeWindow)) {
          timeMap.set(item.timeWindow, { timeWindow: item.timeWindow });
        }
        const dataPoint = timeMap.get(item.timeWindow);
        const zName = zNamesMap.get(item.zoneId) || item.zoneName;
        dataPoint[zName] = item.occupancyPct;
      }
    });

    const flattened = Array.from(timeMap.values()).sort((a, b) => {
      // timeWindow is now "HH:00 dd/MM"
      // We shouldn't rely on string sort directly if dates change month, but for short ranges it's mostly ok if parsed.
      // But since the backend already sends them in order, maybe we can just keep their insertion order or trust it.
      // Wait, backend sends by date then by hour. If we collect them in timeMap, they will be in order.
      return 0; // maintain insertion order which matches backend chronological order
    });
    
    Array.from(zNamesMap.values()).forEach(z => {
      for (let i = 0; i < flattened.length; i++) {
        if (flattened[i][z] === undefined || flattened[i][z] === null) {
          flattened[i][z] = 0;
        }
      }
    });

    return { chartData: flattened, zoneNames: Array.from(zNamesMap.values()) };
  }, [chartDataRaw, selectedTrendDateRange, confirmedFloor, confirmedVehicle, vehicleTypes, zones]);

  // --- ACTIONS ---
  const moveZone = (frameId: string, index: number, direction: 'LEFT' | 'RIGHT') => {
    setTimeFrames(prev => prev.map(tf => {
      if (tf.timeFrameId !== frameId) return tf;
      const newRules = [...tf.rules];
      if (direction === 'LEFT' && index > 0) {
        const temp = newRules[index];
        newRules[index] = newRules[index - 1];
        newRules[index - 1] = temp;
      } else if (direction === 'RIGHT' && index < newRules.length - 1) {
        const temp = newRules[index];
        newRules[index] = newRules[index + 1];
        newRules[index + 1] = temp;
      }
      return { ...tf, rules: newRules };
    }));
  };

  const updateThreshold = (frameId: string, index: number, value: number | null) => {
    if (value === null) return;
    setTimeFrames(prev => prev.map(tf => {
      if (tf.timeFrameId !== frameId) return tf;
      const newRules = [...tf.rules];
      newRules[index].fillThresholdPct = value;
      return { ...tf, rules: newRules };
    }));
  };

  const handleFrameChange = (frameId: string, field: 'startTime' | 'endTime', value: string) => {
    setTimeFrames(prev => prev.map(tf => {
      if (tf.timeFrameId !== frameId) return tf;
      return { ...tf, [field]: value };
    }));
  };

  const handleAddFrame = () => {
    const defaultFrame = timeFrames.find(tf => tf.isDefault);
    
    let newRules: any[] = [];
    if (defaultFrame) {
      newRules = defaultFrame.rules.map(r => ({ ...r, id: undefined }));
    } else {
      const vt = vehicleTypes.find(v => v.typeName === confirmedVehicle);
      const availableZones = zones.filter(z => z.vehicleTypeId === vt?.id && z.zoneType === 'WALK_IN' && z.status !== 'DELETED' && z.floorId === confirmedFloor);
      newRules = availableZones.map((z, idx) => ({
        zoneId: z.id,
        zoneName: z.zoneName,
        priority: idx + 1,
        fillThresholdPct: 90
      }));
    }
    
    setTimeFrames(prev => {
      const copy = [...prev];
      const hasDefault = copy.some(tf => tf.isDefault);
      const defaultIdx = copy.findIndex(tf => tf.isDefault);
      
      const newFrame = {
        timeFrameId: `tf_${Date.now()}`,
        name: hasDefault ? `New time frame` : `Default Time Frame`,
        startTime: hasDefault ? '07:00' : '00:00',
        endTime: hasDefault ? '10:00' : '23:59',
        isDefault: !hasDefault,
        rules: newRules
      };

      if (hasDefault && defaultIdx >= 0) {
        copy.splice(defaultIdx, 0, newFrame);
      } else {
        copy.push(newFrame);
      }
      return copy;
    });
  };

  const handleRemoveFrame = (frameId: string) => {
    setTimeFrames(prev => prev.filter(tf => tf.timeFrameId !== frameId));
  };

  // VALIDATION LOGIC FOR OVERLAPPING
  const checkOverlapping = () => {
    const specificFrames = timeFrames.filter(tf => !tf.isDefault);
    for (let i = 0; i < specificFrames.length; i++) {
      const f1 = specificFrames[i];
      if (!f1.startTime || !f1.endTime) {
        message.error("Please fill in the full start and end times");
        return true;
      }
      for (let j = i + 1; j < specificFrames.length; j++) {
        const f2 = specificFrames[j];
        if (!f2.startTime || !f2.endTime) continue;

        // Convert HH:mm to minutes for comparison
        const start1 = parseInt(f1.startTime.split(':')[0]) * 60 + parseInt(f1.startTime.split(':')[1]);
        const end1 = parseInt(f1.endTime.split(':')[0]) * 60 + parseInt(f1.endTime.split(':')[1]);
        const start2 = parseInt(f2.startTime.split(':')[0]) * 60 + parseInt(f2.startTime.split(':')[1]);
        const end2 = parseInt(f2.endTime.split(':')[0]) * 60 + parseInt(f2.endTime.split(':')[1]);

        if (start1 < end2 && start2 < end1) {
          message.error(`Time frame ${f1.startTime}-${f1.endTime} overlaps with frame ${f2.startTime}-${f2.endTime}`);
          return true; // overlapping
        }
      }
    }
    return false;
  };

  const handleSave = async () => {
    if (checkOverlapping()) return;

    try {
      setSaving(true);
      const payload = {
        vehicleTypeName: selectedVehicle,
        floorId: confirmedFloor,
        timeFrames: timeFrames.map(tf => ({
          startTime: tf.startTime,
          endTime: tf.endTime,
          isDefault: tf.isDefault,
          rules: tf.rules.map(r => ({
            zoneId: r.zoneId,
            fillThresholdPct: r.fillThresholdPct
          }))
        }))
      };
      await axiosClient.put(`/manager/routing-rules`, payload);
      message.success('Dispatcher configuration saved Success!');
      if (selectedVehicle && confirmedFloor) {
        fetchRules(selectedVehicle, confirmedFloor);
      }
    } catch (error) {
      message.error("Error when saving configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleAskAi = async () => {
    try {
      setIsAiLoading(true);
      setAiResponse(null);

      // Lọc dữ liệu biểu đồ để chỉ gửi các zone WALK_IN cho AI
      const targetVehicleTypeId = vehicleTypes.find(v => v.typeName === confirmedVehicle)?.id;
      const walkInZoneIds = new Set<number>();
      zones.forEach(zoneObj => {
        if (zoneObj.floorId === confirmedFloor && zoneObj.vehicleTypeId === targetVehicleTypeId && (zoneObj.functionType === 'WALK_IN' || zoneObj.zoneType === 'WALK_IN')) {
          walkInZoneIds.add(zoneObj.id);
        }
      });
      const filteredChartData = chartDataRaw.filter(item => walkInZoneIds.has(item.zoneId));

      const payload = {
        vehicleType: confirmedVehicle,
        dateRange: `${selectedTrendDateRange?.[0]?.format('DD/MM/YYYY')} - ${selectedTrendDateRange?.[1]?.format('DD/MM/YYYY')}`,
        chartData: filteredChartData,
        extraContext,
        isRoutingEnabled: displayRouting,
        currentRules: timeFrames
      };
      const res = await axiosClient.post('/manager/ai/routing-advice', payload);
      let adviceStr = res.data.data;
      
      try {
        if (adviceStr.startsWith("```json")) {
           adviceStr = adviceStr.substring(7, adviceStr.length - 3).trim();
        } else if (adviceStr.startsWith("```")) {
           adviceStr = adviceStr.substring(3, adviceStr.length - 3).trim();
        }
        const parsed = JSON.parse(adviceStr);
        setAiResponse(parsed);
      } catch (e) {
        setAiResponse({ raw: adviceStr });
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || "AI connection error");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 pb-24 relative">
      
      {/* HEADER */}
      <div className="bg-white px-8 py-5 border-b border-gray-200 sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <div>
          <Title level={2} className="m-0 text-gray-800">Automatic Zone Coordination</Title>
          <Text type="secondary" className="text-base">Set up smart vehicle routing for each time frame based on water level threshold</Text>
        </div>
        
        <Space size="middle" className="bg-gray-50 p-2 rounded-xl border border-gray-200">
           <div className="flex items-center gap-2 px-2 border-r border-gray-300 mr-2 pr-4">
             <Text strong className="text-gray-600">Routing Display</Text>
             <Switch 
               checked={displayRouting} 
               onChange={toggleDisplayRouting}
               checkedChildren="ON"
               unCheckedChildren="OFF"
               className={displayRouting ? 'bg-blue-600' : 'bg-gray-400'}
             />
           </div>
           <Select 
              value={selectedFloor} 
              onChange={handleFloorChange}
              options={floors.map(f => ({ label: `Floor ${f.name}`, value: f.id }))}
              className="w-32"
              size="large"
              bordered={false}
              placeholder="Select floor"
           />
           <div className="w-px h-6 bg-gray-300"></div>
           <Select 
              value={selectedVehicle}
              onChange={setSelectedVehicle}
              options={
                selectedFloor 
                  ? vehicleTypes
                      .filter(v => {
                        const floorObj = floors.find(f => f.id === selectedFloor);
                        return floorObj ? v.category === floorObj.type : false;
                      })
                      .map(v => ({ 
                        label: v.typeName === 'CAR' ? 'Car' : (v.typeName === 'MOTO' ? 'Motorbike' : v.typeName), 
                        value: v.typeName 
                      }))
                  : []
              }
              className="w-32"
              size="large"
              bordered={false}
              placeholder="Select car"
           />
           <Button type="primary" onClick={handleConfirm} loading={loading}>
             Confirm
           </Button>
        </Space>
      </div>

      {/* CHART SECTION */}
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <Title level={4} className="m-0 flex items-center gap-2"><DashboardOutlined className="text-blue-600"/>  Water Leveling Each Zone Automatically</Title>
              <Text type="secondary">Measure peak fill every hour through AI/IoT Sensor System</Text>
            </div>
            <div className="flex flex-col items-end gap-2">
              <DatePicker.RangePicker 
                value={selectedTrendDateRange} 
                onChange={setSelectedTrendDateRange} 
                format="DD/MM/YYYY" 
                allowClear={false}
              />
              <div className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 font-medium">
                 
                                               Update automatically every hour
                                            </div>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="timeWindow" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} domain={[0, 100]} />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [`${value}%`, '']}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
              
              <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'top', value: 'Critical Threshold 90%', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} />
              
              {zoneNames.map((zName, idx) => (
            <Line 
              key={zName}
              type="monotone" 
              dataKey={zName}
              name={zName} 
              stroke={COLORS[idx % COLORS.length]} 
              strokeWidth={3}
              dot={{r: 4, strokeWidth: 2}}
              activeDot={{r: 6}}
            />
          ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ROUTING MATRIX */}
      <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full pt-0">
        <div className="flex justify-between items-center mb-6">
           <div>
             <Title level={3} className="m-0 flex items-center gap-2 text-gray-800">
               <NodeIndexOutlined className="text-blue-600" />  Configuration According to Time Frame
                                       </Title>
             <Text type="secondary">Add time frames and drag and drop to prioritize the flow for each frame. The last frame is redundant</Text>
           </div>
           <Button type="primary" ghost icon={<PlusOutlined />} onClick={handleAddFrame}>Add Time Frame</Button>
        </div>

        <Spin spinning={loading}>
          <div className="flex flex-col gap-6">
            {timeFrames.map((frame, frameIdx) => (
              <Card 
                key={frame.timeFrameId} 
                className={`shadow-sm rounded-xl overflow-hidden [&_.ant-card-body]:p-6 transition-all ${frame.isDefault ? 'border-indigo-400 bg-indigo-50/20' : 'border-gray-300'}`}
              >
                <div className="flex flex-col xl:flex-row gap-6">
                  
                  {/* Left: Time Info */}
                  <div className="w-full xl:w-64 shrink-0 flex flex-col justify-start border-b xl:border-b-0 xl:border-r border-gray-200 pb-4 xl:pb-0 xl:pr-6 relative">
                    <div className={`text-lg font-bold mb-2 ${frame.isDefault ? 'text-indigo-800' : 'text-blue-800'}`}>
                      {frame.name}
                    </div>
                    
                    {!frame.isDefault && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                        <ClockCircleOutlined />
                        <Input 
                          value={frame.startTime || ''} 
                          onChange={e => handleFrameChange(frame.timeFrameId, 'startTime', e.target.value)}
                          placeholder="07:00"
                          className="w-20 text-center font-mono" size="small"
                        />
                        <span>-</span>
                        <Input 
                          value={frame.endTime || ''} 
                          onChange={e => handleFrameChange(frame.timeFrameId, 'endTime', e.target.value)}
                          placeholder="10:00"
                          className="w-20 text-center font-mono" size="small"
                        />
                      </div>
                    )}
                    
                    {frame.isDefault && (
                      <div className="text-sm text-gray-500 italic">
                        
                                                            Applicable outside the specific time frames above
                                                          </div>
                    )}

                    {!frame.isDefault && (
                      <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        className="absolute right-0 top-0 xl:static xl:mt-auto xl:w-fit"
                        onClick={() => handleRemoveFrame(frame.timeFrameId)}
                      >
                        Delete Frame
                      </Button>
                    )}
                  </div>

                  {/* Right: Zones Rules */}
                  <div className="flex-1 overflow-x-auto pb-2">
                    <div className="flex items-center gap-2 min-w-max">
                      {frame.rules.map((rule, index) => (
                        <div key={rule.zoneId} className="flex items-center gap-2">
                          <div className={`flex flex-col items-center justify-between p-3 rounded-xl border transition-all w-48 bg-white
                            ${index === 0 ? 'border-blue-400 shadow-sm' : 'border-gray-200'}
                          `}>
                            
                            <div className="flex items-center w-full gap-2 mb-2 border-b border-gray-100 pb-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0
                                ${index === 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`
                              }>
                                {index + 1}
                              </div>
                              <div className="font-bold text-gray-800 text-sm truncate">{rule.zoneName}</div>
                            </div>

                            <div className="flex items-center justify-between w-full">
                              <div className="flex flex-col items-start">
                                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Threshold</span>
                                <InputNumber 
                                  value={rule.fillThresholdPct} 
                                  onChange={(val) => updateThreshold(frame.timeFrameId, index, val)}
                                  min={0} max={100}
                                  size="small"
                                  formatter={(value) => `${value}%`}
                                  parser={(value) => value!.replace('%', '') as unknown as number}
                                  className="w-16 text-center text-xs text-red-600 font-semibold"
                                />
                              </div>
                              
                              <div className="flex gap-1">
                                <Button 
                                  type="text" size="small" icon={<CaretLeftOutlined />} 
                                  disabled={index === 0}
                                  onClick={() => moveZone(frame.timeFrameId, index, 'LEFT')}
                                />
                                <Button 
                                  type="text" size="small" icon={<CaretRightOutlined />} 
                                  disabled={index === frame.rules.length - 1}
                                  onClick={() => moveZone(frame.timeFrameId, index, 'RIGHT')}
                                />
                              </div>
                            </div>

                          </div>
                          
                          {/* Connection Arrow */}
                          {index < frame.rules.length - 1 && (
                            <div className="flex items-center text-gray-300">
                              <div className="w-6 h-0.5 bg-gray-300"></div>
                              <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-6 border-l-gray-300"></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </Card>
            ))}
          </div>
        </Spin>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50 flex justify-end px-8">
         <Space size="large">
            <Text type="secondary" className="hidden sm:inline-block">The configuration will be synchronized to the Backend and Gate immediately</Text>
            <Button
               type="default"
               size="large"
               icon={<RobotOutlined />}
               onClick={() => setIsAiModalVisible(true)}
               className="border-purple-500 text-purple-600 hover:text-purple-700 hover:border-purple-600 font-bold px-6 h-12 text-lg shadow-sm"
            >
               AI Suggestion
            </Button>
            <Button 
              type="primary" 
              size="large" 
              icon={<SaveOutlined />} 
              onClick={handleSave}
              loading={saving}
              className="bg-blue-600 hover:bg-blue-500 font-bold px-8 h-12 text-lg shadow-md"
            >
              SAVE THE COORDINATE CONFIGURATION
            </Button>
         </Space>
      </div>

      {/* AI MODAL */}
      <Modal
        title={<span><RobotOutlined className="text-purple-600 mr-2"/> Zone Routing Advisor (AI)</span>}
        open={isAiModalVisible}
        onCancel={() => !isAiLoading && setIsAiModalVisible(false)}
        width={800}
        footer={null}
        maskClosable={false}
      >
        {!aiResponse ? (
          <div className="py-4">
            <Text className="block mb-2 text-gray-700">
              AI will analyze the occupancy data of <b>{confirmedVehicle}</b> from the chart below to suggest the optimal routing. Do you want to provide additional context about the zones? (Optional)
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="E.g. Zone A is near the elevator so it should be prioritized, Zone B has a narrow path so restrict entry during peak hours..."
              value={extraContext}
              onChange={e => setExtraContext(e.target.value)}
              disabled={isAiLoading}
            />
            <div className="mt-6 flex justify-end">
              <Button type="primary" onClick={handleAskAi} loading={isAiLoading} className="bg-purple-600" size="large">
                Send Analysis Request
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4">
            {aiResponse.raw ? (
              <div>
                <Text strong className="text-red-500 block mb-2">AI returned a format that cannot be parsed into a UI table. Here is the raw result:</Text>
                <div className="bg-gray-100 p-4 rounded whitespace-pre-wrap text-sm font-mono overflow-auto max-h-96">
                  {aiResponse.raw}
                </div>
              </div>
            ) : (
              <div>
                <Text strong className="block mb-2 text-lg text-purple-800">AI Analysis:</Text>
                <div className="bg-purple-50 p-4 rounded-lg mb-6 border border-purple-100">
                  <Text className="text-gray-800 italic">"{aiResponse.reasoning}"</Text>
                </div>
                
                <Text strong className="block mb-4 text-lg">Suggested Timeframes Configuration:</Text>
                {aiResponse.timeFrames?.map((tf: any, i: number) => (
                  <Card key={i} className="mb-4 shadow-sm border-gray-200" size="small" title={<span className="font-bold">{tf.name} ({tf.startTime} - {tf.endTime})</span>}>
                    <Table 
                      dataSource={tf.rules} 
                      pagination={false} 
                      size="small"
                      rowKey={(record: any) => record.zoneName}
                      columns={[
                        { title: 'Priority', dataIndex: 'priority', key: 'priority', render: text => <span className="font-bold text-blue-600">#{text}</span> },
                        { title: 'Zone', dataIndex: 'zoneName', key: 'zoneName', render: text => <span className="font-medium">{text}</span> },
                        { title: 'Threshold', dataIndex: 'threshold', key: 'threshold', render: text => <span>{text}%</span> },
                      ]}
                    />
                  </Card>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => setAiResponse(null)} disabled={isAiLoading}>Re-analyze</Button>
              <Button type="primary" onClick={() => setIsAiModalVisible(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
