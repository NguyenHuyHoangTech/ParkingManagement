# KỊCH BẢN BẢO VỆ HỘI ĐỒNG — MODULE ĐIỀU PHỐI ZONE (ROUTING) & THẺ THÁNG

> Phạm vi: `RoutingRule`, `ZoneRoutingService.suggestZone()`, luồng check-in
> (`GateOperationService`), đặt chỗ (`ReservationService`), và `MonthlyTicketService`.
> Tài liệu này để chuẩn bị demo trực tiếp + trả lời câu hỏi hội đồng, không phải
> tài liệu nộp — có thể chỉnh sửa số liệu cho khớp dữ liệu demo thật.

---

## 0. Bảng tổng hợp nhanh — 3 loại khách hàng × các luồng xử lý

Đọc bảng này trước để nắm toàn cảnh, chi tiết từng dòng xem ở kịch bản tham
chiếu tương ứng bên dưới.

| Loại khách | Luồng | Điều gì xảy ra | Kịch bản |
|---|---|---|---|
| **Vãng lai (WALK_IN)** | Bình thường, chưa cần trượt | Zone đầu chuỗi (ưu tiên 1) chưa đạt ngưỡng → dùng luôn, không cascade | *(ngầm định trong mọi KB, xem `suggestZone` dòng 392-395)* |
| Vãng lai (WALK_IN) | Happy path — trượt 1 lần | Zone đầu chuỗi vượt ngưỡng → trượt đúng 1 lần sang `suggestedZone` → zone đó chưa đầy → nhận | **KB-1** |
| Vãng lai (WALK_IN) | Fallback bậc 1 — zone ngoài chuỗi | Toàn chuỗi đã đầy/vượt ngưỡng, nhưng có 1 Zone WALK_IN khác **chưa từng gắn `RoutingRule`** còn trống → Fallback bậc 1 vớt được | **KB-6** |
| Vãng lai (WALK_IN) | Fallback bậc 2 — vét máng thật | Mọi Zone trong chuỗi đã vượt ngưỡng riêng, nhưng vẫn còn <100% vật lý → Fallback bậc 2 bỏ qua ngưỡng để cứu | **KB-7** |
| Vãng lai (WALK_IN) | Hết chỗ hoàn toàn | Tất cả Zone WALK_IN đều 100% vật lý → `suggestZone()` trả `null` → UI hiện "Free", **không chặn xe vào** (advisory-only) | **KB-2** |
| **Đặt chỗ trước (Reservation)** | Cảnh báo sớm (chạy nền) | Trước giờ hẹn `RESERVATION_EARLY_MINS` phút, nếu Zone đã đặt bị đầy vật lý → gửi WebSocket `ZONE_CONFLICT` cho nhân viên | **KB-3** (mục 4a) |
| Đặt chỗ trước (Reservation) | Check-in thực tế | Khi xe quét thẻ, nếu Zone đã đặt bị đầy → tự động gọi lại `suggestZone()` đổi zone khác, xe vẫn vào, không mất phí đặt chỗ | **KB-3** (mục 4b) |
| **Vé tháng (MONTHLY)** | Bình thường, chưa cần fallback | Zone MONTHLY đầu tiên (A-Z) chưa đầy vật lý → dùng luôn (không có ngưỡng % vì Zone MONTHLY không có `RoutingRule`, chỉ nhị phân đầy/còn) | *(ngầm định, chưa có KB riêng)* |
| Vé tháng (MONTHLY) | Fallback bậc 1 — nhiều Zone MONTHLY | Zone MONTHLY đầu đầy, còn Zone MONTHLY khác trống → ưu tiên chọn Zone MONTHLY khác **trước khi** thử BACKUP | **KB-8** |
| Vé tháng (MONTHLY) | Fallback bậc 1 — tràn sang BACKUP | Mọi Zone MONTHLY đầy → Zone BACKUP còn trống → nhận | **KB-5** |
| Vé tháng (MONTHLY) | Fallback bậc 1 — tràn hết xuống WALK_IN | Cả Zone MONTHLY và BACKUP đều đầy → tràn tiếp xuống Zone WALK_IN (so đúng ngưỡng riêng của WALK_IN, không phải <100%) | **KB-9** |
| Vé tháng (MONTHLY) | Fallback bậc 2 — vét máng cuối | Mọi Zone (MONTHLY/BACKUP/WALK_IN) đều đã vượt ngưỡng riêng, nhưng có zone <100% vật lý → bỏ qua ngưỡng, nhận | **KB-10** |
| Vé tháng (MONTHLY) | Bán vé vượt slot (overbook có kiểm soát) | Bán vé không giới hạn cứng theo số slot, chỉ cảnh báo `MONTHLY_ZONE_OVERLOAD` ở ngưỡng cấu hình (mặc định 90%), không chặn bán | **KB-4** |
| Vé tháng (MONTHLY) | Hết chỗ hoàn toàn | Tất cả Zone (mọi loại) đều 100% vật lý → `suggestZone()` trả `null` → advisory-only, không chặn xe, giống hệt khách vãng lai | **KB-11** |

**Quy tắc chung cần nhớ khi bị hỏi dồn:**
- Cascade theo `RoutingRule` (%) **chỉ tồn tại cho Zone WALK_IN**; Zone MONTHLY/BACKUP luôn nhị phân đầy/còn.
- Cơ chế tràn giữa các loại Zone **chỉ 1 chiều**: MONTHLY → BACKUP → WALK_IN. Khách vãng lai không bao giờ lọt vào MONTHLY/BACKUP.
- Fallback bậc 1 tôn trọng ngưỡng cấu hình riêng từng zone; Fallback bậc 2 mới thật sự bỏ qua ngưỡng, chỉ cần <100% vật lý.
- Toàn bộ hệ thống là **advisory-only** — dù `suggestZone()` trả `null`, xe vẫn được cho vào, quyết định cuối luôn thuộc về nhân viên gác cổng.

---

## 1. Bộ dữ liệu thô nền (setup trước khi demo)

### 1.1. Zone mẫu (tầng 1, xe máy)

| Zone | functionType | Số slot | Ghi chú |
|---|---|---|---|
| Zone A | WALK_IN | 10 | Zone vãng lai ưu tiên 1 |
| Zone B | WALK_IN | 10 | Zone vãng lai dự phòng (nhận xe khi A vượt ngưỡng) |
| Zone M | MONTHLY | 8 | Zone dành riêng khách vé tháng |
| Zone K | BACKUP | 6 | Zone dự phòng chung, chỉ khách vé tháng mới thấy |
| Zone C | WALK_IN | 10 | **Không gắn `RoutingRule` nào** — cố ý để ngoài chuỗi, dùng riêng để test Fallback bậc 1 thật sự có tác dụng (Kịch bản 6) |
| Zone M2 | MONTHLY | 5 | Zone tháng thứ 2 — dùng để test thứ tự ưu tiên giữa nhiều Zone MONTHLY (Kịch bản 8, 9, 10, 11) |

### 1.2. RoutingRule mẫu (bảng `routing_rules`, chỉ tồn tại cho Zone `WALK_IN`)

| id | zone (giám sát) | fillThresholdPct | suggestedZone | startTime–endTime | isDefault |
|---|---|---|---|---|---|
| 1 | Zone A | 80 | Zone B | (null–null) | true |
| 2 | Zone A | 60 | Zone B | 06:00–22:00 | false (khung giờ cao điểm ban ngày) |
| 3 | Zone B | 95 | (null) | (null–null) | true |

Đọc thành lời: *"Ban ngày (06:00–22:00), Zone A đầy từ 60% là bắt đầu đẩy xe mới
sang Zone B; ngoài khung giờ đó áp dụng luật mặc định 80%. Zone B chấp nhận tới
95% mới coi là hết, không có Zone nào để trượt tiếp."*

Zone M, Zone K **không có RoutingRule nào** — đây là chủ đích thiết kế (xem mục 4),
không phải thiếu cấu hình. Zone M2 cũng vậy (Zone MONTHLY không bao giờ có luật).
Zone C cũng cố ý không có luật, nhưng vì lý do khác — xem mục 1.2b.

### 1.2b. Bộ luật tạm thời — hạ ngưỡng còn ~10% để test nhóm kịch bản Fallback/"vét máng"

> ⚠️ **Chỉ áp dụng cho Kịch bản 6, 7, 9, 10 bên dưới.** Trước khi quay lại demo
> Kịch bản 1/2 (mục 2, 3), phải đổi ngưỡng Zone A/B về đúng bảng 1.2 gốc
> (80%/60%/95%) trên màn `VehicleRoutingScreen`, nếu không kết quả sẽ sai lệch.

| id | Zone (giám sát) | fillThresholdPct | suggestedZone | startTime–endTime | isDefault |
|---|---|---|---|---|---|
| 1' | Zone A | **10** | Zone B | (null–null) | true |
| 3' | Zone B | **10** | (null) | (null–null) | true |

Lý do hạ ngưỡng xuống 10%: chỉ cần 1-2 xe đỗ vào là đã vượt ngưỡng, không cần
đợi zone gần đầy mới test được nhánh Fallback — dễ set up dữ liệu demo, không
ảnh hưởng tới logic (ngưỡng vẫn do quản lý tự cấu hình, đây chỉ là 1 bộ số khác
của cùng 1 cơ chế, không phải hardcode riêng cho test).

### 1.3. SystemConfig liên quan

| Key | Giá trị demo | Ý nghĩa |
|---|---|---|
| `DISPLAY_ROUTING` | `TRUE` | Có hiển thị Zone gợi ý lên màn hình cổng hay không |
| `RESERVATION_EARLY_MINS` | `30` | Cửa sổ tính "đặt chỗ sắp tới" khi tính % lấp đầy |
| `MONTHLY_TICKET_ALERT_THRESHOLD` | `90` | Ngưỡng % cảnh báo quá tải vé tháng (mặc định code nếu thiếu key: `90`) |

### 1.4. Trạng thái vật lý slot (đặt trước khi bấm demo)

| Kịch bản | Zone A | Zone B | Zone C | Zone M | Zone M2 | Zone K | Ghi chú |
|---|---|---|---|---|---|---|---|
| KB-1: Trượt ngưỡng bình thường | 6/10 (60%) | 2/10 | — | — | — | — | Vừa chạm ngưỡng 60% ban ngày. Dùng bảng luật gốc 1.2 |
| KB-2: Hết chỗ toàn bộ | 10/10 | 10/10 | — | — | — | — | Cả 2 zone vãng lai 100%. Dùng bảng luật gốc 1.2 |
| KB-3: Zone đặt chỗ bị full khi xe tới | 10/10 (đã có xe khác chiếm chỗ đặt) | 5/10 | — | — | — | — | Có 1 `Reservation` PENDING tại Zone A |
| KB-4: Vé tháng vượt ngưỡng cảnh báo | — | — | — | không liên quan slot, liên quan số vé ACTIVE | — | — | 8 slot Zone M, đã bán 8 vé ACTIVE (100% > 90%) |
| KB-5: Khách vé tháng check-in, Zone M full | — | — | — | 8/8 (100%) | — | 0/6 (còn trống) | Zone K còn trống |
| KB-6: WALK_IN ngoài chuỗi luật | 10/10 | 10/10 | 3/10 (30%, **không có luật**) | — | — | — | Dùng bảng luật gốc 1.2 cho A/B. Test Fallback bậc 1 thật sự có tác dụng |
| KB-7: Fallback bậc 2 cứu (WALK_IN) | 2/10 (20%) | 3/10 (30%) | — | — | — | — | Dùng bảng luật tạm **1.2b** (ngưỡng 10%) cho A/B |
| KB-8: Ưu tiên giữa nhiều Zone MONTHLY | — | — | — | 8/8 (100%) | 2/5 (40%) | — | Test Fallback bậc 1 chọn Zone MONTHLY khác trước khi thử BACKUP |
| KB-9: Tràn hết MONTHLY→BACKUP→WALK_IN | 0/10 (0%) | — | — | 8/8 (100%) | 5/5 (100%) | 6/6 (100%) | Dùng bảng luật tạm **1.2b** cho Zone A |
| KB-10: Fallback bậc 2 (đường vé tháng) | 5/10 (50%) | 9/10 (90%) | — | 8/8 (100%) | 5/5 (100%) | 6/6 (100%) | Dùng bảng luật tạm **1.2b** cho A/B |
| KB-11: Hết sạch hoàn toàn (đường vé tháng) | 10/10 | 10/10 | — | 8/8 | 5/5 | 6/6 | Kết quả `null` — giống KB-2 nhưng đi qua nhánh MONTHLY |

---

## 2. KỊCH BẢN 1 — Trượt ngưỡng bình thường (happy path, dùng để mở đầu demo)

**Diễn giải cho hội đồng:** "Đây là thuật toán Sliding Threshold — khi Zone ưu
tiên đầy tới ngưỡng cấu hình (chưa phải 100%), hệ thống chủ động đẩy xe mới
sang Zone dự phòng để tránh dồn cục, thay vì đợi đầy cứng mới xử lý."

- Setup: Zone A 6/10 (60%), đang trong khung giờ 06:00–22:00.
- Xe máy vãng lai quét biển số tại cổng vào.
- Kỳ vọng: `suggestZone()` tính occupancy Zone A = 60% ≥ ngưỡng rule #2 (60%) →
  trượt sang Zone B → Zone B occupancy thấp, dưới ngưỡng 95% → trả về **Zone B**.
- Trên UI cổng: hộp thoại hiện "Zone gợi ý: Zone B".

**Nếu hội đồng hỏi "sao không đẩy xe khi Zone A còn 40% trống?"**
→ Trả lời: ngưỡng 60% là do quản lý tự cấu hình trong màn `VehicleRoutingScreen`,
mục đích là chừa biên an toàn (buffer) để giảm khả năng khách phải quay đầu xe
tìm chỗ trong chính Zone A khi nó gần đầy — đây là tham số nghiệp vụ, không phải
số cứng trong code.

---

## 3. KỊCH BẢN 2 — Bãi hết chỗ hoàn toàn (câu hỏi hội đồng hay hỏi nhất)

**Setup:** Zone A = 10/10, Zone B = 10/10 (cả 2 Zone WALK_IN đều 100% vật lý).

**Chạy thử:** xe vãng lai quét biển số check-in.

**Kết quả thực tế của hệ thống (đã đọc code, không suy đoán):**
1. `suggestZone()` chạy hết chuỗi trượt ngưỡng → Fallback bậc 1 → Fallback bậc 2
   → không zone nào < 100% → trả về `null`.
2. Trên UI cổng, tên zone gợi ý hiển thị chữ **"Free"** (nghĩa là "hệ thống không
   gợi ý được, nhân viên tự quyết định chỗ đỗ" — KHÔNG phải "còn slot tên Free").
3. **Quan trọng — đây là điểm hội đồng dễ bắt bẻ:** hệ thống **không chặn xe vào**
   khi hết chỗ. `processCheckIn()` vẫn tạo `ParkingSession` bình thường với
   `suggestedZoneId = null`, thẻ RFID vẫn được cấp, cổng vẫn mở.

**Kịch bản trả lời khi hội đồng hỏi "vậy nếu bãi hết chỗ thật, hệ thống có
chặn xe không?":**

> "Không. Đây là lựa chọn thiết kế có chủ đích, không phải bug: bãi xe thực tế
> có slot đệm/không gian di chuyển ngoài các Zone được số hoá (ví dụ lối đi,
> chỗ đỗ tạm), và quyết định cuối cùng cho xe vào hay từ chối thuộc về nhân
> viên gác cổng — hệ thống chỉ đóng vai trò **cố vấn (advisory)** gợi ý zone
> tối ưu, không đóng vai trò kiểm soát vật lý (đó là việc của rào chắn IoT/con
> người). Việc chặn cứng 100% sẽ rủi ro hơn: nếu cảm biến báo sai (dính lỗi
> phần cứng) mà xe thật sự chặn luôn ở cổng thì gây kẹt xe ngoài đường."

Nếu hội đồng vặn tiếp "vậy sao không thêm 1 dòng chặn nếu suggestedZone == null
mà toàn bãi thật sự 100%?" — đây là câu trả lời trung thực:

> "Có thể làm được (thêm 1 điều kiện chặn trong `processCheckIn`), nhưng nhóm
> chủ động không làm để giữ đúng vai trò cố vấn của module Routing, tách bạch
> với quyền quyết định vận hành của nhân viên — đúng với mô hình bãi xe có
> người trực cổng (không phải bãi xe tự động hoàn toàn không người)."

---

## 4. KỊCH BẢN 3 — Xe đã đặt chỗ (Reservation) nhưng Zone đặt hiện tại bị full

**Setup:** Khách đặt chỗ trước cho Zone A lúc 14:00. Trước giờ đó, do khách vãng
lai đến đông, Zone A bị chiếm hết 10/10 slot vật lý bởi xe khác.

### 4a. Luồng cảnh báo sớm (tự động, chạy nền)

- Timer `NOTIFY` (chạy trước giờ hẹn `RESERVATION_EARLY_MINS` = 30 phút) gọi
  `notifyStaffTask()`.
- `isZonePhysicallyFull(ZoneA)` = true → hệ thống gửi WebSocket
  `type: "ZONE_CONFLICT"` tới `/topic/staff/notifications` với nội dung:
  *"Zone A is FULL but vehicle 59A-12345 is arriving soon. Please resolve this
  conflict."*
- **Demo trực tiếp:** dùng nút "Time Fast-Forward" để nhảy tới đúng mốc
  `notifyTime` và cho hội đồng thấy thông báo `ZONE_CONFLICT` nảy ra ở màn
  nhân viên theo thời gian thực. **Lưu ý vị trí:** nút này nằm ở app
  `pbms-iot-simulator` (`App.tsx`, gọi `POST
  /api/v1/operation/iot/hardware/time/fast-forward` trong
  `IotHardwareController.java:310`) — **không phải** trong web nhân
  viên/quản lý (`pbms-fe`). Cần mở song song cả 2 app khi demo.

### 4b. Khi xe thực sự quét thẻ tại cổng (check-in)

- `processCheckIn()`: tìm thấy `Reservation` PENDING đúng loại xe → lấy
  `suggestedZone = reservation.getZone()` (Zone A) → kiểm tra
  `isZonePhysicallyFull(Zone A)` = true → **tự động gọi lại `suggestZone()`**
  để tìm zone thay thế (Zone B, hoặc xa hơn) → xe vẫn vào bãi bình thường, chỉ
  đổi zone gợi ý, **không bị từ chối và không mất phí đặt chỗ**.

---

## 5. KỊCH BẢN 4 — Thẻ tháng (Monthly Ticket) vượt ngưỡng cảnh báo

**Bối cảnh nghiệp vụ:** Zone M chỉ có 8 slot vật lý, nhưng hệ thống **cho phép
bán vé tháng vượt số slot** (giống hàng không overbook vé máy bay) — vì không
phải khách vé tháng nào cũng đỗ xe cùng lúc.

**Setup:** đã bán 8 vé tháng ACTIVE cho Zone M (8 slot) → tỉ lệ = 8/8 = 100%.

**Chạy thử:** bán/kích hoạt thêm 1 vé tháng thứ 9 (hoặc để hệ thống tự chạy job
kiểm tra định kỳ `checkMonthlyThreshold()`).

**Kết quả thực tế:**
1. Hệ thống **không chặn việc bán vé thứ 9** — không có giới hạn cứng nào ở
   tầng service khi tạo `MonthlyTicket`.
2. `checkMonthlyThreshold()` tính `currentPercentage = activeTickets /
   totalMonthlySlots * 100` = 112.5% > ngưỡng 90% → gửi cảnh báo WebSocket
   `type: "MONTHLY_ZONE_OVERLOAD"` tới `/topic/manager-alerts`:
   *"Warning: The number of registered monthly tickets (112.5%) has exceeded
   the 90% threshold of total Monthly Zone slots. Please consider expanding
   the Monthly Zone."*
3. Đây chỉ là **cảnh báo cho quản lý ra quyết định mở rộng Zone**, không tự
   động từ chối bán vé, không tự động khoá đăng ký.

**Kịch bản trả lời khi hội đồng hỏi "vậy lỡ bán dư 100% vé thì sao, xe vô
không có chỗ đậu?"**

> "Đây là quyết định sản phẩm có chủ đích, mô phỏng đúng thực tế bãi xe tháng
> ngoài đời (không phải xe nào cũng ở bãi 24/7): hệ thống overbook có kiểm
> soát bằng cảnh báo sớm ở ngưỡng 90% để quản lý chủ động mở rộng Zone hoặc
> tạm ngừng bán, thay vì cấm cứng ở đúng 100% — vì cấm cứng sẽ chặn nhầm
> trường hợp nhiều khách tháng thực tế không đỗ cùng lúc."

Nếu hội đồng hỏi tiếp "vậy khi khách vé tháng tới mà Zone M hết chỗ thật thì
xe đi đâu?" → chuyển sang Kịch bản 5 ngay bên dưới.

---

## 6. KỊCH BẢN 5 — Khách vé tháng check-in khi Zone MONTHLY đã đầy vật lý

**Setup:** Zone M = 8/8 (100% vật lý), Zone K (BACKUP) còn trống, Zone A/B
(WALK_IN) còn trống.

**Chạy thử:** khách có vé tháng hợp lệ quét thẻ RFID tại cổng vào.

**Kết quả kỳ vọng theo thuật toán (đã đọc code xác nhận):**
- Vì `customerType = "MONTHLY"`, `suggestZone()` giữ lại toàn bộ zone (không
  lọc chỉ còn WALK_IN như khách vãng lai).
- Zone M không có `RoutingRule` nào → rơi vào nhánh "không có luật, chỉ xét
  nhị phân đầy/còn 100%" → Zone M đã 100% → dừng chuỗi tại đây (không có luật
  để trượt tiếp).
- Rơi xuống **Fallback bậc 1**: duyệt các zone chưa đi qua theo thứ tự ưu
  tiên (MONTHLY > BACKUP > WALK_IN) → Zone K (BACKUP) còn trống → **trả về
  Zone K**.
- Nếu Zone K cũng đầy → tiếp tục fallback → rơi xuống Zone A/B (WALK_IN) →
  khách vé tháng được xếp tạm vào zone vãng lai.
- Nếu tất cả đều đầy → trả `null` → giống Kịch bản 2 (vẫn cho xe vào, không
  gợi ý được zone).

**Điểm hay để nhấn mạnh khi thuyết trình:** cơ chế tràn **chỉ 1 chiều**
(MONTHLY → BACKUP → WALK_IN), khách vãng lai **không bao giờ** được xếp lọt
vào Zone MONTHLY/BACKUP dù các zone đó còn trống — vì `zones` đã bị lọc cứng
chỉ còn `WALK_IN` ngay từ bước đầu tiên cho khách vãng lai. Đây là điểm cố ý
bảo vệ quyền lợi khách vé tháng, không phải sơ suất.

---

## 7. KỊCH BẢN 6 — Zone WALK_IN "quên" chưa gắn luật (Fallback bậc 1 phát huy tác dụng thật)

**Bối cảnh:** Kịch bản 2 (mục 3) cho thấy Fallback bậc 1 gần như vô dụng với
khách vãng lai — vì `RoutingRuleService`/UI luôn gom **hết** Zone WALK_IN vào 1
chuỗi liền mạch. Kịch bản này dựng đúng trường hợp duy nhất Fallback bậc 1 thật
sự có tác dụng: **1 Zone WALK_IN tồn tại nhưng chưa được thêm vào cấu hình
luật** (ví dụ quản lý vừa tạo Zone mới, quên bấm lưu vào màn `VehicleRoutingScreen`).

**Setup:** Zone A = 10/10, Zone B = 10/10 (dùng đúng bảng luật gốc 1.2, không
đổi gì). Zone C = 3/10 (30%), **không xuất hiện trong bất kỳ `RoutingRule` nào**
(không phải Zone giám sát, cũng không phải `suggestedZone` của ai).

**Chạy thử:** xe máy vãng lai quét biển số tại cổng vào.

**Kết quả thực tế (đã đọc code xác nhận):**
1. `zones` (đã lọc chỉ còn WALK_IN, sắp A-Z) = [Zone A, Zone B, Zone C].
2. Chuỗi chính chỉ đi qua Zone A → Zone B (do rule nối 2 zone này) rồi dừng vì
   cả 2 đều ≥ ngưỡng của chúng — `visitedChain = [Zone A, Zone B]`. **Zone C
   chưa từng được xét tới** vì nó không nằm trong chuỗi `RoutingRule` nào.
3. Fallback bậc 1 (`remainingZones = zones - visitedChain = [Zone C]`): Zone C
   không có rule → ngưỡng ngầm định 100% → 30% < 100% → **trả về Zone C ngay
   ở Fallback bậc 1**, không cần rớt xuống Fallback bậc 2.
4. Trên UI cổng: "Zone gợi ý: Zone C".

**Kịch bản trả lời nếu hội đồng hỏi "sao Zone C không nằm trong chuỗi mà vẫn
được gợi ý?":**

> "Đây chính là vai trò của Fallback bậc 1: bất kỳ Zone WALK_IN nào tồn tại
> trên hệ thống nhưng chưa được quản lý đưa vào chuỗi cấu hình luật vẫn không
> bị 'bỏ quên' — hệ thống vẫn tự động xét đến nó như một phương án dự phòng,
> tránh trường hợp Zone mới tạo bị lãng quên hoàn toàn khỏi cơ chế điều phối."

---

## 8. KỊCH BẢN 7 — Fallback bậc 2 "cứu" khi mọi Zone WALK_IN đã vượt ngưỡng riêng

**Bối cảnh:** Kịch bản 2 (mục 3) chỉ demo trường hợp Fallback bậc 2 **cũng thất
bại** (cả 2 zone đều 100% vật lý). Kịch bản này demo đúng lúc Fallback bậc 2
**thành công** — ý nghĩa thật của "lưới an toàn cuối": chấp nhận zone đã vượt
ngưỡng "đẹp" cấu hình, miễn là còn chỗ vật lý thật.

**Setup:** Dùng bảng luật tạm **1.2b** (ngưỡng hạ còn 10% cho cả Zone A và
Zone B). Zone A = 2/10 (20%), Zone B = 3/10 (30%) — không có `Reservation`
PENDING nào ảnh hưởng.

**Chạy thử:** xe máy vãng lai quét biển số tại cổng vào.

**Kết quả thực tế:**
1. Chuỗi chính: Zone A occupancy 20% ≥ ngưỡng 10% → trượt sang Zone B. Zone B
   occupancy 30% ≥ ngưỡng 10% → hết chuỗi (Zone B không có `suggestedZone`).
   `visitedChain = [Zone A, Zone B]`.
2. Fallback bậc 1: `remainingZones` rỗng (cả A, B đều đã đi qua) → **không tìm
   được gì**, đúng như dự đoán ở Kịch bản 2 — Fallback bậc 1 gần như vô dụng
   với khách vãng lai khi chuỗi đã phủ hết zone.
3. Fallback bậc 2: quét lại **toàn bộ** `zones` = [Zone A, Zone B], bỏ hẳn
   ngưỡng %, chỉ cần < 100% vật lý → Zone A (20% < 100%) là zone đầu tiên thỏa
   → **trả về Zone A**.

**Điểm nhấn khi thuyết trình:** dù Zone A đã "vượt ngưỡng đẹp" (10%) từ lâu,
hệ thống **không báo hết chỗ** — vì ngưỡng % chỉ là biên an toàn mềm do quản lý
cấu hình, không phải giới hạn vật lý cứng. Đây là lý do thiết kế 2 tầng
Fallback tách biệt: bậc 1 tôn trọng ngưỡng cấu hình, bậc 2 mới thật sự là "vét
máng" bỏ qua ngưỡng.

---

## 9. KỊCH BẢN 8 — Ưu tiên giữa nhiều Zone MONTHLY

**Bối cảnh:** Kịch bản 5 (mục 6) chỉ có 1 Zone MONTHLY (Zone M) nên chưa test
được việc `getZonePriority` + `.sorted()` (dòng 104-114, 282-288) thật sự tạo
ra thứ tự **giữa các Zone MONTHLY với nhau** trước khi rơi xuống BACKUP.

**Setup:** Zone M = 8/8 (100%). Zone M2 = 2/5 (40%, còn trống).

**Chạy thử:** khách có vé tháng hợp lệ quét thẻ RFID tại cổng vào.

**Kết quả thực tế:**
1. `zones` (giữ cả 3 loại, sắp ưu tiên MONTHLY→BACKUP→WALK_IN, A-Z trong cùng
   nhóm) = [Zone M, Zone M2, Zone K, Zone A, Zone B, (Zone C)].
2. Zone bắt đầu = Zone M (Zone MONTHLY đầu tiên theo tên). Không có rule →
   kiểm tra nhị phân: 100% đầy → dừng chuỗi. `visitedChain = [Zone M]`.
3. Fallback bậc 1: `remainingZones` = [Zone M2, Zone K, Zone A, Zone B, ...] —
   **thử Zone M2 trước tiên** (vẫn cùng nhóm ưu tiên 1, đứng trước Zone K ưu
   tiên 2) → Zone M2 không có rule → ngưỡng ngầm định 100% → 40% < 100% →
   **trả về Zone M2 ngay**, chưa cần thử tới Zone K (BACKUP).

**Điểm nhấn khi thuyết trình:** khi bãi có nhiều Zone MONTHLY (ví dụ theo từng
tòa/khu), hệ thống ưu tiên dồn khách vé tháng sang **Zone MONTHLY khác còn
trống** trước khi mới tính tới phương án BACKUP — giữ đúng tinh thần "khách vé
tháng được phục vụ đúng loại Zone của họ nhiều nhất có thể".

---

## 10. KỊCH BẢN 9 — Tràn hết MONTHLY → BACKUP → WALK_IN (cascade trọn vẹn 1 chiều)

**Bối cảnh:** Kịch bản 5 (mục 6) chỉ mô tả **bằng lời** trường hợp Zone K cũng
đầy thì "rơi xuống Zone A/B" — chưa từng dựng dữ liệu để demo trực tiếp. Đây là
lần đầu tiên set up đủ dữ liệu để chạy thật cảnh tràn hết cả 2 tầng MONTHLY/
BACKUP, xuống tới tận WALK_IN.

**Setup:** Dùng bảng luật tạm **1.2b** cho Zone A (ngưỡng 10%). Zone M = 8/8
(100%), Zone M2 = 5/5 (100%), Zone K = 6/6 (100%) — **cả 3 Zone MONTHLY/BACKUP
đều đầy**. Zone A = 0/10 (0%, còn nguyên).

**Chạy thử:** khách có vé tháng hợp lệ quét thẻ RFID tại cổng vào.

**Kết quả thực tế:**
1. Zone bắt đầu = Zone M → 100% đầy, không có rule → dừng chuỗi.
   `visitedChain = [Zone M]`.
2. Fallback bậc 1, duyệt `remainingZones` theo đúng thứ tự ưu tiên:
   - Zone M2 (MONTHLY khác): 100% đầy, ngưỡng ngầm định 100% → **không** thỏa
     (100 không nhỏ hơn 100) → bỏ qua.
   - Zone K (BACKUP): 100% đầy → cũng không thỏa → bỏ qua.
   - Zone A (WALK_IN, dùng luật tạm 1.2b — ngưỡng 10%): occupancy 0% < 10% →
     **thỏa ngay** → **trả về Zone A**.
3. Không cần rớt xuống tới Fallback bậc 2.

**Điểm nhấn khi thuyết trình:** đây là bằng chứng trực quan nhất cho cơ chế
"tràn 1 chiều" MONTHLY → BACKUP → WALK_IN — khách vé tháng vẫn được xếp chỗ dù
*cả 2 tầng ưu tiên riêng của họ* đã đầy hoàn toàn, nhờ Fallback bậc 1 duyệt
đúng theo thứ tự ưu tiên đã sắp sẵn (không cần `RoutingRule` nối MONTHLY/BACKUP
với WALK_IN — điều này chỉ tồn tại trong logic Fallback, không phải trong
Database).

---

## 11. KỊCH BẢN 10 — Fallback bậc 2 trên đường vé tháng

**Bối cảnh:** Tương tự Kịch bản 7 (mục 8) nhưng cho khách vé tháng — trường hợp
**mọi Zone** (kể cả WALK_IN) đều đã vượt ngưỡng riêng của chúng, chỉ Fallback
bậc 2 (bỏ hẳn ngưỡng) mới cứu được.

**Setup:** Dùng bảng luật tạm **1.2b** cho Zone A/B (ngưỡng 10%). Zone M = 8/8
(100%), Zone M2 = 5/5 (100%), Zone K = 6/6 (100%). Zone A = 5/10 (50%, đã vượt
ngưỡng 10% từ lâu nhưng chưa đầy vật lý). Zone B = 9/10 (90%, cũng đã vượt
ngưỡng 10% nhưng chưa đầy).

**Chạy thử:** khách có vé tháng hợp lệ quét thẻ RFID tại cổng vào.

**Kết quả thực tế:**
1. Zone M đầy → dừng chuỗi chính. `visitedChain = [Zone M]`.
2. Fallback bậc 1 duyệt `remainingZones` = [Zone M2, Zone K, Zone A, Zone B]:
   Zone M2 (100%, không thỏa), Zone K (100%, không thỏa), Zone A (50% ≥ ngưỡng
   10% của chính nó → không thỏa), Zone B (90% ≥ ngưỡng 10% → không thỏa) →
   **Fallback bậc 1 thất bại hoàn toàn**.
3. Fallback bậc 2: quét lại toàn bộ `zones` theo cùng thứ tự ưu tiên, bỏ hẳn
   ngưỡng: Zone M2 (100%, không <100, bỏ qua), Zone K (100%, bỏ qua), **Zone A
   (50% < 100% → thỏa ngay)** → **trả về Zone A**.

**Điểm nhấn khi thuyết trình:** kể cả trên "đường" vé tháng, tầng Fallback bậc
2 vẫn giữ đúng thứ tự ưu tiên MONTHLY→BACKUP→WALK_IN khi quét lại — nó không
nhảy thẳng vào WALK_IN đầu tiên tìm thấy mà vẫn thử các Zone MONTHLY/BACKUP
khác (đã đầy) trước, chỉ là lần này bỏ qua điều kiện ngưỡng %.

---

## 12. KỊCH BẢN 11 — Hết sạch hoàn toàn qua nhánh vé tháng

**Bối cảnh:** Phiên bản "hết chỗ toàn bộ" (như Kịch bản 2, mục 3) nhưng đi qua
đúng nhánh xử lý MONTHLY, để khẳng định hành vi "advisory-only, không chặn xe"
cũng áp dụng nhất quán cho khách vé tháng, không chỉ khách vãng lai.

**Setup:** Zone M = 8/8, Zone M2 = 5/5, Zone K = 6/6, Zone A = 10/10, Zone B =
10/10 — **tất cả Zone không phân biệt loại đều đầy 100% vật lý**.

**Chạy thử:** khách có vé tháng hợp lệ quét thẻ RFID tại cổng vào.

**Kết quả thực tế:**
1. Zone M đầy → dừng chuỗi chính.
2. Fallback bậc 1: không Zone nào (M2/K/A/B) thỏa ngưỡng riêng của nó (đều 100%
   hoặc đã vượt ngưỡng và cũng 100%) → thất bại.
3. Fallback bậc 2: quét lại toàn bộ, không zone nào < 100% vật lý → thất bại.
4. `suggestZone()` trả về `null`.
5. Giống hệt Kịch bản 2: UI hiện "Free" (không gợi ý được), nhưng
   `processCheckIn()` **vẫn cho xe vào bình thường**, thẻ RFID vẫn cấp, cổng
   vẫn mở — advisory-only, không phân biệt khách vãng lai hay vé tháng.

**Kịch bản trả lời nếu hội đồng hỏi "vậy khách vé tháng cũng bị vậy luôn hả,
không ưu tiên gì cả khi hết chỗ thật à?":**

> "Đúng, khi bãi xe hết chỗ vật lý hoàn toàn cho mọi loại Zone, hệ thống áp
> dụng cùng 1 nguyên tắc advisory-only cho mọi loại khách — vì lúc này không
> còn zone nào để 'ưu tiên' nữa, quyết định cho xe vào hay không thuộc về nhân
> viên gác cổng, giống hệt lý do đã trình bày ở Kịch bản 2."

---

## 13. Bảng câu hỏi nhanh (cheat-sheet) hội đồng hay hỏi khi bắt bẻ Routing

| Câu hỏi hội đồng | Trả lời ngắn |
|---|---|
| Ngưỡng % trượt zone lấy ở đâu ra, sao không phải AI học? | Do quản lý tự cấu hình trong `RoutingRuleService`/màn hình `VehicleRoutingScreen`, đây là luật nghiệp vụ tường minh (rule-based), không phải machine learning — đúng phạm vi đồ án. |
| Nếu cấu hình 1 vòng lặp A→B→A thì sao? | Có chặn: biến `visitedChain` ghi nhớ zone đã đi qua, gặp lại thì dừng và log cảnh báo "Infinite routing loop detected", không bị treo hệ thống. |
| Khung giờ qua đêm (22:00–06:00) có hoạt động không? | Không hoạt động nếu cấu hình 1 luật duy nhất kiểu 22:00→06:00 (giới hạn đã biết). Cách né: cấu hình 2 luật `22:00–23:59` + `00:00–06:00`, hoạt động đúng 100%. Lưu ý không dùng `24:00` (parse lỗi). |
| Đặt chỗ trước có tính vào % lấp đầy không? | Có — `calculateZoneOccupancy` cộng cả slot đang OCCUPIED lẫn số đặt chỗ PENDING rơi vào "cửa sổ giữ chỗ" (trước giờ hẹn `RESERVATION_EARLY_MINS` phút, tới hết thời lượng dự kiến đỗ), để tránh xe vãng lai chiếm mất chỗ người đã đặt trước. |
| Zone bị khoá bảo trì (DISABLED) tính sao? | Bị trừ khỏi mẫu số (effective capacity); nếu toàn bộ slot của zone đều DISABLED thì occupancy trả thẳng 100% (coi như đầy, không nhận thêm xe). |
| Vé tháng bán dư có bị chặn không? | Không, chỉ cảnh báo quản lý ở ngưỡng cấu hình được (mặc định 90%), là overbook có kiểm soát, xem Kịch bản 4. |
| Xe vé tháng vào khi Zone tháng hết mà không có luật routing nối Zone tháng, vậy sao vẫn tràn được sang zone khác? | Nhờ "Fallback bậc 1" duyệt lại toàn bộ zone chưa đi qua theo đúng thứ tự ưu tiên MONTHLY→BACKUP→WALK_IN, không cần RoutingRule nối chúng — xem giải thích thuật toán trong `ZoneRoutingService` (LƯU Ý 2 đầu file). |
| Fallback bậc 1 và bậc 2 khác nhau chỗ nào? | Bậc 1 vẫn tôn trọng ngưỡng % cấu hình riêng của từng zone (chỉ zone MONTHLY/BACKUP không rule mới coi ngưỡng là 100%); bậc 2 là "vét máng" cuối cùng, bỏ hẳn mọi ngưỡng, chỉ cần zone chưa đầy 100% vật lý là nhận — xem Kịch bản 6-11. |
| Nếu quản lý tạo Zone mới mà quên gắn luật routing thì sao? | Zone đó vẫn không bị bỏ quên — Fallback bậc 1 tự động xét tới nó như phương án dự phòng dù không nằm trong chuỗi `RoutingRule` nào, xem Kịch bản 6. |
| Nếu có nhiều hơn 1 Zone MONTHLY, khách vé tháng được xếp theo thứ tự nào? | Ưu tiên các Zone MONTHLY khác còn trống trước, chỉ khi tất cả Zone MONTHLY đều đầy mới tràn xuống BACKUP rồi WALK_IN — xem Kịch bản 8, 9. |

---

## 14. Việc cần chuẩn bị trước ngày demo (checklist)

- [ ] Seed sẵn đúng số liệu Zone/Slot theo từng kịch bản ở mục 1.4 (script SQL
      hoặc thao tác tay trên UI quản lý trước giờ thuyết trình).
- [ ] Test thử "Time Fast-Forward" trước để chắc chắn demo được thông báo
      `ZONE_CONFLICT` đúng lúc, tránh lỗi giờ hệ thống lệch pha lúc demo thật.
      Nhớ mở sẵn app `pbms-iot-simulator` — nút này nằm ở đó, không có trong
      `pbms-fe`.
- [ ] Seed thêm Zone C (WALK_IN, không gắn luật) và Zone M2 (MONTHLY thứ 2)
      theo mục 1.1 — cần cho Kịch bản 6, 8, 9, 10, 11.
- [ ] Trước khi demo Kịch bản 6/7/9/10, nhớ đổi ngưỡng Zone A/B sang bảng luật
      tạm **1.2b** (10%) trên `VehicleRoutingScreen`; đổi lại đúng bảng **1.2**
      gốc (80%/60%/95%) trước khi quay lại demo Kịch bản 1/2/6, tránh chạy sai
      bộ số giữa các lượt demo.
- [ ] Chuẩn bị sẵn 1-2 câu trả lời ở mục 13 thuộc lòng, không đọc giấy khi
      hội đồng hỏi dồn.
