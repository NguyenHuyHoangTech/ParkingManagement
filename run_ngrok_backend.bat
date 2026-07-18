@echo off

echo Khoi dong Ngrok cho PBMS Backend (Port 8080)

echo.

echo Vui long cho trong giay lat...

echo Ngrok se cung cap mot duong dan dang: https://abcd-1234.ngrok-free.app

echo Hay copy duong dan do de dan vao cau hinh Webhook cua PayOS/PayPal.

echo.

call npx ngrok http 8080 --authtoken 3GdUVulz4bzsF2SSJRZzdCNywrE_5UWmraD9ABK31B5Kobsvb

pause
