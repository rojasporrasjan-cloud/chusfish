const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
    res.end(fs.readFileSync(p));
  });
  server.listen(5053);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('--- TESTING INDEX.HTML ---');
  await page.goto('http://localhost:5053/index.html');
  await page.waitForTimeout(4000);

  console.log('--- TESTING CATALOGO.HTML ---');
  await page.goto('http://localhost:5053/catalogo.html');
  await page.waitForTimeout(4000);

  server.close();
  await browser.close();
})();
