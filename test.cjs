const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => {
    console.log('Page Error:', err.toString());
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console Error:', msg.text());
    }
  });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  const html = await page.content();
  if (html.includes('id="root"></div>') || html.includes('id="root"></div>')) {
    console.log('Root is empty!');
  } else {
    console.log('Root is not empty.');
  }
  await browser.close();
})();
