const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://virginiasports.com/sports/swimming/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const info = await page.evaluate(() => {
    const groups = document.querySelectorAll('.roster-players__group');
    
    if (groups.length === 0) return { error: 'no groups' };
    
    const firstGroup = groups[0];
    const titleEl = firstGroup.querySelector('h2, h3, [class*="title"]');
    const title = titleEl ? titleEl.textContent.trim() : '';
    
    // Get all li items
    const items = firstGroup.querySelectorAll('li');
    const liHtml = items[0] ? items[0].innerHTML.substring(0, 400) : 'no items';
    
    return {
      groups: groups.length,
      firstTitle: title,
      liCount: items.length,
      liHtml
    };
  });
  
  console.log(JSON.stringify(info, null, 2));
  
  await browser.close();
})();
