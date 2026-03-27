const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const teams = [
    { name: 'Stanford', url: 'https://gostanford.com/sports/mens-swimming-diving/roster' },
    { name: 'Arizona State', url: 'https://thesundevils.com/sports/mens-swimming-diving/roster' },
  ];
  
  for (const team of teams) {
    console.log('\n===', team.name, '===');
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    const athletes = await page.evaluate(() => {
      const results = [];
      
      const groups = document.querySelectorAll('.roster-players__group');
      for (const group of groups) {
        const titleEl = group.querySelector('h2, h3, [class*="title"]');
        const title = titleEl ? titleEl.textContent.trim() : '';
        // For men's-only URLs, just take all groups or first group
        
        const items = group.querySelectorAll('li, .roster-list-item');
        items.forEach(item => {
          // Try sr-only
          const srOnly = item.querySelectorAll('.sr-only');
          let name = '';
          srOnly.forEach(el => {
            const t = el.textContent.trim();
            if (t && t.length > 2 && !t.toLowerCase().includes('instagram') && !t.toLowerCase().includes('twitter') && !t.toLowerCase().includes('facebook') && !t.toLowerCase().includes('tiktok')) {
              if (!name) name = t;
            }
          });
          
          // Fallback: img alt
          if (!name) {
            const img = item.querySelector('img');
            name = img ? (img.getAttribute('alt') || '') : '';
          }
          
          const posEl = item.querySelector('[class*="position"], [class*="event"]');
          const pos = posEl ? posEl.textContent.trim() : '';
          
          if (name && name.length > 2) results.push({ name, pos });
        });
      }
      
      return results;
    });
    
    console.log(`${team.name}: ${athletes.length} athletes`);
    athletes.slice(0, 3).forEach(a => console.log(' -', a.name, '|', a.pos));
  }
  
  await browser.close();
})();
