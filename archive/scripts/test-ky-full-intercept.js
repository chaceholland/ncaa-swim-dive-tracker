const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    try {
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('json') && url.includes('ukathletics.com')) {
        const body = await response.text();
        apiCalls.push({ url: url.substring(0, 120), body: body.substring(0, 400) });
      }
    } catch(e) {}
  });
  
  await page.goto('https://ukathletics.com/sports/mswim/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  console.log('Kentucky API calls (' + apiCalls.length + '):');
  apiCalls.forEach(c => console.log(' URL:', c.url, '\n Body:', c.body.substring(0, 300), '\n'));
  
  await browser.close();
})();
