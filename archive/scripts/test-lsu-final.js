const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  const athletes = await page.evaluate(() => {
    const results = [];
    const items = document.querySelectorAll('.roster-list_item');
    items.forEach(item => {
      const nameEl = item.querySelector('.roster-list_item_info_name');
      const posEl = item.querySelector('.roster-list_item_info_position');
      const name = nameEl ? nameEl.textContent.trim() : '';
      const pos = posEl ? posEl.textContent.trim() : '';
      if (name) results.push({ name, pos });
    });
    return results;
  });
  
  console.log('LSU athletes:', athletes.length);
  athletes.slice(0, 5).forEach(a => console.log(' -', a.name, '|', a.pos));
  
  await browser.close();
})();
