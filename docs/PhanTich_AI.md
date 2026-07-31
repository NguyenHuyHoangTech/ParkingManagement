# PHÂN TÍCH — TÍNH NĂNG AI TƯ VẤN CẤU HÌNH ĐIỀU PHỐI (AI ZONE ROUTING ADVISOR)

> Phân tích 3 file: `AiAdvisorController.java`, `AiRoutingRequest.java`,
> `GeminiService.java`, cùng phần giao diện trong `VehicleRoutingScreen.tsx`.
> Trả lời câu hỏi: **AI trong dự án này thực sự làm gì, dữ liệu đi và về ra sao**.
>
> Liên quan: [PhanTich_ZoneTrend.md](PhanTich_ZoneTrend.md) — biểu đồ xu hướng
> chính là **nguồn dữ liệu đầu vào** cho AI.

---

## 1. AI ở đây làm gì — và KHÔNG làm gì

Đây là điều cần nói rõ đầu tiên vì rất dễ bị hiểu nhầm.

| AI **có** làm | AI **không** làm |
|---|---|
| Đọc biểu đồ độ đầy theo giờ + cấu hình luật hiện tại, rồi **đề xuất bộ khung giờ và ngưỡng mới** | Không tham gia vào việc quyết định xe nào đỗ Zone nào — việc đó là thuật toán `suggestZone()` thuần rule-based |
| Giải thích **lý do** đề xuất (trường `reasoning`) | Không tự động áp dụng đề xuất. Quản lý phải tự nhập lại bằng tay |
| Nhận thêm ngữ cảnh bằng lời từ quản lý ("Zone A gần thang máy") | Không học từ dữ liệu lịch sử, không có mô hình được huấn luyện riêng |

Nói ngắn gọn: **AI là một cố vấn đọc số liệu, không phải bộ điều khiển**. Toàn bộ
việc điều phối xe chạy bằng luật tường minh do người cấu hình; AI chỉ giúp trả lời
câu hỏi *"tôi nên đặt ngưỡng bao nhiêu, chia khung giờ thế nào cho hợp lý?"*.

**Vì sao cần?** Vì nhìn một biểu đồ 24 cột × nhiều Zone × nhiều ngày rồi tự suy ra
"nên chia mấy khung giờ, mỗi khung đặt ngưỡng bao nhiêu" là việc rất khó với người
thường. AI đọc hộ đống số đó và đề xuất một cấu hình cụ thể.

---

## 2. Toàn cảnh luồng dữ liệu

```
   Quản lý bấm nút "Ask AI" trên màn Vehicle Routing
              │
              │  ① FE gom dữ liệu: biểu đồ + luật hiện tại + ngữ cảnh nhập tay
              ▼
   POST /api/v1/manager/ai/routing-advice
              │
              ▼
   ┌────────────────────────────┐
   │    AiAdvisorController     │  ② chặn quyền, chỉ MANAGER/SUPER_ADMIN
   └──────────┬─────────────────┘
              │
              ▼
   ┌────────────────────────────────────────────┐
   │            GeminiService                   │
   │  ③ đọc API key + tên model từ System Config│
   │  ④ buildPrompt() — dựng câu lệnh cho AI    │
   │  ⑤ gọi HTTP sang Google Gemini             │
   │  ⑥ bóc tách chuỗi JSON từ phản hồi         │
   └──────────┬─────────────────────────────────┘
              │  trả về CHUỖI JSON thô
              ▼
   ⑦ FE tự parse chuỗi → vẽ bảng đề xuất trong Modal
```

Điểm đáng chú ý: backend **không hề parse** kết quả AI, nó trả nguyên chuỗi về cho
giao diện. Việc bóc tách và hiển thị hoàn toàn do frontend làm.

---

## 3. Ba mảnh ghép ở backend

### 3.1. `AiAdvisorController` — mỏng nhất có thể

```java
@RequestMapping("/api/v1/manager/ai")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'MANAGER')")
public class AiAdvisorController {
    @PostMapping("/routing-advice")
    public ResponseEntity<ApiResponse<String>> getRoutingAdvice(@RequestBody AiRoutingRequest request) {
        String advice = geminiService.getRoutingAdvice(request);
        return ResponseEntity.ok(ApiResponse.success(advice, "Success"));
    }
}
```

Toàn bộ controller chỉ có đúng 1 endpoint và 2 dòng thân hàm. Nó không xử lý gì
cả — chỉ làm 2 việc: **chặn quyền** (chỉ quản lý mới được gọi AI, vì mỗi lần gọi
là một lần tốn quota API) và **giao việc** cho service.

Kiểu trả về là `ApiResponse<String>` — chú ý là `String`, không phải một DTO có
cấu trúc. Đây là hệ quả của việc backend không parse kết quả AI.

### 3.2. `AiRoutingRequest` — gói dữ liệu gửi lên

| Trường | Nội dung | Ví dụ |
|---|---|---|
| `vehicleType` | Loại xe đang xem | `"Motorbike"` |
| `dateRange` | Khoảng ngày của biểu đồ, dạng chữ | `"24/07/2026 - 30/07/2026"` |
| `chartData` | **Toàn bộ điểm dữ liệu biểu đồ** | `[{timeWindow, zoneId, zoneName, occupancyPct}, ...]` |
| `extraContext` | Ghi chú tự do quản lý gõ vào | `"Zone A gần thang máy nên ưu tiên"` |
| `isRoutingEnabled` | Tính năng điều phối đang bật hay tắt | `true` |
| `currentRules` | Cấu hình khung giờ + ngưỡng đang dùng | `[{startTime, endTime, rules:[...]}]` |

### 3.3. `GeminiService` — nơi mọi thứ thật sự diễn ra

Hai hàm: `getRoutingAdvice()` (gọi API) và `buildPrompt()` (dựng câu lệnh). Phân
tích chi tiết ở mục 4 và 5.

---

## 4. Dựng prompt — phần quan trọng nhất

Chất lượng câu trả lời của AI phụ thuộc gần như hoàn toàn vào việc đưa cho nó
**đúng ngữ cảnh**. Hàm `buildPrompt()` ghép 6 phần theo thứ tự:

### Phần 1 — Gán vai trò

```
You are an expert in smart parking lot planning (AI Zone Routing Advisor).
```

Câu đầu tiên định nghĩa AI là ai. Không có câu này, AI sẽ trả lời chung chung
kiểu trợ lý phổ thông thay vì như một chuyên gia quy hoạch bãi xe.

### Phần 2 — Dữ liệu biểu đồ

```
Below is the hourly occupancy data for vehicle type 'Motorbike' during the period: 24/07 - 30/07
Chart data (JSON): [{"timeWindow":"08:00 24/07","zoneName":"Zone A","occupancyPct":45.00}, ...]
```

Đây là số liệu thật, lấy nguyên từ biểu đồ xu hướng. **Frontend đã lọc trước, chỉ
gửi Zone WALK_IN** — vì Zone vé tháng và Zone dự phòng không có ngưỡng % để chỉnh,
gửi lên chỉ làm AI đề xuất nhầm cho những Zone vốn không dùng cơ chế ngưỡng.

### Phần 3 — Trạng thái bật/tắt, và đây là chỗ tinh tế

Prompt **rẽ nhánh** tuỳ theo tính năng điều phối đang bật hay tắt:

| Trạng thái | Câu đưa vào prompt |
|---|---|
| **Đang TẮT** | *"Tính năng điều phối đang bị tắt, xe vào tự do theo kiểu ai đến trước được trước. Dưới đây là cấu hình không hoạt động, chỉ để tham khảo. Hãy phân tích xem cách 'thả tự do' này đang gây ra vấn đề gì, đề xuất cấu hình tối ưu, và **khuyến khích quản lý bật lại tính năng**."* |
| **Đang BẬT** | *"Tính năng đang hoạt động. Dưới đây là cấu hình hiện tại. Hãy phân tích, chỉ ra điểm chưa hợp lý (ví dụ ngưỡng quá cao trong giờ cao điểm), và đề xuất cấu hình tối ưu hơn."* |

Cùng một bộ số liệu nhưng hai lời dẫn khác nhau sẽ cho hai câu trả lời khác hẳn
về giọng điệu và trọng tâm. Đây là lý do trường `isRoutingEnabled` quan trọng hơn
vẻ ngoài của nó rất nhiều — và cũng là lý do nó từng gây ra một lỗi khá thú vị
(xem mục 7).

### Phần 4 — Cấu hình hiện tại + giải thích quy ước

```
Current Configuration (JSON): [...]

NOTE: The last time frame is usually the 'Default' timeframe (isDefault=true).
It has no specific start/end time because it acts as a fallback for all hours
not covered by the specific timeframes.
```

Câu `NOTE` này rất cần thiết: nếu không giải thích, AI nhìn thấy một khung giờ có
`startTime = null` sẽ tưởng là dữ liệu lỗi và có thể đề xuất xoá nó đi — trong
khi đó chính là khung mặc định giữ cho hệ thống chạy 24/7.

### Phần 5 — Ngữ cảnh do người nhập (nếu có)

```
Additional context from Management (VERY IMPORTANT):
Zone A gần thang máy nên ưu tiên, Zone B lối đi hẹp nên hạn chế giờ cao điểm
```

Đây là thứ **dữ liệu không bao giờ có**: bố trí vật lý, thói quen khách, kế hoạch
bảo trì. Nhãn `VERY IMPORTANT` được thêm vào để AI ưu tiên thông tin này khi nó
mâu thuẫn với suy luận thuần từ số liệu.

### Phần 6 — Ép định dạng đầu ra

```
Return ONLY a JSON string with the following exact format (no markdown blocks ```json):
{
  "reasoning": "...",
  "timeFrames": [
    { "name": "...", "startTime": "07:00", "endTime": "11:00",
      "rules": [ { "zoneName": "Zone A", "threshold": 85, "priority": 1 } ] }
  ]
}
```

Đưa hẳn **mẫu JSON cụ thể** thay vì mô tả bằng lời. Đây là kỹ thuật cơ bản nhưng
hiệu quả nhất để có đầu ra máy đọc được.

Ngoài ra còn một lớp ép nữa ở tầng API:

```java
generationConfig.put("response_mime_type", "application/json");
```

Tham số này của Gemini bắt model trả về JSON hợp lệ ở mức API, không kèm lời dẫn
kiểu "Đây là cấu hình tôi đề xuất:". **Hai lớp ép cùng lúc** — một ở prompt, một
ở tham số API — vì chỉ dùng prompt thôi thì model vẫn có thể bọc kết quả trong
khối markdown ```json.

---

## 5. Gọi API và bóc tách phản hồi

### 5.1. Đọc cấu hình

```java
apiKey = systemConfigService.getConfigByKey("GEMINI_API_KEY").getConfigValue();
// thiếu → ném IllegalArgumentException("GEMINI_API_KEY is not configured in System Config.")

model  = systemConfigService.getConfigByKey("GEMINI_MODEL").getConfigValue();
// thiếu → im lặng dùng mặc định "models/gemini-1.5-flash"
```

Hai khoá xử lý **khác nhau có chủ đích**: thiếu API key thì không thể chạy được
nên phải báo lỗi rõ ràng; thiếu tên model thì vẫn chạy được bằng model mặc định
nên không cần làm phiền người dùng.

> **Lưu ý vận hành**: không có migration nào seed sẵn `GEMINI_API_KEY`. Phải tự
> thêm khoá này trên màn hình System Config trước khi dùng, nếu không lần đầu bấm
> Ask AI sẽ báo lỗi ngay.

### 5.2. Cấu trúc phản hồi của Gemini

Gemini trả về JSON lồng khá sâu, nội dung thật nằm ở tận đáy:

```json
{
  "candidates": [
    { "content": { "parts": [ { "text": "{\"reasoning\":\"...\",\"timeFrames\":[...]}" } ] } }
  ]
}
```

Code phải đi qua 4 tầng để lấy được chuỗi cần dùng:

```java
root.get("candidates")           // ① mảng các phương án trả lời
    .get(0)                      // ② lấy phương án đầu tiên
    .get("content").get("parts") // ③ mảng các mẩu nội dung
    .get(0).get("text")          // ④ chuỗi JSON thật, dạng text
```

Mỗi tầng đều được kiểm tra null/rỗng trước khi đi tiếp, vì Gemini có thể trả về
`candidates` rỗng khi nội dung bị bộ lọc an toàn chặn.

**Điểm cần nhớ**: thứ trả về cho frontend là một **chuỗi ký tự chứa JSON**, chưa
được parse. Backend đóng vai người đưa thư, không mở phong bì.

---

## 6. Giao diện hiển thị kết quả

### 6.1. Hai bước trong Modal

**Bước 1 — trước khi gọi**: ô nhập ngữ cảnh tự do + nút "Send Analysis Request".

**Bước 2 — sau khi có kết quả**: frontend tự parse chuỗi rồi vẽ:
- Khối tím hiển thị `reasoning` — lý do AI đưa ra đề xuất.
- Mỗi khung giờ đề xuất là một thẻ riêng, bên trong là bảng 3 cột: **Priority /
  Zone / Threshold**.

### 6.2. Lớp phòng thủ khi AI trả về sai định dạng

Frontend không tin tuyệt đối vào AI. Trước khi parse, nó **cắt bỏ phần thừa**:

```js
const firstBrace = cleanStr.indexOf('{');
const lastBrace  = cleanStr.lastIndexOf('}');
cleanStr = cleanStr.substring(firstBrace, lastBrace + 1);
```

Nghĩa là dù AI có lỡ trả về ```` ```json {...} ``` ```` hay kèm câu dẫn, đoạn này
vẫn móc được phần JSON ở giữa ra.

Nếu parse vẫn thất bại, thay vì vỡ giao diện, nó rơi vào **nhánh dự phòng**: hiển
thị nguyên văn chuỗi thô kèm dòng chữ *"AI returned a format that cannot be parsed
into a UI table. Here is the raw result:"* — người dùng vẫn đọc được nội dung, chỉ
là không có bảng đẹp.

### 6.3. Không có nút "Áp dụng"

Modal chỉ có 2 nút: **Re-analyze** và **Close**. Đề xuất của AI **không được áp
dụng tự động** — quản lý phải tự nhìn bảng rồi nhập lại cấu hình bằng tay ở màn
hình chính.

Đây vừa là giới hạn (thao tác thủ công, dễ nhập sai) vừa là một lựa chọn an toàn:
không để một hệ thống bên ngoài tự ý thay đổi cấu hình vận hành thật của bãi xe.

---

## 7. Câu chuyện một lỗi đáng nhớ: `@JsonProperty("isRoutingEnabled")`

Trong `AiRoutingRequest` có một dòng annotation kèm comment dài cảnh báo **không
được xoá**. Lý do rất đáng học:

```java
@JsonProperty("isRoutingEnabled")
private boolean isRoutingEnabled;
```

**Chuỗi nguyên nhân:**

1. Field kiểu `boolean` đặt tên bắt đầu bằng `is` → Lombok sinh getter
   `isRoutingEnabled()` (không phải `getIsRoutingEnabled()`).
2. Jackson nhìn getter `isRoutingEnabled()` và suy ra tên thuộc tính JSON là
   **`routingEnabled`** — chữ `is` bị coi là tiền tố của getter nên bị nuốt mất.
3. Nhưng frontend gửi lên đúng key **`isRoutingEnabled`**.
4. Hai tên lệch nhau → Jackson **âm thầm bỏ qua**, field giữ nguyên giá trị mặc
   định `false`.

**Hậu quả:** prompt **luôn** khẳng định "tính năng điều phối đang TẮT", kể cả khi
quản lý đã bật. AI đọc xong liền khuyên *"hãy bật lại tính năng đi"* — trong khi
nó đang bật sẵn. Người dùng thấy AI nói năng vô lý mà không hiểu vì sao.

**Vì sao lỗi này khó phát hiện:** không có exception, không có log lỗi, API vẫn
trả 200. Chỉ có nội dung tư vấn là sai lệch — mà nội dung do AI sinh ra thì vốn
đã "mềm", rất dễ bị bỏ qua như một câu trả lời kém chất lượng ngẫu nhiên.

`@JsonProperty` ép Jackson dùng đúng tên `isRoutingEnabled` như frontend gửi, vá
đứt gãy này.

---

## 8. Xử lý lỗi

| Tình huống | Chuyện gì xảy ra | Người dùng thấy gì |
|---|---|---|
| Chưa cấu hình `GEMINI_API_KEY` | Ném `IllegalArgumentException` → HTTP 400 | Toast đỏ **`GEMINI_API_KEY is not configured in System Config.`** |
| Chưa cấu hình `GEMINI_MODEL` | Im lặng dùng `models/gemini-1.5-flash` | Không thấy gì, chạy bình thường |
| API key sai / hết quota / mất mạng | Bọc thành `RuntimeException` → HTTP 500 | Toast đỏ `An unexpected error occurred: Error communicating with Gemini API: ...` |
| Gemini trả về `candidates` rỗng | Rơi vào `throw` cuối hàm, nhưng bị chính `catch` bao ngoài bắt lại → HTTP 500 | Cùng thông báo như dòng trên |
| AI trả về không đúng JSON | Frontend parse lỗi → nhánh dự phòng | Hiện chuỗi thô kèm dòng chữ giải thích |
| Người dùng không phải MANAGER | `@PreAuthorize` chặn | HTTP 403 |
| Bấm nút liên tục | Nút bị khoá khi `isAiLoading` | Không gửi trùng request |

**Một chi tiết trong code cần biết**: dòng
`throw new IllegalArgumentException("Failed to get a valid response from Gemini")`
nằm **bên trong** khối `try`, nên bị chính `catch (Exception e)` ngay dưới bắt lại
và bọc thành `RuntimeException`. Kết quả là thông điệp này không bao giờ ra ngoài
ở dạng lỗi 400 gọn gàng, mà luôn thành lỗi 500 với chuỗi dài
`An unexpected error occurred: Error communicating with Gemini API: Failed to get
a valid response from Gemini`.

---

## 9. Giới hạn của thiết kế hiện tại

| Giới hạn | Chi tiết |
|---|---|
| **Không áp dụng tự động** | Không có nút "Apply". Quản lý phải nhập lại cấu hình bằng tay theo bảng AI đề xuất |
| **Không lưu lịch sử tư vấn** | Đóng modal là mất. Không có bảng nào lưu lại đề xuất cũ để so sánh |
| **Không xác thực nội dung AI** | Backend không kiểm tra tên Zone AI trả về có tồn tại thật không, ngưỡng có nằm trong 0–100 không. AI hoàn toàn có thể bịa ra một Zone không tồn tại |
| **Gọi đồng bộ, không timeout riêng** | `RestTemplate` mặc định. Nếu Gemini phản hồi chậm thì request treo, người dùng chỉ thấy nút xoay |
| **API key lưu dạng văn bản thường trong DB** | Nằm ở bảng `system_configs`, ai đọc được bảng đó là thấy key |
| **Mỗi lần bấm là một lần gọi API tính phí** | Không có cache. Bấm "Re-analyze" 5 lần là 5 lần tốn quota |
| **Chỉ tư vấn cho Zone WALK_IN** | Do frontend lọc trước. Đúng thiết kế, nhưng nghĩa là AI không có ý kiến gì về Zone vé tháng |

---

## 10. Tóm tắt trong 5 câu

1. AI trong dự án là **cố vấn đọc số liệu**, không tham gia điều phối xe — việc
   quyết định xe đỗ đâu vẫn do thuật toán rule-based đảm nhiệm hoàn toàn.
2. Khi bấm "Ask AI", frontend gom **biểu đồ độ đầy + cấu hình luật hiện tại +
   trạng thái bật/tắt + ghi chú tự do của quản lý** gửi lên backend.
3. `GeminiService` ghép 6 phần đó thành một prompt có gán vai trò, có rẽ nhánh
   theo trạng thái bật/tắt, và **đưa hẳn mẫu JSON** để ép định dạng đầu ra.
4. Phản hồi của Gemini được bóc qua 4 tầng lồng nhau để lấy chuỗi JSON, rồi trả
   nguyên chuỗi về cho frontend tự parse và vẽ bảng đề xuất.
5. Đề xuất chỉ dừng ở mức **hiển thị để tham khảo** — không tự áp dụng, không lưu
   lịch sử, quản lý toàn quyền quyết định có làm theo hay không.
