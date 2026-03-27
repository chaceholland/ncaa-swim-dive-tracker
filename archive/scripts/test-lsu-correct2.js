const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  const athletes = await page.evaluate(() => {
    const results = [];
    
    // Only process the FIRST roster-list which has Men's Roster title
    const rosterLists = document.querySelectorAll('.roster-list');
    for (const list of rosterLists) {
      const title = list.querySelector('.section-title');
      const titleText = title ? title.textContent.trim() : '';
      if (!titleText.includes("Men")) continue;
      
      const items = list.querySelectorAll('.roster-list_item');
      for (const item of items) {
        const nameEl = item.querySelector('[itemprop="name"]');
        const name = nameEl ? nameEl.getAttribute('content') : null;
        
        // Get position from info section
        const posEl = item.querySelector('.roster-list_item_info_position');
        const pos = posEl ? posEl.textContent.trim() : '';
        
        if (name) results.push({ name, pos });
      }
      break; // Only men's
    }
    
    return results;
  });
  
  console.log('LSU Men:', athletes.length);
  athletes.slice(0, 5).forEach(a => console.log(' -', a.name, '|', a.pos));
  
  await browser.close();
})();
