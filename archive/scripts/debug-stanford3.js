const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://gostanford.com/sports/mens-swimming-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const info = await page.evaluate(() => {
    const groups = document.querySelectorAll('.roster-players__group');
    const firstGroup = groups[0];
    if (!firstGroup) return { error: 'no groups' };
    
    const items = firstGroup.querySelectorAll('li, .roster-list-item');
    const firstItem = items[0];
    if (!firstItem) return { error: 'no items in group' };
    
    const title = firstGroup.querySelector('h2, h3')?.textContent.trim();
    
    // Check what's in the first li
    return {
      groups: groups.length,
      title,
      items: items.length,
      firstItemHtml: firstItem.innerHTML.substring(0, 400),
      firstItemText: firstItem.textContent.trim().substring(0, 100)
    };
  });
  
  console.log(JSON.stringify(info, null, 2));
  
  await browser.close();
})();
