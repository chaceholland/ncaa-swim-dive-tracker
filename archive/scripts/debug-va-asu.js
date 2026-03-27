const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const teams = [
    { name: 'Virginia', url: 'https://virginiasports.com/sports/swimming/roster' },
    { name: 'Arizona State', url: 'https://thesundevils.com/sports/mens-swimming-diving/roster' },
    { name: 'Stanford', url: 'https://gostanford.com/sports/mens-swimming-diving/roster' },
  ];
  
  for (const team of teams) {
    console.log('\n===', team.name, '===');
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    const athletes = await page.evaluate(() => {
      const results = [];
      
      // Check for roster-players__group
      const groups = document.querySelectorAll('.roster-players__group');
      if (groups.length > 0) {
        groups.forEach(group => {
          const titleEl = group.querySelector('h2, h3, [class*="title"]');
          const title = titleEl ? titleEl.textContent.trim() : '';
          if (!title.includes("Men") && title !== '') return;
          
          const items = group.querySelectorAll('li, [class*="list-item"]');
          items.forEach(item => {
            const img = item.querySelector('img');
            const name = img ? img.getAttribute('alt') : '';
            const posEl = item.querySelector('[class*="position"], [class*="event"]');
            const pos = posEl ? posEl.textContent.trim() : '';
            if (name && name.length > 2) results.push({ name, pos });
          });
        });
        return { method: 'roster-players__group', athletes: results.slice(0, 5) };
      }
      
      return { method: 'none', athletes: [] };
    });
    
    console.log(JSON.stringify(athletes));
  }
  
  await browser.close();
})();
