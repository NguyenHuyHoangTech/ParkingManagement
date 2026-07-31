# TOÀN BỘ QUY TẮC ROUTING (ĐIỀU PHỐI ZONE) — GIẢI THÍCH NGHIỆP VỤ ĐỂ BẢO VỆ HỘI ĐỒNG

> Phạm vi: đúng phần việc cá nhân — cấu hình luật điều phối (Routing Rule),
> bộ máy điều phối thời gian thực (Zone Routing Engine), theo dõi đỉnh điểm
> lấp đầy (Occupancy Tracker) và xu hướng theo giờ (Zone Trend). Viết theo
> hướng NGHIỆP VỤ (nhân viên/quản lý thấy gì, vì sao hệ thống xử lý vậy),
> hạn chế thuật ngữ code. Dùng để trả lời phản biện, không phải tài liệu nộp.

---

## PHẦN 1 — TOÀN BỘ QUY TẮC ROUTING, GIẢI THÍCH TỪ ĐẦU

### 1.1. Bài toán nghiệp vụ đang giải quyết

Bãi xe có nhiều khu vực đỗ (Zone). Nếu để khách vãng lai tự do đỗ vào 1 Zone
cho tới khi Zone đó đầy cứng 100% mới báo "hết chỗ", sẽ dồn cục: xe phải bò
vòng vòng tìm chỗ trống trong Zone gần đầy, gây kẹt lối đi nội bộ. Giải pháp:
mỗi Zone được gán 1 "ngưỡng an toàn" (ví dụ 80%) — hễ chạm ngưỡng là hệ thống
chủ động gợi ý xe *mới* sang Zone dự phòng kế tiếp, dù Zone đó vẫn còn 20% chỗ
trống. Đây gọi là thuật toán **"Ngưỡng trượt" (Sliding Threshold)**.

### 1.2. 3 vai của một Zone trong hệ thống điều phối

| Vai (functionType) | Ý nghĩa nghiệp vụ | Có tham gia cấu hình luật (Routing Rule) không? |
|---|---|---|
| `WALK_IN` | Zone cho khách vãng lai (không có vé tháng, không đặt chỗ trước) | **Có** — đây là loại Zone duy nhất được cấu hình luật ngưỡng/chuỗi trượt trên màn hình quản lý. |
| `MONTHLY` | Zone riêng cho khách có vé tháng | Không — không có cấu hình ngưỡng riêng, xử lý nhị phân "còn/hết" (xem mục 1.5). |
| `BACKUP` | Zone dự phòng chung, chỉ lộ ra cho khách vé tháng | Không — tương tự MONTHLY. |

**Vì sao chỉ cấu hình luật cho WALK_IN?** Vì đây là nhóm khách đông, biến động
nhanh theo giờ trong ngày (giờ cao điểm sáng/tối) — cần luật tinh chỉnh theo
khung giờ. Khách vé tháng đã "đăng ký chỗ" ổn định từ trước, không cần luật
theo giờ phức tạp — chỉ cần biết Zone dành riêng cho họ còn chỗ hay không.

### 1.3. Một "Luật điều phối" (Routing Rule) gồm những gì

Về mặt nghiệp vụ, 1 luật trả lời đúng 1 câu: **"Zone X đầy tới bao nhiêu % thì
bắt đầu đẩy xe mới sang Zone Y, và luật này áp dụng trong khung giờ nào?"**

- **Zone bị giám sát** (Zone X): Zone đang được theo dõi độ đầy.
- **Ngưỡng kích hoạt** (0–100%): mốc % để bắt đầu đẩy xe đi.
- **Zone gợi ý kế tiếp** (Zone Y): xe mới sẽ được hướng sang đây khi Zone X
  vượt ngưỡng. Có thể để trống nếu Zone X là điểm cuối chuỗi (không có gì để
  trượt tiếp).
- **Khung giờ áp dụng** (giờ bắt đầu – giờ kết thúc): 1 Zone có thể có NHIỀU
  luật ứng với nhiều khung giờ khác nhau trong ngày (ví dụ giờ cao điểm ngưỡng
  thấp hơn giờ vắng), cộng thêm 1 luật "mặc định" áp dụng khi không khung giờ
  cụ thể nào khớp thời điểm hiện tại.

### 1.4. Nhiều luật ghép thành 1 "chuỗi điều phối" như thế nào

Trên màn hình quản lý, mỗi khung giờ hiển thị thành 1 danh sách Zone theo thứ
tự ưu tiên — kéo thả để sắp xếp. Khi lưu, thứ tự đó được ghi lại thành chuỗi
"Zone đứng trước trỏ sang Zone đứng sau". Ví dụ khung giờ 06:00–22:00 có thứ
tự [Zone A, Zone B, Zone C] nghĩa là: A đầy → trượt sang B; B đầy → trượt sang
C; C đầy → hết cách (không còn Zone nào để trượt tiếp trong chuỗi này).

**Nếu chưa từng cấu hình gì cho 1 loại xe + 1 tầng:** hệ thống tự bịa ra 1
khung giờ "mặc định" ảo, liệt kê toàn bộ Zone WALK_IN hợp lệ với ngưỡng cứng
**90%** mỗi Zone, không nối chuỗi (không Zone nào trỏ sang Zone nào) — chỉ để
màn hình quản lý không bị trắng trơn, không phải giá trị đã lưu thật.

**Nếu 1 Zone hợp lệ nhưng bị "quên" không đưa vào chuỗi cấu hình:** hệ thống
tự động gắn thêm Zone đó vào cuối danh sách hiển thị với ngưỡng mặc định
**90%**, đứng độc lập (không nằm trong chuỗi trượt của Zone khác) — để quản lý
luôn thấy đủ mọi Zone, không bị "mất tích" khỏi màn hình dù họ chưa cấu hình
riêng cho Zone đó.

### 1.5. Nghiệp vụ áp dụng luật lúc xe THẬT sự check-in (thời gian thực)

Mỗi khi có xe quét biển số/thẻ ở cổng vào, hệ thống chạy đúng theo trình tự
sau để chọn 1 Zone gợi ý:

1. **Lọc Zone phù hợp**: đúng loại xe (ô tô/xe máy...), đúng tầng. Khách vãng
   lai chỉ được xét trong nhóm Zone `WALK_IN`; khách vé tháng được xét toàn bộ
   Zone (kể cả MONTHLY/BACKUP/WALK_IN).
2. **Xác định Zone bắt đầu chuỗi**: khách vãng lai bắt đầu từ Zone đầu chuỗi
   WALK_IN theo cấu hình khung giờ hiện tại. Khách vé tháng ưu tiên bắt đầu từ
   Zone MONTHLY.
3. **Đo độ đầy Zone hiện tại** (công thức chi tiết ở mục 2.1):
   - Nếu Zone này CÓ luật cấu hình riêng: so độ đầy với ngưỡng. Chưa tới ngưỡng
     → **chọn Zone này ngay**. Đã tới/vượt ngưỡng → trượt sang Zone kế tiếp
     trong chuỗi (nếu có), lặp lại bước 3 cho Zone mới.
   - Nếu Zone này KHÔNG có luật riêng (đúng trường hợp của MONTHLY/BACKUP,
     hoặc 1 Zone WALK_IN lẻ chưa được đưa vào chuỗi): chỉ cần **chưa đầy cứng
     100% vật lý** là chọn ngay, không có khái niệm "ngưỡng mềm" cho các Zone
     này.
4. **Nếu trượt hết cả chuỗi mà vẫn không chọn được Zone nào** (mọi Zone trong
   chuỗi đều đã vượt ngưỡng riêng của nó): kích hoạt **cơ chế dự phòng** — xét
   lại toàn bộ Zone hợp lệ CHƯA được đi qua trong bước 3, theo đúng thứ tự ưu
   tiên, chấp nhận Zone đầu tiên còn dưới ngưỡng của nó (hoặc dưới 100% nếu
   không có ngưỡng riêng).
5. **Nếu dự phòng vẫn thất bại**: xét lại LẦN CUỐI toàn bộ Zone hợp lệ, bỏ hẳn
   khái niệm ngưỡng cấu hình, chỉ cần chưa đầy cứng 100% là chấp nhận.
6. **Nếu tất cả Zone hợp lệ đều đã đầy cứng 100%**: hệ thống trả lời "Không
   gợi ý được Zone nào" (hiển thị chữ **"Free"** trên màn hình cổng — nghĩa là
   "hệ thống bó tay, nhân viên tự quyết định", KHÔNG phải "còn 1 chỗ tên
   Free").

### 1.6. Chiều "tràn" giữa các loại Zone (chỉ 1 chiều, có chủ đích)

- Khách **vé tháng**: nếu Zone MONTHLY hết chỗ → tự động tràn sang Zone BACKUP
  → nếu BACKUP cũng hết → tràn tiếp sang Zone WALK_IN (khách vãng lai). Đây là
  quyền lợi ưu tiên dành cho khách đã trả tiền vé tháng: họ luôn có nhiều lớp
  dự phòng.
- Khách **vãng lai**: KHÔNG BAO GIỜ được xếp vào Zone MONTHLY/BACKUP, kể cả khi
  các Zone đó đang trống hoàn toàn. Đây là ranh giới bảo vệ quyền lợi khách vé
  tháng, được chặn cứng ngay từ bước lọc Zone hợp lệ (bước 1 ở mục 1.5), không
  phải do "chưa tính tới trường hợp đó".

### 1.7. Đặt chỗ trước (Reservation) ảnh hưởng độ đầy như thế nào

Không chỉ xe đang thực sự đỗ (chiếm chỗ vật lý) mới tính vào độ đầy — các đơn
**đặt chỗ trước sắp tới giờ hẹn** cũng được cộng vào, để tránh trường hợp
khách vãng lai vô tình chiếm mất chỗ của người đã đặt trước ngay trước giờ họ
đến. Cụ thể: 1 đơn đặt chỗ được tính là "đang giữ chỗ" trong khoảng từ (giờ hẹn
trừ đi X phút, mặc định 30 phút, cấu hình được) cho tới (giờ hẹn cộng thời
lượng dự kiến đỗ). Ngoài khung giờ đó, đơn đặt chỗ không ảnh hưởng gì tới % lấp
đầy hiển thị.

### 1.8. Zone bảo trì / khoá slot ảnh hưởng ra sao

Slot đang bị khoá bảo trì (DISABLED) bị loại khỏi "sức chứa hiệu dụng" của
Zone trước khi tính %. Ví dụ Zone có 10 slot, 2 slot đang bảo trì → mẫu số tính
% chỉ còn 8, không phải 10 — Zone sẽ "cảm giác đầy nhanh hơn" đúng như thực tế
vận hành (khách không thể đỗ vào slot đang khoá). Nếu TOÀN BỘ slot của 1 Zone
đều bị khoá bảo trì, Zone đó coi như đã đầy 100% ngay lập tức, không nhận thêm
xe.

### 1.9. Theo dõi đỉnh điểm & biểu đồ xu hướng theo giờ (phục vụ báo cáo)

Độ đầy của 1 Zone lên xuống liên tục trong 1 giờ (xe ra vào). Ngoài % tức thời,
hệ thống còn ghi nhớ riêng **con số đỉnh điểm (cao nhất)** mà Zone từng chạm
tới trong giờ đang chạy — để cuối giờ "chốt sổ" đúng mức độ quá tải thực sự đã
từng xảy ra, thay vì chỉ ghi lại đúng con số tại thời điểm "canh giờ" chạy
(có thể bỏ lỡ đỉnh điểm giữa giờ). Số liệu này được lưu lại theo từng giờ,
dùng vẽ biểu đồ "Xu hướng lấp đầy" trên màn hình quản lý — giờ nào Zone nào đã
từng chạm/vượt ngưỡng đỏ (cấu hình, ví dụ 90%) đều thấy rõ trên biểu đồ, kể cả
khi tại thời điểm quản lý xem lại thì Zone đã vãn khách.

---

## PHẦN 2 — CÔNG THỨC & QUY TẮC TÍNH TOÁN (tóm tắt nghiệp vụ, không đi sâu code)

### 2.1. Công thức % lấp đầy

```
% lấp đầy = (Số xe đang đỗ + Số đặt chỗ sắp tới trong "cửa sổ giữ chỗ")
            ÷ (Tổng slot − Slot đang bảo trì)  × 100
```

### 2.2. Thứ tự ưu tiên xét Zone

- Khách vé tháng: **MONTHLY (1) → BACKUP (2) → WALK_IN (3)**.
- Khách vãng lai: chỉ **WALK_IN (1)**, không xét loại nào khác.
- Cùng mức ưu tiên: xếp theo tên Zone (A→Z).

### 2.3. Vòng lặp an toàn (chống cấu hình sai gây treo hệ thống)

Nếu quản lý cấu hình lỡ tạo thành vòng lặp (Zone A trỏ sang B, B trỏ ngược lại
A), hệ thống tự ghi nhớ đường đã đi qua và **dừng ngay** khi phát hiện quay lại
chỗ cũ, không bị treo vô hạn — chỉ đơn giản dừng chuỗi ở đó và coi như hết
Zone để trượt.

---

## PHẦN 3 — CÁC CASE OÁI OĂM HỘI ĐỒNG CÓ THỂ BẮT BẺ + CÁCH TRẢ LỜI

### Case 1: "Cấu hình khung giờ qua đêm (22:00 → 06:00) có hoạt động không?"

**Sự thật:** Nếu cấu hình đúng 1 luật duy nhất với giờ bắt đầu 22:00, giờ kết
thúc 06:00 (giờ bắt đầu LỚN HƠN giờ kết thúc), luật này **sẽ không bao giờ
kích hoạt** — hệ thống hiểu nhầm khoảng đó là rỗng.

**Cách xử lý nghiệp vụ (không cần sửa code):** thay vì cấu hình 1 luật qua
đêm, quản lý cấu hình **2 luật riêng biệt**: một luật `22:00–23:59` và một
luật `00:00–06:00`. Vì mỗi luật giờ bắt đầu < giờ kết thúc bình thường (không
"qua đêm" trong nội bộ từng luật), cả hai đều hoạt động đúng, và ghép lại vẫn
phủ đúng khung giờ mong muốn (22h tối tới 6h sáng).

**Lưu ý khi cấu hình theo cách này:** dùng `23:59`, tuyệt đối không dùng
`24:00` (hệ thống không hiểu giờ `24:00`, sẽ báo lỗi ngay khi lưu).

**Câu trả lời mẫu nếu hội đồng hỏi thẳng "đây có phải lỗi không?":**
> "Đây là một giới hạn về mặt trải nghiệm cấu hình (không hỗ trợ nhập trực
> tiếp 1 khung giờ qua đêm), nhưng có cách cấu hình tương đương đạt đúng kết
> quả mong muốn bằng 2 khung giờ, đã kiểm chứng hoạt động đúng 100% — nên
> nhóm xếp đây là hạn chế UX nhỏ, không phải lỗi nghiệp vụ nghiêm trọng."

### Case 2: "Nếu tôi cấu hình 2 khung giờ đè lên nhau (ví dụ cả 08:00–12:00 và 10:00–14:00) thì sao?"

**Sự thật:** màn hình cấu hình **chủ động chặn** hành vi này ngay lúc bấm Lưu
— phát hiện 2 khung giờ cụ thể (không phải khung mặc định) giao nhau về thời
gian sẽ báo lỗi rõ ràng ngay trên màn hình ("Khung giờ X-Y trùng với khung giờ
Z-T"), không cho lưu xuống hệ thống. Đây là hàng rào bảo vệ tại chính khâu
nhập liệu, không đợi tới lúc vận hành mới phát hiện sai.

**Điểm cần lưu ý khi trả lời:** hàng rào này chỉ áp dụng giữa các khung giờ CỤ
THỂ với nhau — khung giờ MẶC ĐỊNH (áp dụng khi không khung nào khớp) không bị
đưa vào phép so sánh này, vì về bản chất nó không có "giờ bắt đầu/kết thúc"
thật để so sánh — nó chỉ là phương án dự phòng cuối cùng.

### Case 3: "Ngưỡng % có thể cấu hình âm hoặc trên 100% không?"

**Sự thật:** ô nhập ngưỡng trên màn hình bị giới hạn cứng trong khoảng
**0–100%**, không thể gõ số ngoài khoảng này — người dùng không có cách nào
nhập sai qua đường giao diện chuẩn.

### Case 4: "Nếu 2 Zone khác nhau tạo thành 2 chuỗi độc lập trong CÙNG 1 khung giờ (ví dụ A→B và tách biệt C→D) thì hiển thị đúng không?"

**Sự thật — đây là giới hạn thật, nên biết trước khi bị hỏi:** màn hình cấu
hình hiện tại chỉ cho phép quản lý dựng **1 chuỗi liên tục duy nhất** cho mỗi
khung giờ (kéo-thả sắp thứ tự trong 1 danh sách), nên về mặt thao tác, quản lý
không có cách nào tạo ra 2 chuỗi song song qua giao diện chuẩn — tình huống này
chỉ có thể xảy ra nếu ai đó chỉnh trực tiếp dữ liệu dưới tầng cơ sở dữ liệu,
nằm ngoài luồng nghiệp vụ bình thường.

**Câu trả lời mẫu:** "Giao diện quản lý hiện tại được thiết kế theo mô hình 1
chuỗi trượt duy nhất mỗi khung giờ — đúng với cách vận hành thực tế (1 nhóm
Zone vãng lai của 1 tầng thường san sẻ tải cho nhau theo 1 trình tự thống
nhất, không chia phe). Việc hỗ trợ nhiều chuỗi song song chưa được đặt ra vì
chưa có nhu cầu nghiệp vụ thực tế nào cần nhiều nhóm điều phối độc lập trên
cùng 1 tầng."

### Case 5: "Khách vé tháng đến khi TẤT CẢ Zone (MONTHLY, BACKUP, WALK_IN) đều hết chỗ thì hệ thống làm gì?"

**Trả lời:** hệ thống trả lời "không gợi ý được Zone nào" — đây là tình huống
bãi xe thực sự hết công suất, không phải lỗi thuật toán. Xe vẫn được nhân viên
xử lý theo quy trình vận hành thực tế (không phải phần mềm tự ý từ chối cứng
nhắc) — quyết định cuối cùng cho xe vào hay không thuộc thẩm quyền nhân viên
trực cổng, phần mềm chỉ đóng vai trò cố vấn.

### Case 6: "Vì sao hệ thống lại có ngưỡng đúng đúng 90% xuất hiện lặp đi lặp lại (Zone chưa cấu hình, Zone bị 'quên' trong chuỗi)?"

**Trả lời:** 90% là giá trị mặc định an toàn được nhóm chọn làm "lưới đỡ"
(safety net) cho những Zone quản lý CHƯA kịp cấu hình cụ thể — mục tiêu là
đảm bảo màn hình luôn hiển thị đầy đủ thông tin có ý nghĩa (không bỏ trắng,
không để ngưỡng bằng 0 khiến Zone bị coi là "luôn đầy" ngay từ đầu), đồng thời
vẫn đủ chặt để tránh dồn khách sát nút 100% nếu quản lý quên cấu hình. Đây là
giá trị khởi tạo, quản lý luôn có thể chỉnh lại theo ý muốn bất cứ lúc nào.

### Case 7: "Nếu 1 khung giờ có Zone A nhưng bấm 'Lưu' thì Zone B ở khung giờ khác có bị ảnh hưởng không?"

**Trả lời:** Khi quản lý bấm "Lưu cấu hình" cho 1 loại xe + 1 tầng, TOÀN BỘ
luật cũ của đúng loại xe + tầng đó (mọi khung giờ) bị vô hiệu hoá và ghi đè
hoàn toàn bằng dữ liệu mới gửi lên — tương đương "lưu lại toàn bộ trang cấu
hình" chứ không phải "chỉ lưu phần vừa sửa". Nghiệp vụ: nếu quản lý đang mở 1
khung giờ để sửa nhưng có khung giờ KHÁC đang hiển thị trên cùng trang mà họ
không chủ ý sửa, khung đó vẫn được gửi kèm nguyên trạng trong cùng 1 lần lưu —
không bị mất dữ liệu, nhưng người dùng cần hiểu "Lưu" là lưu toàn bộ trang,
không phải lưu từng dòng riêng lẻ.

**Điểm hay để biết thêm:** luật cũ không bị xoá cứng khỏi hệ thống — chỉ bị
đánh dấu "ngưng dùng", vẫn giữ lại được để tra cứu lịch sử thay đổi cấu hình
sau này nếu cần.

### Case 8: "Biểu đồ xu hướng lấy dữ liệu cho GIỜ HIỆN TẠI (đang chạy dở, chưa qua) như thế nào — số liệu có đúng không?"

**Trả lời:** vì giờ hiện tại chưa kết thúc nên chưa có "đỉnh điểm chốt sổ" —
với đúng giờ đang chạy, hệ thống hiển thị số liệu **tính tức thời tại đúng lúc
xem biểu đồ**, không phải số liệu lịch sử. Các giờ đã qua thì dùng đúng số
đỉnh điểm đã chốt. Nếu 1 giờ trong quá khứ mà hệ thống chưa từng ghi nhận gì
(ví dụ Zone đó mới được tạo sau thời điểm đó), biểu đồ điền 0% cho giờ đó để
không bị đứt quãng — đây là giá trị "không có dữ liệu", không phải "Zone thực
sự trống 0% xe" tại giờ đó.

### Case 9: "Nếu bấm 'Tua nhanh thời gian' để demo (ví dụ tua từ 8h sáng sang 10h tối) thì các giờ bị nhảy qua có bị mất dữ liệu xu hướng không?"

**Trả lời:** Không mất — hệ thống có cơ chế "chạy bù": khi phát hiện đồng hồ
mô phỏng bị tua tới tương lai, nó tự động chốt sổ lần lượt từng giờ đã bị nhảy
cóc qua (8h, 9h, ..., 21h) ngay lập tức, đảm bảo biểu đồ không bị thủng lỗ dù
demo bằng cách tua giờ thay vì chờ thời gian thực trôi qua.

**Giới hạn cần biết trước khi bị hỏi:** cơ chế bù này CHỈ xử lý khi tua **tới
tương lai**. Nếu tua NGƯỢC về quá khứ (hiếm khi cần trong demo, nhưng nếu hội
đồng thử), hệ thống không có cơ chế "chốt bù ngược" — đơn giản vì tua lùi thời
gian không phải use-case nghiệp vụ thực tế (đồng hồ thật không bao giờ chạy
lùi).

### Case 10: "Đỉnh điểm lấp đầy được ghi nhớ trong bộ nhớ hay lưu bền vững? Nếu backend bị restart giữa giờ thì sao?"

**Trả lời trung thực:** đỉnh điểm của giờ ĐANG CHẠY (chưa chốt sổ) được giữ
tạm trong bộ nhớ máy chủ, chưa ghi xuống Database — nếu máy chủ bị khởi động
lại đúng giữa giờ đó, đỉnh điểm đang tích luỹ của giờ đó sẽ mất, giờ đó sẽ chỉ
ghi nhận lại từ mốc khởi động lại trở đi. Đây là đánh đổi hợp lý cho quy mô
đồ án hiện tại (1 máy chủ, không yêu cầu độ bền dữ liệu tuyệt đối cho số liệu
thống kê tức thời) — dữ liệu ĐÃ chốt sổ của các giờ trước đó vẫn nằm an toàn
trong Database, không bị ảnh hưởng.

### Case 11: "Nếu mở rộng hệ thống chạy nhiều máy chủ song song (scale ra), tính năng đỉnh điểm còn đúng không?"

**Trả lời trung thực (nên chủ động thừa nhận thay vì né):** không — hiện tại
mỗi máy chủ tự giữ riêng bộ đếm đỉnh điểm của mình trong bộ nhớ, không đồng bộ
giữa các máy chủ. Nếu chạy nhiều máy chủ song song mà không nâng cấp cơ chế
này lên một kho lưu trữ dùng chung, số liệu đỉnh điểm giữa các máy chủ sẽ lệch
nhau. Đây là hạn chế đã được nhóm ghi nhận, chấp nhận được ở quy mô đồ án (chỉ
chạy 1 máy chủ), và có hướng nâng cấp rõ ràng nếu cần mở rộng thật (đổi sang
kho lưu trữ dùng chung giữa các máy chủ).

### Case 12: "Xe vé tháng ưu tiên Zone MONTHLY, nhưng nếu Zone WALK_IN đang trống trơn còn Zone MONTHLY gần đầy, sao không cho khách tháng đỗ tạm bên WALK_IN cho tiện, đỡ phải đợi tràn qua BACKUP trước?"

**Trả lời:** đây là thứ tự ưu tiên có chủ đích: khách vé tháng LUÔN được ưu
tiên thử Zone MONTHLY (đúng với gói dịch vụ họ trả tiền) trước khi xét tới
BACKUP rồi mới tới WALK_IN — dù WALK_IN trống nhiều hơn. Vì Zone MONTHLY có
thể còn chỗ (dưới ngưỡng đầy vật lý 100%) dù đang "gần đầy" theo cảm nhận,
hệ thống vẫn ưu tiên xếp đúng Zone theo gói dịch vụ trước, chỉ tràn sang lớp
tiếp theo khi lớp trước đó ĐÃ THỰC SỰ hết chỗ (100%), không phải "gần hết".

### Case 13: "Nếu Zone gợi ý kế tiếp (suggestedZone) bị chuyển tầng khác hoặc bị vô hiệu hoá sau khi đã cấu hình luật trỏ tới, luật đó còn hoạt động không?"

**Trả lời:** không — khi tới lượt trượt sang Zone kế tiếp, hệ thống kiểm tra
lại Zone đó có còn nằm trong danh sách Zone hợp lệ hiện tại không (đúng tầng,
đang ACTIVE). Nếu Zone kế tiếp đã bị đổi tầng hoặc vô hiệu hoá, chuỗi **dừng
ngay tại đó** thay vì trượt sang 1 Zone không còn phù hợp — tránh tình huống
gợi ý nhầm khách sang tầng khác hoặc Zone đã đóng.

### Case 14: "Vậy nếu chuỗi dừng giữa chừng như Case 13, xe có bị 'rơi khỏi hệ thống', không được gợi ý gì không?"

**Trả lời:** không bị rơi — đây chính là lúc cơ chế dự phòng ở mục 1.5 (bước
4-5) tiếp quản: hệ thống xét lại toàn bộ Zone hợp lệ còn lại theo thứ tự ưu
tiên, không phụ thuộc vào chuỗi đã bị đứt gãy, để vẫn cố gắng tìm ra 1 Zone
khả dụng trước khi thật sự chào thua (mục 1.5, bước 6).

---

## PHẦN 4 — BẢNG TRA NHANH (đọc trước khi lên hội đồng)

| Hỏi nhanh | Trả lời 1 câu |
|---|---|
| Luật routing áp dụng cho loại Zone nào? | Chỉ Zone `WALK_IN`. MONTHLY/BACKUP không có luật riêng, xử lý nhị phân còn/hết. |
| Khách tháng có tràn được sang WALK_IN không? | Có, khi MONTHLY và BACKUP đều hết. Chiều ngược lại (WALK_IN → MONTHLY) không xảy ra. |
| Ngưỡng mặc định khi chưa cấu hình là bao nhiêu? | 90%, chỉ để hiển thị/lưới đỡ an toàn, quản lý luôn chỉnh lại được. |
| Khung giờ qua đêm có cấu hình được không? | Không cấu hình bằng 1 luật duy nhất; tách thành 2 luật là chạy đúng. |
| 2 khung giờ đè nhau có lưu được không? | Không, bị chặn ngay khi bấm Lưu. |
| Vòng lặp cấu hình sai (A→B→A) có làm treo hệ thống không? | Không, có cơ chế tự dừng khi phát hiện quay lại Zone đã đi qua. |
| Đặt chỗ trước có tính vào % lấp đầy không? | Có, trong khung "trước giờ hẹn X phút → hết thời lượng dự kiến". |
| Zone bảo trì ảnh hưởng % ra sao? | Bị trừ khỏi mẫu số; nếu bảo trì hết cả Zone thì coi như đầy 100%. |
| Đỉnh điểm theo giờ lưu ở đâu, bền vững không? | Giờ đang chạy: tạm trong bộ nhớ máy chủ (mất nếu restart giữa giờ). Giờ đã chốt: lưu Database, an toàn. |
| Tua nhanh thời gian có làm mất dữ liệu xu hướng không? | Không, có cơ chế chạy bù cho các giờ bị nhảy cóc (chỉ khi tua tới tương lai). |
| Nếu mở rộng nhiều máy chủ, đỉnh điểm còn đúng không? | Không tự động đúng — mỗi máy chủ giữ riêng, cần nâng cấp lên kho lưu trữ dùng chung nếu scale thật. |
