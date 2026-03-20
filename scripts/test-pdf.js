const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async ()=>{
  try{
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    const html = '<html><body><h1>Test PDF</h1><p>Généré avec Puppeteer</p></body></html>';
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true });
    const out = path.join(process.cwd(), 'public', 'exports', 'test-pdf.pdf');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buffer);
    console.log('PDF écrit:', out);
    await browser.close();
  }catch(e){
    console.error('Test PDF failed:', e && e.message);
    process.exitCode = 1;
  }
})();
