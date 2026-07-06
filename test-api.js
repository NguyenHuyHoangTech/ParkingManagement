const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 8080,
  path: '/api/v1/identity/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const token = JSON.parse(body).data?.accessToken;
    console.log('Token:', token ? 'Success' : body);
    if (!token) return;
    
    http.get({
      hostname: 'localhost',
      port: 8080,
      path: '/api/v1/finance/revenue/dashboard?startDate=2026-08-02&endDate=2026-08-09',
      headers: { 'Authorization': 'Bearer ' + token }
    }, res2 => {
      let b2 = '';
      res2.on('data', d => b2 += d);
      res2.on('end', () => console.log('Revenue Data:', b2));
    });
  });
});
req.write(JSON.stringify({email: 'systemmanagerweb@gmail.com', password: '123'}));
req.end();
