const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://gostanford.com/sports/mens-swimming-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const info = await page.evaluate(() => {
    const groups = document.querySelectorAll('.roster-players__group');
    const firstGroup = groups[0];
    
    const titleEl = firstGroup?.querySelector('h2, h3');
    const title = titleEl ? titleEl.textContent.trim() : '';
    
    // Get all children of the group
    const children = firstGroup ? Array.from(firstGroup.children) : [];
    
    return {
      groups: groups.length,
      title,
      childCount: children.length,
      children: children.map(c => ({ 
        tag: c.tagName, 
        cls: c.className.substring(0, 60),
        childCount: c.children.length
      })).slice(0, 5)
    };
  });
  
  console.log(JSON.stringify(info, null, 2));
  
  // Also look for roster links  
  const rosterLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/roster/"]');
    return Array.from(links).map(l => ({
      text: l.textContent.trim() || l.getAttribute('aria-label') || '',
      href: l.getAttribute('href')
    })).filter(l => l.text && l.text.length > 2).slice(0, 5);
  });
  
  console.log('Roster links:', rosterLinks);
  
  await browser.close();
})();
