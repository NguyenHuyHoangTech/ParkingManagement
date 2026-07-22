# BỨC TRANH TOÀN CẢNH: HÀNH TRÌNH CỦA MỘT YÊU CẦU (REQUEST - RESPONSE)
*Tài liệu này mô tả chi tiết vòng đời 100% của một luồng dữ liệu từ khi người dùng thao tác trên màn hình (Frontend) chọc xuống Cơ sở dữ liệu (Backend) và quay trở về màn hình hiển thị.*

---

## GIAI ĐOẠN 1: KHỞI NGUỒN TỪ FRONTEND (Màn hình giao diện)
**📍 Địa điểm:** File `GateConsoleScreen.tsx`

Khi giao diện cần lấy danh sách cổng, nó phát ra một tín hiệu (bóp cò) thông qua thư viện vận chuyển Axios:
```typescript
// Gọi lệnh lấy dữ liệu từ địa chỉ '/infrastructure/gates'
const res = await axiosClient.get('/infrastructure/gates');
```
*Lưu ý: Lúc này, lệnh `await` làm cho hệ thống tạm dừng tại dòng này, đứng há miệng chờ dữ liệu trả về.*

---

## GIAI ĐOẠN 2: TRẠM KIỂM SOÁT XUẤT CẢNH (Request Interceptor)
**📍 Địa điểm:** File `axiosClient.ts`

Trước khi gói hàng được quăng lên mạng Internet, thư viện Axios ép nó phải chạy qua một "Chốt hải quan" để kiểm tra và dán thêm Hộ chiếu (Token bảo mật).
```typescript
axiosClient.interceptors.request.use((config) => {
    // 1. Chạy vào Ngân hàng Zustand lôi cái Token ra
    const token = useAuthStore.getState().token;
    
    // 2. Dán chặt Token lên vỏ hộp bằng băng keo "Authorization"
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 3. Mở barie cho kiện hàng bay lên mạng!
    return config; 
});
```

---

## GIAI ĐOẠN 3: XUYÊN QUA INTERNET VÀ CHẠM NGÕ MÁY CHỦ (Backend)
Kiện hàng được đóng gói, nhắm thẳng tới Cổng (Port) `8080` của Máy chủ Java Spring Boot.
Tại cửa tòa nhà Spring Boot, cô Lễ Tân **`DispatcherServlet`** nhận lấy kiện hàng và dắt nó đi qua các trạm kiểm tra an ninh.

---

## GIAI ĐOẠN 4: CỬA AN NINH VÀ PHÂN QUYỀN (Security & JWT)
**📍 Địa điểm:** Khởi điểm từ `SecurityConfig.java` -> Gọi `JwtAuthFilter.java` -> Gọi `JwtProvider.java`

Từ Internet vào đến Backend, kiện hàng sẽ bị chặn lại bởi Lớp khiên bảo vệ **Spring Security**. Quá trình gọi nhau diễn ra như sau:

**Bước 4.1: `SecurityConfig` gọi `JwtAuthFilter` ra làm việc**
Trong file `SecurityConfig.java`, hệ thống đã ra lệnh bố trí chốt gác ngay cửa:
`http.addFilterBefore(jwtAuthFilter, ...)`
Do đó, mọi kiện hàng từ Internet ập vào đều phải đưa cho ông bảo vệ `JwtAuthFilter` xử lý đầu tiên.

**Bước 4.2: `JwtAuthFilter` bóc vỏ hộp (Hàm `parseJwt`)**
Ông bảo vệ xé lớp băng keo "Authorization" trên kiện hàng, cắt bỏ 7 chữ cái đầu "Bearer " để lôi cái lõi Thẻ Token ra ngoài. 

**Bước 4.3: `JwtAuthFilter` gọi `JwtProvider` để quét thẻ**
Ông bảo vệ đút tấm thẻ vào máy quét:
```java
if (jwt != null && jwtProvider.validateToken(jwt)) { ... }
```
Máy quét `JwtProvider` sẽ lôi chìa khóa bí mật (`jwt.secret`) ra soi Chữ ký điện tử (Mộc đỏ) và Hạn sử dụng. Trả về `true` (Thẻ xịn) hoặc văng lỗi (Thẻ dỏm / Hết hạn).

**Bước 4.4: Đeo thẻ chức vụ cho khách (`SecurityContextHolder`)**
Nếu máy quét báo thẻ hợp lệ, `JwtAuthFilter` lập tức lôi thông tin chức vụ (Ví dụ: `ROLE_STAFF`) của người này từ Database ra. 
Sau đó, nó làm một hành động cực kỳ quan trọng: **Đeo cái chức vụ đó lên ngực khách hàng** bằng cách lưu vào Bảng Thông Báo Chung:
`SecurityContextHolder.getContext().setAuthentication(...)`
Xong xuôi, ông bảo vệ mở cửa cho khách bước lọt vào trong sảnh.

**Bước 4.5: Lõi Security đối chiếu chức vụ (Phân quyền - Authorization)**
Khách đi vào trong sảnh, muốn rẽ vào phòng `/api/v1/gates`. Hệ thống Camera An Ninh của `SecurityConfig` soi cái thẻ đang đeo trên ngực khách (Lấy từ `SecurityContextHolder`).
Nó đối chiếu với Bảng Nội Quy do bạn viết:
```java
.requestMatchers("/api/v1/gates/**").hasAnyRole("STAFF", "MANAGER")
.requestMatchers("/api/v1/infrastructure/**").permitAll() 
```
- Nếu khách rẽ vào `/infrastructure/**` -> Bảng ghi `permitAll()` -> Mở cửa ngay!
- Nếu khách rẽ vào `/api/v1/gates` -> Bảng ghi yêu cầu `STAFF` hoặc `MANAGER`. Camera soi ngực khách thấy chữ `ROLE_STAFF` -> Khớp! Cho đi tiếp. Nhưng nếu ngực khách ghi `ROLE_CUSTOMER` -> Báo động, đá văng ra ngoài với mã lỗi **403 Forbidden** (Cấm truy cập).

Chỉ khi vượt qua được 5 bước liên hoàn này, kiện hàng mới thực sự được quyền đi sâu vào bên trong tòa nhà!

---

## GIAI ĐOẠN 5: SA BÀN ĐIỀU HƯỚNG (Router Ngầm)
Máy chủ Spring Boot có một bộ não điều hướng tên là **`HandlerMapping`**.
Nó nhìn vào cái địa chỉ đích `/infrastructure/gates` ghi trên kiện hàng, đối chiếu với các lá bùa trên đầu các file code. Nó thấy khớp mười mươi với lá bùa **`@RequestMapping`** và **`@GetMapping`** ở file `GateController`. Thế là nó ném thẳng kiện hàng vào đó!

---

## GIAI ĐOẠN 6: PHÒNG GIAO DỊCH VÀ THỢ LẶN DATABASE
**📍 Địa điểm:** File `GateController.java` & `GateRepository.java`

Kiện hàng lọt vào tay hàm `getAllGates()`.

**Bước 6.1: Nhờ Thợ lặn xúc dữ liệu**
```java
// gateRepository là công cụ (Thợ lặn) được Spring Boot "tiêm" sẵn vào tay Controller
List<GateConfigDTO> gates = gateRepository.findAll()
```
Anh thợ lặn `gateRepository` chui tuột xuống đáy Database (MySQL), xúc lên toàn bộ danh sách cổng.

**Bước 6.2: Chạy băng chuyền chế biến (Java Stream API)**
```java
.stream()
.filter(g -> !"DELETED".equals(g.getStatus())) // Gạt bỏ hàng lỗi (cổng đã xóa)
.map(this::toDTO)                              // Gọt đẽo từ Cổng nguyên bản thành Mô hình cổng mini (DTO)
.collect(Collectors.toList());                 // Gom tất cả vào một cái Khay nhôm (List)
```

**Bước 6.3: Đóng Hộp Búp Bê Nga và Ném về Frontend**
```java
return ResponseEntity.ok(ApiResponse.success(gates, "Fetched gates successfully"));
```
Ông Giao dịch viên lôi cái Khay nhôm bỏ vào cái Hộp Quà công ty (`ApiResponse`). Sau đó lại lồng vào Hộp Carton bưu điện (`ResponseEntity`), dán con tem xanh **200 OK** và vứt cho Tomcat ném qua mạng về lại Frontend. Khúc này code Java kết thúc nhiệm vụ!

---

## GIAI ĐOẠN 7: TRẠM HẢI QUAN NHẬN HÀNG (Response Interceptor)
**📍 Địa điểm:** File `axiosClient.ts`

Gói hàng bay về tới Trình duyệt web. Trước khi giao cho file giao diện, nó bị trạm hải quan chặn lại:
```typescript
axiosClient.interceptors.response.use(
  // LUỒNG 1 (THÀNH CÔNG): Nếu thấy tem 200 OK -> Cho qua!
  (response) => response, 
  
  // LUỒNG 2 (THẤT BẠI): 
  (error) => {
    // Nếu Máy chủ Backend dán tem 401 (Lỗi Hết hạn thẻ)
    if (error.response?.status === 401) {
      useAuthStore.getState().logout(); // Ép hệ thống xóa trí nhớ
      window.location.href = '/login';  // Đá văng ra màn hình đăng nhập
    }
    return Promise.reject(error);
  }
);
```

---

## GIAI ĐOẠN 8: ĐÍCH ĐẾN CUỐI CÙNG (Giao diện React bừng sáng)
**📍 Địa điểm:** File `GateConsoleScreen.tsx`

Kiện hàng (cục `response`) lọt qua hải quan an toàn. Bưu điện Axios Core mang nó chạy thẳng tới dòng chữ `await` đang đứng mỏi chân chờ từ Giai đoạn 1.
Chữ `await` vỡ vụn. Biến `res` nhận lấy toàn bộ kiện hàng.

```typescript
// Khui lớp hộp số 1 (của Axios) -> Khui lớp hộp số 2 (của Java) -> Lấy được cái Khay Nhôm!
return res.data.data; 
```

Cái Khay Nhôm (chứa danh sách cổng) được ném cho anh quản lý **`useQuery`**.
1. Anh ta nhét khay nhôm vào biến `gatesData`.
2. Tắt cầu dao `isLoading` thành `false`.
3. React réo còi báo động: *"Dữ liệu thay đổi rồi!"*.
4. Giao diện Màn hình Cổng tự động vẽ lại (Re-render), vứt bỏ cái vòng tròn Loading và hiển thị lên toàn bộ danh sách Cổng cho nhân viên sử dụng!

**KẾT THÚC QUY TRÌNH KÉP KÍN! (Thời gian thực thi: ~0.1 giây)**
