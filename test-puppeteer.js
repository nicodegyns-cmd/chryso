const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    console.log('Testing Puppeteer...');
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    console.log('✅ Browser launched successfully');
    
    const page = await browser.newPage();
    console.log('✅ Page created');
    
    await page.setContent('<h1>Test PDF</h1><p>This is a test PDF</p>', { waitUntil: 'networkidle0' });
    console.log('✅ Content set');
    
    const buffer = await page.pdf({ format: 'A4' });
    console.log('✅ PDF generated,', buffer.length, 'bytes');
    
    const exportsDir = path.join(process.cwd(), 'public', 'exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
    const filePath = path.join(exportsDir, 'test.pdf');
    fs.writeFileSync(filePath, buffer);
    console.log('✅ PDF saved to', filePath);
    
    await browser.close();
    console.log('✅ Browser closed - ALL OK!');
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
