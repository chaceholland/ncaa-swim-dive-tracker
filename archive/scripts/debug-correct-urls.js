const { chromium } = require('playwright');

const teams = [
  { name: 'Florida State', url: 'https://seminoles.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Georgia Tech', url: 'https://ramblinwreck.com/sports/c-swim/roster/' },
  { name: 'Louisville', url: 'https://gocards.com/sports/swimming-and-diving/roster' },
  { name: 'North Carolina', url: 'https://goheels.com/sports/swimming-and-diving/roster' },
  { name: 'Notre Dame', url: 'https://fightingirish.com/sports/swim/roster/' },
  { name: 'Stanford', url: 'https://gostanford.com/sports/mens-swimming-diving/roster' },
  { name: 'Virginia', url: 'https://virginiasports.com/sports/swimming/roster' },
  { name: 'Arizona State', url: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/mens-swim-dive/roster' },
  { name: 'West Virginia', url: 'https://wvusports.com/sports/mens-swimming-and-diving/roster' },
];

async function checkTeam(page, team) {
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 7000));
  
  const info = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title.substring(0, 50),
    sTables: document.querySelectorAll('.s-table').length,
    cards: document.querySelectorAll('.s-person-card').length,
    oldSidearm: document.querySelectorAll('.sidearm-roster-player').length,
    rosterGroups: document.querySelectorAll('.roster-players__group').length,
    rosterItems: document.querySelectorAll('.roster-list-item').length,
    wpItems: document.querySelectorAll('.roster-item, .roster__item, .roster-list_item').length,
  }));
  
  console.log(`${team.name}: tables=${info.sTables}, cards=${info.cards}, old=${info.oldSidearm}, groups=${info.rosterGroups}, listItems=${info.rosterItems}, wp=${info.wpItems}`);
  if (info.url !== team.url) console.log(`  → Redirected to: ${info.url}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await context.newPage();
  
  for (const team of teams) {
    try {
      await checkTeam(page, team);
    } catch(e) {
      console.log(`${team.name}: ERROR - ${e.message.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
})();
