const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('file:///c:/Users/rojas/Desktop/Clientes/Chus´s Fish/catalogo.html');
  await page.waitForTimeout(3000);
  await browser.close();
})();
