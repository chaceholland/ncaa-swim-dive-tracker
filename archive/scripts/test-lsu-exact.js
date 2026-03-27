const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  const result = await page.evaluate(() => {
    // Look for the roster section text content
    const rosterSection = document.querySelector('.rosters');
    if (!rosterSection) return { error: 'No .rosters found', bodyText: document.body.textContent.substring(0, 500) };
    
    // Get the full text
    const fullText = rosterSection.textContent;
    
    // Look for specific elements
    const allElems = rosterSection.querySelectorAll('*');
    const elsByClass = {};
    allElems.forEach(el => {
      const cls = el.className;
      if (typeof cls === 'string' && cls.length > 0) {
        const key = cls.split(' ')[0];
        if (!elsByClass[key]) elsByClass[key] = [];
        elsByClass[key].push(el.textContent.trim().substring(0, 50));
      }
    });
    
    return {
      rosterText: fullText.substring(0, 2000),
      classes: Object.keys(elsByClass).slice(0, 30)
    };
  });
  
  console.log('Roster text:', result.rosterText ? result.rosterText.substring(0, 1000) : 'Error: ' + result.error);
  if (result.error) console.log('Body text:', result.bodyText);
  console.log('\nClasses found:', result.classes ? result.classes.join(', ') : 'none');
  
  await browser.close();
})();
