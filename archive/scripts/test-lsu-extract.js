const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const athletes = await page.evaluate(() => {
    const results = [];
    
    // Found .roster-list > items
    const rosterLists = document.querySelectorAll('.roster-list');
    rosterLists.forEach(list => {
      // Check for gender section header
      const header = list.previousElementSibling;
      const sectionHeader = list.parentElement ? list.parentElement.querySelector('h2, h3, [class*="roster-section"]') : null;
      const gender = sectionHeader ? sectionHeader.textContent.trim().toLowerCase() : 'unknown';
      
      // Get athlete items
      const items = list.querySelectorAll('[class*="roster-card"], [class*="athlete-card"], li, .roster__item, .roster-item');
      items.forEach(item => {
        const nameEl = item.querySelector('[class*="name"], h3, h4, h5, a');
        const name = nameEl ? nameEl.textContent.trim() : '';
        if (name && name.length > 2 && name !== 'Full Bio') {
          results.push({ gender, name });
        }
      });
    });
    
    return results;
  });
  
  console.log('LSU athletes:', athletes.length);
  athletes.slice(0, 5).forEach(a => console.log(' -', a.name, '|', a.gender));
  
  // Also try finding by section headers
  const section = await page.evaluate(() => {
    const section = document.querySelector('.rosters, .roster-section, [class*="rosters"]');
    if (!section) return null;
    
    return {
      html: section.innerHTML.substring(0, 1000),
      children: Array.from(section.children).slice(0, 5).map(c => ({
        tag: c.tagName,
        cls: c.className.substring(0, 60),
        text: c.textContent.trim().substring(0, 50)
      }))
    };
  });
  
  if (section) {
    console.log('\nSection HTML:', section.html.substring(0, 500));
    console.log('Children:', JSON.stringify(section.children, null, 2));
  }
  
  await browser.close();
})();
