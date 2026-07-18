import React, { useState, useEffect, useRef } from 'react';
import { Typography, Button, message, Spin, Input, Select, InputNumber, Collapse, Slider, Switch, Radio, notification, Badge, Tooltip, Modal } from 'antd';
import {
  SaveOutlined, SyncOutlined, AimOutlined, PlusOutlined,
  SettingOutlined, CompassOutlined, GatewayOutlined,
  CloseCircleOutlined, SwapRightOutlined, SwapLeftOutlined,
  StopOutlined, DeleteOutlined, ZoomInOutlined, ZoomOutOutlined,
  LockOutlined, UnlockOutlined
} from '@ant-design/icons';
import { Stage, Layer, Line, Group, Rect, Text as KonvaText, Label, Tag, Image as KonvaImage } from 'react-konva';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../core/api/axiosClient';
import { getImageUrl } from '../../core/utils/imageHelper';
import { useWebSocket } from '../../core/websocket/useWebSocket';
import Konva from 'konva';

const URLImage = ({ src, x, y, width, height }: { src: string, x: number, y: number, width: number, height: number }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.src = src;
    img.onload = () => setImage(img);
  }, [src]);
  if (!image) return null;
  return <KonvaImage image={image} x={x} y={y} width={width} height={height} listening={false} />;
};

const { Title, Text } = Typography;
const { Panel } = Collapse;

// Constants & Types
const GRID_SIZE = 50;

interface Floor {
  id: number;
  name: string;
  type: 'FOUR_WHEEL' | 'TWO_WHEEL';
  mapCols: number;
  mapRows: number;
}

interface Slot {
  id: string;
  name: string;
  status: 'EMPTY' | 'OCCUPIED' | 'DISABLED';
  plate?: string;
}

interface Zone {
  id: number;
  floorId: number;
  name: string;
  capacity: number;
  vehicleTypeId: number;
  vehicleTypeName?: string;
  vehicleCategory?: string;
  functionType: 'WALK_IN' | 'MONTHLY';
  layoutX: number;
  layoutY: number;
  rotation: number;
  slots: Slot[];

  activeReservationsCount?: number;
}

interface Gate {
  id: string | number;
  floorId: number;
  name: string;
  type: 'ENTRY' | 'EXIT' | 'ENTRY_EXIT' | 'PATROL';
  status: 'IDLE' | 'OCCUPIED' | 'MAINTENANCE' | string;
  staffName?: string;
  layoutX: number;
  layoutY: number;
  rotation: number;
  vehicleTypeId?: number;
}

interface VehicleType {
  id: number;
  typeName: string;
  category: 'FOUR_WHEEL' | 'TWO_WHEEL';
  matrixWidth: number;
  matrixHeight: number;
  iconUrl?: string;
}

type SelectedEntity =
  | { type: 'ZONE'; id: number }
  | { type: 'SLOT'; zoneId: number; slotId: string }
  | { type: 'GATE'; id: string | number }
  | null;

const getVehicleDimensions = (typeId: number, vehicleTypes: VehicleType[]) => {
  const type = vehicleTypes.find(v => v.id === typeId);
  if (type) {
    return { width: type.matrixWidth * GRID_SIZE, height: type.matrixHeight * GRID_SIZE };
  }
  return { width: 3 * GRID_SIZE, height: 6 * GRID_SIZE };
};

export const SpaceMapScreen = () => {
  const queryClient = useQueryClient();

  // State
  const [zones, setZones] = useState<Zone[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['0', '1', '2', '4']);
  const [collidingNodeId, setCollidingNodeId] = useState<string | null>(null);

  const getComparableMapState = (f: Floor[], z: Zone[], g: Gate[]) => {
    return {
      floors: f,
      zones: z.map(zone => ({ ...zone, slots: [] })), // Ignore transient slot states
      gates: g
    };
  };

  // Helper for deep comparison
  const deepEqual = (obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) return false;
    let keys1 = Object.keys(obj1);
    let keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;
    for (let key of keys1) {
      if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false;
    }
    return true;
  };

  const [initialMapState, setInitialMapState] = useState<any>(null);
  const isDirty = initialMapState !== null && !deepEqual(getComparableMapState(floors, zones, gates), initialMapState);

  // Floors State
  const [selectedFloorId, setSelectedFloorId] = useState<number>(1);

  const activeFloor = floors.find(f => f.id === selectedFloorId);
  const mapCols = activeFloor?.mapCols || 60;
  const mapRows = activeFloor?.mapRows || 40;

  const handleUpdateMapSize = (cols: number, rows: number) => {
    const mapW = cols * GRID_SIZE;
    const mapH = rows * GRID_SIZE;
    let isOutside = false;

    const currentZones = zones.filter(z => z.floorId === selectedFloorId);
    for (const z of currentZones) {
      const { width: slotW, height: slotH } = getVehicleDimensions(z.vehicleTypeId, vehicleTypes);
      let zw = z.capacity * slotW;
      let zh = slotH;
      if (z.rotation === 90 || z.rotation === 270) { zw = slotH; zh = z.capacity * slotW; }

      let zx = z.layoutX; let zy = z.layoutY;
      if (z.rotation === 90) zx -= zw;
      else if (z.rotation === 180) { zx -= zw; zy -= zh; }
      else if (z.rotation === 270) zy -= zh;

      if (zx + zw > mapW || zy + zh > mapH) {
        isOutside = true;
        break;
      }
    }

    if (!isOutside) {
      const currentGates = gates.filter(g => g.floorId === selectedFloorId);
      for (const g of currentGates) {
        let gw = 3 * GRID_SIZE;
        let gh = GRID_SIZE;
        if (g.vehicleTypeId) {
          const vt = vehicleTypes.find(v => v.id === g.vehicleTypeId);
          if (vt) gw = vt.matrixWidth * GRID_SIZE;
        }
        if (g.rotation === 90 || g.rotation === 270) {
          const temp = gw; gw = gh; gh = temp;
        }
        let gx = g.layoutX; let gy = g.layoutY;
        if (g.rotation === 90) gx -= gw;
        else if (g.rotation === 180) { gx -= gw; gy -= gh; }
        else if (g.rotation === 270) gy -= gh;

        if (gx + gw > mapW || gy + gh > mapH) {
          isOutside = true;
          break;
        }
      }
    }

    if (isOutside) {
      message.error('Cannot reduce size because a Zone or Gate falls outside the map!');
      return;
    }

    setFloors(prev => prev.map(f => f.id === selectedFloorId ? { ...f, mapCols: cols, mapRows: rows } : f));
  };

  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [defaultScale, setDefaultScale] = useState(1);

  const { stompClient, connected } = useWebSocket();

  // Fetch initial data via API
  const { data: mapConfigData, refetch } = useQuery({
    queryKey: ['mapConfig'],
    queryFn: async () => {
      const res = await axiosClient.get('/infrastructure/map/config');
      return res.data.data;
    }
  });

  useEffect(() => {
    if (mapConfigData) {
      if (mapConfigData.floors && mapConfigData.floors.length > 0) {
        setFloors(mapConfigData.floors);
        if (!selectedFloorId || !mapConfigData.floors.find((f: any) => f.id === selectedFloorId)) {
          setSelectedFloorId(mapConfigData.floors[0].id);
        }
      }
      if (mapConfigData.zones) setZones(mapConfigData.zones);
      if (mapConfigData.gates) setGates(mapConfigData.gates);
      if (mapConfigData.vehicleTypes) setVehicleTypes(mapConfigData.vehicleTypes);
      setInitialMapState(getComparableMapState(
        mapConfigData.floors || [], 
        mapConfigData.zones || [], 
        mapConfigData.gates || []
      ));
    }
  }, [mapConfigData]);

  // WebSocket for real-time slot updates
  useEffect(() => {
    if (stompClient && connected) {
      const subscription = stompClient.subscribe('/topic/slots/status', (message) => {
        const payload = JSON.parse(message.body); // e.g., { "slotId": 1, "status": "OCCUPIED" }
        setZones(prevZones => prevZones.map(z => ({
          ...z,
          slots: z.slots.map(s => {
            if (s.id === String(payload.slotId)) {
              return { ...s, status: payload.status === 'AVAILABLE' ? 'EMPTY' : payload.status };
            }
            return s;
          })
        })));
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [stompClient, connected]);

  // Handle floor switch selection clear
  useEffect(() => {
    if (selectedEntity) {
      let keep = false;
      if (selectedEntity.type === 'ZONE' || selectedEntity.type === 'SLOT') {
        const zId = selectedEntity.type === 'ZONE' ? (selectedEntity as any).id : selectedEntity.zoneId;
        if (zones.find(z => z.id === zId)?.floorId === selectedFloorId) keep = true;
      } else if (selectedEntity.type === 'GATE') {
        if (gates.find(g => g.id === (selectedEntity as any).id)?.floorId === selectedFloorId) keep = true;
      }
      if (!keep) setSelectedEntity(null);
    }
  }, [selectedFloorId, zones, gates]);

  const visibleZones = zones.filter(z => z.floorId === selectedFloorId);
  const visibleGates = gates.filter(g => g.floorId === selectedFloorId && g.type !== 'PATROL');

  // Handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    // Slight delay to ensure flex layout has computed
    const timer = setTimeout(updateSize, 100);
    window.addEventListener('resize', updateSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Fit to screen logic
  useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      const mapW = mapCols * GRID_SIZE;
      const mapH = mapRows * GRID_SIZE;

      const scale = Math.min(containerSize.width / mapW, containerSize.height / mapH) * 0.95;
      const minScaleLocked = Math.min(scale, 1);

      setDefaultScale(minScaleLocked);
      setStageScale(minScaleLocked);

      setStagePos({
        x: (containerSize.width - mapW * minScaleLocked) / 2,
        y: (containerSize.height - mapH * minScaleLocked) / 2
      });
    }
  }, [mapCols, mapRows, containerSize]);

  // -- Event Handlers --

  const handleZoomToBox = (boxX: number, boxY: number, boxW: number, boxH: number, padding: number = 50) => {
    if (!stageRef.current || !containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;

    const scaleX = (containerW - padding * 2) / boxW;
    const scaleY = (containerH - padding * 2) / boxH;
    let newScale = Math.min(scaleX, scaleY);
    newScale = Math.max(defaultScale, Math.min(newScale, 4));

    const centerX = boxX + boxW / 2;
    const centerY = boxY + boxH / 2;

    const newX = containerW / 2 - centerX * newScale;
    const newY = containerH / 2 - centerY * newScale;

    const tween = new Konva.Tween({
      node: stageRef.current,
      duration: 0.5,
      easing: Konva.Easings.EaseInOut,
      x: newX,
      y: newY,
      scaleX: newScale,
      scaleY: newScale,
      onFinish: () => {
        setStagePos({ x: newX, y: newY });
        setStageScale(newScale);
      }
    });
    tween.play();
  };

  const handleZoom = (factor: number) => {
    if (!stageRef.current || !containerRef.current) return;
    const oldScale = stageScale;
    let newScale = oldScale * factor;
    newScale = Math.max(defaultScale, Math.min(newScale, 5));

    const center = {
      x: containerRef.current.clientWidth / 2,
      y: containerRef.current.clientHeight / 2,
    };

    const mousePointTo = {
      x: (center.x - stagePos.x) / oldScale,
      y: (center.y - stagePos.y) / oldScale,
    };

    setStageScale(newScale);
    setStagePos({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    });
  };

  const handleZoomFit = () => {
    if (!containerRef.current) return;
    const mapW = mapCols * GRID_SIZE;
    const mapH = mapRows * GRID_SIZE;

    const scale = Math.min(containerRef.current.clientWidth / mapW, containerRef.current.clientHeight / mapH) * 0.95;
    const minScaleLocked = Math.min(scale, 1);

    setStageScale(minScaleLocked);
    setStagePos({
      x: (containerRef.current.clientWidth - mapW * minScaleLocked) / 2,
      y: (containerRef.current.clientHeight - mapH * minScaleLocked) / 2
    });
  };

  const handleZoomZone = (zoneId: number) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    setSelectedEntity({ type: 'ZONE', id: zone.id });

    const { width: slotW, height: slotH } = getVehicleDimensions(zone.vehicleTypeId, vehicleTypes);
    let zoneW = zone.capacity * slotW;
    let zoneH = slotH;
    if (zone.rotation === 90 || zone.rotation === 270) {
      zoneW = slotH;
      zoneH = zone.capacity * slotW;
    }

    let boxX = zone.layoutX;
    let boxY = zone.layoutY;
    if (zone.rotation === 90) boxX -= zoneW;
    else if (zone.rotation === 180) { boxX -= zoneW; boxY -= zoneH; }
    else if (zone.rotation === 270) boxY -= zoneH;

    handleZoomToBox(boxX, boxY, zoneW, zoneH, 100);
  };

  const checkIntersection = (rect1: any, rect2: any) => {
    return !(
      rect2.x > rect1.x + rect1.width ||
      rect2.x + rect2.width < rect1.x ||
      rect2.y > rect1.y + rect1.height ||
      rect2.y + rect2.height < rect1.y
    );
  };

  const handleDragMove = (e: any, id: number | string, isZone: boolean) => {
    const node = e.target;
    const stage = node.getStage();
    const layer = node.getLayer();
    const nodeRect = node.getClientRect({ skipTransform: false });
    const mapW = mapCols * GRID_SIZE;
    const mapH = mapRows * GRID_SIZE;

    const stageTransform = stage.getAbsoluteTransform().copy();
    stageTransform.invert();
    const absRect = {
      x: (nodeRect.x - stage.x()) / stage.scaleX(),
      y: (nodeRect.y - stage.y()) / stage.scaleY(),
      width: nodeRect.width / stage.scaleX(),
      height: nodeRect.height / stage.scaleY()
    };

    let hasCollision = false;

    // Bounds check
    if (absRect.x < 0 || absRect.y < 0 || absRect.x + absRect.width > mapW || absRect.y + absRect.height > mapH) {
      hasCollision = true;
    } else {
      // Sibling collision check
      for (const child of layer.getChildren()) {
        if (child !== node && (child.name() === 'zoneGroup' || child.name() === 'gateGroup')) {
          const otherRect = child.getClientRect({ skipTransform: false });
          if (checkIntersection(nodeRect, otherRect)) {
            hasCollision = true;
            break;
          }
        }
      }
    }

    if (hasCollision) {
      if (collidingNodeId !== String(id)) setCollidingNodeId(String(id));
      node.setAttr('isColliding', true);
    } else {
      if (collidingNodeId === String(id)) setCollidingNodeId(null);
      node.setAttr('isColliding', false);
    }
  };

  const handleDragEnd = (e: any, id: number | string, isZone: boolean) => {
    setCollidingNodeId(null);
    const node = e.target;
    if (node.getAttr('isColliding')) {
      // Revert position
      const previousState = isZone ? zones.find(z => z.id === id) : gates.find(g => g.id === id);
      if (previousState) {
        node.position({ x: previousState.layoutX, y: previousState.layoutY });
      }
      node.setAttr('isColliding', false);
      message.error('Invalid location due to duplicate or off map!');
      return;
    }

    const x = Math.round(node.x() / GRID_SIZE) * GRID_SIZE;
    const y = Math.round(node.y() / GRID_SIZE) * GRID_SIZE;
    node.position({ x, y });

    if (isZone) {
      setZones(prev => prev.map(z => z.id === id ? { ...z, layoutX: x, layoutY: y } : z));
    } else {
      setGates(prev => prev.map(g => g.id === id ? { ...g, layoutX: x, layoutY: y } : g));
    }
  };

  const handleRotateZone = (zoneId: number) => {
    setZones(prev => prev.map(z => z.id === zoneId ? { ...z, rotation: (z.rotation + 90) % 360 } : z));
    // Note: A robust system would check collision AFTER rotation and revert if needed.
  };

  const findEmptyPosition = (w: number, h: number) => {
    const mapW = mapCols * GRID_SIZE;
    const mapH = mapRows * GRID_SIZE;

    const rects = [];
    for (const z of visibleZones) {
      const { width: slotW, height: slotH } = getVehicleDimensions(z.vehicleTypeId, vehicleTypes);
      let zw = z.capacity * slotW;
      let zh = slotH;
      if (z.rotation === 90 || z.rotation === 270) { zw = slotH; zh = z.capacity * slotW; }

      let zx = z.layoutX; let zy = z.layoutY;
      if (z.rotation === 90) zx -= zw;
      else if (z.rotation === 180) { zx -= zw; zy -= zh; }
      else if (z.rotation === 270) zy -= zh;

      rects.push({ x: zx, y: zy, width: zw, height: zh });
    }
    for (const g of visibleGates) {
      let gw = 3 * GRID_SIZE;
      let gh = GRID_SIZE;
      if (g.vehicleTypeId) {
        const vt = vehicleTypes.find(v => v.id === g.vehicleTypeId);
        if (vt) gw = vt.matrixWidth * GRID_SIZE;
      }
      if (g.rotation === 90 || g.rotation === 270) {
        const temp = gw; gw = gh; gh = temp;
      }
      let gx = g.layoutX; let gy = g.layoutY;
      if (g.rotation === 90) gx -= gw;
      else if (g.rotation === 180) { gx -= gw; gy -= gh; }
      else if (g.rotation === 270) gy -= gh;
      rects.push({ x: gx, y: gy, width: gw, height: gh });
    }

    for (let y = 0; y <= mapH - h; y += GRID_SIZE) {
      for (let x = 0; x <= mapW - w; x += GRID_SIZE) {
        const newRect = { x, y, width: w, height: h };
        let collision = false;
        for (const r of rects) {
          if (!(r.x >= newRect.x + newRect.width || r.x + r.width <= newRect.x ||
            r.y >= newRect.y + newRect.height || r.y + r.height <= newRect.y)) {
            collision = true;
            break;
          }
        }
        if (!collision) return { x, y };
      }
    }
    return null;
  };

  const handleAddZone = () => {
    const activeFloor = floors.find(f => f.id === selectedFloorId);
    const validVehicleTypes = vehicleTypes.filter(v => v.category === activeFloor?.type);
    if (validVehicleTypes.length === 0) {
      message.error("There are no vehicles suitable for this floor! Please create a vehicle type first");
      return;
    }
    const defaultVehicleType = validVehicleTypes[0];
    const { width: slotW, height: slotH } = getVehicleDimensions(defaultVehicleType.id, vehicleTypes);
    const capacity = 5;
    const w = capacity * slotW;
    const h = slotH;

    const pos = findEmptyPosition(w, h);
    if (!pos) {
      message.error("The map is full, there are no more vacancies to add new Zones!");
      return;
    }

    const newId = Date.now();
    const newZone: Zone = {
      id: newId,
      floorId: selectedFloorId,
      name: `New Zone`,
      capacity: capacity,
      vehicleTypeId: defaultVehicleType.id,
      functionType: 'WALK_IN',
      layoutX: pos.x,
      layoutY: pos.y,
      rotation: 0,
      slots: Array.from({ length: capacity }).map((_, i) => ({ id: `${Date.now()}${i}`, name: `N${i + 1}`, status: 'EMPTY' }))
    };

    setZones(prev => [...prev, newZone]);
    setSelectedEntity({ type: 'ZONE', id: newId });
    if (!expandedKeys.includes('2')) setExpandedKeys(prev => [...prev, '2']);
  };

  const handleAddGate = () => {
    const pos = findEmptyPosition(3 * GRID_SIZE, GRID_SIZE);
    if (!pos) {
      message.error("The map is full, there are no vacancies left to add new Gates!");
      return;
    }

    const newId = Date.now().toString();
    const newGate: Gate = {
      id: newId,
      floorId: selectedFloorId,
      name: `Gate ${gates.length + 1}`,
      type: 'ENTRY_EXIT',
      status: 'IDLE',
      layoutX: pos.x,
      layoutY: pos.y,
      rotation: 0,
      vehicleTypeId: undefined
    };
    setGates(prev => [...prev, newGate]);
    setSelectedEntity({ type: 'GATE', id: newId });
    if (!expandedKeys.includes('4')) setExpandedKeys(prev => [...prev, '4']);
  };

  const handleAddPatrolGate = () => {
    const newId = Date.now().toString();
    const newGate: Gate = {
      id: newId,
      floorId: selectedFloorId,
      name: `Patrol ${gates.filter(g => g.type === 'PATROL' && g.floorId === selectedFloorId).length + 1}`,
      type: 'PATROL',
      status: 'IDLE',
      layoutX: 0,
      layoutY: 0,
      rotation: 0,
      vehicleTypeId: undefined
    };
    setGates(prev => [...prev, newGate]);
    if (!expandedKeys.includes('5')) setExpandedKeys(prev => [...prev, '5']);
  };

  const handleUpdateZoneCapacity = (zoneId: number, newCapacity: number) => {
    setZones(prev => prev.map(z => {
      if (z.id !== zoneId) return z;
      if (newCapacity === z.capacity) return z;

      let newSlots = [...z.slots];
      if (newCapacity > z.capacity) {
        for (let i = z.capacity; i < newCapacity; i++) {
          newSlots.push({ id: `${Date.now()}${i}`, name: `S${i + 1}`, status: 'EMPTY' });
        }
      } else {
        // Reduce slots (LIFO)
        // Check if any removed slot is occupied
        const removedSlots = newSlots.slice(newCapacity);
        const hasOccupied = removedSlots.some(s => s.status !== 'EMPTY');
        if (hasOccupied) {
          message.error('Can\'t cut it! The cut off spaces are currently parked');
          return z; // Abort
        }
        newSlots = newSlots.slice(0, newCapacity);
      }
      return { ...z, capacity: newCapacity, slots: newSlots };
    }));
  };

  const handleToggleSlotStatus = async (zoneId: number, slotId: string, newStatus: 'EMPTY' | 'DISABLED') => {
    // Check local first for prompt UI feedback if OCCUPIED
    const zone = zones.find(z => z.id === zoneId);
    const slot = zone?.slots.find(s => s.id === slotId);
    if (slot && slot.status === 'OCCUPIED') {
      message.warning('Can\'t do maintenance on a cell that has a car!');
      return;
    }

    try {
      await axiosClient.put(`/infrastructure/slots/${slotId}/status`, { status: newStatus });
      // The websocket will broadcast map-updates, and the map will automatically sync.
      // But we can also update local state instantly for better UX
      setZones(prev => prev.map(z => {
        if (z.id !== zoneId) return z;
        return {
          ...z,
          slots: z.slots.map(s => s.id === slotId ? { ...s, status: newStatus } : s)
        };
      }));
      message.success(`Updated Status in Success box!`);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error when updating cell Status');
    }
  };

  const handleSave = () => {
    // Validate bounds and overlaps
    for (const zone of zones) {
      const activeFloor = floors.find(f => f.id === zone.floorId);
      if (!activeFloor) continue;
      const floorW = (activeFloor.mapCols || 60) * GRID_SIZE;
      const floorH = (activeFloor.mapRows || 40) * GRID_SIZE;
      
      const { width: slotW, height: slotH } = getVehicleDimensions(zone.vehicleTypeId, vehicleTypes);
      let zw = zone.capacity * slotW;
      let zh = slotH;
      if (zone.rotation === 90 || zone.rotation === 270) { zw = slotH; zh = zone.capacity * slotW; }

      let zx = zone.layoutX; let zy = zone.layoutY;
      if (zone.rotation === 90) zx -= zw;
      else if (zone.rotation === 180) { zx -= zw; zy -= zh; }
      else if (zone.rotation === 270) zy -= zh;

      if (zx < 0 || zy < 0 || zx + zw > floorW || zy + zh > floorH) {
        message.error(`Zone ${zone.name} is placed outside the map boundaries!`);
        return;
      }

      for (const other of zones) {
        if (zone.id === other.id || zone.floorId !== other.floorId) continue;
        const { width: oSlotW, height: oSlotH } = getVehicleDimensions(other.vehicleTypeId, vehicleTypes);
        let ow = other.capacity * oSlotW;
        let oh = oSlotH;
        if (other.rotation === 90 || other.rotation === 270) { ow = oSlotH; oh = other.capacity * oSlotW; }
        
        let ox = other.layoutX; let oy = other.layoutY;
        if (other.rotation === 90) ox -= ow;
        else if (other.rotation === 180) { ox -= ow; oy -= oh; }
        else if (other.rotation === 270) oy -= oh;
        
        if (!(zx >= ox + ow || zx + zw <= ox || zy >= oy + oh || zy + zh <= oy)) {
          message.error(`Zone ${zone.name} overlaps with Zone ${other.name}!`);
          return;
        }
      }
    }

    const payload = { floors, zones, gates, vehicleTypes: undefined }; // don't send vehicleTypes back

    axiosClient.post('/infrastructure/map/save', payload)
      .then(res => {
        message.success('Success! control center and diagram configuration saved!');
        setInitialMapState(getComparableMapState(floors, zones, gates));
        refetch().then((result) => {
          const fetchedData = result.data;
          if (fetchedData && fetchedData.floors && fetchedData.floors.length > 0) {
            const stillExists = fetchedData.floors.find((f: any) => f.id === selectedFloorId);
            if (!stillExists) {
              setSelectedFloorId(fetchedData.floors[fetchedData.floors.length - 1].id);
            }
          }
        });
      })
      .catch(err => {
        message.error(err.response?.data?.message || 'an error occurred when saving the configuration');
      });
  };

  // -- Render Helpers --
  const drawGrid = () => {
    const lines = [];
    const width = mapCols * GRID_SIZE;
    const height = mapRows * GRID_SIZE;

    lines.push(<Rect key="bg" x={0} y={0} width={width} height={height} fill="#f8fafc" />);

    for (let i = 1; i < mapCols; i++) {
      lines.push(<Line key={`v-${i}`} points={[i * GRID_SIZE, 0, i * GRID_SIZE, height]} stroke="#cbd5e1" strokeWidth={1} opacity={0.3} listening={false} />);
    }
    for (let j = 1; j < mapRows; j++) {
      lines.push(<Line key={`h-${j}`} points={[0, j * GRID_SIZE, width, j * GRID_SIZE]} stroke="#cbd5e1" strokeWidth={1} opacity={0.3} listening={false} />);
    }

    lines.push(<Rect key="border" x={0} y={0} width={width} height={height} stroke="#334155" strokeWidth={4} listening={false} />);
    return lines;
  };

  // Get current selected data for Inspector
  const activeZone = selectedEntity?.type === 'ZONE' || selectedEntity?.type === 'SLOT' ? zones.find(z => z.id === (selectedEntity as any).zoneId || z.id === (selectedEntity as any).id) : null;
  const activeSlot = selectedEntity?.type === 'SLOT' ? activeZone?.slots.find(s => s.id === selectedEntity.slotId) : null;
  const activeGate = selectedEntity?.type === 'GATE' ? gates.find(g => g.id === (selectedEntity as any).id) : null;
  const validVehicleTypes = vehicleTypes.filter(v => v.category === activeFloor?.type);

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden font-sans">

      {/* COLUMN 2: MAIN CANVAS WORKSPACE (~75%) */}
      <div className="flex-1 relative cursor-grab active:cursor-grabbing bg-gray-200" ref={containerRef}>
        {containerSize.width > 0 && containerSize.height > 0 && (
          <Stage
            width={containerSize.width}
            height={containerSize.height}
            draggable
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            onWheel={(e) => {
              e.evt.preventDefault();
              const scaleBy = 1.05;
              const stage = e.target.getStage();
              if (!stage) return;
              const oldScale = stage.scaleX();
              const pointer = stage.getPointerPosition();
              if (!pointer) return;

              const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
              };

              let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
              newScale = Math.max(defaultScale, Math.min(newScale, 5));

              setStageScale(newScale);
              setStagePos({
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
              });
            }}
            ref={stageRef}
            onClick={(e) => {
              if (e.target === e.target.getStage() || e.target.name() === 'bg') {
                setSelectedEntity(null);
              }
            }}
          >
            <Layer>
              {drawGrid()}
            </Layer>

            <Layer>
              {/* Draw Zones & Slots */}
              {visibleZones.map((zone) => {
                const { width: slotW, height: slotH } = getVehicleDimensions(zone.vehicleTypeId, vehicleTypes);
                const isZoneSelected = selectedEntity?.type === 'ZONE' && (selectedEntity as any).id === zone.id;
                const isSlotSelectedInZone = selectedEntity?.type === 'SLOT' && selectedEntity.zoneId === zone.id;
                const isSelected = isZoneSelected || isSlotSelectedInZone;

                const zoneW = zone.capacity * slotW;
                const zoneH = slotH;

                return (
                  <Group
                    key={`zone-${zone.id}`}
                    name="zoneGroup"
                    x={zone.layoutX}
                    y={zone.layoutY}
                    rotation={zone.rotation}
                    draggable
                    onDragMove={(e) => handleDragMove(e, zone.id, true)}
                    onDragEnd={(e) => handleDragEnd(e, zone.id, true)}
                  >
                    {/* Zone Bounding Box */}
                    <Rect
                      width={zoneW} height={zoneH}
                      fill={isZoneSelected ? 'rgba(59, 130, 246, 0.15)' : (zone.functionType === 'WALK_IN' ? 'rgba(186, 230, 253, 0.4)' : zone.functionType === 'MONTHLY' ? 'rgba(167, 243, 208, 0.4)' : 'rgba(241, 245, 249, 0.6)')}
                      stroke={collidingNodeId === String(zone.id) ? '#ef4444' : (isZoneSelected ? '#3b82f6' : '#64748b')}
                      strokeWidth={isZoneSelected ? 3 : 2}
                      dash={collidingNodeId === String(zone.id) ? [10, 5] : []}
                      onClick={(e) => { e.cancelBubble = true; setSelectedEntity({ type: 'ZONE', id: zone.id }); if (!expandedKeys.includes('2')) setExpandedKeys(p => [...p, '2']); }}
                      onTap={(e) => { e.cancelBubble = true; setSelectedEntity({ type: 'ZONE', id: zone.id }); }}
                    />

                    {/* Slots within Zone */}
                    {zone.slots.map((slot, i) => {
                      const xPos = i * slotW;
                      const isThisSlotSelected = selectedEntity?.type === 'SLOT' && selectedEntity.slotId === slot.id;

                      let slotFill = 'transparent';
                      if (slot.status === 'OCCUPIED') slotFill = '#fecaca'; // Match Staff Screen
                      else if (slot.status === 'DISABLED') slotFill = '#f1f5f9'; // Gray
                      else if (slot.status === 'EMPTY' && isThisSlotSelected) slotFill = '#eff6ff'; // Light blue highlight
                      else slotFill = 'transparent'; // Match Staff Screen

                      let vtIconUrl = '';
                      if (vehicleTypes) {
                        const zoneVt = vehicleTypes.find((v: any) => v.id === zone.vehicleTypeId);
                        if (zoneVt?.iconUrl) vtIconUrl = getImageUrl(zoneVt.iconUrl);
                      }

                      return (
                        <Group
                          key={slot.id}
                          x={xPos}
                          y={0}
                          onClick={(e) => {
                            e.cancelBubble = true;
                            if (isZoneSelected) {
                              setSelectedEntity({ type: 'SLOT', zoneId: zone.id, slotId: slot.id });
                              if (!expandedKeys.includes('3')) setExpandedKeys(p => [...p, '3']);
                            } else {
                              setSelectedEntity({ type: 'ZONE', id: zone.id });
                              if (!expandedKeys.includes('2')) setExpandedKeys(p => [...p, '2']);
                            }
                          }}
                        >
                          <Rect
                            width={slotW} height={slotH}
                            fill={slotFill}
                            stroke={isThisSlotSelected ? '#2563eb' : '#94a3b8'}
                            strokeWidth={isThisSlotSelected ? 3 : 2}
                          />
                          {/* Disabled Crosshatch pattern mock using lines */}
                          {slot.status === 'DISABLED' && (
                            <Line points={[0, 0, slotW, slotH]} stroke="#cbd5e1" strokeWidth={2} listening={false} />
                          )}

                          <KonvaText
                            x={0} y={slot.status === 'OCCUPIED' ? slotH / 2 + 5 : slotH / 2 - 8}
                            width={slotW}
                            align="center"
                            text={slot.name}
                            fontSize={16}
                            fill={slot.status === 'DISABLED' ? '#94a3b8' : '#334155'}
                            fontStyle="bold"
                            listening={false}
                          />
                          {slot.status === 'OCCUPIED' && (
                            vtIconUrl ? (
                              <URLImage src={vtIconUrl} x={slotW / 2 - 16} y={slotH / 2 - 25} width={32} height={32} />
                            ) : (
                              <KonvaText
                                x={0} y={slotH / 2 - 25}
                                width={slotW}
                                align="center"
                                text="🚗"
                                fontSize={28}
                                listening={false}
                              />
                            )
                          )}
                          {slot.status === 'OCCUPIED' && slot.plate && (
                            <KonvaText
                              x={0} y={slotH / 2 + 22}
                              width={slotW}
                              align="center"
                              text={slot.plate}
                              fontSize={12}
                              fill="#ef4444"
                              fontStyle="bold"
                              listening={false}
                            />
                          )}
                        </Group>
                      );
                    })}

                    {/* Zone Name Top-Left (Inside) */}
                    <Label x={5} y={5} listening={false}>
                      <Tag fill="rgba(255, 255, 255, 0.95)" cornerRadius={6} shadowColor="black" shadowBlur={4} shadowOpacity={0.15} shadowOffset={{ x: 0, y: 2 }} />
                      <KonvaText
                        text={`${zone.name} ${zone.activeReservationsCount ? `(Res: ${zone.activeReservationsCount})` : ''}`}
                        fontSize={18}
                        fontFamily="sans-serif"
                        fill={isSelected ? '#2563eb' : '#0f172a'}
                        fontStyle="bold"
                        padding={6}
                      />
                    </Label>
                  </Group>
                );
              })}

              {/* Draw Gates */}
              {visibleGates.map((gate) => {
                let gateW = 3 * GRID_SIZE;
                const gateH = GRID_SIZE;
                if (gate.vehicleTypeId) {
                  const vt = vehicleTypes.find(v => v.id === gate.vehicleTypeId);
                  if (vt) gateW = vt.matrixWidth * GRID_SIZE;
                }
                const isSelected = selectedEntity?.type === 'GATE' && (selectedEntity as any).id === gate.id;
                const gateColor = gate.status === 'OCCUPIED' ? '#059669' : '#94a3b8'; // emerald if OCCUPIED, slate if IDLE

                return (
                  <Group
                    key={`gate-${gate.id}`}
                    name="gateGroup"
                    x={gate.layoutX}
                    y={gate.layoutY}
                    rotation={gate.rotation}
                    draggable
                    onDragMove={(e) => handleDragMove(e, gate.id, false)}
                    onDragEnd={(e) => handleDragEnd(e, gate.id, false)}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      setSelectedEntity({ type: 'GATE', id: gate.id });
                      if (!expandedKeys.includes('4')) setExpandedKeys(p => [...p, '4']);
                    }}
                  >
                    <Rect
                      width={gateW} height={gateH}
                      fill={gateColor}
                      stroke={collidingNodeId === gate.id ? '#ef4444' : (isSelected ? '#facc15' : '#047857')}
                      dash={collidingNodeId === gate.id ? [10, 5] : []}
                      strokeWidth={isSelected ? 4 : 2}
                      cornerRadius={6}
                      shadowColor="black"
                      shadowBlur={6}
                      shadowOpacity={0.3}
                      shadowOffset={{ x: 0, y: 3 }}
                    />
                    <KonvaText
                      x={0} y={gateH / 2 - 6}
                      width={gateW}
                      align="center"
                      text={`[GATE] ${gate.name}`}
                      fontSize={14}
                      fontStyle="bold"
                      fill="#ffffff"
                      listening={false}
                    />
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        )}
      </div>

      {/* COLUMN 3: RIGHT INSPECTOR PANEL (~25%) */}
      <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full shadow-[-4px_0_15px_rgba(0,0,0,0.05)] z-10 shrink-0">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-slate-50 flex items-center justify-between shrink-0">
          <Title level={5} className="m-0 text-slate-800 flex items-center">
            <CompassOutlined className="mr-2 text-blue-600" />  Configuration Bar
          </Title>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
          <Collapse
            ghost
            expandIconPosition="end"
            activeKey={expandedKeys}
            onChange={(keys) => setExpandedKeys(keys as string[])}
            className="bg-white"
          >
            {/* --- SECTION 0: VIEWPORT --- */}
            <Panel header={<Text strong>0e Vision & Navigation</Text>} key="0" className="border-b border-gray-100">
              <Button size="small" block icon={<AimOutlined />} className="mb-3" onClick={() => handleZoomToBox(0, 0, mapCols * GRID_SIZE, mapRows * GRID_SIZE)}>

                Panoramic Zoom
              </Button>
              <Text type="secondary" className="text-xs mb-1 block">Go to Zone:</Text>
              <Select
                size="small"
                className="w-full"
                placeholder="Select Zoneeee"
                onChange={handleZoomZone}
                value={selectedEntity?.type === 'ZONE' ? (selectedEntity as any).id : undefined}
              >
                {visibleZones.map(z => <Select.Option key={z.id} value={z.id}>{z.name}</Select.Option>)}
              </Select>
            </Panel>

            {/* --- SECTION 1: FLOOR CONFIG --- */}
            <Panel header={<Text strong>1. Management Floor (Floor)</Text>} key="1" className="border-b border-gray-100 bg-slate-50/50">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Select
                    size="small"
                    className="flex-1"
                    value={selectedFloorId}
                    onChange={(v) => setSelectedFloorId(v)}
                  >
                    {floors.map(f => <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>)}
                  </Select>
                  <div className="flex space-x-2">
                    <Button size="small" icon={<PlusOutlined />} onClick={() => {
                      const newId = Date.now();
                      setFloors(prev => [...prev, { id: newId, name: `New Floor`, type: 'FOUR_WHEEL', mapCols: 60, mapRows: 40 }]);
                      setSelectedFloorId(newId);
                    }}>More</Button>
                    <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                      Save Floor
                    </Button>
                  </div>
                </div>
                {floors.find(f => f.id === selectedFloorId) && (
                  <div className="space-y-3">
                    <div>
                      <Text className="text-xs text-gray-500 block mb-1">Floor Name:</Text>
                      <Input
                        size="small"
                        value={floors.find(f => f.id === selectedFloorId)?.name}
                        onChange={(e) => setFloors(prev => prev.map(f => f.id === selectedFloorId ? { ...f, name: e.target.value } : f))}
                      />
                    </div>
                    <div>
                      <Text className="text-xs text-gray-500 block mb-1">Floor characteristics (Limited to vehicle type):</Text>
                      <Select
                        size="small"
                        value={floors.find(f => f.id === selectedFloorId)?.type}
                        className="w-full"
                        onChange={(v) => {
                          setFloors(prev => prev.map(f => f.id === selectedFloorId ? { ...f, type: v as 'FOUR_WHEEL' | 'TWO_WHEEL' } : f));
                        }}
                      >
                        <Select.Option value="FOUR_WHEEL">Floor Car (4 wheels)</Select.Option>
                        <Select.Option value="TWO_WHEEL">Floor Motorcycle (2 wheels)</Select.Option>
                      </Select>
                    </div>
                  </div>
                )}
                <div>
                  <Text className="text-xs text-gray-500 block mb-1">Matrix size (Cell):</Text>
                  <div className="flex items-center space-x-2">
                    <InputNumber size="small" min={1} max={55} value={mapCols} onChange={v => v && handleUpdateMapSize(v, mapRows)} className="w-20" />
                    <Text type="secondary">x</Text>
                    <InputNumber size="small" min={1} max={40} value={mapRows} onChange={v => v && handleUpdateMapSize(mapCols, v)} className="w-20" />
                  </div>
                </div>
              </div>
            </Panel>

            {/* --- SECTION 2: ZONE CONFIG --- */}
            <Panel
              header={<div className="flex justify-between items-center w-full pr-4">
                <Text strong>2. Parking Zone (Zone)</Text>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); handleAddZone(); }} />
              </div>}
              key="2"
              className="border-b border-gray-100"
            >
              {activeZone ? (
                <div className="space-y-4">
                  <div className="p-2 bg-blue-50 border border-blue-100 rounded flex justify-between items-center">
                    <Text strong className="text-blue-700">
                      <Input
                        value={activeZone.name}
                        size="small"
                        variant="borderless"
                        className="font-bold text-blue-700 p-0"
                        onChange={(e) => setZones(prev => prev.map(z => z.id === activeZone.id ? { ...z, name: e.target.value } : z))}
                      />
                    </Text>
                  </div>

                  <div>
                    <Text className="text-xs text-gray-500 block mb-1">Zone function:</Text>
                    <Select
                      size="small" className="w-full" value={activeZone.functionType}
                      onChange={v => {
                        const hasOccupied = activeZone.slots.some(s => s.status === 'OCCUPIED');
                        if (hasOccupied) {
                          message.error("Cannot change Zone function because there are vehicles parked in this Zone!");
                          return;
                        }
                        setZones(prev => prev.map(z => z.id === activeZone.id ? { ...z, functionType: v } : z));
                      }}
                    >
                      <Select.Option value="WALK_IN">Walk-in</Select.Option>
                      <Select.Option value="MONTHLY">Monthly Pass (Monthly)</Select.Option>
                      <Select.Option value="BACKUP">Backup</Select.Option>
                    </Select>
                  </div>

                  <div>
                    <Text className="text-xs text-gray-500 block mb-1">Vehicle Type:</Text>
                    <Select
                      size="small" className="w-full" value={activeZone.vehicleTypeId}
                      onChange={v => {
                        const hasOccupied = activeZone.slots.some(s => s.status === 'OCCUPIED');
                        if (hasOccupied) {
                          message.error("Cannot change Vehicle Type because there are vehicles parked in this Zone!");
                          return;
                        }
                        setZones(prev => prev.map(z => z.id === activeZone.id ? { ...z, vehicleTypeId: v } : z));
                      }}
                    >
                      {validVehicleTypes.map(vt => (
                        <Select.Option key={vt.id} value={vt.id}>
                          {vt.iconUrl ? <img src={getImageUrl(vt.iconUrl)} style={{ width: 16, height: 16, marginRight: 8, objectFit: 'contain', display: 'inline-block' }} /> : null}
                          {vt.typeName}
                        </Select.Option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Text className="text-xs text-gray-500 block mb-1">Parking Quantity (reduces to 0 to delete):</Text>
                    <InputNumber
                      size="small" min={0} max={100} value={activeZone.capacity} className="w-full"
                      onChange={v => {
                        if (v === 0) {
                          Modal.confirm({
                            title: 'Confirm delete Zone',
                            content: 'are you sure you want to delete this Zone',
                            okText: 'Delete',
                            cancelText: 'Cancel',
                            onOk: () => {
                              setZones(prev => prev.filter(z => z.id !== activeZone.id));
                              setSelectedEntity(null);
                            }
                          });
                        } else if (v !== null && v !== undefined) {
                          handleUpdateZoneCapacity(activeZone.id, v);
                        }
                      }}
                    />
                  </div>

                  <Button block icon={<SyncOutlined />} onClick={() => handleRotateZone(activeZone.id)}>
                    Xoay Zone 90°
                  </Button>
                </div>
              ) : (
                <div className="py-4 text-center text-gray-400 italic text-sm">

                  Click on a Zone on the map to configure it
                </div>
              )}
            </Panel>

            {/* --- SECTION 3: SLOT CONFIG --- */}
            <Panel header={<Text strong>3e Single Slot (Slot)</Text>} key="3" className="border-b border-gray-100 bg-slate-50/50">
              {activeSlot && activeZone ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-white border border-gray-200 rounded">
                    <Text strong className="text-lg">{activeSlot.name}</Text>
                    <Badge status={activeSlot.status === 'EMPTY' ? 'success' : (activeSlot.status === 'OCCUPIED' ? 'error' : 'default')} text={activeSlot.status} />
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <Text>normal active:</Text>
                    <Switch
                      checked={activeSlot.status !== 'DISABLED'}
                      onChange={(checked) => handleToggleSlotStatus(activeZone.id, activeSlot.id, checked ? 'EMPTY' : 'DISABLED')}
                    />
                  </div>
                  <Text type="secondary" className="text-xs italic block mt-1">

                    * Turn off the switch to switch to Maintenance mode. Maintenance is not possible if the vehicle is in use
                  </Text>
                </div>
              ) : (
                <div className="py-4 text-center text-gray-400 italic text-sm">

                  Double click on a Slot to configure it separately
                </div>
              )}
            </Panel>

            {/* --- SECTION 4: GATE COMMAND CENTER --- */}
            <Panel
              header={<div className="flex justify-between items-center w-full pr-4">
                <Text strong className={activeGate ? "text-amber-600" : ""}>4e Gate Information (Gate)</Text>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); handleAddGate(); }} />
              </div>}
              key="4"
            >
              {activeGate ? (
                <div className="space-y-4">
                  <div className={`p-3 rounded border ${activeGate.status === 'OCCUPIED' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="flex items-center mb-1">
                      <GatewayOutlined className="mr-2 text-lg" />
                      <Input
                        value={activeGate.name}
                        size="small"
                        variant="borderless"
                        className="font-bold p-0"
                        onChange={(e) => setGates(prev => prev.map(g => g.id === activeGate.id ? { ...g, name: e.target.value } : g))}
                      />
                    </div>
                    <Text className="text-xs block mt-2 text-gray-500">

                      * Gate function (Enter/Exit) and Vehicle Type will be chosen by the Staff when closing the shift at this gate
                    </Text>
                    <div className="mt-3">
                      <Text className="text-xs block mb-1">
                        Current status: <Text strong className={activeGate.status === 'OCCUPIED' ? 'text-amber-600' : 'text-emerald-600'}>{activeGate.status}</Text>
                      </Text>
                      <Text className="text-xs block mb-1">
                        Function: <Text strong>{activeGate.type === 'ENTRY' ? 'Entry Only (ENTRY)' : activeGate.type === 'EXIT' ? 'Exit Only (EXIT)' : 'Flexible Entry/Exit'}</Text>
                      </Text>
                      {activeGate.staffName ? (
                        <Text className="text-xs block text-blue-600">Staff on duty: <Text strong>{activeGate.staffName}</Text></Text>
                      ) : (
                        <div className="bg-gray-50 p-2 rounded border border-gray-200 text-center">
                          <Text className="text-xs text-gray-400 italic">Empty (Shift not opened)</Text>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    danger
                    block
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      Modal.confirm({
                        title: 'Confirm Delete Gate',
                        content: 'Are you sure you want to delete this Gate? This is a soft delete, old data will not be lost.',
                        okText: 'Delete',
                        cancelText: 'Cancel',
                        onOk: () => {
                          setGates(prev => prev.filter(g => g.id !== activeGate.id));
                          setSelectedEntity(null);
                        }
                      });
                    }}
                  >
                    Delete Gate (Soft Delete)
                  </Button>
                </div>
              ) : (
                <div className="py-4 text-center text-gray-400 italic text-sm">

                  Click on the Gate icon on the map border to operate
                </div>
              )}
            </Panel>

            {/* --- SECTION 5: PATROL GATES --- */}
            <Panel
              header={<div className="flex justify-between items-center w-full pr-4">
                <Text strong>5e Patrol Gates</Text>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); handleAddPatrolGate(); }} />
              </div>}
              key="5"
            >
              <div className="space-y-2">
                {gates.filter(g => g.type === 'PATROL' && g.floorId === selectedFloorId && g.status !== 'DELETED').length > 0 ? (
                  gates.filter(g => g.type === 'PATROL' && g.floorId === selectedFloorId && g.status !== 'DELETED').map(g => (
                    <div key={g.id} className="flex justify-between items-center bg-white p-2 border border-gray-200 rounded">
                      <div className="flex-1 min-w-0">
                        <Input
                          value={g.name}
                          size="small"
                          variant="borderless"
                          className="font-bold p-0"
                          onChange={(e) => setGates(prev => prev.map(gate => gate.id === g.id ? { ...gate, name: e.target.value } : gate))}
                        />
                        {g.status === 'OCCUPIED' && (
                          <div className="text-xs text-amber-600 font-medium mt-0.5">
                            🟡 Nhân viên đang trực — không thể block
                          </div>
                        )}
                        {g.status === 'MAINTENANCE' && (
                          <div className="text-xs text-red-600 font-medium mt-0.5">
                            🔴 Đang bị block (Không thể chọn)
                          </div>
                        )}
                      </div>
                      {g.status === 'MAINTENANCE' ? (
                        <Button
                          type="text"
                          className="text-green-600"
                          size="small"
                          icon={<UnlockOutlined />}
                          title="Unblock patrol gate"
                          onClick={() => setGates(prev => prev.map(gate => gate.id === g.id ? { ...gate, status: 'IDLE' } : gate))}
                        />
                      ) : (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<LockOutlined />}
                          disabled={g.status === 'OCCUPIED'}
                          title={g.status === 'OCCUPIED' ? 'Cannot block: staff currently on duty' : 'Block patrol gate'}
                          onClick={() => {
                            Modal.confirm({
                              title: 'Confirm Block Patrol Gate',
                              content: 'Are you sure you want to block this Patrol Gate? Staff will not be able to select it for patrol.',
                              okText: 'Block',
                              cancelText: 'Cancel',
                              onOk: () => setGates(prev => prev.map(gate => gate.id === g.id ? { ...gate, status: 'MAINTENANCE' } : gate))
                            });
                          }}
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 italic text-xs py-2">
                    No patrol gates for this floor
                  </div>
                )}
                <Text className="text-xs block mt-2 text-gray-500">
                  * Patrol gates do not appear on the map and are used by staff when patrolling this floor.
                </Text>
              </div>
            </Panel>
          </Collapse>
        </div>

        {/* BOTTOM ACTION */}
        <div className="p-4 border-t border-gray-200 bg-white shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
          <Button
            type="primary"
            size="large"
            block
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={!isDirty}
            className="bg-blue-600 hover:bg-blue-700 h-12 text-base font-medium shadow-md"
          >

            SAVE CONFIGURATION
          </Button>
        </div>

      </div>
    </div>
  );
};
