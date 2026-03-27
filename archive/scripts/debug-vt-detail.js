const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://hokiesports.com/sports/swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const data = await page.evaluate(() => {
    // Find the Men's Roster section
    const allSections = document.querySelectorAll('[class*="roster-section"], [class*="section"]');
    
    // Look for h2/h3 that says "Men's Roster" then find sibling or next list
    const headers = Array.from(document.querySelectorAll('h2, h3, [class*="header"], [class*="title"]'));
    
    let menHeader = null;
    for (const h of headers) {
      if (h.textContent.trim().includes("Men's Roster")) {
        menHeader = h;
        break;
      }
    }
    
    if (!menHeader) return { error: 'No Men\'s Roster header found', headerTexts: headers.map(h => h.textContent.trim().substring(0, 30)).slice(0, 10) };
    
    // Check parent
    const parent = menHeader.parentElement;
    return {
      headerTag: menHeader.tagName,
      headerCls: menHeader.className.substring(0, 80),
      parentTag: parent ? parent.tagName : 'none',
      parentCls: parent ? parent.className.substring(0, 80) : 'none',
      parentChildCount: parent ? parent.children.length : 0,
      parentHtml: parent ? parent.innerHTML.substring(0, 500) : 'none'
    };
  });
  
  console.log(JSON.stringify(data, null, 2));
  
  await browser.close();
})();
