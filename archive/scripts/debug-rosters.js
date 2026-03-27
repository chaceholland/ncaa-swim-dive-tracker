require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

const ROSTERS = [
  { name: 'Stanford', url: 'https://gostanford.com/sports/swimming-and-diving/roster' },
  { name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/c-swim/roster/' },
  { name: 'Cal', url: 'https://calbears.com/sports/swimming-and-diving/roster' },
  { name: 'Alabama', url: 'https://rolltide.com/sports/swimming-and-diving/roster' },
  { name: 'FSU', url: 'https://seminoles.com/sports/mens-swimming-and-diving/roster' },
  { name: 'ASU', url: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Columbia', url: 'https://gocolumbialions.com/sports/mens-swimming-and-diving/roster' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const { name, url } of ROSTERS) {
    console.log(`\n=== ${name} (${url}) ===`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
      const title = await page.title();
      console.log('Title:', title);

      const links = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('a[href*="/roster/"]').forEach(a => {
          const href = a.href;
          if (!href || href.includes('#') || seen.has(href)) return;
          seen.add(href);
          const text = a.textContent?.trim().slice(0, 50);
          const rosterPart = href.split('/roster/')[1] || href;
          results.push({ text, href: rosterPart });
        });
        return results.slice(0, 60);
      });

      links.forEach(l => console.log(`  [${l.text}] -> ${l.href}`));
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  await browser.close();
}
main().catch(console.error);
