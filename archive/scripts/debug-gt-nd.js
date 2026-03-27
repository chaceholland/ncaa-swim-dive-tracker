const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const teams = [
    { name: 'Georgia Tech', url: 'https://ramblinwreck.com/sports/c-swim/roster/' },
    { name: 'Notre Dame', url: 'https://fightingirish.com/sports/swim/roster/' },
  ];
  
  for (const team of teams) {
    console.log('\n===', team.name, '===');
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    const info = await page.evaluate(() => {
      // Check for any text with athlete names (links)
      const rosterLinks = document.querySelectorAll('a[href*="/roster/"]');
      const names = Array.from(rosterLinks).map(l => l.textContent.trim() || l.getAttribute('aria-label') || '').filter(t => t.length > 2).slice(0, 5);
      
      // Check page structure
      const h1 = document.querySelector('h1');
      const title = document.title;
      const url = window.location.href;
      const bodyLen = document.body.textContent.length;
      
      // Check for custom elements
      const allUnique = new Set();
      document.querySelectorAll('[class]').forEach(el => {
        const cls = el.className;
        if (typeof cls === 'string') {
          cls.split(' ').forEach(c => {
            if (c.includes('roster') || c.includes('player') || c.includes('athlete')) allUnique.add(c);
          });
        }
      });
      
      return {
        names,
        title: title.substring(0, 60),
        url,
        bodyLen,
        h1: h1 ? h1.textContent.trim().substring(0, 40) : 'none',
        rosterClasses: Array.from(allUnique).slice(0, 20)
      };
    });
    
    console.log(JSON.stringify(info, null, 2));
  }
  
  await browser.close();
})();
