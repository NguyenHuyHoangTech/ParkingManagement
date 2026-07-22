const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const frontendPaths = new Set();
walkDir('d:/ParkingManagement/pbms-fe/src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /axiosClient\.(?:get|post|put|delete|patch)\((['`"])(.*?)\1/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      frontendPaths.add(match[2].split('?')[0]); // ignore query params
    }
  }
});

const backendPrefixes = [
  '/system/configs', '/system/building-profile', '/system/audit-logs', 
  '/manager/zone-trends', '/operation/vehicle-types', '/operation/vehicles', 
  '/customer/reservations', '/operation/parking-sessions', '/operation/monthly-tickets', 
  '/operation/iot/integration', '/operation/iot/hardware', '/operation/iot/cameras', 
  '/operation/gates', '/infrastructure/cards', '/manager/routing-rules', 
  '/infrastructure/slots', '/infrastructure/zones', '/public', 
  '/infrastructure/map', '/infrastructure/gates', '/incident/incidents', 
  '/identity/work-sessions', '/identity/users', '/identity/auth', 
  '/finance/revenue', '/finance/refunds', '/public/pricing', 
  '/finance/pricing-policies', '/finance/payments', '/finance/dashboard', '/manager/ai'
];

console.log('--- Frontend API calls without matching backend prefix ---');
Array.from(frontendPaths).forEach(fp => {
  let matched = false;
  let p = fp;
  // If it's a template string with ${}, we strip at the first $
  if (p.includes('${')) {
    p = p.substring(0, p.indexOf('${'));
  }
  // Also strip trailing slashes if any
  if (p.endsWith('/')) p = p.slice(0, -1);
  if (!p.startsWith('/')) p = '/' + p; // ensure leading slash

  for (const bp of backendPrefixes) {
    if (p.startsWith(bp)) {
      matched = true;
      break;
    }
  }
  
  if (!matched && p !== '/') {
    console.log('Unmatched frontend path:', fp, '(base:', p, ')');
  }
});
