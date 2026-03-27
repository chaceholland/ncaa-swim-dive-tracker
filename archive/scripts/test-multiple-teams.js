const { chromium } = require('playwright');

const teams = [
  { name: 'Florida', url: 'https://floridagators.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Texas', url: 'https://texassports.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Indiana', url: 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster' },
];

async function scrapeTeam(page, team) {
  try {
    await page.goto(team.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const athletes = await page.evaluate(() => {
      const results = [];
      
      // Pattern 1: Table with gender sections
      const tables = document.querySelectorAll('.s-table');
      if (tables.length > 0) {
        tables.forEach(table => {
          const headerRow = table.querySelector('.s-table-header__row--heading');
          const gender = headerRow ? headerRow.textContent.trim().toLowerCase() : 'unknown';
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const nameCell = row.querySelector('td:first-child');
            const posCell = row.querySelector('td:nth-child(2)');
            const name = nameCell ? nameCell.textContent.trim() : '';
            if (name && name.length > 2) {
              results.push({ gender, name, pos: posCell ? posCell.textContent.trim() : '' });
            }
          });
        });
        return results;
      }
      
      // Pattern 2: Card layout
      const cards = document.querySelectorAll('.sidearm-roster-player, .s-person-card');
      if (cards.length > 0) {
        cards.forEach(card => {
          const nameEl = card.querySelector('.sidearm-roster-player-name a, .s-person-details__personal-name, h3 a');
          const posEl = card.querySelector('.sidearm-roster-player-position, [class*="position"]');
          const name = nameEl ? nameEl.textContent.trim() : '';
          if (name) results.push({ gender: 'mixed', name, pos: posEl ? posEl.textContent.trim() : '' });
        });
        return results;
      }
      
      return results;
    });
    
    const menAthletes = athletes.filter(a => {
      const g = a.gender.toLowerCase();
      if (g === 'mixed' || g === 'unknown') return true; // Men's URL so all should be men
      return g.includes('men') && !g.includes('women');
    });
    
    console.log(`${team.name}: ${menAthletes.length} men (of ${athletes.length} total)`);
    menAthletes.slice(0, 3).forEach(a => console.log(`  - ${a.name} | ${a.pos}`));
    return menAthletes;
  } catch(e) {
    console.log(`${team.name}: ERROR - ${e.message}`);
    return [];
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  for (const team of teams) {
    await scrapeTeam(page, team);
    await new Promise(r => setTimeout(r, 1500));
  }
  
  await browser.close();
})();
