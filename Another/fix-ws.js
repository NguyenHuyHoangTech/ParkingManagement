const fs = require('fs');
const files = [
  'd:/GitHub/ParkingManagement/pbms-fe/src/features/staff/StaffLayout.tsx',
  'd:/GitHub/ParkingManagement/pbms-fe/src/features/shared/components/NotificationDropdown.tsx',
  'd:/GitHub/ParkingManagement/pbms-fe/src/features/admin/UserManagementScreen.tsx',
  'd:/GitHub/ParkingManagement/pbms-fe/src/core/websocket/useWebSocket.ts',
  'd:/GitHub/ParkingManagement/pbms-fe/src/core/utils/timeProvider.ts'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/brokerURL: window\.location\.protocol === 'https:' \? \\"wss:\\\/\\\/\\\/ws-pbms\\" : \\"ws:\\\/\\\/\\\/ws-pbms\\"/g, "brokerURL: window.location.protocol === 'https:' ? `wss://${window.location.host}/ws-pbms` : `ws://${window.location.host}/ws-pbms`");
  fs.writeFileSync(f, content);
});
console.log("Fixed WS URLs");
