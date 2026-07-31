# PHÂN TÍCH — CƠ CHẾ GHI NHẬN XU HƯỚNG LẤP ĐẦY THEO GIỜ

> Phân tích 2 file `ZoneTrendSchedulingService.java` và `ZoneTrendService.java`,
> cùng file phối hợp `ZoneOccupancyTracker.java`. Trả lời câu hỏi: **một con số
> trên biểu đồ được sinh ra như thế nào** — từ lúc cảm biến báo có xe, tới lúc
> thành một điểm trên đường biểu đồ.

---

## 1. Bài toán cần giải

Quản lý muốn biết: *"Zone A của tôi giờ nào trong ngày thì căng nhất?"*

Cách làm ngây thơ: cứ mỗi đầu giờ thì đo độ đầy một lần rồi lưu lại. Nhưng cách
này **sai nặng**:

```
Giờ 10h của Zone A trong thực tế:
10:00 ──── 30%
10:20 ──── 95%   ← bãi kẹt cứng ở đây, đây mới là thứ quản lý cần biết
10:55 ──── 10%   ← xe rút hết
11:00 → đo và lưu: 10%
```

Báo cáo sẽ nói "10h bãi rất thoáng (10%)" — trong khi thực tế 10h là giờ kẹt
nhất ngày. Đợt cao điểm ngắn bị bỏ sót hoàn toàn.

**Giải pháp**: thay vì đo một lần, phải **theo dõi liên tục suốt giờ và nhớ lại
mức cao nhất**. Đây chính là lý do tính năng này cần tới 3 lớp thay vì 1 hàm.

---

## 2. Ba lớp, ba vai trò

```
   Cảm biến IoT báo ô đỗ đổi trạng thái
              │
              ▼
   ┌──────────────────────────┐
   │  ZoneMonitoringService   │  tính lại độ đầy Zone
   └──────────┬───────────────┘
              │ updateOccupancy(zoneId, 95%)
              ▼
   ┌──────────────────────────┐
   │  ZoneOccupancyTracker    │  LỚP 1 — nhớ mức CAO NHẤT trong giờ
   │  (Map trong RAM)         │  chỉ tăng, không bao giờ giảm
   └──────────┬───────────────┘
              │ mỗi đầu giờ, bị "móc" giá trị ra
              ▼
   ┌──────────────────────────┐
   │ ZoneTrendSchedulingService│ LỚP 2 — canh giờ, điều phối
   │  (không tính, không ghi)  │
   └──────────┬───────────────┘
              │ recordZoneTrend(zoneId, 95%, khung_giờ_14h)
              ▼
   ┌──────────────────────────┐
   │     ZoneTrendService     │  LỚP 3 — ghi sổ + dựng báo cáo
   └──────────┬───────────────┘
              │
              ▼
       Bảng zone_hourly_trends  →  getZoneTrends()  →  Biểu đồ
```

| Lớp | File | Vai trò một câu |
|---|---|---|
| 1 | `ZoneOccupancyTracker` | Cái thước đo mực nước lũ — nước rút rồi nhưng vệt bùn vẫn ghi mức cao nhất |
| 2 | `ZoneTrendSchedulingService` | Người canh giờ — không tính toán gì, chỉ quyết định *khi nào* chốt sổ |
| 3 | `ZoneTrendService` | Người ghi sổ (hàm ghi) và người dựng báo cáo (hàm đọc) |

---

## 3. LỚP 1 — "Lấy đỉnh" được thực hiện như thế nào

File: [ZoneOccupancyTracker.java](../pbms-be/src/main/java/com/pbms/modules/operation/service/ZoneOccupancyTracker.java)

### 3.1. Cấu trúc lưu trữ

Một `ConcurrentHashMap` nằm trong bộ nhớ tiến trình backend:

```
"pbms:high-water-mark:zone:1"  →  "95.00"
"pbms:high-water-mark:zone:2"  →  "40.00"
```

Mỗi Zone một dòng, giá trị là độ đầy cao nhất **tính từ đầu giờ hiện tại tới lúc này**.

> **Chi tiết dễ gây hiểu nhầm**: biến trong code tên là `redisTemplate`, hằng số
> tên `REDIS_PREFIX`, khoá đặt theo đúng quy ước Redis. Nhưng bên dưới **không
> phải Redis** — chỉ là Map trong RAM. Đặt tên như vậy để sau này muốn chuyển
> sang Redis thật thì chỉ thay lớp lưu trữ, không phải sửa logic.

### 3.2. Hàm `updateOccupancy()` — chỉ đi lên, không đi xuống

Được gọi **mỗi khi cảm biến báo một ô đỗ đổi trạng thái**, từ
`ZoneMonitoringService.processSensorEvent()`:

```java
if (storedValue == null) {
    lưu luôn giá trị hiện tại          // lần đầu trong giờ
} else if (currentOccupancy > peakOccupancy) {
    ghi đè bằng giá trị mới            // chỉ khi CAO HƠN
}
// nếu thấp hơn: không làm gì cả
```

Đây là toàn bộ bí quyết của "lấy đỉnh". Đơn giản nhưng chính xác: dù độ đầy lên
xuống bao nhiêu lần trong giờ, con số lưu lại luôn là mức cao nhất từng chạm tới.

### 3.3. Hàm `getAndResetPeakOccupancy()` — móc đỉnh ra và đặt lại vạch xuất phát

Hàm này làm **hai việc trong một lần gọi**, và đây là chỗ khó hiểu nhất của cả
tính năng:

```java
public BigDecimal getAndResetPeakOccupancy(Long zoneId, BigDecimal currentOccupancy) {
    String storedValue = redisTemplate.get(key);      // ① đọc đỉnh của giờ VỪA QUA
    redisTemplate.put(key, currentOccupancy.toString()); // ② đặt lại = độ đầy HIỆN TẠI
    return storedValue == null ? currentOccupancy : new BigDecimal(storedValue); // ③ trả về đỉnh cũ
}
```

**Vì sao phải truyền `currentOccupancy` vào một hàm tên là "get"?**

Vì giờ mới không bắt đầu từ 0. Nếu bãi đang có 20 xe lúc sang giờ mới thì vạch
xuất phát của giờ mới phải là 20 xe đó, không phải số 0. Nếu đặt lại về `null`,
đỉnh của giờ mới sẽ chỉ được ghi nhận khi có xe vào tiếp — mà nếu suốt giờ đó
không xe nào vào ra, ta sẽ mất trắng thông tin "bãi giữ nguyên mức 20 xe cả giờ".

Tóm lại, `currentOccupancy` không phải giá trị đem đi lưu — nó là **vạch xuất
phát cho giờ tiếp theo**.

---

## 4. LỚP 2 — Chốt sổ mỗi giờ

File: [ZoneTrendSchedulingService.java](../pbms-be/src/main/java/com/pbms/modules/operation/service/ZoneTrendSchedulingService.java)

Class này **không tính toán độ đầy và cũng không đụng vào bảng
`zone_hourly_trends`**. Nó chỉ trả lời câu hỏi "khi nào cần chốt sổ", rồi gọi
lớp 1 và lớp 3.

### 4.1. Hai nguồn kích hoạt

| Hàm | Kích hoạt bởi | Dùng khi nào |
|---|---|---|
| `recordHourlyZoneTrends()` | Cron `0 0 * * * *` — đúng đầu mỗi giờ theo đồng hồ **thật** của máy chủ | Chạy bình thường |
| `handleTimeFastForward()` | Sự kiện `TimeFastForwardedEvent` do IoT Simulator bắn ra | Khi tua thời gian mô phỏng |

**Vì sao cần nguồn thứ hai?** Vì `TimeProvider.now()` là đồng hồ *mô phỏng* — tua
nó từ 8h sang 22h thì đồng hồ *thật* của máy chủ vẫn đứng yên, cron `@Scheduled`
không chạy lần nào. Nếu không xử lý riêng, 14 giờ bị nhảy cóc qua sẽ mất trắng
dữ liệu. Hàm này lặp **từng giờ một** từ mốc cũ tới trước mốc mới để chốt bù đủ:

```java
LocalDateTime iter = oldTime;
while (iter.isBefore(newTime)) {
    recordTrendForTime(iter);
    iter = iter.plusHours(1);
}
```

Điều kiện `oldTime.isBefore(newTime)` nghĩa là **chỉ chốt bù khi tua tới tương
lai**; tua ngược về quá khứ thì không làm gì (không ghi đè lại lịch sử đã có).

### 4.2. Chi tiết `minusHours(1)` — dễ bị hỏi nhất

```java
LocalDateTime timeWindow = TimeProvider.now().minusHours(1).withMinute(0)...;
```

Cron chạy đúng lúc 11:00:00. Giờ **vừa kết thúc** và cần chốt số liệu là giờ
**10h**, không phải 11h (11h mới vừa bắt đầu, chưa có gì để chốt). Nên phải trừ
đi 1 giờ rồi làm tròn về đầu giờ.

### 4.3. Hàm chung `recordTrendForTime()` — ba bước cho mỗi Zone

Cả hai nguồn trên đều đổ về đây. Với **từng Zone đang ACTIVE**:

```java
// Bước 1: đo độ đầy TỨC THỜI ngay lúc này
BigDecimal currentOccupancy = zoneRoutingService.calculateZoneOccupancy(zone.getId());

// Bước 2: móc đỉnh của giờ vừa qua ra, đồng thời đặt lại vạch xuất phát = bước 1
BigDecimal peakOccupancy = zoneOccupancyTracker.getAndResetPeakOccupancy(zone.getId(), currentOccupancy);

// Bước 3: đưa ĐỈNH (không phải giá trị bước 1) cho lớp 3 ghi xuống DB
zoneTrendService.recordZoneTrend(zone.getId(), peakOccupancy, timeWindow);
```

**Điểm mấu chốt**: thứ được lưu xuống Database là `peakOccupancy` (bước 2), còn
`currentOccupancy` (bước 1) chỉ tồn tại để làm vạch xuất phát cho giờ mới. Nhìn
lướt qua rất dễ tưởng bước 1 là giá trị đem đi lưu.

---

## 5. LỚP 3A — Ghi sổ (`recordZoneTrend`)

File: [ZoneTrendService.java](../pbms-be/src/main/java/com/pbms/modules/operation/service/ZoneTrendService.java)

### 5.1. Quy tắc bất biến

**Mỗi Zone × mỗi giờ chỉ tồn tại đúng 1 dòng.** Khung giờ luôn được làm tròn về
đầu giờ, nên `14:00:00.000` là đại diện cho toàn bộ khoảng 14h–15h.

### 5.2. Logic ghi — upsert kiểu "giữ giá trị lớn nhất"

```
Tìm bản ghi của Zone này trong khoảng [window, window + 1h - 1ns]
│
├─ CHƯA CÓ  → tạo dòng mới với giá trị nhận được
│
└─ ĐÃ CÓ    → chỉ ghi đè khi giá trị mới CAO HƠN giá trị đang lưu
```

Hàm này có thể được gọi nhiều lần cho cùng một giờ (cron chạy trùng, tua giờ
chồng lấn) mà kết quả vẫn đúng — gọi bao nhiêu lần cũng chỉ giữ lại mức cao nhất.

### 5.3. Cơ chế dọn bản ghi trùng

Nếu hai lần gọi chạy gần như đồng thời, có thể lỡ tạo ra 2 dòng cùng Zone + cùng
giờ. Đoạn cuối hàm xử lý việc này:

```
Nếu tìm thấy nhiều hơn 1 dòng trùng:
   - gộp giá trị cao nhất về dòng đầu tiên
   - xoá hẳn các dòng còn lại
   → đảm bảo quay về đúng 1 dòng
```

---

## 6. LỚP 3B — Dựng báo cáo (`getZoneTrends`)

Đây là hàm khó nhất trong hai file, vì nó **không đọc thẳng Database rồi trả về**.

### 6.1. Vì sao không đọc thẳng?

Nếu chỉ trả những gì DB có, biểu đồ sẽ bị "thủng" ở mọi giờ chưa từng được ghi
(Zone mới tạo, hệ thống chưa chạy vào giờ đó…). Đường biểu đồ đứt đoạn trông
giống hệt lỗi mất dữ liệu.

### 6.2. Cách làm: duyệt vét cạn rồi điền vào

Hàm lặp qua **mọi tổ hợp (từng ngày × từng giờ 0–23 × từng Zone ACTIVE)** trong
khoảng yêu cầu. Với mỗi ô, quyết định điền gì theo 4 nhánh:

| Giờ đang xét | Điền gì | Vì sao |
|---|---|---|
| **Sau giờ hiện tại** (tương lai) | Không sinh điểm nào, `continue` bỏ qua | Đây là biểu đồ lịch sử, không phải dự báo |
| **Đúng giờ hiện tại** | Gọi `calculateZoneOccupancy()` tính **realtime** | Giờ chưa kết thúc nên đỉnh chưa chốt xong; đọc DB sẽ ra số cũ từ đầu giờ |
| **Quá khứ, có bản ghi** | Lấy giá trị đã chốt trong DB | Là đỉnh điểm thật của giờ đó |
| **Quá khứ, không có bản ghi** | Điền cứng **0%** | Để đường biểu đồ liền mạch thay vì đứt khúc |

Nếu vẫn còn nhiều bản ghi trùng sót lại từ trước, hàm lấy giá trị **cao nhất** —
cùng triết lý với hàm ghi, tuyệt đối không cộng dồn hay lấy trung bình.

### 6.3. Kết quả trả về

Một **danh sách phẳng** gồm nhiều phần tử `{timeWindow, zoneId, zoneName,
occupancyPct}`, ví dụ:

```
{ "14:00 30/07", 1, "Zone A", 95.00 }
{ "14:00 30/07", 2, "Zone B", 40.00 }
{ "15:00 30/07", 1, "Zone A", 20.00 }
{ "15:00 30/07", 2, "Zone B", 45.00 }
```

Giao diện tự nhóm lại theo Zone để vẽ mỗi Zone một đường màu riêng.

---

## 7. Đi theo một con số từ đầu đến cuối

Ví dụ xuyên suốt: **Zone A có 10 ô, ngày 30/07, khung giờ 14h.**

| Thời điểm | Chuyện gì xảy ra | Map trong RAM | Bảng `zone_hourly_trends` |
|---|---|---|---|
| 14:00:00 | Cron chạy: chốt giờ 13h. Đo hiện tại = **30%**, đặt lại vạch xuất phát | `zone:1 → 30` | +1 dòng cho giờ 13:00 |
| 14:12 | 1 xe vào → 40%. Cao hơn 30 → nâng lên | `zone:1 → 40` | *(không đụng)* |
| 14:20 | Nhiều xe vào → 90%. Cao hơn → nâng | `zone:1 → 90` | *(không đụng)* |
| 14:35 | Thêm xe → **95%**. Cao hơn → nâng | `zone:1 → 95` | *(không đụng)* |
| 14:50 | Xe ra hàng loạt → 20%. **Thấp hơn → không làm gì** | `zone:1 → 95` | *(không đụng)* |
| 15:00:00 | Cron chạy. Bước 1: đo hiện tại = **20%**. Bước 2: móc ra đỉnh **95%**, đặt lại = 20%. Bước 3: ghi DB | `zone:1 → 20` | **+1 dòng: (Zone A, 14:00, 95.00)** |
| Sau đó | Mở biểu đồ | | Cột `14:00 30/07` của Zone A = **95%** |

Điểm cần thấy rõ ở bảng này:
- Trong suốt giờ 14h, Database **không bị ghi lần nào** — mọi biến động chỉ diễn
  ra trong RAM. Đây là chủ đích: cảm biến bắn tín hiệu rất dày, ghi thẳng DB mỗi
  lần sẽ tạo lượng ghi khổng lồ trong khi ta chỉ cần 1 dòng cho mỗi giờ.
- Con số **20%** ở mốc 15:00 không hề bị lưu vào giờ 14h — nó chỉ là vạch xuất
  phát cho giờ 15h.
- Nếu ai đó mở biểu đồ lúc 14:50 (khi giờ 14h còn đang chạy), cột `14:00` sẽ
  hiện **20%** (tính realtime), rồi sau 15:00 mới nhảy thành 95% (giá trị đã
  chốt). Không phải lỗi — hai nguồn dữ liệu khác nhau cho hai thời điểm khác nhau.

---

## 8. Những chỗ tinh tế, dễ hiểu nhầm khi đọc code

| Chỗ dễ nhầm | Sự thật |
|---|---|
| `getAndResetPeakOccupancy(zoneId, currentOccupancy)` — sao hàm "get" lại nhận tham số? | Nó vừa đọc vừa reset. Tham số truyền vào là vạch xuất phát cho giờ mới, không phải giá trị đem lưu |
| Bước 1 của `recordTrendForTime` đo độ đầy hiện tại → tưởng đây là giá trị lưu vào DB | Không. Giá trị lưu là kết quả bước 2 (đỉnh). Bước 1 chỉ để reset |
| `redisTemplate` / `REDIS_PREFIX` → tưởng đang dùng Redis | Là `ConcurrentHashMap` trong RAM. Tên chỉ theo quy ước để dễ chuyển đổi sau |
| Cron chạy lúc 11:00 → tưởng ghi dữ liệu cho 11h | Ghi cho **10h** (giờ vừa kết thúc), nhờ `minusHours(1)` |
| Cột cuối biểu đồ thay đổi khi F5, cột trước thì không | Cột hiện tại tính realtime, cột quá khứ đọc giá trị đã chốt. Đúng thiết kế |
| Giờ quá khứ hiện 0% → tưởng bãi trống thật | Có thể là "trống thật" hoặc "chưa từng có bản ghi". Hai trường hợp đang bị gộp làm một |

---

## 9. Giới hạn của thiết kế hiện tại

| Giới hạn | Ảnh hưởng thực tế |
|---|---|
| Đỉnh điểm của giờ **đang chạy dở** nằm trong RAM | Khởi động lại backend sẽ mất đỉnh của đúng giờ đó. Lịch sử các giờ đã chốt vẫn an toàn trong DB |
| Map trong RAM, không phải Redis | Nếu chạy nhiều máy chủ song song, mỗi máy có bản Map riêng → số liệu lệch nhau. Với 1 máy chủ như hiện tại thì hoàn toàn chính xác |
| Giờ quá khứ không có bản ghi và bãi trống thật đều hiện 0% | Không phân biệt được "không có dữ liệu" với "bãi trống". Cách sửa nếu cần: trả `null` và cho biểu đồ vẽ nét đứt |
| Cột giờ hiện tại gọi `calculateZoneOccupancy()` **riêng cho từng Zone** | N Zone thì N lượt gọi, mỗi lượt lại tự truy vấn DB nhiều lần (lỗi N+1 quen thuộc). Chấp nhận được ở quy mô nhỏ |
| Khoảng ngày bị chặn tối đa **31 ngày** | Vì hàm phải lặp qua từng giờ × từng ngày × từng Zone. Vượt quá sẽ bị `ZoneTrendController` chặn |
| Dữ liệu các giờ chốt bù khi tua thời gian đều **giống hệt nhau** | Vì các giờ đó không diễn ra thật, không có tín hiệu cảm biến nào. Mục đích của chốt bù là không thủng dữ liệu, không phải mô phỏng biến động |

---

## 10. Tóm tắt trong 5 câu

1. Cảm biến báo mỗi lần ô đỗ đổi trạng thái, hệ thống tính lại độ đầy và đưa cho
   `ZoneOccupancyTracker` — nơi **chỉ giữ lại mức cao nhất**, không bao giờ hạ xuống.
2. Đúng đầu mỗi giờ, `ZoneTrendSchedulingService` móc đỉnh của giờ vừa kết thúc
   ra, đồng thời đặt lại vạch xuất phát bằng độ đầy hiện tại.
3. Đỉnh đó được `ZoneTrendService.recordZoneTrend()` ghi xuống bảng
   `zone_hourly_trends` — mỗi Zone × mỗi giờ đúng 1 dòng, có cơ chế gộp nếu lỡ trùng.
4. Khi mở biểu đồ, `getZoneTrends()` duyệt vét cạn mọi (Zone × giờ) và điền theo
   4 nhánh: tương lai bỏ qua, giờ hiện tại tính realtime, quá khứ có bản ghi thì
   đọc DB, quá khứ không có thì điền 0%.
5. Nhờ vậy biểu đồ luôn liền mạch và phản ánh đúng **lúc bãi căng nhất** trong
   từng giờ, thay vì một ảnh chụp ngẫu nhiên ở cuối giờ.
