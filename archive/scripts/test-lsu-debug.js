const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  const info = await page.evaluate(() => {
    // Check the roster-list with Men's section-title 
    const rosterLists = document.querySelectorAll('.roster-list');
    return Array.from(rosterLists).map(list => {
      const title = list.querySelector('.section-title');
      const items = list.querySelectorAll('.roster-list_item');
      return {
        titleText: title ? title.textContent.trim().substring(0, 30) : 'NO TITLE',
        itemCount: items.length,
        firstItemHtml: items[0] ? items[0].innerHTML.substring(0, 200) : 'none'
      };
    });
  });
  
  console.log('Roster lists:');
  info.forEach(r => console.log(JSON.stringify(r, null, 2)));
  
  await browser.close();
})();
