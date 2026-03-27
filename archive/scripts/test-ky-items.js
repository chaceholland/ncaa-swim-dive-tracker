const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://ukathletics.com/sports/mswim/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // .roster-item has info
  const items = await page.evaluate(() => {
    const rosterItems = document.querySelectorAll('.roster-item');
    return Array.from(rosterItems).slice(0, 5).map(item => ({
      text: item.textContent.trim().substring(0, 100),
      html: item.innerHTML.substring(0, 300)
    }));
  });
  
  console.log('Roster items:', items.length);
  items.forEach(i => {
    console.log('Text:', i.text);
    console.log('HTML:', i.html.substring(0, 200));
    console.log('---');
  });
  
  await browser.close();
})();
