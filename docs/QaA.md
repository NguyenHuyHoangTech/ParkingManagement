# TÀI LIỆU HỎI ĐÁP (Q&A) BẢO VỆ ĐỒ ÁN
**Chủ đề:** Các kịch bản ngoại lệ (Edge Cases) và xử lý sự cố tại bãi đỗ xe thông minh.

Dưới đây là bộ câu trả lời chất lượng cao, dựa trên thiết kế thực tế của mã nguồn (Backend & Frontend) để đối đáp với hội đồng bảo vệ.

---

### CÂU 1: Vụ án "Quay xe chớp nhoáng" (U-turn / Grace period)
**Câu hỏi:** Khách vừa vào nhưng quay ra ngay, hệ thống tính tiền như thế nào? Thẻ vé tháng có bị kẹt Anti-passback không?

**Trả lời (Dựa trên code thực tế):**
* Thưa hội đồng, hệ thống của em **đã có thiết kế cơ chế ân hạn (Grace Period)**.
* Trong core tính cước `PricingCalculatorService`, hệ thống sử dụng cấu hình **Lớp Phủ Toàn Cục (Global Base Settings)**. Quản trị viên có thể cài đặt `globalBaseMins = 15` (15 phút) và `globalBaseFee = 0`.
* Khi thuật toán chạy (Bước 1: Pre-processing), nếu tổng thời gian `totalMinutes <= globalBaseMins`, máy tính tiền lập tức kết thúc vòng lặp và trả về 0 VNĐ. Khách hàng ra khỏi bãi hoàn toàn miễn phí.
* Đối với vé tháng, khi xe ra, hệ thống đóng phiên (chuyển trạng thái thành `COMPLETED`). Lần sau khách quay lại, biển số đó hoàn toàn hợp lệ để mở một phiên IN mới. Không hề bị kẹt trạng thái Anti-passback (kẹt trạng thái đang IN).

---

### CÂU 2: Vụ án "Bám đuôi" và Lỗi trạng thái (Tailgating)
**Câu hỏi:** Xe đi bám đuôi vượt trạm lúc vào (không có lịch sử Check-in), lúc ra hệ thống xử lý sao?

**Trả lời (Dựa trên code thực tế):**
* Hệ thống của em áp dụng chính sách **Strict Anti-passback**. Tại cổng ra, hàm `processCheckOut` bắt buộc phải tìm thấy một `ParkingSession` đang `ACTIVE` gắn với biển số hoặc thẻ RFID đó.
* Vì xe trốn trạm lúc vào, Database không có Session nào. Màn hình cổng ra sẽ báo lỗi: "Không tìm thấy dữ liệu xe vào". Cổng tuyệt đối không mở.
* **Cách giải quyết:** Nhân viên sẽ điều hướng xe sang một bên, sử dụng màn hình **Xử lý ngoại lệ (Exception Desk - `ExceptionDeskScreen.tsx`)**. Nhân viên kiểm tra camera an ninh, tạo một phiên Check-in **hồi tố (Backdated)**, đồng thời tạo một **Vé phạt (Incident Ticket)** với lỗi "Trốn trạm/Không tuân thủ quy định". Khách phải đóng phí đỗ xe + phí phạt thì mới được giải phóng.

---

### CÂU 3: Vụ án "Trễ giờ và Bùng kèo" Booking (Late Arrival & No Show)
**Câu hỏi:** Khách Booking đến trễ thì tính tiền từ lúc nào? Khách không đến thì xử lý ra sao?

**Trả lời (Dựa trên code thực tế):**
1. **Trường hợp đến trễ (Late Arrival):** Hệ thống tạo `ParkingSession` (Bắt đầu tính tiền đỗ xe) dựa trên **thời gian thực tế xe quét biển số qua cổng (`timeIn`)**, chứ không phải tính từ lúc bắt đầu khung giờ Booking. Do đó, khách không bị tính tiền đỗ cho khoảng thời gian chưa đến.
2. **Trường hợp Bùng kèo (No Show):** Hệ thống có các background job (Scheduled Tasks). Khi qua mốc thời gian đặt chỗ mà xe không xuất hiện, trạng thái của Đơn đặt chỗ (Reservation) sẽ tự động chuyển từ `PENDING` sang `EXPIRED` hoặc `CANCELLED`. Bãi đỗ (Zone) được giải phóng tự động để nhường chỗ cho khách Vãng lai, tối ưu hóa không gian.

---

### CÂU 4: Vụ án "Mất thẻ & Kẻ gian" (Security & Lost Card)
**Câu hỏi:** Kẻ gian trộm xe, giả vờ báo mất thẻ. Giải quyết thế nào để không tiếp tay cho trộm?

**Trả lời (Dựa trên code thực tế):**
* Thưa hội đồng, mất thẻ không có nghĩa là mất thông tin. Hệ thống của em có **Camera AI đọc biển số tự động (LPR)** tại cổng ra.
* Kẻ gian đi xe tới cổng ra, Camera sẽ đọc được biển số. Nhân viên chỉ cần nhìn màn hình là thấy ngay lịch sử Check-in của biển số đó (Ảnh chụp toàn cảnh và Ảnh mặt người lái xe lúc vào).
* Dựa vào tính năng đối chiếu hình ảnh, nhân viên sẽ thấy mặt người lái lúc ra không giống người lúc vào. Kẻ gian lập tức bị phát hiện.
* Kể cả khi đó đúng là chủ xe bị rơi thẻ, nhân viên sẽ sử dụng tính năng **Báo mất thẻ** trên UI: Khóa thẻ cũ (chuyển status thành `LOST_CARD`), tạo vé phạt đền bù thẻ gắn vào Session, thu tiền và cho xe ra. Thẻ cũ bị khóa vĩnh viễn nên kẻ gian nếu nhặt được cũng không thể dùng.

---

### CÂU 5: Vụ án "Tráo thẻ cước phí" (Fee Fraud)
**Câu hỏi:** Lấy thẻ của xe đạp (phí rẻ) quẹt để đi ô tô (phí đắt) ra khỏi bãi. Làm sao để bắt lỗi?

**Trả lời (Dựa trên code thực tế):**
* Hệ thống của em được thiết kế để đập toàn hoàn thủ đoạn này nhờ cơ chế **Đối chiếu Chéo (Cross-Validation)**.
* Khi kẻ gian lấy thẻ xe đạp quẹt tại cổng ra của ô tô, mã thẻ đó gọi về DB và lôi lên `ParkingSession` của chiếc xe đạp (với Biển số xe đạp, Ảnh xe đạp, Loại xe là BICYCLE).
* TRONG KHI ĐÓ, Camera AI tại cổng ra lại quét ra Biển số thực tế là Ô tô, và loại xe AI nhận diện là CAR.
* Trên giao diện (`GateOutConsoleScreen.tsx`), dữ liệu lập tức **xung đột đỏ chót**:
  - Thông tin thẻ: Xe đạp | Biển số A
  - AI nhận diện: Ô tô | Biển số B
* Thêm vào đó, nhân viên nhìn ảnh xe lúc vào (là xe đạp) so với xe đang đứng trước mặt (là ô tô) sẽ biết ngay có sự gian lận. Thao tác này là không thể qua mặt!

---

### CÂU 6: Sự cố "Đứt cáp lúc Cao điểm" (System Resilience)
**Câu hỏi:** Sập mạng/Sập server lúc đang giải phóng 5000 xe. Xử lý như thế nào?

**Trả lời (Dựa trên thiết kế kiến trúc):**
* Đây là rủi ro bất khả kháng với mọi hệ thống IoT tập trung. Để phòng bị:
  1. **Về phần cứng:** Server và các Trạm gác (Edge Node) luôn có mạng dự phòng (Backup 4G/LTE) và bộ lưu điện UPS.
  2. **Về phần mềm:** Nếu mất kết nối Backend hoàn toàn, hệ thống barie có công tắc mở cứng (Manual Override). Bảo vệ sẽ sử dụng điện thoại/máy tính bảng chụp ảnh lại toàn bộ xe ra (hoặc ghi chép sổ). 
  3. **Hậu kiểm:** Khi hệ thống online trở lại, nhân viên sử dụng tính năng **Bàn Xử Lý Ngoại Lệ (Exception Desk)** hoặc module `DataMigrationService` để nhập hồi tố (Sync) các xe đã ra ngoài vào hệ thống, chốt lại doanh thu và trạng thái thẻ hợp lệ.

---

## PHẦN 2: GÓC NHÌN CHUYÊN GIA (BẮT LỖI NGHIỆP VỤ SÂU)
*(Đây là các lỗi logic/yếu điểm thực sự đang tồn tại trong hệ thống hiện tại. Em cần nắm rõ để bọc lót khi bị hỏi xoáy).*

### CÂU 7: Lỗ hổng "Blacklist Auto-Removal" (Tự động gỡ Danh sách đen)
**Chuyên gia hỏi:** "Tôi đọc code thấy ở hàm `processCheckIn`, khi xe nằm trong Blacklist tiến vào, hệ thống của em **tự động gỡ cờ Blacklist** (`v.setIsBlacklisted(false)`) rồi cho xe vào bãi và tự tạo một vé phạt để thu tiền lúc ra. 
1. Nếu xe đó là xe tội phạm, xe bị cấm cửa do gây rối, tại sao em lại mở cửa cho nó vào bãi? 
2. Nếu lúc ra khách đó chây ỳ không có tiền trả vé phạt, thì xe đó vẫn nghiễm nhiên được xóa Blacklist sao? Logic này đang phá vỡ hoàn toàn định nghĩa của từ 'Blacklist'!"

**Cách bọc lót/Trả lời:**
* "Dạ, em xin ghi nhận điểm yếu này. Thiết kế hiện tại của bọn em đang thiên hướng Blacklist là 'Danh sách nợ xấu' (chưa đóng phạt) thay vì 'Cấm cửa vật lý'. 
* Hướng khắc phục chuẩn xác nhất là: Hệ thống phải Hard-stop (Chặn cứng) ở cổng IN, tuyệt đối không mở barie. Nhân viên ra thu tiền mặt vé phạt ngay tại cổng IN. Thu xong, nhân viên bấm nút 'Xóa Blacklist' bằng tay thì mới cho xe vào. Em sẽ cập nhật lại luồng này ở phiên bản thực tế ạ."

### CÂU 8: Lỗ hổng "Bãi đã đầy nhưng vẫn cho vào" (Capacity Enforcement)
**Chuyên gia hỏi:** "Ở hàm `processCheckIn`, khi tìm Zone gợi ý (Routing), nếu tất cả các bãi đều đầy (`suggestedZone = null`), hệ thống của em chỉ gán `request.setSuggestedZoneName("Free")` và... **VẪN CHO XE VÀO BÃI**. 
Hậu quả là xe vãng lai cứ ùn ùn kéo vào một bãi đỗ đã hết sức chứa, dẫn đến kẹt xe cục bộ bên trong hầm. Em giải quyết bài toán sức chứa (Capacity) cứng này ở đâu?"

**Cách bọc lót/Trả lời:**
* "Thưa thầy, hiện tại hệ thống mới chỉ dừng ở mức 'Khuyến nghị' (Routing/Suggested) chứ chưa áp dụng Hard-Limit (Chặn cứng).
* Để giải quyết triệt để, em sẽ bổ sung một biến `totalCapacity` ở cấp độ bãi xe. Khi hàm `processCheckIn` đếm thấy số `ParkingSession` đang ACTIVE (Cộng với số Booking đang chờ) = `totalCapacity`, hệ thống sẽ trả về Error: 'Bãi xe đã đầy', Barrier tuyệt đối không mở cho khách Vãng lai (Walk-in), và trên bảng LED ngoài cổng sẽ báo chữ FULL đỏ."

### CÂU 9: Rủi ro "Chênh lệch giá lúc giao ca/biến động" (Token Expiration & Cash Flow)
**Chuyên gia hỏi:** "Khi Check-out, UI gọi API báo giá và giữ giá đó qua `CheckoutToken` (có hạn 5 phút). Nhưng nếu khách đang lôi ví trả tiền mặt, mất đúng 5 phút 1 giây. Lúc nhân viên bấm 'Xác nhận thanh toán', Token hết hạn, API báo lỗi. 
Nhân viên F5 lại thì xe bị nhảy sang Block giờ tiếp theo, giá từ 20k nhảy lên 25k. Khách hàng đã đưa 20k và nhất quyết không đưa thêm. Nhân viên phải tự bù 5k hay cãi nhau với khách? Trải nghiệm (UX) đoạn này quá rủi ro!"

**Cách bọc lót/Trả lời:**
* "Đây đúng là một bài toán UX thực tế cực kỳ đau đầu ạ. Để xử lý, hệ thống của em đang cấp quyền cho tài khoản `MANAGER`. Nếu xảy ra tranh chấp tại mốc giao thời, Manager có thể dùng tính năng **'Discount/Waive' (Giảm trừ/Miễn trừ)** trên màn hình Exception Desk để cấn trừ 5.000đ phát sinh đó cho khách, giúp luồng xe đi nhanh nhất có thể. 
* Hoặc, em sẽ tăng hạn mức thời gian sống của JWT `CheckoutToken` lên 15 phút thay vì 5 phút để tạo bộ đệm an toàn lớn hơn cho giao dịch tiền mặt."

### CÂU 10: Rủi ro Race Condition (Xung đột Đồng thời)
**Chuyên gia hỏi:** "Ở `processCheckIn`, em kiểm tra xe đã ở trong bãi chưa (`existingSessions.isEmpty()`). Nếu tao click đúp chuột thật nhanh (Double Click) 2 lần, hoặc hệ thống IoT bắn 2 request đồng thời ở 2 luồng (thread) khác nhau. 2 luồng đều đọc DB thấy `isEmpty() = true` cùng 1 mili-giây, và ghi vào DB 2 bản ghi `ParkingSession` ACTIVE cho cùng 1 xe. Hệ thống của em sập luồng Check-out ngay lập tức. Em bọc lỗi Database Concurrency này chưa?"

**Cách bọc lót/Trả lời:**
* "Dạ, hiện tại code dùng Spring `@Transactional` mặc định, nên nó chưa khóa được lỗi Read-Write đồng thời này (Phantom Read).
* Hướng khắc phục triệt để: Ở mức Database, em sẽ thêm khóa Unique Constraint (UNIQUE INDEX) cho cặp cột `(plate, status)` với điều kiện `status = 'ACTIVE'`. Khi Thread thứ 2 cố Insert bản ghi thứ 2, Database sẽ quăng lỗi `DataIntegrityViolationException`, đảm bảo tính toàn vẹn 100% ạ."

---

## PHẦN 3: BẮT LỖI LOGIC CODE TRỰC TIẾP (CRITICAL BUGS)
*(Đây là 3 lỗi logic sai lệch trực tiếp trong source code của em. Hãy thuộc lòng cách phản biện này để chứng minh em làm chủ hoàn toàn dòng code).*

### CÂU 11: Bẫy Trải Nghiệm "Hoàn Tiền Tự Động" (Auto-Refund UX Trap) khi quét QR
**Chuyên gia hỏi:** "Tôi đã soi đoạn xử lý Webhook ở `PaymentController.java` (dòng 262). Khi khách thanh toán QR, nếu lề mề quét mã làm giá bị thay đổi, hệ thống của em rất thông minh khi văng lỗi và tự động gọi hàm `processRefundForFailedAction` để hoàn tiền, đồng thời Barie không mở. 
Tuy nhiên, em có nghĩ tới trải nghiệm thực tế không? Khách bị trừ tiền trong tài khoản ngân hàng, barie không mở, hệ thống báo 'Giá đã đổi, đang hoàn tiền' (mà hoàn tiền thẻ tín dụng/PayOS có thể mất từ 2-3 ngày). Lúc này nhân viên lại yêu cầu khách phải lấy ví ra quét tiếp mã QR 25.000đ mới tạo. Khách hàng chắc chắn sẽ nổi điên cãi vã tại cổng làm kẹt cứng toàn bộ bãi xe. Em xử lý rủi ro UX này thế nào?"

**Cách bọc lót/Trả lời:**
* "Dạ, em xin cảm ơn thầy đã chỉ ra một 'điểm mù' rất thực tế về mặt vận hành. Hệ thống của em đúng là đã bọc lót rất kỹ về dòng tiền (không để thất thoát kế toán nhờ Auto-Refund), nhưng lại bỏ quên cảm xúc của khách hàng.
* **Cách fix:** 
  1. Thay vì từ chối và Hoàn tiền tự động, em sẽ đưa quyền quyết định cho Nhân viên (Staff). Hệ thống báo: *'Khách đã thanh toán 20.000đ (Thiếu 5.000đ). Cho phép hạ barie hoặc yêu cầu bù tiền mặt?'*
  2. Nhân viên có thể linh động thu thêm 5k tiền mặt, hoặc gọi Quản lý dùng tính năng **Waive (Miễn trừ)** cấn trừ luôn 5k đó để mở cổng ngay lập tức, giải tỏa ách tắc."

### CÂU 12: Bẫy "Xóa án tích" cho tội phạm (Blacklist Code Logic)
**Chuyên gia hỏi:** "Tại hàm `processCheckIn` (Khoảng dòng 977 - 985), tôi thấy đoạn code:
`if (Boolean.TRUE.equals(v.getIsBlacklisted())) { v.setIsBlacklisted(false); vehicleRepository.save(v); }`
Tức là hệ thống tự động gỡ cờ Blacklist ngay khi xe đi vào bãi chỉ để bắt lỗi. Blacklist là Cấm Cửa, tại sao em lại cho nó vào? Và nếu lúc ra khách không chịu đóng phạt tiền mặt, thì chiếc xe đó vẫn vô tình được hệ thống của em 'Xóa án tích' thành xe sạch sao?"

**Cách bọc lót/Trả lời:**
* "Dạ, em xin nhận lỗi sai về mặt định nghĩa quy trình ở đoạn code này. Mục đích ban đầu của nhóm em chỉ là 'Lưu cờ phạt để thu tiền bù', nên tụi em đặt tên nhầm là Blacklist. 
* **Cách fix:** 
  1. Em phải đổi tên nghiệp vụ đó thành `WarningList` (Danh sách nợ xấu) thay vì `Blacklist` (Cấm cửa).
  2. Đoạn code `v.setIsBlacklisted(false);` tuyệt đối không được gọi lúc Check-in. Nó CHỈ được gọi ở hàm `processCheckOut` SAU KHI khách hàng thanh toán thành công 100% tiền phạt ạ."

### CÂU 13: Bất đồng bộ giảm giá (Discount Inconsistency)
**Chuyên gia hỏi:** "Ở hàm API `calculateRequiredAmount` (File `PaymentValidatorService`), khi tính toán em lấy `expectedParking + expectedPenalty - discount` (Trừ Voucher vào CẢ tổng tiền đỗ + tiền phạt).
NHƯNG ở hàm `processCheckOut`, khi lưu Database, biến `remainingDiscount` của em chỉ được trừ vào Phí đỗ và Phí lố giờ, KHÔNG ĐƯỢC trừ vào Tiền phạt. 
Hậu quả: API tính ra 0đ (Khách qua cổng), nhưng DB ghi nhận khách nợ 50.000đ tiền phạt. Tại sao code tính tiền ở API và code lưu Database của em lại tính ra 2 kết quả khác nhau?"

**Cách bọc lót/Trả lời:**
* "Dạ, đây là lỗi bất đồng bộ công thức tính toán (Inconsistent Formula) giữa 2 Service riêng biệt do quá trình gom code chưa triệt để. 
* Theo nghiệp vụ chuẩn: Voucher (Discount) CHỈ được giảm giá cho tiền đỗ xe, tuyệt đối không được áp dụng giảm tiền Phạt (Penalty). 
* **Cách fix:** Em sẽ sửa lại API ở `PaymentValidatorService` để nó tính giống hệt DB: `total = Math.max(0, expectedParking - discount) + expectedPenalty;`. Lúc đó tiền phạt sẽ luôn được bảo toàn và 2 hàm sẽ đồng nhất kết quả ạ."
