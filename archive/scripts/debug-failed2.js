const { chromium } = require('playwright');

const teams = [
  { name: 'Duke', url: 'https://goduke.com/sports/swimming-and-diving/roster' },
  { name: 'Missouri', url: 'https://mutigers.com/sports/swimming-and-diving/roster' },
  { name: 'TCU', url: 'https://gofrogs.com/sports/swimming-and-diving/roster' },
  { name: 'West Virginia', url: 'https://wvusports.com/sports/swimming-and-diving/roster' },
  { name: 'Virginia Tech', url: 'https://hokiesports.com/sports/swimming-and-diving/roster' },
  { name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/swimming-and-diving/roster' },
  { name: 'Auburn', url: 'https://auburntigers.com/sports/swimming-and-diving/roster' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  for (const team of teams) {
    try {
      await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 6000));
      
      const info = await page.evaluate(() => {
        const sTables = document.querySelectorAll('.s-table');
        const cards = document.querySelectorAll('.s-person-card');
        const oldSidearm = document.querySelectorAll('.sidearm-roster-player');
        const rosterItems = document.querySelectorAll('.roster-item, .roster__item, .roster-list_item');
        
        // Check tables for gender headers
        let menTableRows = 0;
        sTables.forEach(t => {
          const hdr = t.querySelector('.s-table-header__row--heading');
          const gender = hdr ? hdr.textContent.trim().toLowerCase() : 'unknown';
          const isMen = gender.includes('men') && !gender.includes('women');
          if (isMen || gender === 'unknown') {
            menTableRows += t.querySelectorAll('tbody tr').length;
          }
        });
        
        // Sample card name
        let sampleName = '';
        if (cards.length > 0) {
          const nameEl = cards[0].querySelector('h3, [class*="personal-single-line"]');
          sampleName = nameEl ? nameEl.textContent.trim() : '';
        }
        
        return {
          sTables: sTables.length,
          menTableRows,
          cards: cards.length,
          oldSidearm: oldSidearm.length,
          rosterItems: rosterItems.length,
          sampleName
        };
      });
      
      console.log(`${team.name}: tables=${info.sTables}(men rows:${info.menTableRows}), cards=${info.cards}, old=${info.oldSidearm}, items=${info.rosterItems}`);
      if (info.sampleName) console.log(`  sample card name: ${info.sampleName}`);
    } catch(e) {
      console.log(`${team.name}: ERROR - ${e.message.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
})();
