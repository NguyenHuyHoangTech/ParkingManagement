const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const backendPaths = new Set();
// Store "METHOD:/path"

// 1. Scan backend controllers
walkDir('d:/ParkingManagement/pbms-be/src/main/java/com/pbms', (filePath) => {
  if (filePath.endsWith('Controller.java')) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const classMappingMatch = /@RequestMapping\(\s*["']([^"']+)["']\s*\)/.exec(content);
    const classPrefix = classMappingMatch ? classMappingMatch[1] : '';

    const methodRegex = /@(Get|Post|Put|Delete|Patch)Mapping\(\s*(?:value\s*=\s*)?["']([^"']*)["']/g;
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      let method = match[1].toUpperCase();
      let suffix = match[2];
      if (!suffix.startsWith('/') && suffix !== '') suffix = '/' + suffix;
      let fullPath = classPrefix + suffix;
      if (fullPath.endsWith('/')) fullPath = fullPath.slice(0, -1);
      backendPaths.add(`${method}:${fullPath.toLowerCase()}`);
    }
    
    const methodEmptyRegex = /@(Get|Post|Put|Delete|Patch)Mapping(?:\(\s*\))?/g;
    while ((match = methodEmptyRegex.exec(content)) !== null) {
      if (match[0].startsWith('@') && (match[0].endsWith('Mapping') || match[0].endsWith('()'))) {
        let method = match[1].toUpperCase();
        let fullPath = classPrefix;
        if (fullPath.endsWith('/')) fullPath = fullPath.slice(0, -1);
        backendPaths.add(`${method}:${fullPath.toLowerCase()}`);
      }
    }
  }
});

function matchesBackend(method, fePath) {
  fePath = fePath.toLowerCase();
  
  for (const bp of backendPaths) {
    const [bpMethod, bpPath] = bp.split(':');
    if (bpMethod !== method) continue;
    
    let bpRegexStr = bpPath.replace(/\{[^}]+\}/g, '[^/]+');
    bpRegexStr = '^' + bpRegexStr + '$';
    
    if (new RegExp(bpRegexStr).test(fePath.replace(/\$\{[^}]+\}/g, 'dummy'))) {
        return true;
    }
  }
  return false;
}

const mismatches = new Set();
walkDir('d:/ParkingManagement/pbms-fe/src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /axiosClient\.(get|post|put|delete|patch)\((['`"])(.*?)\2/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      let method = match[1].toUpperCase();
      let rawPath = match[3];
      rawPath = rawPath.split('?')[0];
      if (!rawPath.startsWith('/')) rawPath = '/' + rawPath;
      let fullPath = '/api/v1' + rawPath;
      if (fullPath.endsWith('/')) fullPath = fullPath.slice(0, -1);
      
      if (rawPath === '/') continue;

      if (!matchesBackend(method, fullPath)) {
        mismatches.add(`${method} ${fullPath} (in ${path.basename(filePath)})`);
      }
    }
  }
});

console.log('--- Mismatched Frontend API Calls (Method + Path) ---');
mismatches.forEach(m => console.log(m));
