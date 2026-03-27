const { chromium } = require('playwright');

const teams = [
  { name: 'Florida State', base: 'https://seminoles.com' },
  { name: 'Georgia Tech', base: 'https://ramblinwreck.com' },
  { name: 'Louisville', base: 'https://gocards.com' },
  { name: 'North Carolina', base: 'https://goheels.com' },
  { name: 'Notre Dame', base: 'https://und.com' },
  { name: 'Stanford', base: 'https://gostanford.com' },
  { name: 'Virginia', base: 'https://virginiasports.com' },
  { name: 'Arizona State', base: 'https://thesundevils.com' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
  const page = await context.newPage();
  
  for (const team of teams) {
    try {
      await page.goto(team.base + '/sports', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
      
      const swimLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="swim"], a[href*="dive"]');
        return Array.from(links).map(l => l.href).filter(h => h.includes('roster') || h.includes('swim') || h.includes('dive')).slice(0, 3);
      });
      
      console.log(`${team.name}:`, swimLinks);
    } catch(e) {
      console.log(`${team.name}: ERROR -`, e.message.substring(0, 60));
    }
  }
  
  await browser.close();
})();
