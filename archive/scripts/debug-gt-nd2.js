const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Georgia Tech
  console.log('=== Georgia Tech ===');
  await page.goto('https://ramblinwreck.com/sports/c-swim/roster/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 6000));
  
  const gtAthletes = await page.evaluate(() => {
    const results = [];
    // Try .roster__list_item
    const items = document.querySelectorAll('.roster__list_item');
    items.forEach(item => {
      const nameEl = item.querySelector('.earit_player, [class*="name"], a, h3, h4');
      const name = nameEl ? nameEl.textContent.trim() : '';
      if (name && name.length > 2 && name !== 'Roster') results.push(name);
    });
    
    // Also try table rows
    if (results.length === 0) {
      const tableItems = document.querySelectorAll('.roster__table tr');
      tableItems.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
          const name = cells[0].textContent.trim();
          if (name && name.length > 2) results.push(name);
        }
      });
    }
    
    return results.slice(0, 10);
  });
  
  console.log('GT athletes found:', gtAthletes.length, gtAthletes.slice(0, 5));
  
  // Notre Dame
  console.log('\n=== Notre Dame ===');
  await page.goto('https://fightingirish.com/sports/swim/roster/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 6000));
  
  const ndAthletes = await page.evaluate(() => {
    const results = [];
    // Try .player or .roster_name
    const players = document.querySelectorAll('.player, .rosters-list > *');
    players.forEach(p => {
      const nameEl = p.querySelector('.roster_name, [class*="name"], h3, h4');
      const name = nameEl ? nameEl.textContent.trim() : '';
      if (name && name.length > 2) results.push(name);
    });
    
    // Check gender
    const genderHeaders = Array.from(document.querySelectorAll('h2, h3, .rosters__title')).map(h => h.textContent.trim().substring(0, 40)).filter(t => t.includes('Men') || t.includes('Women')).slice(0, 5);
    
    return { athletes: results.slice(0, 5), genderHeaders };
  });
  
  console.log('ND athletes:', ndAthletes);
  
  await browser.close();
})();
