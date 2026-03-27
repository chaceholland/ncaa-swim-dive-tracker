const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await page.goto('https://unlvrebels.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
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
              result.push({ name: p.name, gender: p.gender || '', url: p.url || '' });
            }
          });
        } catch(e) {}
      }
    }
    return result;
  });
  console.log('Total players:', players.length);
  const males = players.filter(p => p.gender.toUpperCase() !== 'F');
  console.log('Male players (non-F gender):', males.length);
  males.forEach(p => console.log(' ', JSON.stringify(p.name), '|', p.gender));
})().catch(e => console.error('Error:', e.message));
