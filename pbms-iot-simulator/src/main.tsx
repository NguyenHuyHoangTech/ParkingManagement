// =========================================================================
// ĐIỂM KHỞI CHẠY CỦA ỨNG DỤNG (ENTRY POINT)
// =========================================================================
// MỤC ĐÍCH: Đây là file đầu tiên Vite chạy (khai báo trong index.html qua
// thẻ <script type="module" src="/src/main.tsx">). Nhiệm vụ duy nhất: gắn
// (mount) component gốc <App /> vào thẻ <div id="root"> trong index.html.
import { StrictMode } from 'react' // Chế độ kiểm tra nghiêm ngặt của React (dev-only), giúp phát hiện side-effect không an toàn.
import { createRoot } from 'react-dom/client' // API React 18+ để tạo root render (thay cho ReactDOM.render cũ).
import './index.css' // Nạp Tailwind + style toàn cục (xem PHẦN import trong index.css).
import App from './App.tsx' // Component gốc chứa toàn bộ UI của IoT Hardware Simulator.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
