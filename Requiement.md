Topic:
"Hệ thống quản lý tòa nhà gửi xe
Parking Building Management System"

Context:
Tại các đô thị lớn, nhu cầu gửi xe tăng cao trong khi diện tích đỗ xe bị giới hạn. Tòa nhà gửi xe nhiều tầng là công trình chuyên dùng để tiếp nhận, lưu giữ và tổ chức xe ra/vào theo nhiều tầng hoặc khu vực đỗ khác nhau. Vì lưu lượng xe ra vào liên tục, cần có hệ thống phần mềm hỗ trợ quản lý vận hành bãi xe chính xác và hiệu quả.

Problems:
Nghiệp vụ tòa nhà gửi xe cần quản lý tốt các vấn đề như xe vào/ra, chỗ đỗ còn trống, vé gửi xe, phí gửi xe và các tình huống phát sinh như mất vé, quá hạn hoặc sai thông tin xe. Nếu quản lý thủ công, bãi xe dễ bị ùn ứ tại cổng, sai lệch dữ liệu, khó kiểm soát sức chứa và khó đối soát doanh thu.

Primary Actors:
"Parking Facility Manager
Parking Staff
Parking User / Driver
System Administrator"

Functional Requirements:
"Parking Manager
- Quản lý thông tin tòa nhà gửi xe
- Quản lý loại phương tiện
- Quản lý phân tầng theo loại xe
- Quản lý slot đỗ xe và trạng thái slot: theo dõi slot còn trống, đang sử dụng, đã đặt trước, bảo trì hoặc tạm khóa
- Quản lý bảng giá, quy định chính sách tính phí gửi xe
- Xem báo cáo lượt xe vào/ra, doanh thu, tỷ lệ lấp đầy, khung giờ cao điểm theo từng loại phương tiện
- Các quản lý nâng cao khác như: theo dõi các trường hợp mất vé, sai biển số, quá giờ, gửi sai khu vực, xe chưa thanh toán (optional)

Parking Staff
- Hỗ trợ xử lý xe vào bãi: kiểm tra điều kiện xe vào bãi, nhập/quét biển số xe, hướng dẫn xe vào đúng tầng/khu vực theo loại phương tiện
- Tạo lượt gửi xe: Tạo parking session cho xe gửi theo lượt, ghi nhận thời gian vào, loại xe, cổng vào
- Hỗ trợ xử lý xe ra bãi: tìm lượt gửi xe, xác nhận thời gian ra, kiểm tra phí cần thanh toán, thu phí gửi xe,
- Hỗ trợ xử lý các trường hợp ngoại lệ: mất thẻ xe, sai thông tin xe, xe quá hạn gửi, xe gửi sai khu vực, cập nhật trạng thái slot.

Parking User / Driver
- Xem thông tin bãi xe: thời gian hoạt động, loại xe được phục vụ, bảng giá và quy định gửi xe, số slot trống
- Gửi xe theo lượt: nhận thẻ xe/mã gửi xe khi vào bãi và thanh toán phí khi ra
- Đặt chỗ trước: đặt chỗ theo loại phương tiện, thời gian gửi và khu vực còn trống nếu hệ thống hỗ trợ
- Theo dõi lượt gửi xe: xem thông tin lượt gửi xe hiện tại: giờ vào, loại xe, khu vực gửi, phí tạm tính
- Thanh toán phí gửi xe và dịch vụ bổ sung nếu có
- Gửi phản hồi về mất thẻ xe, sai phí, khó tìm xe, slot bị chiếm hoặc vấn đề trong bãi xe (optional)

System Administrator
- Quản lý tài khoản người dùng
- Phân quyền
- Quản lý cấu hình hệ thống

*** Khuyến khích có thêm các chức năng AI hỗ trợ như:
Tối ưu phân bổ chỗ đỗ xe theo loại phương tiện trong tòa nhà gửi xe sao cho giảm thời gian tìm chỗ, tăng tỷ lệ sử dụng bãi xe"

Research Questions:
"RQ1: Việc phân tầng, khu vực theo loại phương tiện ảnh hưởng thế nào đến hiệu quả sử dụng chỗ đỗ?
RQ2: Phân bổ slot tự động có giúp giảm thời gian tìm chỗ so với cách chọn chỗ tự do không?
RQ3: Nên ưu tiên tiêu chí nào khi phân bổ slot: khoảng cách, tầng, loại xe, thời gian gửi hay tỷ lệ lấp đầy slot đỗ các tầng, các khu vực?
RQ4: Thuật toán phân bổ slot có thể cải thiện tỷ lệ sử dụng bãi xe trong giờ cao điểm?"

Main Flows:
"1. Luồng xử lý xe vào tòa nhà để gửi/đỗ theo lượt
2. Luồng xử lý xe ra, kết thúc lượt gửi và thanh toán theo lượt
3. Luồng tạo, quản lý các khu vực, tầng đỗ (slot đỗ nếu có) cho các phương tiện
4. Luồng quản lý, cấu hình và quy định chi phí đỗ xe theo phương tiện, theo các loại vé lượt, vé tháng
5. Luồng xử lý đăng ký và gửi/đỗ xe theo các trường hợp đặc biệt: vé tháng, đặt chỗ trước,… (optional)
6. Luồng xử lý mất thẻ gửi xe (optional)"
