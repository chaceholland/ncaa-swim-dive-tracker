const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://gostanford.com/sports/mens-swimming-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const athletes = await page.evaluate(() => {
    const results = [];
    
    // Stanford uses .roster-players-cards > children for cards
    const groups = document.querySelectorAll('.roster-players__group');
    groups.forEach(group => {
      const cardsDiv = group.querySelector('.roster-players-cards');
      if (!cardsDiv) return;
      
      // Each child card
      Array.from(cardsDiv.children).forEach(card => {
        // Look for name in link text
        const link = card.querySelector('a[href*="/roster/"]');
        const name = link ? link.textContent.trim() : '';
        
        // Also check img alt
        const img = card.querySelector('img');
        const imgName = img ? img.getAttribute('alt') : '';
        
        const posEl = card.querySelector('[class*="position"], [class*="event"]');
        const pos = posEl ? posEl.textContent.trim() : '';
        
        const finalName = name || imgName;
        if (finalName && finalName.length > 2) results.push({ name: finalName, pos });
      });
    });
    
    return results;
  });
  
  console.log('Stanford Men:', athletes.length);
  athletes.slice(0, 5).forEach(a => console.log(' -', a.name, '|', a.pos));
  
  await browser.close();
})();
