const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    try {
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('json') && (url.includes('lsu') || url.includes('roster'))) {
        const body = await response.text();
        apiCalls.push({ url: url.substring(0, 150), body: body.substring(0, 300) });
      }
    } catch(e) {}
  });
  
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Check DOM
  const domInfo = await page.evaluate(() => {
    const tables = document.querySelectorAll('.s-table');
    const cards = document.querySelectorAll('.s-person-card');
    const rosterItems = document.querySelectorAll('[class*="roster-item"], [class*="athlete"]');
    const bodyLen = document.body.textContent.length;
    
    const sampleCard = document.querySelector('.s-person-card');
    const sampleItem = document.querySelector('[class*="roster-item"]');
    
    return {
      tables: tables.length,
      cards: cards.length,
      rosterItems: rosterItems.length,
      bodyLen,
      sampleCardHtml: sampleCard ? sampleCard.innerHTML.substring(0, 200) : null,
      sampleItemHtml: sampleItem ? sampleItem.innerHTML.substring(0, 200) : null,
    };
  });
  
  console.log('LSU DOM:', JSON.stringify(domInfo, null, 2));
  
  console.log('\nAPI calls:');
  apiCalls.forEach(c => console.log(' URL:', c.url, '\n Body:', c.body, '\n'));
  
  await browser.close();
})();
