const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  // Serve files locally by launching an http server
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
  const server = http.createServer((req, res) => {
    let p = path.join(__dirname, req.url === '/' ? 'catalogo.html' : req.url);
    if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
    res.end(fs.readFileSync(p));
  });
  server.listen(5050);

  await page.goto('http://localhost:5050/catalogo.html');
  await page.waitForTimeout(3000);
  
  const html = await page.evaluate(() => {
    return document.getElementById('catalog-wrap').innerHTML;
  });
  console.log('CATALOG HTML START');
  console.log(html.substring(0, 500));
  console.log('CATALOG HTML END');
  
  server.close();
  await browser.close();
})();
