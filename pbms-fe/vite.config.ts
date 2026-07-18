import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Để dùng qua mạng LAN (Wi-Fi), bắt buộc phải có host: '0.0.0.0'. 
    // Nếu bạn muốn quay về chỉ dùng localhost, hãy thêm // vào đầu dòng dưới để comment nó lại:
    host: '0.0.0.0', 
    port: 5173,
    allowedHosts: ['kiwi-chatroom-liquid.ngrok-free.dev'],
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/ws-pbms': {
        target: 'ws://localhost:8080',
        ws: true
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})