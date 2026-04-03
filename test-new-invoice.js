const http = require('http');

const data = JSON.stringify({status: 'En attente d\'envoie'});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/prestations/2',
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const resp = JSON.parse(body);
      console.log('✅ Invoice generated:', resp.invoice_number);
      console.log('📄 PDF URL:', resp.pdf_url);
      console.log('✅ Status:', resp.status);
    } catch(e) {
      console.error('Error parsing:', e.message);
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
