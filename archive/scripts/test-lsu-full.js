const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const allRequests = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('lsusports.net/wp-json')) {
      try {
        const body = await response.text();
        allRequests.push({ url: url.substring(0, 200), body: body.substring(0, 300) });
      } catch(e) {}
    }
  });
  
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  console.log('All WP JSON requests:');
  allRequests.forEach(r => console.log(' URL:', r.url, '\n Body:', r.body.substring(0, 200), '\n'));
  
  // Also check DOM for rendered roster items
  const domItems = await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="roster"], [class*="athlete"], [class*="player"]');
    return {
      count: items.length,
      samples: Array.from(items).slice(0, 3).map(el => ({
        tag: el.tagName,
        cls: el.className.substring(0, 80),
        text: el.textContent.trim().substring(0, 60)
      }))
    };
  });
  
  console.log('DOM items:', JSON.stringify(domItems, null, 2));
  
  await browser.close();
})();
