const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const requests = [];
  page.on('response', async (r) => {
    const url = r.url();
    if (url.includes('json') || url.includes('roster') || url.includes('api')) {
      try {
        const ct = r.headers()['content-type'] || '';
        if (ct.includes('json') && url.includes('ohiostate')) {
          const body = await r.text();
          requests.push({ url: url.substring(0,120), body: body.substring(0,200) });
        }
      } catch(e) {}
    }
  });
  
  await page.goto('https://ohiostatebuckeyes.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);
  
  const dom = await page.evaluate(() => {
    const tables = document.querySelectorAll('.s-table');
    const cards = document.querySelectorAll('.s-person-card');
    const rosterItems = document.querySelectorAll('[class*="roster-item"], [class*="roster-list_item"]');
    
    // Sample card HTML
    const sampleCard = document.querySelector('.s-person-card, [class*="roster"]');
    
    return {
      tables: tables.length,
      cards: cards.length,
      rosterItems: rosterItems.length,
      bodyLen: document.body.textContent.length,
      sampleHtml: sampleCard ? sampleCard.outerHTML.substring(0, 300) : null
    };
  });
  
  console.log('Ohio State DOM:', JSON.stringify(dom, null, 2));
  console.log('API Requests:', requests.length);
  requests.forEach(r => console.log(' ', r.url, r.body.substring(0, 100)));
  
  await browser.close();
})();
