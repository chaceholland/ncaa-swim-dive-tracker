require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://unlvrebels.com/sports/swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);
  const result = await page.evaluate(() => {
    const menSection = document.getElementById('sidearm-m-roster');
    const links = Array.from(document.querySelectorAll('a[href*="/sports/swimming-and-diving/roster/"]'))
      .filter(a => !a.href.includes('/coaches/') && !a.href.includes('#'))
      .slice(0, 12)
      .map(a => ({ part: a.href.split('/roster/')[1], text: JSON.stringify(a.textContent.trim().slice(0, 60)) }));
    return { menSectionFound: !!menSection, sampleLinks: links };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
