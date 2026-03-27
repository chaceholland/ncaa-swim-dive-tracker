const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Virginia Tech
  console.log('=== Virginia Tech ===');
  await page.goto('https://hokiesports.com/sports/swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const vtInfo = await page.evaluate(() => {
    // Find a roster link
    const rosterLinks = document.querySelectorAll('a[href*="/roster/"]');
    const firstLink = rosterLinks[0];
    
    // Look at parent structure
    if (!firstLink) return { error: 'no roster links' };
    
    const parent1 = firstLink.closest('[class*="card"], [class*="player"], [class*="athlete"], li, article');
    return {
      linkText: firstLink.textContent.trim(),
      linkHref: firstLink.getAttribute('href'),
      parentTag: parent1 ? parent1.tagName : 'none',
      parentCls: parent1 ? parent1.className.substring(0, 80) : 'none',
      parentHtml: parent1 ? parent1.innerHTML.substring(0, 300) : 'none',
      // Check gender sections
      genderHeaders: Array.from(document.querySelectorAll('h2, h3, [class*="section-title"]')).map(h => h.textContent.trim().substring(0, 30)).filter(t => t.includes('Men') || t.includes('Women')).slice(0, 5)
    };
  });
  
  console.log(JSON.stringify(vtInfo, null, 2));
  
  // Auburn
  console.log('\n=== Auburn ===');
  await page.goto('https://auburntigers.com/sports/swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const auburnInfo = await page.evaluate(() => {
    const rosterLinks = document.querySelectorAll('a[href*="/roster/"]');
    const firstLink = rosterLinks[0];
    if (!firstLink) return { error: 'no roster links' };
    
    const parent1 = firstLink.closest('[class*="card"], [class*="player"], [class*="athlete"], li, article, [class*="person"]');
    return {
      linkText: firstLink.textContent.trim(),
      linkHref: firstLink.getAttribute('href'),
      parentTag: parent1 ? parent1.tagName : 'none',
      parentCls: parent1 ? parent1.className.substring(0, 80) : 'none',
      parentHtml: parent1 ? parent1.innerHTML.substring(0, 300) : 'none',
      genderHeaders: Array.from(document.querySelectorAll('h2, h3, [class*="section"]')).map(h => h.textContent.trim().substring(0, 30)).filter(t => t.includes('Men') || t.includes('Women') || t.includes('men') || t.includes('women')).slice(0, 5)
    };
  });
  
  console.log(JSON.stringify(auburnInfo, null, 2));
  
  await browser.close();
})();
