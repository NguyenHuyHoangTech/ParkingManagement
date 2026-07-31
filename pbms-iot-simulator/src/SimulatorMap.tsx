/**
 * ============================================================================
 * [IMPORT LIBRARIES & UTILITIES] - Các thư viện và công cụ tiện ích
 * ============================================================================
 * 1. React Hooks: `useState`/`useEffect`/`useRef` quản lý trạng thái zoom/pan;
 *    `forwardRef` + `useImperativeHandle` là cặp đôi bắt buộc để component CHA
 *    (`App.tsx`) có thể "thò tay" gọi thẳng 2 hàm zoom nội bộ của component
 *    này (`handleZoomFit`/`handleZoomZone`) — bình thường React chỉ cho cha
 *    truyền dữ liệu XUỐNG con qua props, cặp hook này là cách hợp lệ để làm
 *    NGƯỢC LẠI (con "lộ" hàm ra cho cha gọi).
 * 2. react-konva: thư viện vẽ Canvas 2D kiểu khai báo (declarative) cho React
 *    — `Stage` là khung vẽ gốc (kéo/phóng to được), `Layer` là 1 lớp vẽ độc
 *    lập (tách riêng Layer lưới nền và Layer Zone/Gate để tối ưu tốc độ vẽ
 *    lại), `Group` gom nhiều hình thành 1 khối dịch chuyển/xoay cùng nhau,
 *    `Rect`/`Line`/`Text` là các hình cơ bản, `Label`+`Tag` là khung chữ có
 *    nền (dùng hiển thị tên Zone nổi trên bản đồ).
 * 3. konva: thư viện lõi (react-konva chỉ là lớp bọc React cho nó) — dùng
 *    trực tiếp `Konva.Tween` để tạo hiệu ứng chuyển động mượt khi zoom tới
 *    1 Zone cụ thể (không nhảy vị trí đột ngột).
 * ============================================================================
 */
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Line, Group, Rect, Text as KonvaText, Label, Tag } from 'react-konva';
import Konva from 'konva';

// Kích thước 1 ô lưới (pixel) — đơn vị quy đổi DUY NHẤT cho mapCols/mapRows,
// layoutX/layoutY và kích thước Zone/Gate trong toàn bộ file này.
const GRID_SIZE = 50;

/**
 * ============================================================================
 * [HÀM NỘI BỘ] TRA KÍCH THƯỚC (PIXEL) CỦA 1 Ô ĐỖ THEO LOẠI XE
 * ============================================================================
 * MỤC ĐÍCH: mỗi loại xe (`vehicleTypes`) có `matrixWidth`/`matrixHeight` riêng
 * (số ô lưới chiếm dụng theo chiều rộng/cao) — hàm này quy đổi ra kích thước
 * pixel thật để vẽ đúng tỉ lệ trên Konva Stage.
 *
 * Không tìm thấy loại xe (`typeId` không khớp bản ghi nào trong `vehicleTypes`)
 * -> dùng mặc định 3x6 ô lưới (kích thước xe 4 bánh tiêu chuẩn) để tránh vẽ ra
 * 1 ô kích thước 0 (vô hình, không bấm được).
 * ============================================================================
 */
const getVehicleDimensions = (typeId: any, vehicleTypes: any) => {
  const type = vehicleTypes.find((v: any) => v.id === typeId);
  if (type) {
    const w = type.matrixWidth || 3;
    const h = type.matrixHeight || 6;
    return { width: w * GRID_SIZE, height: h * GRID_SIZE };
  }
  return { width: 3 * GRID_SIZE, height: 6 * GRID_SIZE };
};

/**
 * ============================================================================
 * MÔ TẢ TỔNG QUAN VỀ VAI TRÒ & KIẾN TRÚC CỦA SIMULATOR MAP
 * ============================================================================
 *
 * [PHẦN 1] MỤC ĐÍCH & VAI TRÒ CỦA COMPONENT:
 *    - Vẽ lại y hệt sơ đồ bãi xe (Zone/Slot/Gate) mà `SpaceMapScreen.tsx` bên
 *      `pbms-fe` hiển thị cho quản lý — nhưng ở đây phục vụ mục đích khác:
 *      cho phép người test BẤM TRỰC TIẾP vào 1 ô đỗ (Slot) để giả lập cảm
 *      biến báo "có xe" / "hết xe" (`toggleSlot`), thay vì phải gọi Postman
 *      thủ công từng lần.
 *    - Component THUẦN HIỂN THỊ + tương tác zoom/pan — không tự gọi API, toàn
 *      bộ dữ liệu (`floors`/`zones`/`gates`/`slots`/`vehicleTypes`) đều nhận
 *      qua props từ `App.tsx` (nơi polling `/data-sync` mỗi 2 giây).
 *
 * [PHẦN 2] KIẾN TRÚC ZOOM/PAN KÈM MINH CHỨNG:
 *
 * BƯỚC 1: ĐO KHUNG CHỨA THẬT BẰNG ResizeObserver
 * - Minh chứng: `useEffect` (dòng ~101) dùng `ResizeObserver`, KHÔNG dùng sự
 *   kiện `window.resize` — vì khung chứa bản đồ có thể tự đổi kích thước (VD:
 *   người dùng thu gọn Sidebar bên `App.tsx`/`DashboardLayout`) mà không hề
 *   đổi kích thước toàn bộ cửa sổ trình duyệt.
 *
 * BƯỚC 2: TỰ TÍNH TỈ LỆ ZOOM "VỪA KHÍT" (`defaultScale`)
 * - Minh chứng: `useEffect` thứ 2 (dòng ~120) tính `scale` sao cho toàn bộ
 *   `mapCols x mapRows` lọt gọn trong khung chứa (nhân thêm 0.95 để chừa viền
 *   trắng xung quanh), rồi CĂN GIỮA bản đồ. Giá trị này đồng thời là NGƯỠNG
 *   ZOOM RA TỐI ĐA — `handleZoom`/cuộn chuột không cho zoom nhỏ hơn mức này,
 *   tránh bản đồ bé tí không nhìn rõ được gì.
 *
 * BƯỚC 3: LỘ 2 HÀM ZOOM RA CHO COMPONENT CHA GỌI (forwardRef)
 * - Minh chứng: `useImperativeHandle` (dòng ~91) đăng ký `handleZoomFit` (zoom
 *   vừa khít toàn bản đồ, dùng cho nút "Fit to Screen") và `handleZoomZone`
 *   (zoom mượt tới đúng 1 Zone, dùng cho dropdown "Zoom to Zone") — cả 2 đều
 *   được `App.tsx` gọi qua `mapRef.current.handleZoomFit()`.
 *
 * [PHẦN 3] LƯU Ý — 2 KHÁC BIỆT CÓ CHỦ ĐÍCH SO VỚI `SpaceMapScreen.tsx` (pbms-fe):
 *    1. Component này KHÔNG tự tính toán vị trí Slot bên trong Zone theo đúng
 *       công thức xoay 4 hướng (0/90/180/270) như bản quản lý — nó dựa vào
 *       `rotation` của Konva `Group` để tự xoay hình ảnh quanh điểm gốc (x, y),
 *       nên chỉ cần tính kích thước Zone theo dạng CHƯA XOAY (0 độ) rồi để
 *       Konva xoay hộ. Đây là cách đơn giản hơn, phù hợp cho công cụ test —
 *       không phải thiếu sót.
 *    2. Object Gate ở đây đến từ endpoint `/data-sync` (IotHardwareController)
 *       — KHÁC HẲN `GateConfigDTO` mà `SpaceMapScreen.tsx` dùng. Cụ thể: Gate
 *       ở đây có cờ `hasStaff` (boolean) thay vì `status` (string). Trước đây
 *       code từng so `gate.status === 'OCCUPIED'` — một trường KHÔNG TỒN TẠI
 *       trong payload này — khiến Gate không bao giờ đổi màu xanh dù có nhân
 *       viên trực thật; đã sửa lại dùng đúng `gate.hasStaff`. Tương tự,
 *       `layoutX`/`layoutY`/`rotation` của Gate từng bị Backend bỏ sót khi
 *       dựng `/data-sync` (khác với Zone, luôn có đủ 3 trường này) khiến MỌI
 *       Gate bị vẽ dồn về toạ độ mặc định (0,0) — nay Backend đã bổ sung đủ.
 * ============================================================================
 */
export const SimulatorMap = forwardRef(({ floors, zones, gates, slots, vehicleTypes, selectedFloorId, toggleSlot }: any, ref: any) => {
  const activeFloor = floors.find((f: any) => f.id === selectedFloorId);
  const mapCols = activeFloor?.mapCols || 60;
  const mapRows = activeFloor?.mapRows || 40;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [defaultScale, setDefaultScale] = useState(1);

  // Chỉ vẽ Zone/Gate thuộc ĐÚNG tầng đang được chọn xem (`selectedFloorId`) —
  // dữ liệu `zones`/`gates` truyền vào chứa TOÀN BỘ các tầng, phải tự lọc ở
  // đây trước khi render.
  const visibleZones = zones.filter((z: any) => z.floorId === selectedFloorId);
  const visibleGates = gates.filter((g: any) => g.floorId === selectedFloorId);

  /**
   * ============================================================================
   * [LỘ HÀM ZOOM RA NGOÀI] - forwardRef + useImperativeHandle
   * ============================================================================
   * Cho phép component cha (`App.tsx`) gọi thẳng `mapRef.current.handleZoomFit()`
   * hoặc `mapRef.current.handleZoomZone(id)` — dù bản thân 2 hàm đó không phải
   * props truyền vào mà là hàm NỘI BỘ khai báo bên dưới trong cùng component
   * này. Việc tham chiếu tới 2 hàm khai báo ở dòng SAU vẫn hoạt động bình
   * thường vì `useImperativeHandle` chỉ thực sự ĐỌC giá trị của chúng lúc React
   * gọi hàm callback này, không phải ngay lúc dòng code này chạy.
   * ============================================================================
   */
  useImperativeHandle(ref, () => ({
    handleZoomFit,
    handleZoomZone
  }));

  /**
   * ============================================================================
   * [ĐO KHUNG CHỨA] - ResizeObserver theo dõi kích thước thật của khung bản đồ
   * ============================================================================
   * Không dùng sự kiện `window.resize` của trình duyệt vì khung chứa bản đồ
   * này có thể tự đổi kích thước (VD: người dùng thu gọn Sidebar bên ngoài)
   * MÀ KHÔNG hề đổi kích thước toàn bộ cửa sổ trình duyệt — `ResizeObserver`
   * theo dõi đúng phần tử DOM cụ thể (`containerRef.current`) nên bắt được cả
   * những thay đổi kiểu này.
   * ============================================================================
   */
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  /**
   * ============================================================================
   * [TỰ ĐỘNG TÍNH LẠI TỈ LỆ ZOOM "VỪA KHÍT"] - Chạy lại khi đổi tầng/đổi khung
   * ============================================================================
   * MÃ GIẢ (PSEUDO-CODE LÕI):
   * B1: Tính kích thước pixel thật của toàn bản đồ (`mapCols`/`mapRows` x
   *     `GRID_SIZE`).
   * B2: Tính tỉ lệ zoom sao cho toàn bộ bản đồ lọt gọn trong khung chứa, nhân
   *     thêm hệ số 0.95 để chừa viền trắng xung quanh cho đẹp mắt.
   * B3: `Math.min(scale, 1)` chặn KHÔNG cho tỉ lệ mặc định vượt quá 100% —
   *     bản đồ nhỏ hơn khung thì hiển thị đúng kích thước thật, không tự động
   *     phóng to quá mức gây khó nhìn.
   * B4: Lưu tỉ lệ này làm `defaultScale` (đồng thời là NGƯỠNG zoom ra xa nhất
   *     cho phép ở mọi thao tác zoom khác), rồi CĂN GIỮA bản đồ trong khung.
   * ============================================================================
   */
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

  /**
   * ============================================================================
   * [NÚT FIT TO SCREEN] - Zoom về đúng tỉ lệ "vừa khít" toàn bản đồ
   * ============================================================================
   * Về bản chất là PHÉP TÍNH GIỐNG HỆT effect ở trên, nhưng đóng gói thành 1
   * hàm gọi được THỦ CÔNG qua nút bấm "Fit to Screen" ở `App.tsx`. Dùng
   * `clientWidth`/`clientHeight` đọc TRỰC TIẾP từ DOM (thay vì state
   * `containerSize`) vì hàm này có thể được gọi bất cứ lúc nào từ bên ngoài,
   * không phụ thuộc vào chu kỳ render của effect phía trên.
   * ============================================================================
   */
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

  /**
   * ============================================================================
   * [HÀM NỘI BỘ] ZOOM MƯỢT (TWEEN) TỚI 1 VÙNG HÌNH CHỮ NHẬT CHO TRƯỚC
   * ============================================================================
   * Dùng chung bởi `handleZoomZone` bên dưới — nhận toạ độ + kích thước 1 vùng
   * (tính theo hệ toạ độ bản đồ, CHƯA nhân tỉ lệ zoom), rồi tính tỉ lệ zoom
   * mới sao cho vùng đó (cộng thêm `padding` mỗi bên) lấp đầy khung chứa, và
   * tâm vùng đó nằm giữa màn hình.
   *
   * `newScale` bị kẹp trong khoảng [`defaultScale`, 4] — không cho zoom nhỏ
   * hơn mức vừa khít ban đầu, cũng không cho zoom quá 400% (nhìn vỡ hạt).
   * Dùng `Konva.Tween` để tạo hiệu ứng chuyển động mượt (0.5 giây, easing
   * EaseInOut) thay vì camera "nhảy" đột ngột tới vị trí mới.
   * ============================================================================
   */
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

  /**
   * ============================================================================
   * [DROPDOWN ZOOM TO ZONE] - Zoom mượt tới đúng 1 Zone theo `zoneId`
   * ============================================================================
   * MÃ GIẢ (PSEUDO-CODE LÕI):
   * B1: Tìm Zone theo `zoneId` trong `visibleZones` (Zone thuộc tầng đang xem).
   *     Không tìm thấy thì dừng lại, không làm gì cả.
   * B2: Tính kích thước 1 ô đỗ theo loại xe của Zone, rồi suy ra tổng số ô
   *     thật (`zoneSlots` — ưu tiên lấy từ `zone.slots` nếu Backend đã trả
   *     sẵn, không thì tự lọc từ danh sách `slots` chung theo `zoneId`).
   * B3: `capacity` lấy giá trị LỚN HƠN giữa sức chứa khai báo và số ô thực tế
   *     tìm được, để không bị hụt khung nhìn nếu 2 số liệu lệch nhau.
   * B4: Nếu Zone xoay 90/270 độ, hoán đổi chiều rộng/cao (Zone nằm dọc thay vì
   *     ngang) — giống hệt cách tính ở phần vẽ Zone bên dưới, phải đồng bộ với
   *     nhau thì khung zoom mới khớp đúng hình vẽ thật.
   * B5: Bù trừ toạ độ góc trên-trái theo từng góc xoay, vì Konva `Group` xoay
   *     quanh điểm gốc (`layoutX`, `layoutY`) chứ không phải quanh tâm hình —
   *     phải TỰ tính lại góc trên-trái "hình dung" sau khi xoay, khác với lúc
   *     VẼ Zone (nơi Konva tự xoay hộ, không cần tính tay).
   * B6: Gọi `handleZoomToBox` với khung nhìn vừa tính, thêm đệm 100px mỗi bên
   *     cho Zone không dính sát mép màn hình.
   * ============================================================================
   */
  const handleZoomZone = (zoneId: number) => {
    const zone = visibleZones.find((z: any) => String(z.id) === String(zoneId));
    if (!zone) return;

    const { width: slotW, height: slotH } = getVehicleDimensions(zone.vehicleTypeId, vehicleTypes);

    const zoneSlots = (zone.slots && zone.slots.length > 0)
      ? zone.slots
      : slots.filter((s: any) => String(s.zoneId) === String(zone.id));

    const capacity = Math.max(zone.capacity || 0, zoneSlots.length);

    let zoneW = capacity * slotW;
    let zoneH = slotH;

    if (zone.rotation === 90 || zone.rotation === 270) {
      zoneW = slotH;
      zoneH = capacity * slotW;
    }

    let boxX = zone.layoutX || 0;
    let boxY = zone.layoutY || 0;
    if (zone.rotation === 90) boxX -= zoneW;
    else if (zone.rotation === 180) { boxX -= zoneW; boxY -= zoneH; }
    else if (zone.rotation === 270) boxY -= zoneH;

    handleZoomToBox(boxX, boxY, zoneW, zoneH, 100);
  };

  /**
   * ============================================================================
   * [VẼ LƯỚI NỀN] - Layer dưới cùng của bản đồ
   * ============================================================================
   * Vẽ 3 thứ, theo đúng thứ tự từ dưới lên: (1) 1 hình chữ nhật nền màu xám
   * nhạt phủ toàn bộ `mapCols x mapRows`, (2) các đường kẻ dọc/ngang cách nhau
   * đúng 1 ô lưới (`GRID_SIZE`) với độ mờ thấp (opacity 0.3) để không át hình
   * Zone/Gate vẽ ở Layer trên, (3) 1 đường viền đậm bao quanh toàn bộ bản đồ
   * để phân định rõ ranh giới bãi xe. Toàn bộ đường kẻ gắn `listening={false}`
   * để KHÔNG chặn sự kiện click/kéo của Stage (chỉ Zone/Slot/Gate mới cần bắt
   * sự kiện chuột, đường kẻ lưới chỉ để trang trí).
   * ============================================================================
   */
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

  return (
    <div className="flex-1 relative cursor-grab active:cursor-grabbing bg-[#f8fafc] h-full w-full rounded-xl overflow-hidden shadow-inner" ref={containerRef} style={{ minHeight: 'calc(100vh - 180px)' }}>
      {containerSize.width > 0 && containerSize.height > 0 && (
        <Stage
          width={containerSize.width}
          height={containerSize.height}
          draggable
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          /**
           * [ZOOM BẰNG CON LĂN CHUỘT] - Giữ nguyên điểm dưới con trỏ (zoom-to-cursor):
           * B1: Quy đổi vị trí con trỏ từ toạ độ màn hình sang toạ độ "bản đồ
           *     thật" tại tỉ lệ zoom CŨ (`mousePointTo`).
           * B2: Tính tỉ lệ zoom MỚI theo hướng lăn chuột (`deltaY < 0` nghĩa là
           *     lăn lên = zoom in), kẹp trong khoảng [`defaultScale`, 5].
           * B3: Tính lại vị trí Stage sao cho đúng điểm `mousePointTo` đó vẫn
           *     nằm dưới con trỏ ở tỉ lệ zoom MỚI — nếu bỏ qua bước này, mỗi
           *     lần zoom sẽ luôn "trôi" bản đồ về góc (0,0) thay vì giữ nguyên
           *     đúng chỗ người dùng đang nhìn/rê chuột tới.
           */
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
        >
          <Layer>
            {drawGrid()}
          </Layer>

          <Layer>
            {/*
             * ============================================================================
             * [VẼ ZONE + SLOT CON BÊN TRONG]
             * Zone CHƯA XOAY được tính theo chiều "ngang" (các Slot xếp thành
             * 1 hàng liên tiếp theo `capacity`), Konva `Group` sẽ tự xoay cả
             * khối theo `zone.rotation` khi vẽ ra màn hình — không cần tự tính
             * toạ độ Slot theo từng góc xoay như khi zoom tới Zone ở trên.
             * ============================================================================
             */}
            {visibleZones.map((zone: any) => {
              const { width: slotW, height: slotH } = getVehicleDimensions(zone.vehicleTypeId, vehicleTypes);
              // Ưu tiên `zone.slots` do Backend trả sẵn (đã lọc đúng Zone);
              // nếu Backend chưa gộp sẵn thì tự lọc từ mảng `slots` phẳng.
              const zoneSlots = (zone.slots && zone.slots.length > 0)
                ? zone.slots
                : slots.filter((s: any) => String(s.zoneId) === String(zone.id));

              // Lấy số lớn hơn giữa sức chứa khai báo và số Slot thực tế tìm
              // được, để khung Zone luôn đủ chỗ vẽ hết Slot dù 2 số liệu lệch.
              const capacity = Math.max(zone.capacity || 0, zoneSlots.length);

              const zoneW = capacity * slotW;
              const zoneH = slotH;

              return (
                <Group
                  key={`zone-${zone.id}`}
                  x={zone.layoutX || 0}
                  y={zone.layoutY || 0}
                  rotation={zone.rotation || 0}
                >
                  <Rect
                    width={zoneW || (3 * GRID_SIZE)} height={zoneH || (6 * GRID_SIZE)}
                    fill="transparent"
                    stroke="#94a3b8"
                    strokeWidth={1}
                  />

                  {/* [CÁC Ô SLOT TRONG ZONE] - Mỗi ô là 1 Group con, xếp cạnh
                      nhau theo chiều ngang (`xPos = i * slotW`). */}
                  {zoneSlots.map((slotConfig: any, i: number) => {
                    // `zoneSlots` có thể là bản chụp cấu hình cũ (từ zone.slots
                    // lúc load); tra lại trong `slots` (danh sách đang được
                    // App.tsx polling mỗi 2s qua /data-sync) để luôn lấy đúng
                    // trạng thái OCCUPIED/EMPTY/DISABLED MỚI NHẤT khi vẽ màu.
                    // Không tìm thấy (Slot mới, chưa kịp đồng bộ) thì tạm dùng
                    // luôn `slotConfig` để không vẽ lỗi.
                    const liveSlot = slots.find((s: any) => String(s.id) === String(slotConfig.id)) || slotConfig;
                    const xPos = i * slotW;

                    // Tô màu ô đỗ theo trạng thái: đỏ nhạt = có xe (OCCUPIED),
                    // xám = đang bảo trì (DISABLED), trắng = trống (mặc định).
                    let slotFill = '#ffffff';
                    let strokeColor = '#cbd5e1';
                    let shadowColor = 'transparent';
                    if (liveSlot.status === 'OCCUPIED') {
                      slotFill = '#fee2e2'; // Light red
                      strokeColor = '#ef4444';
                      shadowColor = '#ef4444';
                    } else if (liveSlot.status === 'DISABLED') {
                      slotFill = '#f1f5f9'; // Gray
                    }

                    return (
                      <Group
                        key={liveSlot.id}
                        x={xPos || 0}
                        y={0}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          toggleSlot(liveSlot);
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          toggleSlot(liveSlot);
                        }}
                        onMouseEnter={(e) => {
                          const container = e.target.getStage()?.container();
                          if (container) container.style.cursor = 'pointer';
                        }}
                        onMouseLeave={(e) => {
                          const container = e.target.getStage()?.container();
                          if (container) container.style.cursor = 'grab';
                        }}
                      >
                        <Rect
                          width={slotW} height={slotH}
                          fill={slotFill}
                          stroke={strokeColor}
                          strokeWidth={2}
                          shadowColor={shadowColor}
                          shadowBlur={liveSlot.status === 'OCCUPIED' ? 10 : 0}
                          shadowOpacity={0.4}
                        />
                        {/* Ô đang bảo trì (DISABLED): vẽ thêm 1 đường chéo giả
                            lập ký hiệu "gạch chéo" (crosshatch) cảnh báo. */}
                        {liveSlot.status === 'DISABLED' && (
                          <Line points={[0, 0, slotW, slotH]} stroke="#cbd5e1" strokeWidth={2} listening={false} />
                        )}

                        <KonvaText
                          x={0} y={slotH / 2 - 16}
                          width={slotW}
                          align="center"
                          text={liveSlot.slotName || liveSlot.name}
                          fontSize={16}
                          fill={liveSlot.status === 'DISABLED' ? '#94a3b8' : '#334155'}
                          fontStyle="bold"
                          listening={false}
                        />
                        {/* Có xe + biết được biển số -> hiện luôn biển số dưới
                            tên ô để dễ nhận diện xe đang đỗ ở đâu. */}
                        {liveSlot.status === 'OCCUPIED' && liveSlot.currentPlate && (
                          <KonvaText
                            x={0} y={slotH / 2 + 4}
                            width={slotW}
                            align="center"
                            text={liveSlot.currentPlate}
                            fontSize={12}
                            fill="#ef4444"
                            fontStyle="bold"
                            listening={false}
                          />
                        )}
                      </Group>
                    );
                  })}

                  {/* [NHÃN TÊN ZONE] - đặt ở góc trên-trái, bên trong khung Zone */}
                  <Label x={5} y={5} listening={false}>
                    <Tag fill="rgba(255, 255, 255, 0.85)" cornerRadius={4} />
                    <KonvaText
                      text={`${zone.zoneName || zone.name}`}
                      fontSize={14}
                      fontFamily="sans-serif"
                      fill="#334155"
                      fontStyle="bold"
                      padding={4}
                    />
                  </Label>
                </Group>
              );
            })}

            {/*
             * ============================================================================
             * [VẼ CÁC GATE (CỔNG RA/VÀO)] trên tầng đang xem
             * Mặc định kích thước 3x1 ô lưới, nếu Gate gắn riêng 1 loại xe thì
             * lấy đúng chiều rộng ma trận của loại xe đó (Gate chuyên dụng
             * thường rộng hơn/hẹp hơn Gate chung).
             *
             * MÀU SẮC: xanh lá đậm (kèm hiệu ứng phát sáng `shadowBlur`) khi
             * đang có nhân viên trực, xám khi trống — dựa vào cờ `hasStaff`
             * (boolean) mà `/data-sync` (IotHardwareController) tính sẵn từ
             * ca trực đang ACTIVE tại Gate đó.
             * ============================================================================
             */}
            {visibleGates.map((gate: any) => {
              let gateW = 3 * GRID_SIZE;
              let gateH = GRID_SIZE;
              if (gate.vehicleTypeId) {
                const vt = vehicleTypes.find((v: any) => v.id === gate.vehicleTypeId);
                if (vt) gateW = (vt.matrixWidth || 3) * GRID_SIZE;
              }
              const gateColor = gate.hasStaff ? '#059669' : '#94a3b8'; // emerald if staffed, slate otherwise

              return (
                <Group
                  key={`gate-${gate.id}`}
                  x={gate.layoutX || 0}
                  y={gate.layoutY || 0}
                  rotation={gate.rotation || 0}
                >
                  <Rect
                    width={gateW || (3 * GRID_SIZE)} height={gateH || GRID_SIZE}
                    fill="#ffffff"
                    stroke={gateColor}
                    strokeWidth={3}
                    cornerRadius={4}
                    shadowColor={gateColor === '#059669' ? '#059669' : 'transparent'}
                    shadowBlur={gateColor === '#059669' ? 12 : 0}
                    shadowOpacity={0.5}
                  />
                  <KonvaText
                    x={0} y={gateH / 2 - 6}
                    width={gateW}
                    align="center"
                    text={gate.name || gate.gateName}
                    fontSize={12}
                    fontStyle="bold"
                    fill={gateColor}
                    listening={false}
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      )}

      {/* Chưa xác định được Floor đang chọn (VD: dữ liệu Backend chưa tải
          xong, hoặc `selectedFloorId` chưa khớp Floor nào) -> hiện thông báo
          thay vì để bản đồ trống trơn không rõ lý do. */}
      {!activeFloor && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white">
          No floor data loaded
        </div>
      )}
    </div>
  );
});
