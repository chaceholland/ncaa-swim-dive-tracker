const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://hokiesports.com/sports/swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const athletes = await page.evaluate(() => {
    const results = [];
    
    // Find all .roster-players__group divs
    const groups = document.querySelectorAll('.roster-players__group');
    groups.forEach(group => {
      const titleEl = group.querySelector('h2, h3, [class*="title"]');
      const title = titleEl ? titleEl.textContent.trim() : '';
      
      if (!title.includes("Men's Roster")) return;
      
      // Get athletes from the list
      const items = group.querySelectorAll('.roster-list-item');
      items.forEach(item => {
        // Name is in the img alt attribute or elsewhere
        const img = item.querySelector('img');
        const name = img ? img.getAttribute('alt') : '';
        
        // Look for position
        const posEl = item.querySelector('[class*="position"], [class*="event"]');
        const pos = posEl ? posEl.textContent.trim() : '';
        
        if (name && name.length > 2) results.push({ name, pos });
      });
    });
    
    return results;
  });
  
  console.log('Virginia Tech Men:', athletes.length);
  athletes.slice(0, 5).forEach(a => console.log(' -', a.name, '|', a.pos));
  
  await browser.close();
})();
