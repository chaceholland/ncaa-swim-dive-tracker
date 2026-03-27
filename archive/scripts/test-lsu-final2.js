const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  const athletes = await page.evaluate(() => {
    const results = [];
    
    // The Men's roster-list contains section-title "Men's Roster" and roster-list_items
    // The items use itemprop="name"
    const rosterLists = document.querySelectorAll('.roster-list');
    rosterLists.forEach(list => {
      const title = list.querySelector('.section-title');
      if (!title || !title.textContent.includes("Men's Roster")) return;
      
      const items = list.querySelectorAll('.roster-list_item');
      items.forEach(item => {
        // Name is in itemprop="name" span
        const nameEl = item.querySelector('[itemprop="name"]');
        const posEl = item.querySelector('.roster-list_item_info_position');
        const name = nameEl ? nameEl.getAttribute('content') : '';
        const pos = posEl ? posEl.textContent.trim() : '';
        if (name) results.push({ name, pos });
      });
    });
    
    return results;
  });
  
  console.log('LSU Men:', athletes.length);
  athletes.slice(0, 5).forEach(a => console.log(' -', a.name, '|', a.pos));
  
  await browser.close();
})();
