const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  const info = await page.evaluate(() => {
    // Check the first roster-list with Men's title
    const rosterList = document.querySelector('.roster-list');
    if (!rosterList) return { error: 'no roster-list' };
    
    const titleEl = rosterList.querySelector('.section-title');
    const title = titleEl ? titleEl.textContent.trim() : 'none';
    
    // Check items
    const items = rosterList.querySelectorAll('.roster-list_item');
    const firstItem = items[0];
    
    // Check itemprop
    const nameEl = firstItem ? firstItem.querySelector('[itemprop="name"]') : null;
    const nameContent = nameEl ? nameEl.getAttribute('content') : 'no content attr';
    const nameText = nameEl ? nameEl.textContent : 'no text';
    const nameHtml = nameEl ? nameEl.outerHTML : 'no el';
    
    return { title, itemCount: items.length, nameContent, nameText, nameHtml };
  });
  
  console.log(JSON.stringify(info, null, 2));
  
  await browser.close();
})();
