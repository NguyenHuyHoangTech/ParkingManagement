# KỊCH BẢN TEST — ĐIỀU PHỐI ZONE (ROUTING)

> **Nguyên tắc của tài liệu này**: mọi kịch bản đều thao tác **hoàn toàn trên
> trình duyệt** (màn hình Manager + màn hình Staff + IoT Simulator). Không dùng
> Postman, không sửa tay Database, không gọi curl. Mục tiêu là chứng minh được
> **các cách điều phối xe** của hệ thống và các tình huống lỗi mà người dùng
> thật sự gặp.

---

## 0. CHUẨN BỊ

### 0.1. Ba trang web cần mở song song

| Trang | Địa chỉ | Dùng để |
|---|---|---|
| Manager | `http://localhost:5173/manager/routing` | Cấu hình luật, xem biểu đồ, gọi AI |
| Staff — Gate Console | `http://localhost:5173` (đăng nhập Staff, mở ca ở 1 cổng vào) | **Xem kết quả điều phối** |
| IoT Simulator | `http://localhost:3001` | Bắn xe vào, set ô đỗ đầy/trống, tua giờ |

Mở bằng `localhost`, không dùng IP LAN/ngrok (bị chặn WebSocket → không thấy tín hiệu realtime).

### 0.2. Ba nơi quan sát kết quả

**① Ô Zone gợi ý (màn hình Staff, giữa màn hình)** — kết quả cuối cùng của thuật
toán: hiện tên Zone, hoặc chữ `Free` khi không điều phối được.

**② Danh sách thẻ Zone (màn hình Staff, góc dưới trái)** — đây là bảng điều
khiển quan trọng nhất khi test, mỗi Zone hiện:
- `<số ô còn trống> / <sức chứa hiệu dụng>`
- `Reserved incoming:` số đặt chỗ đang giữ chỗ
- `Fill rate: xx.x%` ← **chính là con số thuật toán dùng để so với ngưỡng**
- Thẻ **viền xanh sáng** = Zone đang được gợi ý; **nền đỏ** = hết chỗ; **icon cảnh báo** = vượt 100%

**③ Biểu đồ "Water Leveling Each Zone" (màn hình Manager)** — lịch sử đỉnh điểm theo giờ.

### 0.3. Dữ liệu nền dựng sẵn (làm 1 lần, dùng cho tất cả kịch bản)

Trên **Space Map**, tầng 1, loại xe Motorbike:

| Zone | Chức năng | Số ô | Vai trò trong test |
|---|---|---|---|
| Zone A | WALK_IN | 10 | Zone ưu tiên đầu tiên |
| Zone B | WALK_IN | 10 | Nhận xe khi A đầy |
| Zone C | WALK_IN | 5 | Nhận xe khi B đầy |
| Zone M | MONTHLY | 8 | Chỉ khách vé tháng |
| Zone K | BACKUP | 6 | Dự phòng cho khách vé tháng |

Trên **Vehicle Routing** (tầng 1 + Motorbike), lưu chuỗi mặc định:
`Zone A (80%) → Zone B (90%) → Zone C (95%)`.

Trên **System Config**: `DISPLAY_ROUTING = TRUE`, `RESERVATION_EARLY_MINS = 30`.

### 0.4. Mẹo set độ đầy nhanh

Vào tab **Sensor Map** của IoT Simulator, bấm trực tiếp lên từng ô đỗ để đổi
trạng thái trống ↔ có xe. Đây là cách nhanh nhất để đưa 1 Zone lên đúng % mong
muốn mà không cần bắn từng xe qua cổng.

---

## 1. NHÓM 1 — CÁC CÁCH ĐIỀU PHỐI CƠ BẢN (phần chính cần thể hiện)

### KB-01. Zone còn thoáng → giữ nguyên Zone ưu tiên nhất

| | |
|---|---|
| **Nghiệp vụ** | Khi khu vực ưu tiên còn thoáng, hệ thống không cần điều phối đi đâu cả |
| **Chuẩn bị** | Sensor Map: Zone A cho 7/10 ô có xe → thẻ Zone A hiện `Fill rate: 70.0%` |
| **Thao tác** | IoT Simulator → tab Gate Check-in → chọn cổng đang trực → nhập biển số → Fire |
| **Kết quả** | Ô gợi ý hiện **`Zone A`**; thẻ Zone A viền xanh sáng |

### KB-02. Vượt ngưỡng → tự động đẩy sang Zone kế tiếp

| | |
|---|---|
| **Nghiệp vụ** | Zone A chạm ngưỡng 80% thì xe mới được hướng sang Zone B, tránh dồn cục bộ |
| **Chuẩn bị** | Zone A: 9/10 ô có xe (`Fill rate: 90.0%`); Zone B: 2/10 (`20.0%`) |
| **Thao tác** | Bắn 1 xe vào |
| **Kết quả** | Ô gợi ý hiện **`Zone B`**; thẻ Zone B viền xanh, thẻ Zone A không được chọn dù vẫn còn 1 ô trống |

### KB-03. Biên ngưỡng — đầy **đúng bằng** ngưỡng vẫn bị đẩy đi

| | |
|---|---|
| **Nghiệp vụ** | Ngưỡng 80% nghĩa là "đạt 80% là ngừng nhận thêm", không phải "vượt quá 80%" |
| **Chuẩn bị** | Zone A: **8/10** ô có xe → `Fill rate: 80.0%` (đúng bằng ngưỡng đã cấu hình) |
| **Thao tác** | Bắn 1 xe vào |
| **Kết quả** | Gợi ý **`Zone B`**, KHÔNG phải Zone A |
| **Ghi chú** | Đây là câu hỏi hội đồng hay hỏi nhất. Nếu muốn A nhận tới 80% thì phải cấu hình ngưỡng 81% |

### KB-04. Đẩy dây chuyền 2 bậc liên tiếp

| | |
|---|---|
| **Nghiệp vụ** | Chuỗi điều phối hoạt động nhiều tầng, không chỉ 1 bước |
| **Chuẩn bị** | Zone A: 9/10 (`90%` ≥ 80); Zone B: 10/10 (`100%` ≥ 90); Zone C: 0/5 (`0%`) |
| **Thao tác** | Bắn 1 xe vào |
| **Kết quả** | Gợi ý **`Zone C`** — hệ thống đã trượt A → B → C trong 1 lần tính |

### KB-05. Cơ chế cứu hộ — mọi Zone vượt ngưỡng nhưng vẫn còn chỗ

| | |
|---|---|
| **Nghiệp vụ** | Không bao giờ từ chối xe khi bãi vẫn còn chỗ trống thật, kể cả khi mọi Zone đều đã quá ngưỡng "đẹp" |
| **Chuẩn bị** | Màn Manager: hạ ngưỡng thành **A = 80%, B = 80%, C = 50%** → Save. Sensor Map: Zone A **9/10** (90%), Zone B **9/10** (90%), Zone C **4/5** (80%). Cả 3 đều đã vượt ngưỡng của mình nhưng **chưa Zone nào đầy 100%** |
| **Thao tác** | Bắn 1 xe vào |
| **Kết quả** | Vẫn gợi ý được 1 Zone — cụ thể là **`Zone A`** (Zone ưu tiên cao nhất còn dưới 100%), chứ **không** hiện `Free` |
| **Ghi chú** | Đây là "phao cứu sinh": khi đã đi hết chuỗi mà không Zone nào đạt chuẩn, hệ thống hạ tiêu chuẩn xuống còn "miễn là còn chỗ trống thật" và quay lại chọn từ đầu theo thứ tự ưu tiên |

### KB-06. Bãi đầy tuyệt đối → không điều phối được

| | |
|---|---|
| **Nghiệp vụ** | Chỉ khi thực sự không còn ô nào, hệ thống mới báo không có gợi ý |
| **Chuẩn bị** | Zone A, B, C đều đầy 100% |
| **Thao tác** | Bắn 1 xe vào |
| **Kết quả** | Ô gợi ý hiện **`Free`**; cả 3 thẻ Zone đều nền đỏ |

### KB-07. Xe vãng lai không bao giờ bị đẩy vào khu vé tháng

| | |
|---|---|
| **Nghiệp vụ** | Ràng buộc cứng: khách vãng lai không được lấn khu dành riêng cho khách vé tháng |
| **Chuẩn bị** | Zone A, B, C đầy 100%; Zone M (MONTHLY) và Zone K (BACKUP) **trống hoàn toàn** |
| **Thao tác** | Bắn 1 xe **không có vé tháng** vào |
| **Kết quả** | Hiện **`Free`** — dù Zone M và K còn trống nguyên |

### KB-08. Ô bảo trì làm giảm sức chứa, đẩy ngưỡng chạm sớm hơn

| | |
|---|---|
| **Nghiệp vụ** | Ô đang bảo trì không được tính là chỗ đỗ, nên Zone chạm ngưỡng nhanh hơn |
| **Chuẩn bị** | Zone A: đặt 3 ô sang trạng thái bảo trì, cho 6 ô có xe |
| **Thao tác** | Xem thẻ Zone A trên màn Staff, rồi bắn 1 xe |
| **Kết quả** | Thẻ hiện sức chứa hiệu dụng **`/ 7`** (không phải 10) và `Fill rate: 85.7%` (= 6/7) → vượt ngưỡng 80% → gợi ý **`Zone B`** |

### KB-09. Đặt chỗ trước cũng chiếm chỗ trong tính toán

| | |
|---|---|
| **Nghiệp vụ** | Chỗ đã có người đặt phải được giữ, không để xe vãng lai chiếm mất |
| **Chuẩn bị** | Tạo 3 đơn đặt chỗ vào Zone A với giờ hẹn **trong vòng 30 phút tới**; Zone A có 6/10 ô có xe |
| **Thao tác** | Xem thẻ Zone A, rồi bắn 1 xe vào |
| **Kết quả** | Thẻ hiện `Reserved incoming: 3` và `Fill rate: 90.0%` (= (6+3)/10) → vượt ngưỡng → gợi ý **`Zone B`**, dù Zone A vật lý vẫn còn 4 ô trống |

### KB-10. Đặt chỗ ngoài khung giờ thì không giữ chỗ

| | |
|---|---|
| **Nghiệp vụ** | Chỉ giữ chỗ khi khách sắp đến, không giữ suốt cả ngày |
| **Chuẩn bị** | Cùng cấu hình KB-09 nhưng giờ hẹn cách hiện tại **2 tiếng** |
| **Thao tác** | Xem thẻ Zone A, bắn 1 xe |
| **Kết quả** | `Reserved incoming: 0`, `Fill rate: 60.0%` → gợi ý **`Zone A`** |

### KB-11. Đổi cấu hình có hiệu lực ngay, không cần khởi động lại

| | |
|---|---|
| **Nghiệp vụ** | Quản lý điều chỉnh chính sách giữa ca, cổng áp dụng ngay lập tức |
| **Chuẩn bị** | Zone A đang ở 60% |
| **Thao tác** | Bắn 1 xe → ghi nhận kết quả. Sang màn Manager hạ ngưỡng Zone A xuống **50%** → Save → quay lại bắn xe thứ 2 |
| **Kết quả** | Xe 1 → `Zone A`; xe 2 → **`Zone B`** |

### KB-12. Tắt hiển thị điều phối

| | |
|---|---|
| **Nghiệp vụ** | Quản lý có thể tạm ẩn gợi ý để nhân viên tự sắp xếp |
| **Thao tác** | Màn Manager: gạt tắt công tắc Routing Display → bắn 1 xe |
| **Kết quả** | Toast xanh `Routing display disabled. Incoming vehicles will show FREE.`; ô gợi ý trên màn Staff hiện **`Free`** dù bãi còn trống |

### KB-13. Nhân viên có quyền bỏ qua gợi ý

| | |
|---|---|
| **Nghiệp vụ** | Gợi ý là khuyến nghị, không phải ép buộc |
| **Chuẩn bị** | Bật lại Routing Display, bắn 1 xe được gợi ý Zone B |
| **Thao tác** | Bấm nút **Switch to Free** trên màn Staff → Confirm cho xe vào |
| **Kết quả** | Ô gợi ý chuyển thành `Free`; toast `Vehicle entry confirmed! Suggested zone: Free` |

---

## 2. NHÓM 2 — ĐIỀU PHỐI THEO KHUNG GIỜ

Dùng tab **Time Controller** của IoT Simulator để tua giờ.

### KB-14. Luật khung giờ thắng luật mặc định

| | |
|---|---|
| **Nghiệp vụ** | Giờ cao điểm siết ngưỡng chặt hơn để giãn xe sớm |
| **Chuẩn bị** | Màn Manager: thêm khung giờ `06:00–22:00` với ngưỡng Zone A = **60%**; giữ khung Default ngưỡng A = 80% → Save |
| **Thao tác** | Tua giờ về **10:00**. Cho Zone A ở 7/10 (70%) → bắn 1 xe |
| **Kết quả** | Gợi ý **`Zone B`** (70% ≥ 60%) |

### KB-15. Ngoài khung giờ thì quay về luật mặc định

| | |
|---|---|
| **Chuẩn bị** | Giữ nguyên cấu hình KB-14, Zone A vẫn 70% |
| **Thao tác** | Tua giờ về **23:00** → bắn 1 xe |
| **Kết quả** | Gợi ý **`Zone A`** (70% < 80%) |

### KB-16. Biên khung giờ — tính cả đầu lẫn cuối

| | |
|---|---|
| **Thao tác** | Tua lần lượt về **06:00**, **22:00**, rồi **22:01**; mỗi lần bắn 1 xe với Zone A ở 70% |
| **Kết quả** | 06:00 → Zone B; 22:00 → Zone B (vẫn trong khung); 22:01 → **Zone A** (đã rơi về luật mặc định) |

### KB-17. Khung giờ qua đêm — cách cấu hình đúng

| | |
|---|---|
| **Nghiệp vụ** | Chính sách ban đêm 22:00 hôm nay đến 06:00 hôm sau |
| **Cách làm SAI** | Tạo 1 khung `22:00–06:00` → tua giờ 23:00 → bắn xe → **luật không có hiệu lực**, hệ thống dùng luật mặc định |
| **Cách làm ĐÚNG** | Tách thành **2 khung**: `22:00–23:59` và `00:00–06:00`, cùng ngưỡng → tua 23:00 và 02:00 |
| **Kết quả** | Cả 2 mốc giờ đều áp đúng ngưỡng ban đêm; màn hình không báo trùng khung giờ |
| **Ghi chú** | Đây là **giới hạn thao tác đã biết**, có cách làm thay thế trọn vẹn — không phải lỗi cần sửa |

---

## 3. NHÓM 3 — ĐIỀU PHỐI CHO KHÁCH VÉ THÁNG

Chuẩn bị chung: tạo 1 vé tháng còn hiệu lực cho biển số dùng để test (màn hình
Monthly Passes), rồi bắn đúng biển số đó qua cổng.

### KB-18. Ưu tiên khu dành riêng

| | |
|---|---|
| **Chuẩn bị** | Zone M (MONTHLY) còn trống; Zone A cũng trống |
| **Thao tác** | Bắn xe có vé tháng |
| **Kết quả** | Gợi ý **`Zone M`** — khách vé tháng luôn được ưu tiên khu riêng trước |

### KB-19. Khu riêng đầy → tràn sang khu dự phòng

| | |
|---|---|
| **Chuẩn bị** | Zone M đầy 8/8; Zone K (BACKUP) trống |
| **Thao tác** | Bắn xe có vé tháng |
| **Kết quả** | Gợi ý **`Zone K`** |

### KB-20. Dự phòng cũng đầy → tràn xuống khu vãng lai

| | |
|---|---|
| **Chuẩn bị** | Zone M và Zone K đều đầy 100%; Zone A trống |
| **Thao tác** | Bắn xe có vé tháng |
| **Kết quả** | Gợi ý **`Zone A`** |
| **Ghi chú** | So sánh với **KB-07**: chiều tràn chỉ đi 1 hướng — vé tháng được mượn khu vãng lai, khách vãng lai không được mượn khu vé tháng |

### KB-21. Khu vé tháng chỉ xét còn/hết chỗ, không theo ngưỡng %

| | |
|---|---|
| **Nghiệp vụ** | Khu dành riêng phải tận dụng đến ô cuối cùng, không chừa buffer như khu vãng lai |
| **Chuẩn bị** | Zone M có 7/8 ô có xe → `Fill rate: 87.5%` (cao hơn mọi ngưỡng đang cấu hình) |
| **Thao tác** | Bắn xe có vé tháng |
| **Kết quả** | Vẫn gợi ý **`Zone M`** vì chưa đủ 100% |

### KB-22. Cảnh báo xe lậu đỗ khu vé tháng

| | |
|---|---|
| **Nghiệp vụ** | Phát hiện xe không có vé tháng nhưng chiếm ô trong khu vé tháng |
| **Thao tác** | Sensor Map: bật ô trong Zone M lên "có xe" nhiều hơn số xe vé tháng đang thực sự trong bãi |
| **Kết quả** | Popup vàng **System Alert** ở mọi màn hình đang mở, nội dung: `Overload Alert: There are N slots occupied in the Monthly Zone (type ...), but only M monthly cars of this type are currently in the parking lot! Walk-in vehicles might have parked improperly.` — đồng thời vào danh sách chuông thông báo |

---

## 4. NHÓM 4 — BIỂU ĐỒ XU HƯỚNG LẤP ĐẦY

### KB-23. Cột giờ hiện tại cập nhật theo thời gian thực

| | |
|---|---|
| **Thao tác** | Mở biểu đồ trên màn Manager → sang Sensor Map cho thêm xe vào Zone A → quay lại bấm Confirm để tải lại |
| **Kết quả** | Cột của **giờ hiện tại** đổi giá trị ngay, không cần chờ hết giờ |

### KB-24. Biểu đồ ghi nhận ĐỈNH ĐIỂM trong giờ, không phải giá trị cuối giờ

| | |
|---|---|
| **Nghiệp vụ** | Biểu đồ phải phản ánh lúc bãi căng nhất trong giờ, để quản lý biết giờ nào cần siết ngưỡng |
| **Thao tác** | Trong giờ hiện tại: cho Zone A lên **95%** (Sensor Map), rồi cho xe ra hết còn **10%**. Tua giờ sang giờ kế tiếp → xem biểu đồ |
| **Kết quả** | Cột giờ vừa qua hiển thị **95%**, không phải 10% |
| **Ghi chú** | Đây là kịch bản quan trọng nhất của nhóm này |

### KB-25. Không vẽ trước tương lai

| | |
|---|---|
| **Thao tác** | Đang ở 14:30, xem biểu đồ hôm nay |
| **Kết quả** | Chỉ có điểm từ 00:00 đến 14:00; không có điểm nào cho 15:00–23:00 |

### KB-26. Giờ quá khứ chưa từng ghi nhận thì hiện 0%

| | |
|---|---|
| **Thao tác** | Tạo Zone mới lúc 13:00, xem biểu đồ từ đầu ngày |
| **Kết quả** | Các giờ trước 13:00 hiển thị **0%** liền mạch, biểu đồ không bị đứt đoạn |

### KB-27. Tua giờ vẫn chốt đủ dữ liệu, không bỏ sót giờ nào

| | |
|---|---|
| **Thao tác** | Time Controller: tua từ **08:00 → 12:00** một lần → xem biểu đồ |
| **Kết quả** | Có đủ điểm cho 08, 09, 10, 11 giờ (đường biểu đồ phẳng vì các giờ bù đều lấy cùng 1 giá trị — bình thường, không phải lỗi) |

### KB-28. Zone ngừng hoạt động biến mất khỏi biểu đồ

| | |
|---|---|
| **Thao tác** | Đặt Zone B sang trạng thái không hoạt động → tải lại biểu đồ |
| **Kết quả** | Đường Zone B biến mất hoàn toàn, kể cả phần lịch sử đã có dữ liệu |

### KB-29. Lọc theo loại xe

| | |
|---|---|
| **Thao tác** | Đổi dropdown loại xe sang Car → Confirm |
| **Kết quả** | Biểu đồ chỉ còn các Zone thuộc loại Car |

---

## 5. NHÓM 5 — TÌNH HUỐNG LỖI TÁI HIỆN ĐƯỢC TRÊN WEB

### 5.1. Lỗi khi cấu hình luật

| ID | Cách tái hiện | Thông báo hiện trên UI |
|---|---|---|
| **EX-01** | Xoá trống ô giờ bắt đầu của 1 khung giờ → bấm Save | Toast đỏ `Please fill in the full start and end times`, **không** gọi API |
| **EX-02** | Tạo 2 khung giờ `08:00–12:00` và `10:00–14:00` → Save | Toast đỏ `Time frame 08:00-12:00 overlaps with frame 10:00-14:00` |
| **EX-03** | Tạo 2 khung giờ **liền kề** `08:00–12:00` và `12:00–16:00` → Save | Lưu **thành công** — liền kề không bị coi là chồng lấn |
| **EX-04** | Nhập giờ kết thúc là **`24:00`** → Save | Toast đỏ `Error when saving configuration`. **Luôn dùng `23:59`** — ô nhập giờ là text tự do nên không chặn được từ đầu |
| **EX-05** | Nhập giờ sai kiểu `8h` hoặc `08:60` → Save | Cùng kết quả EX-04 |
| **EX-06** | Nhập ngưỡng `150` rồi `-5` vào ô Threshold | Tự kẹp về **100** và **0** |
| **EX-07** | Không sửa gì → nhìn nút Save | Nút **mờ, không bấm được** (chống lưu thừa) |
| **EX-08** | Tắt backend → F5 màn hình Vehicle Routing | Toast đỏ `Error loading dispatcher configuration` |
| **EX-09** | Chọn 1 tầng không có Zone WALK_IN nào → Confirm | Thẻ `Other price brackets` hiện nhưng **rỗng**. Đây là đúng thiết kế, không phải lỗi |
| **EX-10** | Xoá 1 Zone khỏi Space Map rồi quay lại màn Routing | Zone đó biến mất khỏi chuỗi, các Zone còn lại nối liền, không văng lỗi |
| **EX-11** | Thêm 1 Zone mới trên Space Map rồi quay lại màn Routing | Zone mới tự **gắn vào cuối chuỗi** với ngưỡng mặc định 90% |

### 5.2. Lỗi khi gọi AI tư vấn

| ID | Cách tái hiện | Thông báo hiện trên UI |
|---|---|---|
| **EX-12** | Màn System Config: xoá giá trị `GEMINI_API_KEY` → bấm Ask AI | Toast đỏ **`GEMINI_API_KEY is not configured in System Config.`** |
| **EX-13** | Đặt `GEMINI_API_KEY` thành chuỗi bậy (vd `abc`) → Ask AI | Toast đỏ `An unexpected error occurred: Error communicating with Gemini API: ...` |
| **EX-14** | Ngắt Internet → Ask AI | Cùng dạng lỗi EX-13 |
| **EX-15** | Bấm Ask AI rồi bấm liên tục | Nút bị khoá trong lúc đang chờ, không gửi trùng |

### 5.3. Lỗi phân quyền

| ID | Cách tái hiện | Kết quả |
|---|---|---|
| **EX-16** | Đăng nhập bằng tài khoản **Staff**, gõ thẳng URL `/manager/routing` | Bị **đá về trang đăng nhập**, không vào được màn hình cấu hình |
| **EX-17** | Đăng xuất rồi gõ URL `/manager/routing` | Bị đá về trang đăng nhập |

### 5.4. Lỗi **không** hiện thông báo (cần biết trước khi demo)

| ID | Cách tái hiện | Người dùng thấy gì |
|---|---|---|
| **EX-18** | Chọn khoảng ngày biểu đồ **dài hơn 31 ngày** | Biểu đồ **trống trơn, không có thông báo nào**. Backend có chặn nhưng màn hình không hiển thị lý do |
| **EX-19** | Tắt backend → đổi khoảng ngày biểu đồ | Biểu đồ trống, không có toast |
| **EX-20** | Save cấu hình gặp lỗi bất kỳ từ backend | Luôn chỉ hiện đúng 1 câu `Error when saving configuration`, không nói rõ Zone nào / trường nào sai |

---

## 6. HẠN CHẾ ĐÃ BIẾT — TEST RA "SAI" NHƯNG KHÔNG PHẢI LỖI MỚI

Liệt kê để khi chạy bộ kịch bản không nhầm là hồi quy:

1. **KB-17** — khung giờ qua đêm phải tách làm 2 khung. Đã thống nhất không sửa code.
2. **EX-18 / EX-19** — lỗi biểu đồ không hiện thông báo nào trên UI.
3. **EX-20** — thông báo lỗi khi lưu cấu hình quá chung chung.
4. Zone tạo ra nhưng **chưa vẽ ô đỗ nào** vẫn có thể được gợi ý cho xe vào (hệ thống hiểu là "0% đầy").
5. `Fill rate` có thể **vượt 100%** khi cộng cả đặt chỗ (vd 10/10 ô có xe + 2 đặt chỗ = 120%) — thẻ Zone sẽ hiện icon cảnh báo đỏ.
6. Đỉnh điểm trong giờ lưu ở bộ nhớ tạm, **mất khi khởi động lại backend** — tránh restart giữa lúc demo KB-24.

---

## 7. CHECKLIST DEMO NHANH (8 kịch bản đủ thể hiện toàn bộ cách điều phối)

- [ ] **KB-01** — còn thoáng thì giữ nguyên Zone ưu tiên
- [ ] **KB-02** — vượt ngưỡng thì đẩy sang Zone kế
- [ ] **KB-04** — đẩy dây chuyền 2 bậc
- [ ] **KB-08** hoặc **KB-09** — ô bảo trì / đặt chỗ ảnh hưởng tính toán
- [ ] **KB-14 + KB-15** — cùng độ đầy, khác khung giờ thì ra kết quả khác nhau
- [ ] **KB-18 → KB-20** — chuỗi tràn của khách vé tháng
- [ ] **KB-07** — khách vãng lai bị chặn khỏi khu vé tháng
- [ ] **KB-24** — biểu đồ ghi nhận đỉnh điểm trong giờ
