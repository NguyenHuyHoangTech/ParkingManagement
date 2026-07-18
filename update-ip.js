const os = require('os');
const fs = require('fs');
const path = require('path');

console.log("Đang dò tìm địa chỉ IP mạng...");

// 1. Detect IP
const interfaces = os.networkInterfaces();
let localIp = null;

// Ưu tiên Wi-Fi
if (interfaces['Wi-Fi']) {
    const wifi4 = interfaces['Wi-Fi'].find(i => i.family === 'IPv4');
    if (wifi4) localIp = wifi4.address;
}

// Nếu không có Wi-Fi, tìm một mạng khác (bỏ qua máy ảo, loopback)
if (!localIp) {
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && !name.toLowerCase().includes('vmware') && !name.toLowerCase().includes('vethernet')) {
                localIp = iface.address;
                break;
            }
        }
        if (localIp) break;
    }
}

if (!localIp) {
    console.error("❌ KHÔNG TÌM THẤY IP MẠNG LAN HỢP LỆ! Hãy kiểm tra lại kết nối Wi-Fi/LAN.");
    process.exit(1);
}

console.log(`✅ Đã phát hiện IP: \x1b[32m${localIp}\x1b[0m\n`);

function updateEnv(filePath, keys) {
    if (!fs.existsSync(filePath)) {
        console.log(`[Bỏ qua] Không tìm thấy: ${filePath}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let lines = content.split('\n');
    let updated = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        for (const key of keys) {
            // Cập nhật tất cả các dòng KHÔNG CÓ DẤU # ở đầu
            const regexActive = new RegExp(`^${key}=http:\\/\\/[a-zA-Z0-9\\.]+(:[0-9]+.*)`);
            if (regexActive.test(line)) {
                lines[i] = line.replace(regexActive, `${key}=http://${localIp}$1`);
                updated = true;
            }
        }
    }

    if (updated) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        console.log(`[OK] Đã cập nhật ${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`);
    } else {
        console.log(`[Bỏ qua] Không cần thay đổi trong ${path.basename(filePath)}`);
    }
}

function updateYaml(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    const corsRegex = /allowed-origins:\s*\$\{CORS_ALLOWED_ORIGINS:.*\}/;
    if (corsRegex.test(content)) {
        content = content.replace(corsRegex, `allowed-origins: \${CORS_ALLOWED_ORIGINS:http://localhost:5173,http://localhost:3001,http://${localIp}:5173,http://${localIp}:3001}`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[OK] Đã cập nhật ${path.basename(filePath)}`);
    }
}

updateEnv(path.join(__dirname, 'pbms-fe', '.env'), ['VITE_API_URL', 'VITE_BASE_URL']);
updateEnv(path.join(__dirname, 'pbms-iot-simulator', '.env'), ['VITE_IOT_API_URL']);
updateYaml(path.join(__dirname, 'pbms-be', 'src', 'main', 'resources', 'application.yml'));

console.log(`\n🎉 \x1b[36mCẤU HÌNH THÀNH CÔNG! BẠN HÃY KHỞI ĐỘNG LẠI BACKEND, FRONTEND VÀ SIMULATOR ĐỂ ÁP DỤNG.\x1b[0m`);
