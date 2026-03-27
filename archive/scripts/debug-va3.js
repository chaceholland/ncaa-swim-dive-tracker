const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://virginiasports.com/sports/swimming/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const athletes = await page.evaluate(() => {
    const results = [];
    
    const groups = document.querySelectorAll('.roster-players__group');
    for (const group of groups) {
      const titleEl = group.querySelector('h2, h3, [class*="title"]');
      const title = titleEl ? titleEl.textContent.trim() : '';
      if (!title.includes("Men")) continue; // only men's group
      
      const items = group.querySelectorAll('li');
      items.forEach(item => {
        // Name is in .sr-only elements
        const srOnly = item.querySelectorAll('.sr-only');
        let name = '';
        srOnly.forEach(el => {
          const t = el.textContent.trim();
          if (t && t.length > 2 && !t.includes('Instagram') && !t.includes('Twitter') && !t.toLowerCase().includes(' instagram') && !t.toLowerCase().includes(' twitter') && !t.toLowerCase().includes(' facebook')) {
            if (!name) name = t;
          }
        });
        
        // Also check for link text
        const links = item.querySelectorAll('a[href*="/roster/"]');
        if (!name && links.length > 0) name = links[0].textContent.trim();
        
        // Check for position
        const posEl = item.querySelector('[class*="position"], [class*="event"], [class*="sport"]');
        const pos = posEl ? posEl.textContent.trim() : '';
        
        if (name && name.length > 2) results.push({ name, pos });
      });
      break;
    }
    
    return results;
  });
  
  console.log('Virginia Men:', athletes.length);
  athletes.slice(0, 5).forEach(a => console.log(' -', a.name, '|', a.pos));
  
  await browser.close();
})();
