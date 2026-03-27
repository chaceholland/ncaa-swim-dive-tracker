const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const teams = [
    { name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/m-swim/roster' },
    { name: 'West Virginia', url: 'https://wvusports.com/sports/swimming/roster' },
  ];
  
  for (const team of teams) {
    console.log('\n===', team.name, '===');
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 12000)); // Extra wait for Nuxt
    
    const info = await page.evaluate(() => {
      const sTables = document.querySelectorAll('.s-table');
      const cards = document.querySelectorAll('.s-person-card');
      const rosterGroups = document.querySelectorAll('.roster-players__group');
      const rosterItems = document.querySelectorAll('.roster-list-item');
      const title = document.title;
      const url = window.location.href;
      
      return {
        sTables: sTables.length,
        cards: cards.length,
        rosterGroups: rosterGroups.length,
        rosterItems: rosterItems.length,
        title: title.substring(0, 60),
        url
      };
    });
    
    console.log(JSON.stringify(info, null, 2));
  }
  
  await browser.close();
})();
