# PHÂN TÍCH — XỬ LÝ TÍN HIỆU CẢM BIẾN Ô ĐỖ (ZONE MONITORING SERVICE)

> Phân tích file `ZoneMonitoringService.java`. Trả lời câu hỏi: **khi một cảm
> biến dưới ô đỗ báo "có xe đè lên tôi", hệ thống làm những gì**.
>
> Liên quan: [PhanTich_ZoneTrend.md](PhanTich_ZoneTrend.md) — file này là **nơi
> cấp số liệu đầu vào** cho tính năng biểu đồ xu hướng được phân tích ở đó.

---

## 1. Bài toán: cảm biến rất "ngu", phải suy luận từ dữ liệu nghèo nàn

Cảm biến siêu âm gắn dưới mỗi ô đỗ chỉ biết nói đúng **2 điều**:

```
"Tôi là ô số 47"      +      "Trên tôi CÓ vật đè"
```

Nó **không đọc được biển số**, không biết xe đó là xe gì, của ai, có vé tháng
hay không. Toàn bộ giá trị của service này nằm ở chỗ: từ hai mẩu tin thô đó,
phải suy ra được những thông tin có ý nghĩa nghiệp vụ.

Cụ thể là 4 việc, xảy ra tuần tự trong **một hàm duy nhất**:

| # | Việc | Kết quả người dùng thấy |
|---|---|---|
| 1 | Ghi trạng thái mới xuống Database | Dữ liệu nền cho mọi tính năng khác |
| 2 | Nạp số liệu cho biểu đồ xu hướng | Cột đỉnh điểm trên biểu đồ theo giờ |
| 3 | Bắn tin vẽ lại bản đồ | Ô đỗ trên Space Map tự đổi màu tức thì |
| 4 | Suy luận phát hiện xe đỗ lậu | Popup báo động đỏ ở chuông thông báo |

---

## 2. Vị trí trong hệ thống

```
   IoT Simulator (tab Sensor Map) — người dùng bấm vào 1 ô đỗ
              │
              │  POST /operation/iot/hardware/sensors/update
              │  { sensorId: "47", status: "OCCUPIED" }
              ▼
   ┌────────────────────────────┐
   │   IotHardwareController    │  chỉ nhận HTTP rồi giao việc
   └──────────┬─────────────────┘
              │ processSensorEvent("47", "OCCUPIED")
              ▼
   ┌────────────────────────────────────────────────┐
   │          ZoneMonitoringService                 │
   │                                                │
   │  ① Ánh xạ cảm biến → ô đỗ, ghi DB              │
   │  ② Tính độ đầy → nạp cho ZoneOccupancyTracker  │──→ biểu đồ xu hướng
   │  ③ Bắn SLOT_UPDATED lên /topic/slots/status    │──→ Space Map đổi màu ô
   │  ④ Nếu là ô MONTHLY + có xe → kiểm tra đỗ lậu  │──→ popup báo động đỏ
   └────────────────────────────────────────────────┘
```

Đây là **điểm vào duy nhất** cho mọi tín hiệu cảm biến trong hệ thống. Không có
đường nào khác để trạng thái ô đỗ thay đổi từ phần cứng.

---

## 3. Việc ① — Ánh xạ cảm biến sang ô đỗ và ghi Database

```java
Long slotId = Long.parseLong(sensorId);          // quy ước: mã cảm biến = id ô đỗ
Slot slot = slotRepository.findById(slotId)
        .orElseThrow(() -> new IllegalArgumentException("Slot not found"));
slot.setStatus(status);
slotRepository.save(slot);
```

**Quy ước đơn giản hoá của đồ án**: mã cảm biến **chính là** id của ô đỗ, nên chỉ
cần ép chuỗi sang số là xong.

Hệ thống thật sẽ cần một bảng ánh xạ riêng `sensor_id ↔ slot_id`, vì trong thực
tế một cảm biến có thể bị tháo ra lắp sang ô khác, hoặc hỏng phải thay cái mới —
lúc đó mã cảm biến không còn trùng với id ô đỗ nữa.

---

## 4. Việc ② — Nạp số liệu đỉnh điểm cho biểu đồ xu hướng

```java
BigDecimal currentOccupancy = zoneRoutingService.calculateZoneOccupancy(zone.getId());
zoneOccupancyTracker.updateOccupancy(zone.getId(), currentOccupancy);
```

Chỉ 2 dòng, nhưng đây là **mắt xích sống còn** của cả tính năng biểu đồ theo giờ.

**Vì sao phải đặt ở đây?** Vì đây là **nơi duy nhất trong toàn hệ thống biết được
"độ đầy vừa thay đổi"**. Xe vào bãi hay ra bãi đều phải đi qua một ô đỗ, mà mọi
thay đổi trạng thái ô đỗ đều chảy qua hàm này. Nếu không nạp số liệu tại đây thì
`ZoneOccupancyTracker` không bao giờ nhận được dữ liệu.

**Chuyện đã từng xảy ra** (ghi lại trong comment của file): trước đây việc gọi
`updateOccupancy` nằm ở một endpoint khác — `/infrastructure/slots/iot-update`.
Endpoint đó không được frontend hay simulator nào gọi tới, và sau này bị xoá khi
dọn dead code. Hậu quả dây chuyền:

```
updateOccupancy mất sạch nơi gọi
   → kho đỉnh điểm luôn rỗng
   → job chốt giờ nhận được null, đành lấy độ đầy ĐO TẠI ĐẦU GIỜ
   → Zone đầy 100% lúc 8h30 rồi trống lúc 8h59 vẫn bị vẽ theo số lúc 8h00
   → biểu đồ báo thấp hơn thực tế, đường ngưỡng đỏ 90% gần như không chạm tới
```

Chi tiết cơ chế "lấy đỉnh" ở [PhanTich_ZoneTrend.md](PhanTich_ZoneTrend.md) mục 3.

---

## 5. Việc ③ — Bắn tin vẽ lại bản đồ

```java
Map<String, Object> slotPayload = new HashMap<>();
slotPayload.put("slotId", slot.getId());
slotPayload.put("zoneId", zone.getId());
slotPayload.put("status", slot.getStatus());
eventPublisher.broadcastEvent("/topic/slots/status", "SLOT_UPDATED", slotPayload);
```

Gói tin rất gọn: **chỉ 3 trường** — ô nào, thuộc Zone nào, trạng thái mới là gì.

Không gửi cả bản đồ, vì giao diện chỉ cần đổi màu **đúng một ô** chứ không phải
vẽ lại toàn bộ. Màn hình Space Map của quản lý lắng nghe kênh này và cập nhật
tại chỗ.

Điểm cần chú ý: đây là `broadcastEvent` — **tin thường**, khác với báo động đỏ ở
việc ④ ngay bên dưới. Xem so sánh ở mục 8.

---

## 6. Việc ④ — Phát hiện xe đỗ lậu bằng thuật toán "đếm chéo 2 nguồn"

Đây là phần thông minh nhất của file, đáng phân tích kỹ nhất.

### 6.1. Vấn đề

Zone MONTHLY là khu dành riêng cho khách vé tháng. Nếu một xe vãng lai lẻn vào
đỗ ở đó, khách vé tháng về sẽ mất chỗ. Cần phát hiện tình huống này.

**Nhưng cảm biến không đọc được biển số** — nó chỉ biết "ô này có vật đè lên",
hoàn toàn không biết chiếc xe đó là xe vé tháng hay xe lạ. Vậy làm sao phát hiện?

### 6.2. Cách lách: so hai con số đếm từ hai nguồn độc lập

```
NGUỒN A — thế giới VẬT LÝ (do cảm biến báo)
   Có bao nhiêu ô trong các Zone MONTHLY của cùng loại xe đang bị đè?

NGUỒN B — thế giới GIẤY TỜ (đọc từ Database)
   Có bao nhiêu xe vé tháng CÒN HẠN đang có lượt đỗ mở trong bãi?

   Nếu A > B  →  số xe nằm trên chỗ vé tháng NHIỀU HƠN số xe có quyền
              →  phần dư chắc chắn là xe đỗ lậu  →  hú còi
```

Logic rất chặt: mỗi xe vé tháng hợp lệ chỉ chiếm được đúng 1 ô. Nếu đếm được 12
ô bị chiếm mà chỉ có 9 xe vé tháng đang trong bãi, thì **chắc chắn có 3 chiếc xe
không có quyền** đang nằm đó — không cần biết biển số của chúng là gì.

### 6.3. Chi tiết cách đếm từng nguồn

**Nguồn A** — đếm ô đang bị chiếm:

```sql
SELECT COUNT(s) FROM Slot s
WHERE s.zone.functionType = 'MONTHLY'
  AND s.zone.vehicleType.id = :vehicleTypeId
  AND s.status = 'OCCUPIED'
```

Chú ý: đếm theo **loại xe**, gộp **tất cả Zone MONTHLY** lại, chứ không đếm riêng
từng Zone. Vì khách vé tháng ô tô được đỗ ở bất kỳ Zone MONTHLY nào dành cho ô
tô — nếu chỉ đếm một Zone thì so sánh sẽ sai lệch.

**Nguồn B** — đếm xe vé tháng hợp lệ đang trong bãi:

```sql
SELECT COUNT(ps) FROM ParkingSession ps
WHERE ps.status = 'ACTIVE'
  AND ps.vehicleType.id = :vehicleTypeId
  AND ps.plate IN (
        SELECT mt.plateNumber FROM MonthlyTicket mt
        WHERE mt.status = 'ACTIVE' AND mt.validUntil > :currentTime
      )
```

Đọc thành lời: *"đếm các lượt đỗ đang mở (đã check-in, chưa check-out), của đúng
loại xe này, mà biển số nằm trong danh sách vé tháng còn hiệu lực tại thời điểm
hiện tại"*. Ba điều kiện cùng lúc: đang đỗ + đúng loại xe + vé còn hạn.

### 6.4. Hai điều kiện lọc trước khi chạy kiểm tra

```java
if ("OCCUPIED".equals(status) && "MONTHLY".equals(zone.getFunctionType())) {
```

Đây là bộ lọc rất gọn nhưng loại bỏ được gần hết tín hiệu vô ích:

| Điều kiện | Vì sao cần |
|---|---|
| `status == OCCUPIED` | Xe **rời đi** thì không thể sinh vi phạm mới — chỉ giảm chứ không tăng số ô bị chiếm |
| `functionType == MONTHLY` | Khu vãng lai thì ai đỗ cũng hợp lệ, không có khái niệm "đỗ lậu" |

Nhờ vậy phép đếm chéo (2 truy vấn DB) chỉ chạy khi thực sự có khả năng phát sinh
vi phạm, không chạy trên mọi tín hiệu cảm biến.

### 6.5. Nội dung cảnh báo

Khi A > B, hệ thống bắn báo động đỏ lên `/topic/alerts`:

> `Overload Alert: There are 12 slots occupied in the Monthly Zone (type Car),
> but only 9 monthly cars of this type are currently in the parking lot!
> Walk-in vehicles might have parked improperly.`

Câu cảnh báo cố ý **nêu cả 2 con số** (12 và 9) chứ không chỉ nói "có vi phạm" —
để nhân viên tự đánh giá mức độ nghiêm trọng và biết cần đi kiểm tra bao nhiêu xe.

> **Quan trọng**: hàm này **không tự lập phiếu sự cố** (IncidentTicket). Nó chỉ
> thông báo tức thời. Việc lập biên bản là quyết định thủ công của nhân viên sau
> khi nhận cảnh báo và đi kiểm tra thực địa.

---

## 7. Đi theo một tín hiệu từ đầu đến cuối

Ví dụ: **ô số 47 thuộc Zone M (MONTHLY, xe ô tô), một chiếc xe vừa đỗ vào.**

| Bước | Chuyện gì xảy ra | Kết quả |
|---|---|---|
| 0 | Người dùng bấm ô 47 trên Sensor Map | Gửi `{ sensorId: "47", status: "OCCUPIED" }` |
| ① | Ép `"47"` → số 47, tìm ô đỗ, ghi `status = OCCUPIED` | DB đã cập nhật |
| ② | Tính độ đầy Zone M = **62.5%**, đưa cho tracker | Tracker: nếu 62.5 > mức đang lưu thì nâng lên |
| ③ | Bắn `SLOT_UPDATED {slotId:47, zoneId:3, status:"OCCUPIED"}` | Ô 47 trên Space Map **đổi màu ngay** |
| ④a | Kiểm tra 2 điều kiện: `OCCUPIED` ✅ và Zone `MONTHLY` ✅ | Tiếp tục kiểm tra vi phạm |
| ④b | Nguồn A: đếm ô OCCUPIED trong mọi Zone MONTHLY của ô tô = **12** | |
| ④c | Nguồn B: đếm xe vé tháng ô tô đang trong bãi = **9** | |
| ④d | 12 > 9 → có **3 xe đỗ lậu** | Bắn `ZONE_VIOLATION` cờ `CRITICAL` |
| Kết | | Popup đỏ **System Alert** hiện ở mọi màn hình đang mở |

Nếu ô 47 thuộc Zone WALK_IN thay vì MONTHLY, luồng sẽ **dừng lại sau bước ③** —
không có bước ④ nào chạy, không tốn 2 truy vấn đếm.

---

## 8. Hai loại thông báo WebSocket — khác nhau chỗ nào

File này bắn ra 2 loại tin hoàn toàn khác nhau về mức độ:

| | Việc ③ — cập nhật bản đồ | Việc ④ — báo vi phạm |
|---|---|---|
| Hàm gọi | `broadcastEvent()` | `broadcastCriticalEvent()` |
| Kênh | `/topic/slots/status` | `/topic/alerts` |
| Nhãn sự kiện | `SLOT_UPDATED` | `ZONE_VIOLATION` |
| Cờ mức độ | *(không có)* | **`CRITICAL`** |
| Tần suất | Rất dày — mỗi tín hiệu cảm biến đều bắn | Thưa — chỉ khi thực sự phát hiện vi phạm |
| Giao diện phản ứng | Đổi màu lặng lẽ 1 ô trên Space Map | **Popup đỏ** + vào danh sách chuông thông báo |

Sự phân biệt này quan trọng: nếu dùng chung một loại tin, hoặc là popup sẽ nhảy
liên tục mỗi lần có xe ra vào (không ai chịu nổi), hoặc là cảnh báo vi phạm sẽ
bị chìm nghỉm giữa hàng trăm tin cập nhật bản đồ.

---

## 9. Những chỗ dễ hiểu nhầm khi đọc code

| Chỗ dễ nhầm | Sự thật |
|---|---|
| Tưởng service này biết xe nào đỗ sai | Không hề. Nó **không biết biển số nào vi phạm**, chỉ biết "có 3 xe thừa". Muốn biết xe nào phải ra tận nơi kiểm tra |
| Tưởng nguồn A đếm riêng Zone đang có tín hiệu | Đếm **gộp tất cả Zone MONTHLY** cùng loại xe. Đếm riêng từng Zone sẽ ra kết quả sai |
| Tưởng cảnh báo tự lập phiếu phạt | Không. Chỉ bắn thông báo, việc lập biên bản do nhân viên quyết định |
| Tưởng 2 dòng gọi `updateOccupancy` là phụ | Đây là **mắt xích sống còn** của biểu đồ xu hướng. Bỏ đi thì cả tính năng mất số liệu đỉnh điểm |
| Tưởng mọi tín hiệu đều chạy kiểm tra vi phạm | Chỉ chạy khi `OCCUPIED` **và** Zone là `MONTHLY`. Tín hiệu xe rời đi hoặc ô khu vãng lai đều dừng sớm |
| Constructor viết tay → tưởng khác biệt gì | Chỉ là không dùng Lombok `@RequiredArgsConstructor` như các service anh em. Kết quả hoàn toàn như nhau |

---

## 10. Giới hạn và lỗi tiềm ẩn

| Vấn đề | Chi tiết | Mức độ |
|---|---|---|
| **Chưa trừ xe đã bị lập biên bản** | Nguồn B không cộng thêm số xe đỗ lậu **đã bị xử lý**. Nên một chiếc xe đã lập biên bản rồi vẫn tiếp tục kích hoạt cảnh báo mỗi khi có cảm biến khác trong khu vé tháng báo tín hiệu — nhân viên bị làm phiền lặp lại cho cùng một vi phạm. Cách tính đúng: `(vé tháng còn hạn) + (số xe đã bị phạt)` rồi mới so với nguồn A | Gây phiền, không sai dữ liệu |
| **`sensorId` không kiểm tra định dạng** | `Long.parseLong(sensorId)` — cảm biến gửi mã không phải số sẽ vỡ `NumberFormatException` → API trả lỗi 500 thay vì thông báo rõ ràng | Thấp (simulator luôn gửi số) |
| **`status` không kiểm tra giá trị hợp lệ** | Ghi thẳng vào DB mà không kiểm tra có nằm trong tập `EMPTY`/`OCCUPIED`/`DISABLED` hay không. Gửi `"abc"` sẽ được lưu nguyên | Thấp |
| **Không kiểm tra null** | `slot.getZone()` và `zone.getVehicleType()` được dùng thẳng. Ô đỗ chưa gán Zone, hoặc Zone chưa gán loại xe, sẽ gây `NullPointerException` | Thấp (dữ liệu thực luôn có đủ) |
| **Không có chống dội cảnh báo** | Mỗi tín hiệu `OCCUPIED` trong khu MONTHLY đều có thể bắn một popup mới. Nếu 5 xe lần lượt đỗ vào trong 1 phút thì có thể nhận 5 popup liên tiếp | Trung bình |
| **Ánh xạ cảm biến = id ô đỗ** | Đơn giản hoá của đồ án. Hệ thống thật cần bảng ánh xạ riêng vì cảm biến có thể được tháo lắp/thay thế | Chấp nhận được |

---

## 11. Tóm tắt trong 5 câu

1. Cảm biến chỉ biết nói "tôi là ô số mấy" và "trên tôi có xe hay không" — mọi
   giá trị của service này là suy luận ra thông tin có nghĩa từ dữ liệu nghèo đó.
2. Mỗi tín hiệu đi vào đều được ghi xuống Database, rồi **tính lại độ đầy của
   Zone và nạp cho bộ nhớ đỉnh điểm** — đây là nguồn dữ liệu duy nhất của biểu đồ
   xu hướng theo giờ.
3. Sau đó bắn một gói tin gọn 3 trường lên WebSocket để Space Map đổi màu đúng
   một ô, không vẽ lại toàn bản đồ.
4. Nếu tín hiệu là "có xe vừa đỗ vào" **và** ô đó thuộc khu vé tháng, hệ thống
   chạy phép **đếm chéo 2 nguồn**: số ô đang bị chiếm (cảm biến) so với số xe vé
   tháng hợp lệ đang trong bãi (giấy tờ).
5. Nếu con số vật lý lớn hơn con số giấy tờ, phần dư chắc chắn là xe đỗ lậu →
   bắn báo động đỏ kèm cả 2 con số cho nhân viên đi kiểm tra.
