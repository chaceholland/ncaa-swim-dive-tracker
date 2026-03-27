// Check UNLV for API endpoints that return current athletes
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const apiRequests = [];
  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') || url.includes('/api/') || url.includes('roster') || url.includes('player')) {
      let body = '';
      try { body = await response.text(); } catch {}
      if (body.length > 50) {
        apiRequests.push({ url: url.substring(0, 120), bodyLen: body.length, bodySample: body.substring(0, 200) });
      }
    }
  });

  // Try season-filtered URL
  await page.goto('https://unlvrebels.com/sports/mens-swimming-and-diving/roster?season=2025-26', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  const title = await page.evaluate(() => document.title);
  console.log('Page title:', title);
  
  const players = await page.evaluate(() => {
    const result = [];
    const scripts = Array.from(document.querySelectorAll('script:not([src])'));
    for (const s of scripts) {
      const text = s.textContent.trim();
      if (text.includes('"@type":"ListItem"') && text.includes('"@type":"Person"')) {
        try {
          const json = JSON.parse(text);
          const itemsRaw = json.item || [];
          const items = Array.isArray(itemsRaw) ? itemsRaw : Object.values(itemsRaw);
          items.forEach(p => {
            if (p && p['@type'] === 'Person' && p.name) {
              result.push({ name: p.name, gender: p.gender || '' });
            }
          });
        } catch(e) {}
      }
    }
    return result;
  });
  
  const males = players.filter(p => p.gender !== 'F');
  console.log('Players:', players.length, '| Males:', males.length);
  males.forEach(p => console.log(' ', p.name, '|', p.gender));
  
  console.log('\n=== API requests ===');
  apiRequests.forEach(r => console.log(r.url, '| len:', r.bodyLen));

  await browser.close();
})().catch(e => console.error('Error:', e.message));
