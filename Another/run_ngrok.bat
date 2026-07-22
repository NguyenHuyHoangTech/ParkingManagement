@echo off
chcp 65001 >nul
echo ==============================================
echo  Khởi động Ngrok cho PBMS Frontend
echo ==============================================
echo Đang mở kết nối qua tên miền: kiwi-chatroom-liquid.ngrok-free.dev
echo.
npx ngrok http --url=kiwi-chatroom-liquid.ngrok-free.dev 5173
pause
