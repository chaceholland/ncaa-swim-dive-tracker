const { chromium } = require('playwright');

const teams = [
  { name: 'West Virginia', url: 'https://wvusports.com/sports/swimming-and-diving/roster' },
  { name: 'Virginia Tech', url: 'https://hokiesports.com/sports/swimming-and-diving/roster' },
  { name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/swimming-and-diving/roster' },
  { name: 'Auburn', url: 'https://auburntigers.com/sports/swimming-and-diving/roster' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  for (const team of teams) {
    console.log(`\n=== ${team.name} ===`);
    try {
      await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 10000)); // Extra long wait
      
      const info = await page.evaluate(() => {
        const sTables = document.querySelectorAll('.s-table');
        const cards = document.querySelectorAll('.s-person-card');
        const h1 = document.querySelector('h1');
        const bodyLen = document.body.textContent.length;
        
        // Check all table-like structures
        const allTables = document.querySelectorAll('table');
        
        // Check Vue/Nuxt app
        const vueApp = document.querySelector('#__nuxt, #app');
        
        return {
          sTables: sTables.length,
          cards: cards.length,
          allTables: allTables.length,
          bodyLen,
          h1: h1 ? h1.textContent.trim().substring(0, 50) : 'none',
          url: window.location.href,
          hasVue: !!vueApp
        };
      });
      
      console.log(`tables=${info.sTables}, cards=${info.cards}, allTables=${info.allTables}, bodyLen=${info.bodyLen}`);
      console.log(`h1="${info.h1}" url=${info.url} hasVue=${info.hasVue}`);
      
      // Try to find any athlete names
      const names = await page.evaluate(() => {
        // Check for any links with /roster/ pattern
        const rosterLinks = document.querySelectorAll('a[href*="/roster/"]');
        return Array.from(rosterLinks).map(l => l.textContent.trim()).filter(t => t.length > 2).slice(0, 5);
      });
      
      if (names.length > 0) console.log('Roster link texts:', names);
      
    } catch(e) {
      console.log(`ERROR - ${e.message.substring(0, 80)}`);
    }
  }
  
  await browser.close();
})();
