const { chromium } = require('playwright');

const teams = [
  { name: 'Florida', url: 'https://floridagators.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Texas', url: 'https://texassports.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Indiana', url: 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster' },
];

async function scrapeTeam(page, team) {
  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000); // Wait for JS
    
    const result = await page.evaluate(() => {
      // Check what's on the page
      const tables = document.querySelectorAll('.s-table');
      const sidearmPlayers = document.querySelectorAll('.sidearm-roster-player');
      const sPersonCards = document.querySelectorAll('.s-person-card');
      
      const allText = document.body.textContent;
      
      return {
        tableCount: tables.length,
        sidearmCount: sidearmPlayers.length,
        cardCount: sPersonCards.length,
        bodyLength: allText.length,
        firstNamesFound: (() => {
          const items = document.querySelectorAll('.sidearm-roster-player-name, .s-person-details__personal-name, [class*="player-name"]');
          return Array.from(items).map(el => el.textContent.trim()).slice(0, 3);
        })()
      };
    });
    
    console.log(`${team.name}: tables=${result.tableCount}, sidearm=${result.sidearmCount}, cards=${result.cardCount}, bodyLen=${result.bodyLength}`);
    console.log(`  First names:`, result.firstNamesFound);
    return result;
  } catch(e) {
    console.log(`${team.name}: ERROR - ${e.message.substring(0, 80)}`);
    return null;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  for (const team of teams) {
    await scrapeTeam(page, team);
    await new Promise(r => setTimeout(r, 1500));
  }
  
  await browser.close();
})();
