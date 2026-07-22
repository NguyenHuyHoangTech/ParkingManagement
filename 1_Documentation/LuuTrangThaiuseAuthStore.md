# SỰ KỲ DIỆU CỦA ZUSTAND VÀ LƯU TRỮ TRẠNG THÁI (useAuthStore)
*Tài liệu này giải thích chi tiết cách hệ thống Frontend (React) ghi nhớ người dùng là ai, và làm sao để không bị "mất trí nhớ" khi người dùng nhấn F5 tải lại trang web.*

---

## 1. TẠI SAO LẠI CẦN ĐẾN `useAuthStore`? (Ngân hàng Trung Ương)
Trong React, dữ liệu mặc định chỉ chảy từ Component Cha xuống Component Con thông qua các đường ống gọi là `props`. 
Nếu một Component ở tít dưới đáy màn hình muốn biết "Token của người dùng là gì?", nó phải xin Component Cha, Component Cha lại đi xin Component Ông Nội... Việc này gọi là **Prop Drilling**, cực kỳ mệt mỏi và rườm rà!

=> **Giải pháp:** Chúng ta tạo ra một cái **Ngân Hàng Trung Ương (Zustand Store)** tên là `useAuthStore`.
Ngân hàng này nằm độc lập ở ngoài cùng. Bất kỳ Component nào trên màn hình (dù ở ngóc ngách nào) cũng có thể trực tiếp chạy ra Ngân hàng để:
- **Gửi tiền (Set State):** Đưa Token vào lưu trữ sau khi Đăng nhập thành công.
- **Rút tiền (Get State):** Lấy Token ra để gắn vào các luồng gọi API (như ông Hải quan `axiosClient` đã làm).

---

## 2. CẤU TRÚC CỦA NGÂN HÀNG ZUSTAND
Bên trong `useAuthStore.ts`, cấu trúc của nó chia làm 2 phần cực kỳ rõ ràng:
1. **Kho chứa đồ (State):** Chứa các biến như `token`, `user`, `isAuthenticated`. (Lúc chưa đăng nhập thì kho này rỗng).
2. **Nhân viên thu ngân (Actions):** Chứa các hàm như `setAuth` (nhận Token bỏ vào kho), `logout` (đốt sạch Token trong kho đi).

```typescript
export const useAuthStore = create<AuthState>()(
  // ... cấu hình persist
  (set) => ({
    // 1. Kho chứa đồ ban đầu (Trống rỗng)
    user: null,
    token: null,
    isAuthenticated: false,

    // 2. Nhân viên thu ngân xử lý nghiệp vụ
    setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
    logout: () => set({ user: null, token: null, isAuthenticated: false }),
  })
)
```

---

## 3. CĂN BỆNH MẤT TRÍ NHỚ (Khi nhấn F5)
Mặc dù Zustand rất mạnh, nhưng bản chất nó lưu dữ liệu trên **Bộ nhớ RAM của Trình duyệt**.
Điều này dẫn đến một thảm họa: **Chỉ cần người dùng nhấn F5 (Tải lại trang), toàn bộ RAM sẽ bị xóa sạch!** Trí nhớ của Ngân hàng bay màu, Token biến mất, hệ thống tưởng người dùng chưa Đăng nhập và đá văng họ về lại trang Login.

---

## 4. PHÉP MÀU MANG TÊN `persist` (Sổ Tiết Kiệm / Két Sắt)
Để chữa căn bệnh mất trí nhớ, thư viện Zustand cung cấp một đạo bùa cực kỳ bá đạo tên là **`persist`** (Kiên trì / Bền bỉ).

Bạn hãy chú ý dòng code bọc bên ngoài trong file `useAuthStore.ts`:
```typescript
export const useAuthStore = create<AuthState>()(
  persist( // <--- ĐẠO BÙA LƯU TRỮ
    (set) => ({ ... kho chứa và thu ngân ... }),
    {
      name: 'auth-storage', // Tên của cái Két sắt
    }
  )
);
```

### Cơ chế hoạt động của `persist`:
Nó hoạt động y hệt như một **Máy Photocopy tự động**.
1. **Lúc Đăng nhập:** Khi bạn gọi hàm `setAuth` để nhét Token vào RAM, thằng `persist` sẽ tự động photo Token đó ra 1 bản sao, lén đem cất vào một cái Két Sắt vĩnh cửu của Trình duyệt gọi là **Local Storage** (Ổ cứng cục bộ). Nó đặt tên cái két sắt đó là `auth-storage`.
2. **Lúc nhấn F5:** Web bị sập chớp nhoáng, RAM bị xóa sạch.
3. **Lúc Web vừa bật lên lại:** `persist` lập tức chạy tốc biến ra cái Két Sắt Local Storage, lấy cái bản sao của Token đắp ngược trở lại vào RAM. 
4. **Kết quả:** Ngân hàng khôi phục lại 100% trí nhớ chỉ trong 0.001 giây. Giao diện Web được vẽ lại và người dùng vẫn thấy mình đang đăng nhập bình thường!

### Bức tranh tổng thể:
- **Zustand (RAM):** Truy xuất cực nhanh, nhưng dễ bay màu (F5 là mất). Dùng để phục vụ giao diện chạy mượt mà theo thời gian thực.
- **Local Storage (Ổ cứng Browser):** Lưu vĩnh viễn (tắt máy mở lại vẫn còn), nhưng lấy ra hơi chậm. 
- **`persist`:** Kẻ đứng giữa làm nhiệm vụ Thư ký đồng bộ hóa hoàn hảo giữa RAM và Ổ cứng, giúp lập trình viên không phải tự viết code đọc/ghi ổ cứng mệt mỏi!

---

## 5. SỰ MA THUẬT CỦA VIỆC "CẦN GÌ GỌI NẤY" (Selective Subscription)
Zustand cực kỳ thông minh ở chỗ nó cho phép các màn hình (Frontend Component) "đăng ký" theo dõi chính xác từng biến một chứ không bắt ép lấy toàn bộ kho hàng.

Ví dụ trong màn hình `GateConsoleScreen.tsx`, nếu bạn chỉ cần cái thẻ Token để vác đi gọi API, bạn sẽ viết:
```typescript
const token = useAuthStore((state) => state.token);
```
**Sự thần kỳ nằm ở đây:**
1. **Lấy liền tay (Lúc Khởi tạo):** Ngay khi màn hình `GateConsoleScreen` vừa bật lên (Quá trình Mount), dòng code trên tự động thò tay vào Ngân hàng Trung ương, rút cái `token` ra cho bạn xài ngay lập tức. Nó hòa quyện sẵn vào vòng đời của React.
2. **Tối ưu hiệu năng:** Màn hình này chỉ xin theo dõi đúng biến `token`. Nếu một màn hình khác lỡ làm thay đổi biến `user` (ví dụ người dùng đổi Avatar) trong Ngân hàng, màn hình `GateConsoleScreen` này sẽ **KHÔNG BỊ VẼ LẠI** (No Re-render). Nó bơ luôn vì không liên quan đến nó! Nó chỉ vẽ lại nếu đúng cái biến `token` thay đổi. Điều này giúp Web chạy mượt như lụa.

---

## 6. SỰ KẾT NỐI VÔ HÌNH (Reactivity / Phản Ứng Dây Chuyền)
Điều đỉnh cao nhất của sự kết hợp giữa React và Zustand là khả năng **Phản ứng dây chuyền (Reactive)**. Bạn không cần phải liên tục đi hỏi *"Ê ngân hàng, có dữ liệu mới chưa?"*, mà Ngân hàng sẽ tự tát vào mặt bạn báo tin!

Tưởng tượng bạn đang thao tác ở màn hình Console, đột nhiên thẻ Token hết hạn.
Ông Hải quan `axiosClient` phát hiện ra, ông ấy liền gõ phím hú còi:
```typescript
useAuthStore.getState().logout();
```

**Hiệu ứng Domino xảy ra chớp nhoáng như sau:**
1. Lệnh `logout` chạy vào Ngân hàng Zustand, **đốt sạch `token` và `user`** biến thành `null`.
2. Ngân hàng lập tức hú còi báo động qua bộ đàm: *"TẤT CẢ CÁC MÀN HÌNH ĐANG XÀI TOKEN CHÚ Ý, TOKEN ĐÃ VỀ NULL!"*.
3. Màn hình `GateConsoleScreen.tsx` nghe thấy tiếng còi trong bộ đàm, nó kiểm tra lại cái biến `token` của mình và giật mình phát hiện ra nó vừa biến thành `null`.
4. Màn hình **tự động chớp một cái (Re-render)** để giấu hết dữ liệu mật đi, các biến kiểm tra quyền lực sập xuống, và vòng lặp `ProtectedRoute` (nếu có) sẽ ngay lập tức đá cổ bạn ra khỏi phòng, ném về lại trang `/login`.

Mọi thứ tự động lan truyền như một dòng điện chạy khắp các mạch máu của ứng dụng, hoàn toàn tự động, bạn không cần phải tự tay đi tắt từng cái màn hình một!
