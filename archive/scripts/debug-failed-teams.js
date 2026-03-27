const { chromium } = require('playwright');

const failedTeams = [
  { name: 'Auburn', url: 'https://auburntigers.com/sports/swimming-diving/roster' },
  { name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/m-swim/roster/' },
  { name: 'Penn State', url: 'https://gopsusports.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Duke', url: 'https://goduke.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Missouri', url: 'https://mutigers.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Stanford', url: 'https://gostanford.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Virginia Tech', url: 'https://hokiesports.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Arizona State', url: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster' },
  { name: 'TCU', url: 'https://gofrogs.com/sports/mens-swimming-and-diving/roster' },
  { name: 'West Virginia', url: 'https://wvusports.com/sports/swimming-and-diving/roster' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  for (const team of failedTeams) {
    try {
      await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 6000));
      
      const info = await page.evaluate(() => {
        const sTables = document.querySelectorAll('.s-table');
        const cards = document.querySelectorAll('.s-person-card');
        const oldSidearm = document.querySelectorAll('.sidearm-roster-player');
        const rosterItems = document.querySelectorAll('.roster-item, .roster__item, .roster-list_item');
        
        // Check for redirects or 404
        const title = document.title;
        const h1 = document.querySelector('h1');
        const bodyLen = document.body.textContent.length;
        
        return {
          sTables: sTables.length,
          cards: cards.length,
          oldSidearm: oldSidearm.length,
          rosterItems: rosterItems.length,
          bodyLen,
          title: title.substring(0, 60),
          h1: h1 ? h1.textContent.trim().substring(0, 50) : 'none',
          url: window.location.href
        };
      });
      
      console.log(`${team.name}: tables=${info.sTables}, cards=${info.cards}, old=${info.oldSidearm}, items=${info.rosterItems}, bodyLen=${info.bodyLen}`);
      console.log(`  title="${info.title}" h1="${info.h1}"`);
      console.log(`  actual url: ${info.url}`);
    } catch(e) {
      console.log(`${team.name}: ERROR - ${e.message.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
})();
