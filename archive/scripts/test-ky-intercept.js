const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('roster') || url.includes('player') || url.includes('athlete') || url.includes('sport')) {
      try {
        const ct = response.headers()['content-type'] || '';
        if (ct.includes('json')) {
          const body = await response.text();
          apiCalls.push({ url: url.substring(0, 120), body: body.substring(0, 200) });
        }
      } catch(e) {}
    }
  });
  
  await page.goto('https://ukathletics.com/sports/mswim/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  console.log('Kentucky API calls:');
  apiCalls.forEach(c => console.log(' URL:', c.url, '\n Body:', c.body.substring(0, 150), '\n'));
  
  if (apiCalls.length === 0) {
    // Take a screenshot to see what's on the page
    const bodyHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 2000));
    console.log('Body HTML:', bodyHtml);
  }
  
  await browser.close();
})();
