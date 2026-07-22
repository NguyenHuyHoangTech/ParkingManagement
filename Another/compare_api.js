const fs = require('fs');
const path = require('path');

// 1. Load backend paths from api-docs.json
const apiDocsRaw = fs.readFileSync('d:/ParkingManagement/api-docs.json', 'utf8');
const apiDocs = JSON.parse(apiDocsRaw);
const backendPaths = Object.keys(apiDocs.paths).map(p => p.toLowerCase());

// Helper function to match paths
// Frontend: /api/v1/incident/incidents/${id}/process-phase1
// Backend: /api/v1/incident/incidents/{id}/process-phase1
function matchesBackend(fePath) {
  fePath = fePath.toLowerCase();
  
  // Exact match
  if (backendPaths.includes(fePath)) return true;
  
  // Convert ${var} to {var} equivalent regex
  // E.g., /api/v1/users/${id}/status -> /api/v1/users/[^/]+/status
  let regexStr = fePath.replace(/\$\{[^}]+\}/g, '[^/]+');
  regexStr = '^' + regexStr + '$';
  const regex = new RegExp(regexStr);
  
  for (const bp of backendPaths) {
    // backend path is like /api/v1/users/{id}/status
    // replace {var} with regex
    let bpRegexStr = bp.replace(/\{[^}]+\}/g, '[^/]+');
    bpRegexStr = '^' + bpRegexStr + '$';
    
    // Check if the structures match
    if (new RegExp(bpRegexStr).test(fePath.replace(/\$\{[^}]+\}/g, 'dummy'))) {
        return true;
    }
  }
  return false;
}

// 2. Scan frontend for axiosClient calls
function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const mismatches = new Set();
walkDir('d:/ParkingManagement/pbms-fe/src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Match axiosClient.get('path') or axiosClient.post(`path`)
    const regex = /axiosClient\.(?:get|post|put|delete|patch)\((['`"])(.*?)\1/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      let rawPath = match[2];
      // strip query params
      rawPath = rawPath.split('?')[0];
      
      // prepend /api/v1 if not present
      if (!rawPath.startsWith('/')) rawPath = '/' + rawPath;
      let fullPath = '/api/v1' + rawPath;
      
      // ignore empty or root
      if (rawPath === '/') continue;

      if (!matchesBackend(fullPath)) {
        mismatches.add(`${filePath} -> ${match[2]}`);
      }
    }
  }
});

console.log('--- Mismatched Frontend API Calls ---');
mismatches.forEach(m => console.log(m));
