@echo off
echo ==============================================
echo  Tu dong Cap nhat IP Mang LAN va Khoi chay He thong
echo ==============================================
node update-ip.js
echo.

echo Dang khoi dong Backend...
start "PBMS Backend" /D "%~dp0pbms-be" cmd /k "mvnw.cmd spring-boot:run"

echo Dang khoi dong Frontend...
start "PBMS Frontend" /D "%~dp0pbms-fe" cmd /k "npm run dev"

echo Dang khoi dong IoT Simulator...
start "PBMS IoT Simulator" /D "%~dp0pbms-iot-simulator" cmd /k "npm run dev"

echo Da gui lenh khoi dong ca 3 thanh phan (mo trong cac cua so moi)!
pause
